import express from 'express';
import rateLimit from 'express-rate-limit'; 
import { login } from '../controllers/authController.js';

const router = express.Router();

// ====================================================================
// CONFIGURACIÓN DEL MITIGADOR DE FUERZA BRUTA (RATE LIMITER)
// ====================================================================


const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // Ventana de tiempo de 1 minuto bloqueado
  max: 5, // Bloquea la IP tras 5 intentos fallidos consecutivos
  skipSuccessfulRequests: true, // Si el login fue EXITOSO (200 OK), NO se descuenta del límite. el backend ignora los inicio de sesion exitosos
  message: { 
    msg: "Demasiados intentos de inicio de sesión fallidos. Por seguridad su IP ha sido bloqueada temporalmente por 1 minuto." 
  },
  standardHeaders: true, 
  legacyHeaders: false, 
});


// Endpoint para el inicio de sesión (CU-001)
// Se inyecta el limitador perimetral antes de procesar el controlador de login
// router.post('/login', loginLimiter, login); // Coméntalo transitoriamente para el test
router.post('/login', loginLimiter, login);

export default router;
