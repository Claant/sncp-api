import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';

// Conexiones concurrentes del Pool optimizado
import { connectDB, connectDemoDB } from './config/db.js'; 
// Enrutadores de la API (Alineados con los nombres reales de tus archivos físicos)
import authRoutes from './routes/authRoutes.js'; 
import usuarioRoutes from './routes/usuarioRoutes.js';
import pacienteRoutes from './routes/pacienteRoutes.js'; 
import atencionRoutes from './routes/atencionRoutes.js'; // 🚀 Singular: atencionRoutes
import centroSaludRoutes from './routes/centroSaludRoutes.js'; 
import diagnosticoRoutes from './routes/diagnosticoRoutes.js';
import direccionRoutes from './routes/direccionRoutes.js';
import expedienteRoutes from './routes/expedienteRoutes.js';
import bitacoraRoutes from './routes/bitacoraRoutes.js'; // 🔒 Auditoría forense


dotenv.config();

const app = express();

// 🔒 Seguridad perimetral global (Inyección de cabeceras HTTP seguras)
app.use(helmet());

// ====================================================================
// CONFIGURACIÓN DE POLÍTICAS CORS (CONTROL DE ACCESO DE RED)
// ====================================================================
const origenesPermitidos = [
  process.env.ORIGIN1,
  process.env.ORIGIN2,
  process.env.ORIGIN3,
  process.env.ORIGIN4
].filter(Boolean).map(o => o.trim()); // 🚀 Sanitización perimetral de strings de entorno

app.use(cors({
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (como herramientas de desarrollo, Postman o SSR local)
    if (!origin) return callback(null, true);
    
    if (origenesPermitidos.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      console.warn(`🛑 Intento de acceso bloqueado por CORS desde el origen: ${origin}`);
      return callback(new Error('Bloqueado por políticas de seguridad perimetral (CORS)'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parser estricto para objetos JSON entrantes (Protege el parser del Backend)
app.use(express.json());

// ====================================================================
// MONTAJE DE LAS RUTAS MAESTRAS DE LA API
// ====================================================================
app.use('/api/auth', authRoutes); 
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/pacientes', pacienteRoutes); 
app.use('/api/atenciones', atencionRoutes); 
app.use('/api/centros-salud', centroSaludRoutes); 
app.use('/api/diagnosticos', diagnosticoRoutes);
app.use('/api/direcciones', direccionRoutes); 
app.use('/api/expedientes', expedienteRoutes);
app.use('/api/bitacora', bitacoraRoutes); // 🔒 Auditoría forense
// Endpoint de verificación de salud de la infraestructura de red (Health Check)
app.get('/', (req, res) => {
  return res.status(200).send('API del Sistema Web de Interoperabilidad de Ficha Clínica - SNCP Activa');
});

// ====================================================================
// CAPTURADOR GLOBAL DE ERRORES (BLINDAJE CONTRA CAÍDAS 500)
// ====================================================================
app.use((err, req, res, next) => {
  console.error('❌ EXCEPCIÓN DETECTADA EN EL HILO PRINCIPAL DE EXPRESS:', err.stack);
  return res.status(500).json({ 
    error: "InternalServerError",
    msg: 'Ocurrió un conflicto de procesamiento en la pasarela nacional de salud.',
    detalleParaElDesarrollador: err.message 
  });
});

// ====================================================================
// ARRANQUE SECUENCIAL SÍNCRONO CON LOS CLÚSTERES DE ATLAS
// ====================================================================
const PORT = process.env.PORT || 5000;

const arrancarServidorAsistencial = async () => {
  try {
    console.log('🔄 Iniciando secuencia de enlace con repositorios externos en Atlas...');
    
    // Inicializar pool de producción
    await connectDB();
    
    // Inicializar repositorio demo de interoperabilidad de forma paralela
    await connectDemoDB();
    
    // Una vez que los clústeres devuelven la promesa exitosa, abrimos el puerto de Express
    app.listen(PORT, () => {
      console.log(`🚀 Servidor asistencial corriendo exitosamente en el puerto ${PORT}`);
      console.log(`📡 Esperando peticiones concurrentes del cliente de Vue...`);
    });
  } catch (error) {
    console.error('❌ Error catastrófico insalvable en la secuencia de arranque:', error.message);
    process.exit(1); // El proceso muere limpiamente para que el orquestador (PM2/Docker) lo reincie
  }
};

arrancarServidorAsistencial();
