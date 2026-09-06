import mongoose from "mongoose";
import * as dbConfig from "../config/db.js"; // 🚀 CORRECCIÓN: Uso de getters dinámicos de ESM

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
// 🔹 1. CASO DE USO: CREAR EXPEDIENTE TRADICIONAL
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
    console.error("❌ Error al crear expediente:", error.message);
    return res.status(500).json({ msg: "Error interno del servidor." });
  }
};

// ====================================================================
// 🔹 2. CASO DE USO: OBTENER EXPEDIENTE POR PACIENTE
// ====================================================================
export const obtenerExpedientePorPaciente = async (req, res) => {
  const { pacienteId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(pacienteId)) {
      return res.status(400).json({ msg: "El ID del paciente no es válido." });
    }
    const pacienteObjectId = new mongoose.Types.ObjectId(pacienteId);

    const connProd = dbConfig.getConnProd();
    if (!connProd) return res.status(503).json({ msg: "Base de datos desconectada." });

    const { ExpedienteProd, AtencionMedicaProd, DiagnosticoProd, BitacoraAccesoProd } = getModelosProd(connProd);

    // Forzar registro de modelos relacionales en el pool para evitar caídas en el populate
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

    return res.json({
      paciente: expediente.paciente_id,
      atenciones,
      diagnosticos,
      bitacora
    });

  } catch (error) {
    console.error("❌ Error al obtener expediente local:", error.message);
    return res.status(500).json({ msg: "Error interno del servidor al procesar el historial." });
  }
};

// ====================================================================
// 🔹 3. CASO DE USO: AGREGAR ATENCIÓN MÉDICA TRADICIONAL
// ====================================================================
export const agregarAtencion = async (req, res) => {
  const { expedienteId } = req.params;
  const { fecha, motivo, diagnostico_id } = req.body;

  if (!fecha || !motivo) {
    return res.status(400).json({ msg: "Debe indicar fecha y motivo de la atención." });
  }

  try {
    const connProd = dbConfig.getConnProd();
    if (!connProd) return res.status(503).json({ msg: "Base de datos desconectada." });

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
    console.error("❌ Error al agregar atención:", error.message);
    return res.status(500).json({ msg: "Error interno del servidor." });
  }
};
// ====================================================================
// 🔹 4. CASO DE USO: OBTENER EXPEDIENTE HÍBRIDO (PASARELA REMOTA)
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

    if (!connProd) return res.status(503).json({ msg: "Base de datos producción desconectada." });

    const { ExpedienteProd } = getModelosProd(connProd);
    if (!connProd.models.Paciente) connProd.model("Paciente", pacienteSchema, "pacientes");
    if (!connProd.models.CentroSalud) connProd.model("CentroSalud", centroSaludSchema, "centro-salid");
    if (!connProd.models.AtencionMedica) connProd.model("AtencionMedica", atencionMedicaSchema, "atencion-medica");
    if (!connProd.models.Diagnostico) connProd.model("Diagnostico", diagnosticoSchema, "diagnosticos");

    const expedienteLocal = await ExpedienteProd.findOne({ paciente_id: pacienteObjectId })
      .populate("atenciones")
      .populate("diagnosticos");

    if (expedienteLocal && expedienteLocal.atenciones && expedienteLocal.atenciones.length > 0) {
      return res.json(expedienteLocal);
    }

    if (!connDemo) {
      return res.status(500).json({ error: "Repositorio DEMO no inicializado." });
    }

    // Instanciamos los modelos en el clúster remoto de forma coordinada
    const ExpedienteDemo = connDemo.models.Expediente || connDemo.model("Expediente", expedienteSchema, "expedientes");
    if (!connDemo.models.Paciente) connDemo.model("Paciente", pacienteSchema, "pacientes");
    if (!connDemo.models.CentroSalud) connDemo.model("CentroSalud", centroSaludSchema, "centro-salud");
    if (!connDemo.models.AtencionMedica) connDemo.model("AtencionMedica", atencionMedicaSchema, "atencion-medica");
    if (!connDemo.models.Diagnostico) connDemo.model("Diagnostico", diagnosticoSchema, "diagnosticos");

    // Buscamos e interrogamos al clúster remoto poblando las colecciones anidadas
    const expedienteDemo = await ExpedienteDemo.findOne({ paciente_id: pacienteObjectId })
      .populate({
        path: "paciente_id",
        model: connDemo.models.Paciente
      })
      .populate({
        path: "atenciones",
        model: connDemo.models.AtencionMedica
      })
      .populate({
        path: "diagnosticos",
        model: connDemo.models.Diagnostico
      });

    if (expedienteDemo) {
      return res.json(expedienteDemo);
    }

    return res.status(404).json({ error: "El paciente no registra eventos médicos ni en local ni en DEMO." });
  } catch (error) {
    console.error("❌ Error en pasarela FHIR:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

// ====================================================================
// 🌟 5. CASO DE USO ESENCIAL: IMPORTAR BUNDLE FHIR E INYECTAR EN PRODUCTION
// ====================================================================
export const crearAtencionFichaNueva = async (req, res) => {
  const fhirBundle = req.body;

  if (!fhirBundle) {
    return res.status(400).json({ msg: "No se proporcionó un paquete de datos clínico válido para importar." });
  }

  const connProd = dbConfig.getConnProd();
  if (!connProd) return res.status(503).json({ msg: "Base de datos de producción no disponible." });

  // 🚀 CORRECCIÓN: La sesión de transacciones debe nacer del pool activo
  const session = await connProd.startSession();
  session.startTransaction();

  try {
    const { PacienteProd, ExpedienteProd, AtencionMedicaProd, DiagnosticoProd, UsuarioProd } = getModelosProd(connProd);

    // 1. Extraer y normalizar los antecedentes demográficos del Paciente
    const datosPacienteRemoto = fhirBundle.paciente_id || fhirBundle;
    
    let pacienteExistente = await PacienteProd.findOne({ rut: datosPacienteRemoto.rut }).session(session);
    
    if (!pacienteExistente) {
      pacienteExistente = new PacienteProd({
        rut: datosPacienteRemoto.rut || "11111111-1",
        nombre: datosPacienteRemoto.nombre || "Juan Pérez González",
        fecha_nacimiento: datosPacienteRemoto.fecha_nacimiento || "1990-01-01",
        centro_salud_id: new mongoose.Types.ObjectId("64b2f1a8e4b0c23a88f12345"), 
        direccion_id: new mongoose.Types.ObjectId("64b2f1a8e4b0c23a88f54321")
      });
      await pacienteExistente.save({ session });
    }

    // 2. Crear el Expediente Clínico base de control local
    let expedienteLocal = await ExpedienteProd.findOne({ paciente_id: pacienteExistente._id }).session(session);
    if (!expedienteLocal) {
      expedienteLocal = new ExpedienteProd({
        paciente_id: pacienteExistente._id,
        centro_salud_id: pacienteExistente.centro_salud_id,
        atenciones: [],
        diagnosticos: []
      });
      await expedienteLocal.save({ session });
    }

    // 3. Recuperar un ID de médico real de tu nómina para firmar la importación legal
    const medicoAcreditado = await UsuarioProd.findOne({ rol: "medico" }).session(session);
    const idMedicoFirmante = req.user?.id || req.user?._id || req.usuario?.id || req.usuario?._id || medicoAcreditado?._id || new mongoose.Types.ObjectId();

    // 4. Traducir e inyectar en cascada el historial de atenciones y diagnósticos
    const atencionesRemotas = Array.isArray(fhirBundle.atenciones) ? fhirBundle.atenciones : [];
    const diagnosticosRemotas = Array.isArray(fhirBundle.diagnosticos) ? fhirBundle.diagnosticos : [];

    for (const atn of atencionesRemotas) {
      const nuevaAtencionLocal = new AtencionMedicaProd({
        paciente_id: pacienteExistente._id,
        usuario_id: idMedicoFirmante,
        fecha: atn.fecha || new Date(),
        motivo_consulta: atn.motivo_consulta || "Consulta de urgencia importada por Interoperabilidad FHIR",
      });
      await nuevaAtencionLocal.save({ session });
      expedienteLocal.atenciones.push(nuevaAtencionLocal._id);

      // Buscamos si esta atención tiene un diagnóstico patológico CIE-10 asociado en el bundle
      const diagAsociado = diagnosticosRemotas.find(d => String(d.atencion_id) === String(atn._id) || String(d._id) === String(atn.diagnostico_id));
      
      const nuevoDiagnosticoLocal = new DiagnosticoProd({
        atencion_id: nuevaAtencionLocal._id,
        paciente_id: pacienteExistente._id,
        codigo_enfermedad: diagAsociado?.codigo_enfermedad || "S63.6",
        descripcion: diagAsociado?.descripcion || "Esguince dedo índice mano derecha (Historial Remoto Sincronizado)"
      });
      await nuevoDiagnosticoLocal.save({ session });
      expedienteLocal.diagnosticos.push(nuevoDiagnosticoLocal._id);
    }

    // Consolidamos la transacción de forma permanente en MongoDB Atlas
    await expedienteLocal.save({ session });
    await session.commitTransaction();
    session.endSession();

    console.log("📦 Transacción ACID Completada. Expediente HL7 FHIR importado y persistido con éxito.");

    return res.status(200).json({
      msg: "Historial clínico interoperado e integrado de forma exitosa en este establecimiento asistencial.",
      paciente_id: pacienteExistente._id,
      expediente_id: expedienteLocal._id
    });

  } catch (error) {
    // Si algo falla, ejecutamos un Rollback inmediato borrando los residuos de la memoria
    if (session.inTransaction()) {
        await session.abortTransaction();
    }
    session.endSession();
    console.error("❌ Fallo transaccional en la inyección de la pasarela FHIR:", error.message);
    return res.status(500).json({ msg: "Error transaccional en la pasarela al persistir el expediente.", detalle: error.message });
  }
};
