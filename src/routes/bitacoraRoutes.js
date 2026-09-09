import express from 'express';
import { registrarAcceso } from '../controllers/bitacoraController.js';
import { verificarToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// ====================================================================
//  ENDPOINT DE AUDITORÍA FORENSE CENTRALIZADO E IDEMPOTENTE
// ====================================================================
// Fiel a tu arquitectura, forzamos la validación del token antes de registrar
router.post('/registrar', verificarToken, registrarAcceso);

export default router;
