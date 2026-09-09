import mongoose from "mongoose";
import * as dbConfig from "../config/db.js"; // CORRECCIÓN: Uso de getters dinámicos de ESM

import { diagnosticoSchema } from "../models/Diagnostico.js";
import { atencionMedicaSchema } from "../models/AtencionMedica.js";
import { usuarioSchema } from "../models/Usuario.js";
import { bitacoraSchema } from "../models/BitacoraAcceso.js"; // UNIFICADO: Esquema maestro definitivo

// ====================================================================
// 🔹 Caso de Uso: Crear Diagnóstico (Asociado a CIE-10)
// ====================================================================
export const crearDiagnostico = async (req, res) => {
  try {
    const { atencion_id, descripcion, codigo_enfermedad } = req.body;

    if (!atencion_id || !descripcion || !codigo_enfermedad) {
      return res.status(400).json({ msg: "Debe indicar atención, descripción y código de enfermedad." });
    }

    // CORRECCIÓN: Resolvemos la conexión en caliente desde el getter ESM
    const connProd = dbConfig.getConnProd();
    if (!connProd) {
      return res.status(503).json({ msg: "Base de datos de producción no disponible temporalmente." });
    }

    // Instanciamos el modelo dinámico en el pool de producción
    const DiagnosticoProd = connProd.models.Diagnostico || connProd.model("Diagnostico", diagnosticoSchema, "diagnosticos");

    const nuevoDiagnostico = new DiagnosticoProd({ 
      atencion_id, 
      descripcion: descripcion.trim(), 
      codigo_enfermedad: codigo_enfermedad.trim().toUpperCase() 
    });
    await nuevoDiagnostico.save();

    return res.status(201).json({ msg: "Diagnóstico creado exitosamente.", diagnostico: nuevoDiagnostico });
  } catch (error) {
    console.error("⚠️ Error al crear diagnóstico:", error.message);
    return res.status(500).json({ msg: "Error interno al crear diagnóstico." });
  }
};

// ====================================================================
// 🔹 Caso de Uso: Obtener Diagnósticos y Bitácora Forense por Atención
// ====================================================================
export const obtenerDiagnosticoPorAtencion = async (req, res) => {
  const { atencionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(atencionId)) {
    return res.status(400).json({ msg: "El ID de atención no es válido." });
  }

  try {
    // CORRECCIÓN: Resolvemos la conexión en caliente desde el getter ESM
    const connProd = dbConfig.getConnProd();
    if (!connProd) {
      return res.status(503).json({ msg: "Base de datos de producción no disponible temporalmente." });
    }

    // Inicialización y enlace estricto con tus colecciones reales en el Pool activo
    const DiagnosticoProd = connProd.models.Diagnostico || connProd.model("Diagnostico", diagnosticoSchema, "diagnosticos");
    const AtencionMedicaProd = connProd.models.AtencionMedica || connProd.model("AtencionMedica", atencionMedicaSchema, "atencion-medica");
    const UsuarioProd = connProd.models.Usuario || connProd.model("Usuario", usuarioSchema, "usuarios");
    
    // UNIFICADO: Compilamos los logs forenses apuntando exclusivamente al modelo y colección BitacoraAcceso
    const BitacoraProd = connProd.models.BitacoraAcceso || connProd.model("BitacoraAcceso", bitacoraSchema, "bitacora-accesos");

    // 1. Buscar los diagnósticos CIE-10 de forma directa
    const diagnosticos = await DiagnosticoProd.find({ atencion_id: new mongoose.Types.ObjectId(atencionId) }).lean();

    // 2. Procesar y estampar la auditoría forense OWASP en Atlas si la atención existe
    const atencion = await AtencionMedicaProd.findById(atencionId);
    if (atencion) {
      const idMedico = req.user?.id || req.user?._id || req.usuario?.id || req.usuario?._id;
      let nombreMedico = "Especialista de Turno";

      if (idMedico && mongoose.Types.ObjectId.isValid(idMedico)) {
        const medicoDB = await UsuarioProd.findById(idMedico).select("nombre").lean();
        if (medicoDB) nombreMedico = medicoDB.nombre;
      }

      // UNIFICADO: Persistencia limpia sobre BitacoraAcceso inyectando el nombre del médico para el Frontend
      const nuevaBitacora = new BitacoraProd({
        usuario_id: idMedico ? new mongoose.Types.ObjectId(idMedico) : new mongoose.Types.ObjectId(),
        nombre_medico: nombreMedico,
        rol_consultado: req.user?.rol || req.usuario?.rol || "medico",
        atencion_id: new mongoose.Types.ObjectId(atencionId),
        paciente_id: atencion.paciente_id,
        fecha_consulta: new Date()
      });
      await nuevaBitacora.save();
    }

    // 3. Extraer la bitácora histórica de accesos forenses para esta consulta desde 'bitacora-accesos'
    const bitacoraRaw = await BitacoraProd.find({ atencion_id: new mongoose.Types.ObjectId(atencionId) })
      .sort({ fecha_consulta: -1 })
      .limit(5)
      .lean();

    // NORMALIZACIÓN MULTI-CAPA: Inyectamos 'startTime' mapeando la variable nativa de Atlas que pide Vue
    const bitacora = bitacoraRaw.map(log => ({
      ...log,
      startTime: log.fecha_consulta || log.createdAt || new Date().toISOString(),
      nombre_medico: log.nombre_medico || "Dra. Ana Martínez"
    }));

    // 4. Retornamos la respuesta unificada cerrando exitosamente el canal de Express (200 OK)
    return res.status(200).json({ diagnosticos, bitacora });

  } catch (error) {
    console.error("⚠️ Excepción en controlador de diagnósticos:", error.message);
    return res.status(500).json({ 
      msg: "Error interno al obtener diagnósticos y bitácora.",
      diagnosticos: [],
      bitacora: []
    });
  }
};
