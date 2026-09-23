// controllers/pacienteController.js
import mongoose from "mongoose";
import * as dbConfig from "../config/db.js"; // CORRECCIÓN: Uso de getters dinámicos de ESM

// IMPORTACIÓN ÚNICA DE ESQUEMAS CLÍNICOS: Previene el colapso del ModuleLoader en ESM
import { pacienteSchema } from "../models/Paciente.js";
import { expedienteSchema } from "../models/Expediente.js";
import { direccionSchema } from "../models/Direccion.js";
import { centroSaludSchema } from "../models/CentroSalud.js";
import { atencionMedicaSchema } from "../models/AtencionMedica.js";
import { diagnosticoSchema } from "../models/Diagnostico.js";
import { bitacoraSchema } from "../models/BitacoraAcceso.js";
import { usuarioSchema } from "../models/Usuario.js"; 
import { construirFHIRBundle } from "../utils/fhirMapper.js"; // Función de interoperabilidad HL7 FHIR

/**
 * Limpia y empaqueta el RUT agregando el guion antes del dígito verificador (DV)
 * Ejemplo: "12.345.678k" -> "12345678-K"
 */
export const limpiarRut = (rutRaw) => {
  if (!rutRaw || typeof rutRaw !== 'string') return '';
  
  // Extrae únicamente números y la letra K (mayúscula o minúscula)
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

        const BitacoraProd = connProd.models.BitacoraAcceso || connProd.model('BitacoraAcceso', bitacoraSchema, 'bitacora-accesos');

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
            return res.status(503).json({ error: "DbError", msg: "Base de datos sistema-informacion-clinica del CESFAM Emilio Schaffhauser no disponible temporalmente." });
        }

        const PacienteProd = connProd.models.Paciente || connProd.model("Paciente", pacienteSchema, "pacientes");

        const rutSanitizado = limpiarRut(rut);
        const pacienteExiste = await PacienteProd.findOne({ rut: rutSanitizado });
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
// Caso de Uso Interoperable: Obtener Paciente por RUT (Conversión Híbrida local + externa)
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

    // Enlace estricto de esquemas en el Pool de Producción Local
    if (!connProd.models.Direccion) connProd.model("Direccion", direccionSchema, "direcciones");
    if (!connProd.models.CentroSalud) connProd.model("CentroSalud", centroSaludSchema, "centro-salud");
    if (!connProd.models.Usuario) connProd.model("Usuario", usuarioSchema, "usuarios");
    if (!connProd.models.AtencionMedica) connProd.model("AtencionMedica", atencionMedicaSchema, "atencion-medica");
    if (!connProd.models.Diagnostico) connProd.model("Diagnostico", diagnosticoSchema, "diagnosticos");
    if (!connProd.models.BitacoraAcceso) connProd.model("BitacoraAcceso", bitacoraSchema, "bitacora-accesos");

    const PacienteProd = connProd.models.Paciente || connProd.model("Paciente", pacienteSchema, "pacientes");
    const AtencionMedicaProd = connProd.models.AtencionMedica || connProd.model("AtencionMedica", atencionMedicaSchema, "atencion-medica");
    const DiagnosticoProd = connProd.models.Diagnostico || connProd.model("Diagnostico", diagnosticoSchema, "diagnosticos");

    // ----------------------------------------------------------------
    // NODO A: CONSULTAR BASE DE DATOS LOCAL
    // ----------------------------------------------------------------
    const pacienteLocal = await PacienteProd.findOne({ rut: rutSanitizado })
      .populate("direccion_id")
      .populate("centro_salud_id");

    if (pacienteLocal) {
      const atencionesLocales = await AtencionMedicaProd.find({ paciente_id: pacienteLocal._id })
        .populate("usuario_id", "nombre especialidad rut")
        .sort({ fecha: -1 })
        .lean();

      const diagnosticosLocales = await DiagnosticoProd.find({
        atencion_id: { $in: atencionesLocales.map(a => a._id) }
      }).lean();

      // Cripto-auditoría forense centralizada OWASP
      const idMedicoAutenticado = req.user?.id || req.user?._id || req.usuario?.id || req.usuario?._id;
      if (idMedicoAutenticado) {
        await registrarAccesoForense(idMedicoAutenticado, req.user?.nombre || req.usuario?.nombre, req.user?.rol || req.usuario?.rol, pacienteLocal._id);
      }

      // 🔥 ¡CONVERSIÓN LOCAL A FHIR BUNDLE!
      const fhirBundleLocal = construirFHIRBundle(pacienteLocal, atencionesLocales, diagnosticosLocales);

      return res.status(200).json({
        origen: "local",
        msg: "Paciente local transformado exitosamente al estándar internacional HL7 FHIR.",
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

    const PacienteDemo = connDemo.models.Paciente || connDemo.model("Paciente", pacienteSchema, "pacientes");
    if (!connDemo.models.AtencionMedica) connDemo.model("AtencionMedica", atencionMedicaSchema, "atencion-medica");
    if (!connDemo.models.Diagnostico) connDemo.model("Diagnostico", diagnosticoSchema, "diagnosticos");

    const AtencionMedicaDemo = connDemo.models.AtencionMedica;
    const DiagnosticoDemo = connDemo.models.Diagnostico;

    const pacienteExterno = await PacienteDemo.findOne({ rut: rutSanitizado });

    if (!pacienteExterno) {
      return res.status(404).json({
        origen: "ninguno",
        msg: "El RUT ingresado no mantiene registros en este CESFAM",
        fhirBundle: null
      });
    }

    // Extraer historial del clúster remoto demo
    const atencionesExternas = await AtencionMedicaDemo.find({ paciente_id: pacienteExterno._id }).sort({ fecha: -1 }).lean();
    const diagnosticosExternas = await DiagnosticoDemo.find({ atencion_id: { $in: atencionesExternas.map(a => a._id) } }).lean();

    // 🔥 ¡CONVERSIÓN REMOTA A FHIR BUNDLE!
    const fhirBundleExterno = construirFHIRBundle(pacienteExterno, atencionesExternas, diagnosticosExternas);

    return res.status(200).json({
      origen: "externo",
      msg: "Ficha clínica externa desde la base de datos sistema-informacion-clinica-demo, transformado con exito al estándar HL7 FHIR.",
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

        if (!connProd.models.Direccion) connProd.model("Direccion", direccionSchema, "direcciones");
        if (!connProd.models.CentroSalud) connProd.model("CentroSalud", centroSaludSchema, "centro-salud");
        if (!connProd.models.Usuario) connProd.model("Usuario", usuarioSchema, "usuarios");
        // REEMPLAZO: Cambiamos la inyección condicional por la de bitácora
        if (!connProd.models.BitacoraAcceso) connProd.model("BitacoraAcceso", bitacoraSchema, "bitacora-accesos");
        
        const PacienteProd = connProd.models.Paciente || connProd.model("Paciente", pacienteSchema, "pacientes");
        
        const rutSanitizado = limpiarRut(req.params.rut);
        const paciente = await PacienteProd.findOne({ rut: rutSanitizado })
            .populate('direccion_id')
            .populate('centro_salud_id');

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
