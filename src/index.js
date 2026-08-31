import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet'; // [Seguridad] Inyección de cabeceras HTTP robustas

import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js'; 
import usuarioRoutes from './routes/usuarioRoutes.js';
import pacienteRoutes from './routes/pacienteRoutes.js'; 
import atencionRoutes from './routes/atencionRoutes.js';
import centroSaludRoutes from './routes/centroSaludRoutes.js'; 
import diagnosticoRoutes from './routes/diagnosticoRoutes.js';
import direccionRoutes from './routes/direccionRoutes.js';

dotenv.config();

// Inicializar la conexión inyectando el pool optimizado empresarial de MongoDB
connectDB();

const app = express();

// ====================================================================
// 🛡️ CAPA PERIMETRAL DE SEGURIDAD GLOBAL (OWASP / INFRAESTRUCTURA)
// ====================================================================

// 1. Ocultar huellas de Express y blindar cabeceras HTTP contra XSS y Clickjacking
app.use(helmet());

// ====================================================================
// CONFIGURACIÓN DE CORS PERSONALIZADA Y SEGURA (Políticas de Red)
// ====================================================================
const origenesPermitidos = [
  process.env.ORIGIN1, // http://localhost:5000
  process.env.ORIGIN2, // http://localhost:5173 (Vite Vue Frontend)
  process.env.ORIGIN3, // Producción API (Render)
  process.env.ORIGIN4  // Producción Client (Netlify)
].filter(Boolean); 

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Permitir Postman o microservicios locales
    
    if (origenesPermitidos.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por políticas de seguridad CORS del Sistema Nacional Clínico'));
    }
  },
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware intermedio para el parseo estricto del cuerpo JSON
app.use(express.json());

// ====================================================================
// ENRUTADORES GENERALES DE LA ARQUITECTURA REST
// ====================================================================
app.use('/api/auth', authRoutes); // Conserva de forma interna su respectivo loginLimiter
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/pacientes', pacienteRoutes); 
app.use('/api/atenciones', atencionRoutes); 
app.use('/api/centros-salud', centroSaludRoutes); 
app.use('/api/diagnosticos', diagnosticoRoutes);
app.use('/api/direcciones', direccionRoutes); 

// Endpoint base utilitario de salud del servicio (Health Check)
app.get('/', (req, res) => {
  return res.status(200).send('API del Sistema Nacional Clínico de Pacientes activa y operativa.');
});

// [CIBERSEGURIDAD CRÍTICA] Capturador global de errores síncronos/asíncronos (Evita fugas de Stack Traces)
app.use((err, req, res, next) => {
  console.error('❌ Excepción global detectada en Express:', err.message);
  return res.status(500).json({ msg: 'Ocurrió un conflicto de procesamiento en la pasarela nacional de salud.' });
});

// Puerto dinámico adaptativo para entornos PaaS de producción
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Servidor corporativo corriendo exitosamente en el puerto ${PORT}`));
