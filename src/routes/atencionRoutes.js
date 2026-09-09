import express from 'express';
import { 
    crearAtencion, 
    obtenerHistorialPaciente, 
    crearAtencionFichaNueva
} from '../controllers/atencionController.js';

// CORRECCIÓN ESTRICTA DE ENLACE ESM: Usamos la exportación nombrada con llaves { }
import { verificarToken } from '../middlewares/authMiddleware.js'; 
import { permitirRoles } from '../middlewares/rolMiddleware.js';

const router = express.Router();

// ====================================================================
// 1. RUTAS ESTÁTICAS / EXACTAS (DEBEN IR ARRIBA)
// ====================================================================

// Caso de Uso: Registrar la ficha nueva completa de alta rápida (4 formularios integrados en 1 transacción)
router.post('/completa', verificarToken, permitirRoles('medico'), crearAtencionFichaNueva);

// Caso de Uso: Registro de consulta clínica tradicional con su diagnóstico para pacientes recurrentes
router.post('/', verificarToken, permitirRoles('medico'), crearAtencion);

// ====================================================================
// 2. RUTAS DINÁMICAS CON PARÁMETROS VARIABLES (DEBEN IR AL FINAL)
// ====================================================================

// PRIVACIDAD ESTRICTA: Consulta del historial clínico cronológico de un paciente pasando su ID dinámico
router.get('/paciente/:pacienteId', verificarToken, permitirRoles('medico'), obtenerHistorialPaciente);

export default router;
