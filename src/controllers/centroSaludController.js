// controllers/centroSaludController.js
import mongoose from "mongoose";
import * as dbConfig from "../config/db.js"; // CORRECCIÓN: Cambiado para usar el getter dinámico de ESM
import { centroSaludSchema } from "../models/CentroSalud.js"; // Importación del esquema puro

// ====================================================================
// Caso de Uso: Registrar un nuevo establecimiento (Solo Administrador)
// ====================================================================
export const crearCentroSalud = async (req, res) => {
  const { nombre_centro, tipo_prestador } = req.body;

  if (!nombre_centro || !tipo_prestador) {
    return res
      .status(400)
      .json({
        msg: "Por favor, complete todos los campos obligatorios del establecimiento.",
      });
  }

  try {
    // CORRECCIÓN: Extraemos el pool de conexiones en caliente usando el getter ESM
    const connProd = dbConfig.getConnProd();

    if (!connProd) {
      console.error(
        "⚠️ Error: El pool de conexiones de la base de datos connProd (sistema-informacion-clinica) no está inicializado en centroSaludController.",
      );
      return res
        .status(503)
        .json({ msg: "Base de datos sistema-informacion-clinica desconectada temporalmente." });
    }

    // Enlazar dinámicamente el modelo de creación al pool activo de producción
    const CentroSaludProd =
      connProd.models.CentroSalud ||
      connProd.model("CentroSalud", centroSaludSchema, "centro-salud");

    // Instanciamos el nuevo documento amarrado de forma estricta a la conexión real de Atlas
    const nuevoCentro = new CentroSaludProd({
      nombre_centro: nombre_centro.trim(),
      tipo_prestador,
    });

    // El guardado se ejecutará en milisegundos sin colapsar en el buffer
    await nuevoCentro.save();

    return res.status(201).json({
      msg: "Establecimiento asistencial dado de alta exitosamente",
      centro: nuevoCentro,
    });
  } catch (error) {
    console.error("⚠️ Error al dar de alta al crear centro de salud:", error.stack);
    return res
      .status(500)
      .json({
        msg: "Error interno del servidor al registrar la infraestructura.",
      });
  }
};

// ====================================================================
// Caso de Uso: Obtener el catálogo completo de establecimientos
// ====================================================================
export const obtenerCentrosSalud = async (req, res) => {
  try {
    // CORRECCIÓN: Extraemos el pool de conexiones en caliente usando el getter ESM
    const connProd = dbConfig.getConnProd();

    if (!connProd) {
      console.error(
        "⚠️ Error: El pool de conexiones connProd (sistema-informacion-clinica) no está inicializado en centroSaludController.",
      );
      return res
        .status(503)
        .json({ msg: "Base de datos desconectada temporalmente." });
    }

    // Enlazar de forma estricta el modelo de lectura al pool activo
    const CentroSaludProd =
      connProd.models.CentroSalud ||
      connProd.model("CentroSalud", centroSaludSchema, "centro-salud");

    // La consulta se resuelve instantáneamente directo sobre el clúster productivo
    const centros = await CentroSaludProd.find()
      .sort({ nombre_centro: 1 })
      .lean();
    return res.json(centros);
  } catch (error) {
    console.error("⚠️ Error al obtener centros de salud:", error.message);
    return res
      .status(500)
      .json({ msg: "Error al cargar la información del centro de salud." });
  }
};
