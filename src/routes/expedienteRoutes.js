import express from 'express';
import {
  crearExpediente,
  obtenerExpedientePorPaciente,
  agregarAtencion,
  obtenerExpedienteFHIR,
  crearAtencionFichaNueva 
} from '../controllers/expedienteController.js';

import { verificarToken } from '../middlewares/authMiddleware.js'; 

const router = express.Router();

// Aplicamos el blindaje de seguridad perimetral para todo el box médico
router.use(verificarToken);

// ====================================================================
// 1. ENDPOINTS DE PERSISTENCIA Y TRANSACCIONES ACID
// ====================================================================
router.post('/', crearExpediente);

// Endpoints de importación masiva desde paquetes de datos externos
router.post('/importar', crearAtencionFichaNueva);
router.post('/fhir/importar', crearAtencionFichaNueva);

router.post('/:expedienteId/atenciones', agregarAtencion);

// ====================================================================
// 2. ENDPOINTS DE CONSULTA CLÍNICA INTEROPERABLE (SISTEMA HÍBRIDO)
// ====================================================================

// Consulta tradicional que extrae el formato nativo documental de MongoDB
router.get('/paciente/:pacienteId', obtenerExpedientePorPaciente);

// RUTA MAESTRA DE INTEROPERABILIDAD: 
// Esta ruta unificada resuelve el flujo federado. Transforma a FHIR Bundle 
// si los datos se encuentran en el nodo local (Prod) O en el clúster externo (Demo).
router.get('/paciente/:pacienteId/fhir', obtenerExpedienteFHIR);

export default router;
