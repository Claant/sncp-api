import express from 'express';
import { crearCentroSalud, obtenerCentrosSalud } from '../controllers/centroSaludController.js';
import { verificarToken } from '../midlewares/authMidleware.js';
import { permitirRoles } from '../midlewares/rolMidleware.js';

const router = express.Router();

// RESTRICCIÓN: Solo el rol 'administrador' puede dar de alta infraestructura de salud en el sistema
router.post('/', verificarToken, permitirRoles('administrador'), crearCentroSalud);

// ACCESO GENERAL: Tanto médicos como administradores necesitan listar los centros para asociar perfiles
router.get('/', verificarToken, permitirRoles('administrador', 'medico'), obtenerCentrosSalud);

export default router;
