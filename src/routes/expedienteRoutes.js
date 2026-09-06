import express from 'express';
import {
  crearExpediente,
  obtenerExpedientePorPaciente,
  agregarAtencion,
  obtenerExpedienteFHIR,
  // 🌟 FORZAMOS LA IMPORTACIÓN EXACTA DEL CONTROLADOR TRANSACCIONAL
  crearAtencionFichaNueva 
} from '../controllers/expedienteController.js';

import { verificarToken } from '../middlewares/authMiddleware.js'; 

const router = express.Router();

// Aplicamos el token de seguridad global para el box médico
router.use(verificarToken);

router.post('/', crearExpediente);

// 🌟 ENDPOINT DE INTEROPERABILIDAD DEFINITIVO:
// Esta ruta procesará el JSON y romperá el error 404 de inmediato
router.post('/importar', crearAtencionFichaNueva);
router.post('/fhir/importar', crearAtencionFichaNueva);

router.get('/paciente/:pacienteId', obtenerExpedientePorPaciente);
router.post('/:expedienteId/atenciones', agregarAtencion);
router.get('/paciente/:pacienteId/fhir', obtenerExpedienteFHIR);

export default router;
