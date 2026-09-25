// controllers/centroSaludController.js
import * as dbConfig from "../config/db.js";

// ====================================================================
// Caso de Uso: Registrar un nuevo establecimiento (Solo Administrador)
// ====================================================================
export const crearCentroSalud = async (req, res) => {
  const { nombre_centro, tipo_prestador } = req.body;

  if (!nombre_centro || !tipo_prestador) {
    return res.status(400).json({
      msg: "Por favor, complete todos los campos obligatorios del establecimiento.",
    });
  }

  try {
    const connProd = dbConfig.getConnProd();

    if (!connProd) {
      console.error(
        "⚠️ Error: El pool de conexiones connProd no está inicializado en centroSaludController."
      );
      return res.status(503).json({
        msg: "Base de datos sistema-informacion-clinica desconectada temporalmente.",
      });
    }

    // OBTENCIÓN DIRECTA DEL MODELO PRECOMPILADO EN db.js (PUNTO 2)
    const CentroSaludProd = connProd.model("CentroSalud");

    const nuevoCentro = new CentroSaludProd({
      nombre_centro: nombre_centro.trim(),
      tipo_prestador,
    });

    await nuevoCentro.save();

    return res.status(201).json({
      msg: "Establecimiento asistencial dado de alta exitosamente",
      centro: nuevoCentro,
    });
  } catch (error) {
    console.error("⚠️ Error al dar de alta al crear centro de salud:", error.stack);
    return res.status(500).json({
      msg: "Error interno del servidor al registrar la infraestructura.",
    });
  }
};

// ====================================================================
// Caso de Uso: Obtener el catálogo completo de establecimientos
// ====================================================================
export const obtenerCentrosSalud = async (req, res) => {
  try {
    const connProd = dbConfig.getConnProd();

    if (!connProd) {
      console.error(
        "⚠️ Error: El pool de conexiones connProd no está inicializado en centroSaludController."
      );
      return res.status(503).json({ msg: "Base de datos desconectada temporalmente." });
    }

    // OBTENCIÓN DIRECTA DEL MODELO PRECOMPILADO EN db.js (PUNTO 2)
    const CentroSaludProd = connProd.model("CentroSalud");

    // LECTURA OPTIMIZADA CON .LEAN() (PUNTO 3)
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