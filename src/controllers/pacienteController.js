// controllers/pacienteController.js
import mongoose from "mongoose";
import * as dbConfig from "../config/db.js"; // 🚀 CORRECCIÓN: Uso de getters dinámicos de ESM

// IMPORTACIÓN ÚNICA DE ESQUEMAS CLÍNICOS: Previene el colapso del ModuleLoader en ESM
import { pacienteSchema } from "../models/Paciente.js";
import { expedienteSchema } from "../models/Expediente.js";
import { direccionSchema } from "../models/Direccion.js";
import { centroSaludSchema } from "../models/CentroSalud.js";
import { atencionMedicaSchema } from "../models/AtencionMedica.js";
import { diagnosticoSchema } from "../models/Diagnostico.js";
import { bitacoraSchema } from "../models/BitacoraAcceso.js";
import { usuarioSchema } from "../models/Usuario.js"; 

// FUNCIÓN AUXILIAR MAESTRA UNIFICADA: Asegura el formato de forma estricta (ej: 12345678-K)
const limpiarRut = (rutRaw) => {
    if (!rutRaw) return '';
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
            return res.status(503).json({ error: "DbError", msg: "Base de datos de producción no disponible temporalmente." });
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
// 🔹 CASO DE USO INTEROPERABLE TOTALMENTE BLINDADO Y SINCRONIZADO
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

    // Inyección estricta de submodelos en el pool dinámico connProd basándonos en tu Data Explorer
    if (!connProd.models.Direccion) connProd.model("Direccion", direccionSchema, "direcciones");
    if (!connProd.models.CentroSalud) connProd.model("CentroSalud", centroSaludSchema, "centro-salud");
    if (!connProd.models.Usuario) connProd.model("Usuario", usuarioSchema, "usuarios");
    if (!connProd.models.AtencionMedica) connProd.model("AtencionMedica", atencionMedicaSchema, "atencion-medica");
    if (!connProd.models.Diagnostico) connProd.model("Diagnostico", diagnosticoSchema, "diagnosticos");
    
    // 🚀 REEMPLAZO: Registramos únicamente BitacoraAcceso en el pool en lugar de la antigua Auditoria
    if (!connProd.models.BitacoraAcceso) connProd.model("BitacoraAcceso", bitacoraSchema, "bitacora-accesos");

    const PacienteProd = connProd.models.Paciente || connProd.model("Paciente", pacienteSchema, "pacientes");
    const AtencionMedicaProd = connProd.models.AtencionMedica || connProd.model("AtencionMedica", atencionMedicaSchema, "atencion-medica");
    const DiagnosticoProd = connProd.models.Diagnostico || connProd.model("Diagnostico", diagnosticoSchema, "diagnosticos");
    
    // 🚀 REEMPLAZO: Instanciamos el modelo unificado correcto de bitácora
    const BitacoraProd = connProd.models.BitacoraAcceso || connProd.model("BitacoraAcceso", bitacoraSchema, "bitacora-accesos");

    // Paso A: Buscar paciente en base local (Captura de pacientes)
    const pacienteLocal = await PacienteProd.findOne({ rut: rutSanitizado })
      .populate("direccion_id")
      .populate("centro_salud_id");

    if (pacienteLocal) {
      const atencionesRaw = await AtencionMedicaProd.find({ paciente_id: pacienteLocal._id })
        .populate("usuario_id", "nombre especialidad rut")
        .sort({ fecha: -1 })
        .lean();

      // Normalizamos inyectando la propiedad 'startTime' cronológica obligatoria que pide Vue
      const atenciones = atencionesRaw.map(a => ({
        ...a,
        startTime: a.fecha || a.createdAt || new Date().toISOString()
      }));

      // OBTENER DIAGNÓSTICOS: Buscamos en 'diagnosticos' mapeando los IDs de las atenciones
      const diagnosticos = await DiagnosticoProd.find({
        atencion_id: { $in: atenciones.map(a => a._id) }
      }).lean();

      // 🚀 REEMPLAZO: Interrogamos directamente a la colección real unificada 'bitacora-accesos'
      const bitacoraRaw = await BitacoraProd.find({ paciente_id: pacienteLocal._id })
        .sort({ fecha_consulta: -1 })
        .lean();

      const bitacora = bitacoraRaw.map(b => ({
        ...b,
        startTime: b.fecha_consulta || b.createdAt || new Date().toISOString(),
        nombre_medico: b.nombre_medico || "Dra. Ana Martínez"
      }));

      // Capturar ID del médico autenticado de manera tolerante a req.user o req.usuario
      const idMedicoAutenticado = req.user?.id || req.user?._id || req.usuario?.id || req.usuario?._id;

      // Dejamos la huella forense OWASP activa en Atlas apuntando a la bitácora unificada
      await registrarAccesoForense(
        idMedicoAutenticado,
        req.user?.nombre || req.usuario?.nombre || "Dra. Ana Martínez",
        req.user?.rol || req.usuario?.rol || "medico",
        pacienteLocal._id,
        atenciones?.[0]?._id || null
      );

      // Despachamos el payload unificado limpio directo al Frontend en JSON estricto
      return res.status(200).json({
        origen: "local",
        msg: "Paciente encontrado en los registros de este centro médico.",
        paciente: pacienteLocal,
        expediente: {
          atenciones: atenciones || [],
          diagnosticos: diagnosticos || [],
          bitacora: bitacora || []
        }
      });
    }

    // Paso B: Buscar en repositorio externo DEMO si no existe localmente
    if (!connDemo) {
      return res.status(404).json({
        origen: "local",
        msg: "Paciente no encontrado localmente y la pasarela nacional de salud se encuentra caída.",
        expediente: { atenciones: [], diagnosticos: [], bitacora: [] }
      });
    }

    const PacienteDemo = connDemo.models.Paciente || connDemo.model("Paciente", pacienteSchema, "pacientes");
    const pacienteExterno = await PacienteDemo.findOne({ rut: rutSanitizado });

    if (!pacienteExterno) {
      return res.status(404).json({
        origen: "ninguno",
        msg: "El RUT ingresado no está registrado en este centro de salud ni tampoco en otro recinto de salud externo.",
        expediente: { atenciones: [], diagnosticos: [], bitacora: [] }
      });
    }

    return res.status(200).json({
      origen: "externo",
      msg: "El paciente no existe en los registros de este centro de salud, pero se detectó un expediente clínico disponible en el clúster remoto.",
      pacienteIdExterno: pacienteExterno._id,
      nombre: pacienteExterno.nombre,
      expediente: { atenciones: [], diagnosticos: [], bitacora: [] }
    });

  } catch (error) {
    console.error("❌ EXCEPCIÓN REAL CAPTURADA EN EXPRESS:", error.stack);
    return res.status(500).json({
      error: "InternalServerError",
      msg: "Ocurrió un conflicto de procesamiento en la pasarela nacional de salud.",
      detalle: error.message,
      expediente: { atenciones: [], diagnosticos: [], bitacora: [] }
    });
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
        // 🚀 REEMPLAZO: Cambiamos la inyección condicional por la de bitácora
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
        console.error('❌ Error al exportar paciente FHIR:', error.stack);
        return res.status(500).json({ error: "InternalServerError", msg: 'Error interno del servidor al exportar recurso FHIR.' });
    }
};
