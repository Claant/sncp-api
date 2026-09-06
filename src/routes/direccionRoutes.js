import express from 'express';
import { crearDireccion, obtenerDireccionPorId } from '../controllers/direccionController.js';
import { verificarToken } from '../middlewares/authMiddleware.js';
import { permitirRoles } from '../middlewares/rolMiddleware.js';

const router = express.Router();

// Rutas protegidas: Tanto médicos como administradores manipulan direcciones
router.post('/', verificarToken, permitirRoles('medico'), crearDireccion);
router.get('/:id', verificarToken, permitirRoles('medico'), obtenerDireccionPorId);

export default router;
