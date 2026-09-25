// controllers/pacienteController.js
import mongoose from "mongoose";
import * as dbConfig from "../config/db.js";
import { construirFHIRBundle } from "../utils/fhirMapper.js";
import { fusionarAtencionesExternas } from '../utils/syncHelper.js'; // 👈 Importamos la función de syncHelper.js

/**
 * Limpia y empaqueta el RUT agregando el guion antes del dígito verificador (DV)
 * Ejemplo: "12.345.678k" -> "12345678-K"
 */
export const limpiarRut = (rutRaw) => {
  if (!rutRaw || typeof rutRaw !== 'string') return '';
  
  let limpio = rutRaw.replace(/[^0-9kK]/g, '').toUpperCase();
  if (limpio.length < 2) return limpio;
  
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return `${cuerpo}-${dv}`; 
};

// FUNCIÓN AUXILIAR DE INTEROPERABILIDAD: Mapper de Paciente local a Recurso HL7 FHIR
const mapPacienteToFHIR = (paciente) => {
  return {
    resourceType: "Patient",
    identifier: [{ system: "http://sncp.cl", value: paciente.rut }],
    name: [{ given: [paciente.nombre] }],
    birthDate: paciente.fecha_nacimiento,
    address: paciente.direccion_id ? [{
      line: [paciente.direccion_id.calle],
      city: paciente.direccion_id.ciudad,
      country: "Chile"
    }] : [],
    managingOrganization: paciente.centro_salud_id ? {
      reference: `Organization/${paciente.centro_salud_id._id}`,
      display: paciente.centro_salud_id.nombre_centro 
    } : null
  };
};

const registrarAccesoForense = async (usuarioId, nombreMedico, rolConsultado, pacienteId, atencionId = null) => {
  try {
    const connProd = dbConfig.getConnProd();
    if (!connProd) throw new Error("Pool connProd no listo para auditoría.");

    const BitacoraProd = connProd.model('BitacoraAcceso');

    await BitacoraProd.create({
      usuario_id: usuarioId || new mongoose.Types.ObjectId(),
      nombre_medico: nombreMedico || 'Médico No Identificado',
      rol_consultado: rolConsultado || 'MEDICO',
      atencion_id: atencionId, 
      paciente_id: pacienteId,
      fecha_consulta: new Date()
    });
    console.log('🔒 Log de auditoría OWASP unificado registrado en Atlas.');
  } catch (error) {
    console.error('Error en bitácora unificada:', error.message);
  }
};

// ====================================================================
// CONTROLADOR DE SINCRONIZACIÓN ASISTIDA (Invocado por la API REST)
// POST /api/pacientes/sincronizar-atenciones
// ====================================================================
export const sincronizarAtenciones = async (req, res) => {
  try {
    const { paciente_id, atencionesExternas } = req.body;
    const idMedicoAutenticado = req.usuario?._id || req.user?._id;

    if (!paciente_id || !Array.isArray(atencionesExternas) || atencionesExternas.length === 0) {
      return res.status(400).json({
        ok: false,
        msg: "Se requiere el ID del paciente y la lista de atenciones externas."
      });
    }

    // Invocamos la función importada desde syncHelper.js
    const totalSincronizadas = await fusionarAtencionesExternas(
      paciente_id,
      atencionesExternas,
      idMedicoAutenticado
    );

    return res.status(200).json({
      ok: true,
      msg: `Se integraron ${totalSincronizadas} atención(es) al expediente local.`,
      sincronizadas: totalSincronizadas
    });

  } catch (error) {
    console.error("❌ Error en sincronización asistida:", error.message);
    return res.status(500).json({
      ok: false,
      msg: `Error interno al ejecutar la fusión: ${error.message}`
    });
  }
};

// Caso de Uso: Registrar un nuevo paciente (CU-002 / Registro)
// POST /api/pacientes
export const crearPaciente = async (req, res) => {
  const { rut, nombre, fecha_nacimiento, direccion_id, centro_salud_id } = req.body;

  if (!rut || !nombre || !fecha_nacimiento || !direccion_id || !centro_salud_id) {
    return res.status(400).json({ msg: 'Por favor, complete todos los campos obligatorios del paciente.' });
  }

  try {
    const connProd = dbConfig.getConnProd();
    if (!connProd) {
      return res.status(503).json({ error: "DbError", msg: "Base de datos sistema-informacion-clinica no disponible temporalmente." });
    }

    const PacienteProd = connProd.model("Paciente");

    const rutSanitizado = limpiarRut(rut);
    const pacienteExiste = await PacienteProd.findOne({ rut: rutSanitizado }).lean();
    if (pacienteExiste) {
      return res.status(400).json({ msg: 'El RUT de este paciente ya se encuentra registrado.' });
    }

    const nuevoPaciente = new PacienteProd({
      rut: rutSanitizado,
      nombre,
      fecha_nacimiento,
      direccion_id,
      centro_salud_id
    });

    await nuevoPaciente.save();
    return res.status(201).json({ msg: 'Paciente registrado exitosamente.', paciente: nuevoPaciente });

  } catch (error) {
    console.error('Error al registrar paciente:', error.stack);
    return res.status(500).json({ error: "InternalServerError", msg: 'Error interno del servidor al registrar paciente.' });
  }
};

// ====================================================================
// Caso de Uso Interoperable: Obtener Paciente por RUT
// GET /api/pacientes/:rut
// ====================================================================
export const obtenerPacientePorRut = async (req, res) => {
  const { rut } = req.params;
  try {
    const connProd = dbConfig.getConnProd();
    const connDemo = dbConfig.getConnDemo();
    if (!connProd) {
      return res.status(503).json({ error: "DbError", msg: "Base de datos no inicializada para búsquedas clínicas." });
    }
    const rutSanitizado = limpiarRut(rut);

    const PacienteProd = connProd.model("Paciente");
    const AtencionMedicaProd = connProd.model("AtencionMedica");
    const DiagnosticoProd = connProd.model("Diagnostico");

    // ----------------------------------------------------------------
    // NODO A: CONSULTAR BASE DE DATOS LOCAL
    // ----------------------------------------------------------------
    const pacienteLocal = await PacienteProd.findOne({ rut: rutSanitizado })
      .populate("direccion_id")
      .populate("centro_salud_id")
      .lean();

    if (pacienteLocal) {
      let atencionesNuevasExternasCount = 0;
      let atencionesRemotasParaFusion = [];

      if (connDemo) {
        const PacienteDemo = connDemo.model("Paciente");
        const AtencionMedicaDemo = connDemo.model("AtencionMedica");
        const DiagnosticoDemo = connDemo.model("Diagnostico");

        const pacienteExterno = await PacienteDemo.findOne({ rut: rutSanitizado }).lean();
        if (pacienteExterno) {
          const atencionesExt = await AtencionMedicaDemo.find({ paciente_id: pacienteExterno._id }).lean();
          const diagnosticosExt = await DiagnosticoDemo.find({ atencion_id: { $in: atencionesExt.map(a => a._id) } }).lean();

          // Cargar fechas locales para verificar si hay novedades sin guardar
          const atencionesLocalesDB = await AtencionMedicaProd.find({ paciente_id: pacienteLocal._id }).select("fecha").lean();
          const fechasSet = new Set(atencionesLocalesDB.map(a => new Date(a.fecha).getTime()));

          atencionesRemotasParaFusion = atencionesExt.filter(a => !fechasSet.has(new Date(a.fecha).getTime())).map(aten => ({
            ...aten,
            diagnostico: diagnosticosExt.find(d => d.atencion_id.toString() === aten._id.toString())
          }));

          atencionesNuevasExternasCount = atencionesRemotasParaFusion.length;
        }
      }

      // Cargar atenciones locales actuales
      const atencionesLocales = await AtencionMedicaProd.find({ paciente_id: pacienteLocal._id })
        .populate("usuario_id", "nombre especialidad rut")
        .sort({ fecha: -1 })
        .lean();

      const diagnosticosLocales = await DiagnosticoProd.find({
        atencion_id: { $in: atencionesLocales.map(a => a._id) }
      }).lean();

      const fhirBundleLocal = construirFHIRBundle(pacienteLocal, atencionesLocales, diagnosticosLocales);

      return res.status(200).json({
        origen: atencionesNuevasExternasCount > 0 ? "local_con_pendientes" : "local",
        msg: atencionesNuevasExternasCount > 0 
          ? `Se hallaron ${atencionesNuevasExternasCount} atenciones clínicas nuevas en el centro externo.`
          : "Paciente local cargado.",
        atencionesPendientes: atencionesRemotasParaFusion,
        fhirBundle: fhirBundleLocal
      });
    }

    // ----------------------------------------------------------------
    // NODO B: CONMUTACIÓN AL CLÚSTER REMOTO EXTERNO (DEMO ATLAS)
    // ----------------------------------------------------------------
    if (!connDemo) {
      return res.status(404).json({
        origen: "local",
        msg: "Paciente no encontrado en base local y repositorio externo fuera de línea.",
        fhirBundle: null
      });
    }

    const PacienteDemo = connDemo.model("Paciente");
    const AtencionMedicaDemo = connDemo.model("AtencionMedica");
    const DiagnosticoDemo = connDemo.model("Diagnostico");

    const pacienteExterno = await PacienteDemo.findOne({ rut: rutSanitizado }).lean();

    if (!pacienteExterno) {
      return res.status(404).json({
        origen: "ninguno",
        msg: "El RUT ingresado no mantiene registros en este CESFAM ni en la red externa.",
        fhirBundle: null
      });
    }

    const atencionesExternas = await AtencionMedicaDemo.find({ paciente_id: pacienteExterno._id }).sort({ fecha: -1 }).lean();
    const diagnosticosExternas = await DiagnosticoDemo.find({ atencion_id: { $in: atencionesExternas.map(a => a._id) } }).lean();

    const fhirBundleExterno = construirFHIRBundle(pacienteExterno, atencionesExternas, diagnosticosExternas);

    return res.status(200).json({
      origen: "externo",
      msg: "Ficha clínica externa desde la base de datos sistema-informacion-clinica-demo, transformada con éxito al estándar HL7 FHIR.",
      fhirBundle: fhirBundleExterno
    });

  } catch (error) {
    console.error("❌ EXCEPCIÓN REAL CAPTURADA EN LA PLATAFORMA DE PACIENTES FHIR:", error.stack);
    return res.status(500).json({ error: "InternalServerError", msg: "Conflicto de procesamiento interoperable." });
  }
};

// ====================================================================
// Caso de Uso: Exportar Paciente en formato FHIR/JSON
// GET /api/pacientes/:rut/fhir
// ====================================================================
export const obtenerPacienteFHIR = async (req, res) => {
  try {
    const connProd = dbConfig.getConnProd();
    if (!connProd) {
      return res.status(503).json({ error: "DbError", msg: "Base de datos fuera de línea." });
    }

    const PacienteProd = connProd.model("Paciente");
    
    const rutSanitizado = limpiarRut(req.params.rut);
    const paciente = await PacienteProd.findOne({ rut: rutSanitizado })
      .populate('direccion_id')
      .populate('centro_salud_id')
      .lean();

    if (!paciente) {
      return res.status(404).json({ msg: 'Paciente no encontrado.' });
    }

    const idMedicoAutenticado = req.user?.id || req.usuario?.id || req.user?._id || null;
    await registrarAccesoForense(
      idMedicoAutenticado, 
      req.user?.nombre || req.usuario?.nombre, 
      req.user?.rol || req.usuario?.rol, 
      paciente._id
    );

    return res.json(mapPacienteToFHIR(paciente));
  } catch (error) {
    console.error('⚠️ Error al exportar paciente FHIR:', error.stack);
    return res.status(500).json({ error: "InternalServerError", msg: 'Error interno del servidor al exportar recurso FHIR.' });
  }
};