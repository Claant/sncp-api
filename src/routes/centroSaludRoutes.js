import express from 'express';
import { crearCentroSalud, obtenerCentrosSalud } from '../controllers/centroSaludController.js';

// 🔹 CORRECCIÓN ESTRICTA DE ENLACE ESM: Cambiado de checkAuth a { verificarToken }
import { verificarToken } from '../middlewares/authMiddleware.js';
import { permitirRoles } from '../middlewares/rolMiddleware.js';

const router = express.Router();

// ====================================================================
// 🛡️ RUTAS ASISTENCIALES Y ADMINISTRATIVAS PROTEGIDAS
// ====================================================================

// RESTRICCIÓN: Solo el rol 'administrador' puede dar de alta infraestructura de salud en el sistema
router.post('/', verificarToken, permitirRoles('administrador'), crearCentroSalud);

// ACCESO GENERAL: Tanto médicos como administradores necesitan listar los centros para asociar perfiles
router.get('/', verificarToken, permitirRoles('administrador', 'medico'), obtenerCentrosSalud);

export default router;

