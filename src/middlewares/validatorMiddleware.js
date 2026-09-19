// src/middlewares/validatorMiddleware.js
import { ZodError } from 'zod';

/**
 * Middleware Perimetral de Sanitización Corregido.
 * Captura de forma segura las excepciones de Zod sin quebrar el hilo de Express.
 */

export const validarEsquema = (schema) => (req, res, next) => {
  try {
    // Analiza y limpia el cuerpo de la petición HTTP contra las reglas de Zod
    schema.parse(req.body);
    return next();
  } catch (error) {
    // BLINDAJE TÉCNICO: Verificamos si la excepción fue arrojada por Zod
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "ValidationError",
        msg: "El payload JSON de entrada no cumple con las reglas estrictas de sanitización asistencial",
        // CORRECCIÓN CRÍTICA: Cambiamos 'error.errors' por 'error.issues' que es el estándar de Zod
        detalles: (error.issues || []).map(err => ({
          campo: err.path.join('.'),
          mensaje: err.message
        }))
      });
    }

    // Control de contingencia por si ocurre otra anomalía no relacionada a Zod
    console.error("❌ Excepción genérica interceptada", error.message);
    return res.status(500).json({
      error: "InternalServerError",
      msg: "Ocurrió un conflicto inesperado al sanitizar el formulario."
    });
  }
};
