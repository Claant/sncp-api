// controllers/expedienteController.js
import mongoose from "mongoose";
import * as dbConfig from "../config/db.js"; // Pool dinámico mediante getters ESM
import { expedienteSchema } from "../models/Expediente.js";
import { atencionMedicaSchema } from "../models/AtencionMedica.js";
import { pacienteSchema } from "../models/Paciente.js";
import { centroSaludSchema } from "../models/CentroSalud.js";
import { diagnosticoSchema } from "../models/Diagnostico.js";
import { bitacoraSchema } from "../models/BitacoraAcceso.js";
import { usuarioSchema } from "../models/Usuario.js";

// Auxiliar dinámico para compilar los modelos en la conexión activa sin colisionar
const getModelosProd = (connProd) => {
  const ExpedienteProd = connProd.models.Expediente || connProd.model("Expediente", expedienteSchema, "expedientes");
  const AtencionMedicaProd = connProd.models.AtencionMedica || connProd.model("AtencionMedica", atencionMedicaSchema, "atencion-medica");
  const DiagnosticoProd = connProd.models.Diagnostico || connProd.model("Diagnostico", diagnosticoSchema, "diagnosticos");
  const BitacoraAccesoProd = connProd.models.BitacoraAcceso || connProd.model("BitacoraAcceso", bitacoraSchema, "bitacora-accesos");
  const PacienteProd = connProd.models.Paciente || connProd.model("Paciente", pacienteSchema, "pacientes");
  const CentroSaludProd = connProd.models.CentroSalud || connProd.model("CentroSalud", centroSaludSchema, "centro-salud");
  const UsuarioProd = connProd.models.Usuario || connProd.model("Usuario", usuarioSchema, "usuarios");
  return { ExpedienteProd, AtencionMedicaProd, DiagnosticoProd, BitacoraAccesoProd, PacienteProd, CentroSaludProd, UsuarioProd };
};

// ====================================================================
// 1. CASO DE USO: CREAR EXPEDIENTE TRADICIONAL
// ====================================================================
export const crearExpediente = async (req, res) => {
  const { paciente_id, centro_salud_id } = req.body;
  if (!paciente_id || !centro_salud_id) {
    return res.status(400).json({ msg: "Debe indicar paciente y centro de salud." });
  }
  try {
    const connProd = dbConfig.getConnProd();
    if (!connProd) return res.status(503).json({ msg: "Base de datos desconectada." });
    const { ExpedienteProd } = getModelosProd(connProd);
    const nuevoExpediente = new ExpedienteProd({ paciente_id, centro_salud_id });
    await nuevoExpediente.save();
    return res.status(201).json({ msg: "Expediente creado exitosamente.", expediente: nuevoExpediente });
  } catch (error) {
    console.error("⚠️ Error al crear expediente:", error.message);
    return res.status(500).json({ msg: "Error interno del servidor." });
  }
};

// ====================================================================
// 2. CASO DE USO: OBTENER EXPEDIENTE LOCAL POR PACIENTE (FORMATO MONGO)
// ====================================================================
export const obtenerExpedientePorPaciente = async (req, res) => {
  const { pacienteId } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(pacienteId)) {
      return res.status(400).json({ msg: "El ID del paciente no es válido." });
    }
    const pacienteObjectId = new mongoose.Types.ObjectId(pacienteId);
    const connProd = dbConfig.getConnProd();
    if (!connProd) return res.status(503).json({ msg: "Base de datos sistema-informacion-clinica del CESFAM Emilio Schaffhauser desconectada." });
    const { ExpedienteProd, AtencionMedicaProd, DiagnosticoProd, BitacoraAccesoProd } = getModelosProd(connProd);
    
    if (!connProd.models.Paciente) connProd.model("Paciente", pacienteSchema, "pacientes");
    if (!connProd.models.CentroSalud) connProd.model("CentroSalud", centroSaludSchema, "centro-salud");
    if (!connProd.models.Usuario) connProd.model("Usuario", usuarioSchema, "usuarios");

    const expediente = await ExpedienteProd.findOne({ paciente_id: pacienteObjectId })
      .populate("paciente_id")
      .populate("centro_salud_id");

    if (!expediente) {
      return res.json({ atenciones: [], diagnosticos: [], bitacora: [] });
    }

    const atenciones = await AtencionMedicaProd.find({ paciente_id: pacienteObjectId })
      .populate("usuario_id", "nombre centro_salud_id");
    const diagnosticos = await DiagnosticoProd.find({
      atencion_id: { $in: atenciones.map(a => a._id) }
    });
    const bitacora = await BitacoraAccesoProd.find({ paciente_id: pacienteObjectId })
      .populate("usuario_id", "nombre rol")
      .populate("atencion_id", "motivo_consulta fecha");

    return res.json({ expediente, atenciones, diagnosticos, bitacora });
  } catch (error) {
    console.error("⚠️ Error al obtener expediente local:", error.message);
    return res.status(500).json({ msg: "Error interno del servidor al procesar el historial." });
  }
};

// ====================================================================
// 3. CASO DE USO: AGREGAR ATENCIÓN MÉDICA TRADICIONAL
// ====================================================================
export const agregarAtencion = async (req, res) => {
  const { expedienteId } = req.params;
  const { fecha, motivo, diagnostico_id } = req.body;
  if (!fecha || !motivo) {
    return res.status(400).json({ msg: "Debe indicar fecha y motivo de la atención." });
  }
  try {
    const connProd = dbConfig.getConnProd();
    if (!connProd) return res.status(503).json({ msg: "Base de datos sistema-informacion-clinica del CESFAM Emilio Schaffhauser desconectada." });
    const { ExpedienteProd, AtencionMedicaProd } = getModelosProd(connProd);
    const expediente = await ExpedienteProd.findById(expedienteId);
    if (!expediente) {
      return res.status(404).json({ msg: "Expediente no encontrado." });
    }
    const nuevaAtencion = new AtencionMedicaProd({
      paciente_id: expediente.paciente_id,
      fecha,
      motivo_consulta: motivo,
      diagnostico_id: diagnostico_id || null,
    });
    await nuevaAtencion.save();
    expediente.atenciones.push(new mongoose.Types.ObjectId(nuevaAtencion._id));
    if (diagnostico_id) {
      expediente.diagnosticos.push(new mongoose.Types.ObjectId(diagnostico_id));
    }
    await expediente.save();
    return res.status(201).json({
      msg: "Atención agregó al expediente.",
      atencion: nuevaAtencion,
      expediente,
    });
  } catch (error) {
    console.error("⚠️ Error al agregar atención:", error.message);
    return res.status(500).json({ msg: "Error interno del servidor." });
  }
};
// ====================================================================
// 4. CASO DE USO: OBTENER EXPEDIENTE HÍBRIDO CON SALIDA FORMAL HL7 FHIR
// ====================================================================
export const obtenerExpedienteFHIR = async (req, res) => {
  try {
    const { pacienteId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(pacienteId)) {
      return res.status(400).json({ msg: "El ID del paciente no es válido." });
    }
    const pacienteObjectId = new mongoose.Types.ObjectId(pacienteId);
    const connProd = dbConfig.getConnProd();
    const connDemo = dbConfig.getConnDemo();

    if (!connProd) return res.status(503).json({ msg: "Base de datos sistema-informacion-clinica del CESFAM Emilio Schaffhauser desconectada." });
    const { ExpedienteProd } = getModelosProd(connProd);

    if (!connProd.models.Paciente) connProd.model("Paciente", pacienteSchema, "pacientes");
    if (!connProd.models.CentroSalud) connProd.model("CentroSalud", centroSaludSchema, "centro-salud");
    if (!connProd.models.AtencionMedica) connProd.model("AtencionMedica", atencionMedicaSchema, "atencion-medica");
    if (!connProd.models.Diagnostico) connProd.model("Diagnostico", diagnosticoSchema, "diagnosticos");

    // A. Intentar resolver el expediente en el nodo Local
    let expedienteRaw = await ExpedienteProd.findOne({ paciente_id: pacienteObjectId })
      .populate("paciente_id")
      .populate("atenciones")
      .populate("diagnosticos");

    // B. Conmutación en caliente al clúster remoto DEMO si falta información local
    if (!expedienteRaw || !expedienteRaw.atenciones || expedienteRaw.atenciones.length === 0) {
      if (!connDemo) {
        return res.status(500).json({ error: "Base de datos sistema-informacion-clinica-demo no disponible para conexión." });
      }

      const ExpedienteDemo = connDemo.models.Expediente || connDemo.model("Expediente", expedienteSchema, "expedientes");
      if (!connDemo.models.Paciente) connDemo.model("Paciente", pacienteSchema, "pacientes");
      if (!connDemo.models.CentroSalud) connDemo.model("CentroSalud", centroSaludSchema, "centro-salud");
      if (!connDemo.models.AtencionMedica) connDemo.model("AtencionMedica", atencionMedicaSchema, "atencion-medica");
      if (!connDemo.models.Diagnostico) connDemo.model("Diagnostico", diagnosticoSchema, "diagnosticos");

      expedienteRaw = await ExpedienteDemo.findOne({ paciente_id: pacienteObjectId })
        .populate({ path: "paciente_id", model: connDemo.models.Paciente })
        .populate({ path: "atenciones", model: connDemo.models.AtencionMedica })
        .populate({ path: "diagnosticos", model: connDemo.models.Diagnostico });
    }

    if (!expedienteRaw) {
      return res.status(404).json({ error: "El paciente no registra fichas clínicas en ningun centro médico externo" });
    }

    // ====================================================================
    // SERIALIZACIÓN DE INTEROPERABILIDAD: MONGO JSON ➡️ HL7 FHIR BUNDLE
    // ====================================================================
    const fhirBundle = {
      resourceType: "Bundle",
      type: "collection",
      id: `bundle-expediente-${expedienteRaw._id}`,
      timestamp: new Date().toISOString(),
      entry: []
    };

    if (expedienteRaw.paciente_id) {
      fhirBundle.entry.push({
        fullUrl: `urn:uuid:${expedienteRaw.paciente_id._id}`,
        resource: {
          resourceType: "Patient",
          id: expedienteRaw.paciente_id._id.toString(),
          identifier: [{ use: "official", system: "https://registrocivil.cl", value: expedienteRaw.paciente_id.rut }],
          name: [{ use: "official", text: expedienteRaw.paciente_id.nombre }],
          birthDate: expedienteRaw.paciente_id.fecha_nacimiento 
            ? new Date(expedienteRaw.paciente_id.fecha_nacimiento).toISOString().split('T')[0] 
            : undefined
        }
      });
    }

    const atenciones = expedienteRaw.atenciones || [];
    atenciones.forEach((atn) => {
      fhirBundle.entry.push({
        fullUrl: `urn:uuid:${atn._id}`,
        resource: {
          resourceType: "Encounter",
          id: atn._id.toString(),
          status: "finished",
          class: { system: "http://hl7.org", code: "AMB", display: "ambulatory" },
          subject: { reference: `Patient/${expedienteRaw.paciente_id?._id}` },
          period: { start: atn.fecha || atn.createdAt },
          reasonCode: [{ text: atn.motivo_consulta }]
        }
      });
    });

    const diagnosticos = expedienteRaw.diagnosticos || [];
    diagnosticos.forEach((diag) => {
      fhirBundle.entry.push({
        fullUrl: `urn:uuid:${diag._id}`,
        resource: {
          resourceType: "Condition",
          id: diag._id.toString(),
          clinicalStatus: { coding: [{ system: "http://hl7.org", code: "active" }] },
          code: {
            coding: [{ system: "http://hl7.org", code: diag.codigo_enfermedad || "N39.0", display: diag.descripcion }]
          },
          subject: { reference: `Patient/${expedienteRaw.paciente_id?._id}` }
        }
      });
    });

    return res.status(200).json(fhirBundle);
  } catch (error) {
    console.error("⚠️ Error crítico en la plataforma traductora FHIR:", error.message);
    return res.status(500).json({ error: "InternalServerError", detalle: error.message });
  }
};

// ====================================================================
// 5. CASO DE USO REESTRUCTURADO: IMPORTAR BUNDLE FHIR E INYECTAR EN PRODUCTION (ACID)
// ====================================================================
export const crearAtencionFichaNueva = async (req, res) => {
  const fhirBundle = req.body;
  if (!fhirBundle || !fhirBundle.entry) {
    return res.status(400).json({ msg: "No se proporcionó un paquete de datos clínico válido para importar." });
  }
  const connProd = dbConfig.getConnProd();
  if (!connProd) return res.status(503).json({ msg: "Base de datos de sistema-informacion-clinica del CESFAM Emilio Schaffhauser no disponible." });

  const session = await connProd.startSession();
  session.startTransaction();
  try {
    const { PacienteProd, ExpedienteProd, AtencionMedicaProd, DiagnosticoProd, UsuarioProd } = getModelosProd(connProd);
    
    // 🚀 EXTRACCIÓN DEL ESTÁNDAR: Localizamos el recurso demográfico "Patient" en el Bundle
    const entradaPatient = fhirBundle.entry.find(e => e.resource && e.resource.resourceType === "Patient");
    if (!entradaPatient) {
      throw new Error("El Bundle FHIR no contiene el recurso obligatorio de tipo 'Patient'.");
    }

    const patientResource = entradaPatient.resource;
    
    // Extraemos las llaves estandarizadas de salud internacional
    const rutFHIR = patientResource.identifier?.[0]?.value;
    const nombreFHIR = patientResource.name?.[0]?.text || "Paciente Importado";
    const fechaNacimientoFHIR = patientResource.birthDate || "1990-01-01";

    if (!rutFHIR) {
      throw new Error("El recurso Patient de FHIR no posee un identificador de RUT nacional válido.");
    }

    // Buscamos si el paciente ya existe de forma local
    let pacienteExisting = await PacienteProd.findOne({ rut: rutFHIR }).session(session);
    
    if (!pacienteExisting) {
      // Si no existe, lo damos de alta vinculándolo a IDs de infraestructura base
      pacienteExisting = new PacienteProd({
        rut: rutFHIR,
        nombre: nombreFHIR,
        fecha_nacimiento: new Date(fechaNacimientoFHIR),
        centro_salud_id: new mongoose.Types.ObjectId("64b2f1a8e4b0c23a88f12345"), 
        direccion_id: new mongoose.Types.ObjectId("64b2f1a8e4b0c23a88f54321")
      });
      await pacienteExisting.save({ session });
    }

    let expedienteLocal = await ExpedienteProd.findOne({ paciente_id: pacienteExisting._id }).session(session);
    if (!expedienteLocal) {
      expedienteLocal = new ExpedienteProd({
        paciente_id: pacienteExisting._id,
        centro_salud_id: pacienteExisting.centro_salud_id,
        atenciones: [],
        diagnosticos: []
      });
      await expedienteLocal.save({ session });
    }
    const medicoAcreditado = await UsuarioProd.findOne({ rol: "medico" }).session(session);
    const idMedicoFirmante = req.user?.id || req.user?._id || req.usuario?.id || req.usuario?._id || medicoAcreditado?._id || new mongoose.Types.ObjectId();

    // 🚀 SEPARACIÓN SEMÁNTICA: Filtramos los recursos Encounter y Condition del Bundle recibido
    const encuentrosFHIR = fhirBundle.entry.filter(e => e.resource && e.resource.resourceType === "Encounter");
    const condicionesFHIR = fhirBundle.entry.filter(e => e.resource && e.resource.resourceType === "Condition");

    // Iteramos de forma segura las consultas y anexamos sus registros relacionales locales
    for (const enc of encuentrosFHIR) {
      const nuevaAtencionLocal = new AtencionMedicaProd({
        paciente_id: pacienteExisting._id,
        usuario_id: idMedicoFirmante,
        fecha: enc.resource.period?.start || new Date(),
        motivo_consulta: enc.resource.reasonCode?.[0]?.text || "Consulta de urgencia importada por Interoperabilidad FHIR",
      });
      await nuevaAtencionLocal.save({ session });
      expedienteLocal.atenciones.push(nuevaAtencionLocal._id);

      // Buscamos la condición (diagnóstico) CIE-10 correlativa a este encuentro asistencial
      const condAsociada = condicionesFHIR.find(c => 
        c.resource.encounter?.reference === `Encounter/${enc.resource.id}` || 
        c.resource.subject?.reference === `Patient/${patientResource.id}`
      );
      
      const nuevoDiagnosticoLocal = new DiagnosticoProd({
        atencion_id: nuevaAtencionLocal._id,
        paciente_id: pacienteExisting._id,
        codigo_enfermedad: condAsociada?.resource.code?.coding?.[0]?.code || "N39.0",
        descripcion: condAsociada?.resource.code?.coding?.[0]?.display || "Diagnóstico de historial remoto sincronizado"
      });
      await nuevoDiagnosticoLocal.save({ session });
      expedienteLocal.diagnosticos.push(nuevoDiagnosticoLocal._id);
    }

    // Salvamos los índices consolidados en el expediente local
    await expedienteLocal.save({ session });
    await session.commitTransaction();
    session.endSession();
    
    return res.status(200).json({
      msg: "Historial clínico interoperado e integrado de forma exitosa en este establecimiento asistencial.",
      paciente_id: pacienteExisting._id,
      expediente_id: expedienteLocal._id
    });

  } catch (error) {
    if (session.inTransaction()) {
        await session.abortTransaction();
    }
    session.endSession();
    console.error("⚠️ Fallo transaccional en la inyección de la plataforma FHIR:", error.message);
    return res.status(500).json({ 
      msg: "Error transaccional en la plataforma al persistir el expediente.", 
      detalle: error.message 
    });
  }
};
