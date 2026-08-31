import express from 'express';
const router = express.Router();
import { crearPaciente, obtenerPacientePorRut } from '../controllers/pacienteController.js';
import { verificarToken } from '../midlewares/authMidleware.js';
import { permitirRoles } from '../midlewares/rolMidleware.js';

// Rutas protegidas para el módulo de pacientes
router.post('/', verificarToken, permitirRoles('administrador', 'medico'), crearPaciente);
router.get('/:rut', verificarToken, permitirRoles('administrador', 'medico'), obtenerPacientePorRut);

export default router;
