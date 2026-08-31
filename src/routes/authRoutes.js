import express from 'express';
import rateLimit from 'express-rate-limit'; 
import { login } from '../controllers/authController.js';

const router = express.Router();

// ====================================================================
// CONFIGURACIÓN DEL MITIGADOR DE FUERZA BRUTA (RATE LIMITER)
// ====================================================================
const loginLimiter = rateLimit({
  windowMs: 3 * 60 * 1000, // Ventana de tiempo de 3 minutos bloqueado
  max: 5, // Bloquea la IP tras 5 intentos fallidos consecutivos
  message: { 
    msg: "Demasiados intentos de inicio de sesión fallidos. Por seguridad su IP ha sido bloqueada temporalmente por 3 minutos." 
  },
  standardHeaders: true, 
  legacyHeaders: false, 
});

// Endpoint para el inicio de sesión (CU-001)
// Se inyecta el limitador perimetral antes de procesar el controlador de login
router.post('/login', loginLimiter, login);

export default router;
