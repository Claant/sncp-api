import mongoose from "mongoose";
import * as dbConfig from "../config/db.js";
import { bitacoraSchema } from "../models/BitacoraAcceso.js";
import { usuarioSchema } from "../models/Usuario.js";

// ====================================================================
// 🔒 CASO DE USO: REGISTRAR ACCESO FLUIDO E IDEMPOTENTE (OWASP / DEIS)
// ====================================================================
export const registrarAcceso = async (req, res) => {
  const { paciente_id, atencion_id } = req.body;

  // 1. Validación de Frontera (Campos requeridos)
  if (!paciente_id) {
    return res.status(400).json({ 
      msg: "El identificador del paciente (paciente_id) es obligatorio para la auditoría." 
    });
  }

  try {
    // 2. Extracción dinámica del pool de conexiones en caliente
    const connProd = dbConfig.getConnProd();
    if (!connProd) {
      return res.status(503).json({ 
        msg: "Base de datos de producción no disponible para operaciones forenses." 
      });
    }

    // Enlace estricto de esquemas al pool activo de producción
    const BitacoraProd = connProd.models.BitacoraAcceso || connProd.model("BitacoraAcceso", bitacoraSchema, "bitacora-accesos");
    const UsuarioProd = connProd.models.Usuario || connProd.model("Usuario", usuarioSchema, "usuarios");

    // 3. Extracción Segura de Identidad (Blindaje contra suplantación)
    // Extraemos el ID directamente desde el token inyectado por el middleware, nunca desde el req.body
    const idMedicoAutenticado = req.user?.id || req.user?._id || req.usuario?.id || req.usuario?._id;
    if (!idMedicoAutenticado) {
      return res.status(401).json({ 
        msg: "Acceso denegado. No se pudo verificar la firma criptográfica del operador legal." 
      });
    }

    // 4. MECANISMO DE CONTROL DE IDEMPOTENCIA POR VENTANA TEMPORAL
    // Definimos un umbral de 60 segundos hacia atrás para atrapar ráfagas duplicadas del frontend
    const sesentaSegundosAtras = new Date(Date.now() - 60 * 1000);
    
    const filtroUnicidad = {
      paciente_id: new mongoose.Types.ObjectId(paciente_id),
      usuario_id: new mongoose.Types.ObjectId(idMedicoAutenticado),
      fecha_consulta: { $gte: sesentaSegundosAtras } // Evalúa solo logs en el último minuto
    };

    // Manejo estricto de atencion_id para evitar colisiones con el valor 'null' en MongoDB
    if (atencion_id && mongoose.Types.ObjectId.isValid(atencion_id)) {
      filtroUnicidad.atencion_id = new mongoose.Types.ObjectId(atencion_id);
    } else {
      filtroUnicidad.atencion_id = null; // Búsqueda de acceso a la ficha demográfica general
    }

    // Interceptar duplicados en ráfaga concurrente
    const accesoExistente = await BitacoraProd.findOne(filtroUnicidad).lean();
    if (accesoExistente) {
      console.log(`⚠️ Registro duplicado interceptado de forma segura en Atlas para el médico: ${idMedicoAutenticado}`);
      return res.status(200).json({ 
        msg: "Acceso omitido. Operación de lectura idéntica ya auditada en la ventana temporal activa." 
      });
    }

    // 5. Resolución Analítica de Datos del Profesional (Para poblar el frontend)
    let nombreMedico = req.user?.nombre || req.usuario?.nombre || "Especialista de Turno";
    const medicoDB = await UsuarioProd.findById(idMedicoAutenticado).select("nombre").lean();
    if (medicoDB) {
      nombreMedico = medicoDB.nombre;
    }

    // 6. Persistencia Inmutable Final
    const nuevoLogAcceso = new BitacoraProd({
      paciente_id: new mongoose.Types.ObjectId(paciente_id),
      usuario_id: new mongoose.Types.ObjectId(idMedicoAutenticado),
      atencion_id: atencion_id && mongoose.Types.ObjectId.isValid(atencion_id) ? new mongoose.Types.ObjectId(atencion_id) : null,
      nombre_medico: nombreMedico,
      rol_consultado: req.user?.rol || req.usuario?.rol || "medico",
      fecha_consulta: new Date()
    });

    await nuevoLogAcceso.save();

    return res.status(201).json({ 
      msg: "Acceso clínico auditado e inyectado con éxito en la bitácora nacional.", 
      acceso: nuevoLogAcceso 
    });

  } catch (error) {
    console.error("❌ Excepción crítica en bitacoraController:", error.stack);
    return res.status(500).json({ 
      error: "InternalServerError",
      msg: "Error interno del servidor al procesar la huella de auditoría forense." 
    });
  }
};
