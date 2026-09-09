import express from 'express';
import { crearDiagnostico, obtenerDiagnosticoPorAtencion } from '../controllers/diagnosticoController.js';


// Corrección estricta de middleware: usamos verificarToken y permitirRoles
import { verificarToken } from '../middlewares/authMiddleware.js';
import { permitirRoles } from '../middlewares/rolMiddleware.js';

const router = express.Router();

// Privacidad máxima: Solo el rol médico gestiona diagnósticos de salud
router.post('/', verificarToken, permitirRoles('medico'), crearDiagnostico);
router.get('/atencion/:atencionId', verificarToken, permitirRoles('medico'), obtenerDiagnosticoPorAtencion);

export default router;
