import express from 'express';
import { crearDiagnostico, obtenerDiagnosticoPorAtencion } from '../controllers/diagnosticoController.js';
import { verificarToken } from '../midlewares/authMidleware.js';
import { permitirRoles } from '../midlewares/rolMidleware.js';

const router = express.Router();

// PRIVACIDAD MÁXIMA: Solo el rol médico gestiona diagnósticos de salud
router.post('/', verificarToken, permitirRoles('medico'), crearDiagnostico);
router.get('/atencion/:atencionId', verificarToken, permitirRoles('medico'), obtenerDiagnosticoPorAtencion);

export default router;
