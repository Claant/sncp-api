import express from 'express';
import { 
    crearAtencion, 
    obtenerHistorialPaciente, 
    crearAtencionFichaNueva
} from '../controllers/atencionController.js';

// COMPROBACIÓN EXHAUSTIVA: Se mapea con una sola "d" en 'midlewares' y en el nombre del archivo
// Si tu servidor arroja un error "Cannot find module", verifica si tus archivos físicos terminan en 'Middleware.js' (con doble d)
import { verificarToken } from '../midlewares/authMidleware.js';
import { permitirRoles } from '../midlewares/rolMidleware.js';

const router = express.Router();

// ====================================================================
// 1. RUTAS ESTÁTICAS / EXACTAS (DEBEN IR ARRIBA DE TODO)
// ====================================================================

// Caso de Uso: Registrar la ficha nueva completa de alta rápida (4 formularios integrados en 1 sola petición POST)
// Consumido desde Vue.js mediante: authStore.fetchSeguro('/atenciones/completa')
router.post('/completa', verificarToken, permitirRoles('medico'), crearAtencionFichaNueva);

// Caso de Uso: Registro de consulta clínica tradicional con su diagnóstico para pacientes recurrentes (POST raíz)
// Consumido desde Vue.js mediante: authStore.fetchSeguro('/atenciones')
router.post('/', verificarToken, permitirRoles('medico'), crearAtencion);

// ====================================================================
// 2. RUTAS DINÁMICAS CON PARÁMETROS VARIABLES (DEBEN IR AL FINAL)
// ====================================================================

// PRIVACIDAD ESTRICTA: Consulta del historial clínico cronológico de un paciente pasando su ID dinámico de MongoDB
// Consumido desde Vue.js mediante: authStore.fetchSeguro(`/atenciones/paciente/${pacienteId}`)
router.get('/paciente/:pacienteId', verificarToken, permitirRoles('medico'), obtenerHistorialPaciente);

export default router;
