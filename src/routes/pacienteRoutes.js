import express from 'express';
import { crearPaciente, obtenerPacientePorRut, sincronizarAtenciones } from '../controllers/pacienteController.js';

// CORRECCIÓN ESTRICTA DE ENLACE ESM: Cambiado de checkAuth a { verificarToken }
import { verificarToken } from '../middlewares/authMiddleware.js';
import { permitirRoles } from '../middlewares/rolMiddleware.js';

const router = express.Router();

// Rutas protegidas para el módulo de pacientes
router.post('/', verificarToken, permitirRoles('administrador', 'medico'), crearPaciente);
router.get('/:rut', verificarToken, permitirRoles('administrador', 'medico'), obtenerPacientePorRut);
// 📍 2. ESTA ES LA RUTA QUE FALTABA
router.post('/sincronizar-atenciones', verificarToken, permitirRoles('medico'), sincronizarAtenciones);

export default router;
