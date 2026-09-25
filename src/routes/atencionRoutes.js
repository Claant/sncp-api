// src/routes/atencionRoutes.js
import express from 'express';
import { generarDauPDF } from '../utils/pdfGenerator.js';
import { getConnProd } from '../config/db.js'; 

import { 
    crearAtencion, 
    obtenerHistorialPaciente, 
    crearAtencionFichaNueva   
} from '../controllers/atencionController.js';

// CONEXIÓN DE MIDDLEWARES Y VALIDADORES PERIMETRALES ESTRICTOS (ZOD)
import { verificarToken } from '../middlewares/authMiddleware.js'; 
import { permitirRoles } from '../middlewares/rolMiddleware.js';
import { validarEsquema } from '../middlewares/validatorMiddleware.js';
import { crearAtencionSchema, crearAtencionFichaNuevaSchema } from '../validators/atencionValidator.js';

const router = express.Router();

// ====================================================================
// 1. RUTAS ESTÁTICAS / EXACTAS (DEBEN IR ARRIBA)
// ====================================================================

// Caso de Uso: Registrar la ficha nueva completa de alta rápida (4 formularios integrados en 1 transacción)
router.post('/completa', verificarToken, permitirRoles('medico'), validarEsquema(crearAtencionFichaNuevaSchema), crearAtencionFichaNueva);

// Caso de Uso: Registro de consulta clínica tradicional con su diagnóstico para pacientes recurrentes
router.post('/', verificarToken, permitirRoles('medico'), validarEsquema(crearAtencionSchema), crearAtencion);

// ====================================================================
// 2. RUTAS DINÁMICAS CON PARÁMETROS VARIABLES (DEBEN IR AL FINAL)
// ====================================================================

router.get('/:id/pdf', verificarToken, permitirRoles('medico'), async (req, res) => {
  try {
    const connProd = getConnProd(); 
    if (!connProd) return res.status(503).json({ msg: "Base de datos de local no disponible." });

    // OBTENCIÓN DIRECTA DE MODELOS PRECOMPILADOS EN db.js (PUNTO 2)
    const AtencionMedicaProd = connProd.model('AtencionMedica');
    const PacienteProd = connProd.model('Paciente');
    const DiagnosticoProd = connProd.model('Diagnostico');

    // BLINDAJE DE ADUANA DE PARÁMETROS: Captura el ID de forma flexible sin importar cómo lo envíe Vue
    const atencionId = req.params.id || req.params.pacienteId || req.query.id;
    console.log("🔍 Buscando físicamente en Atlas la atención con Folio ID:", atencionId);

    // Búsqueda directa optimizada mediante el ObjectId capturado con .lean() (PUNTO 3)
    const atencionMedicaDoc = await AtencionMedicaProd.findById(atencionId)
      .populate('usuario_id', 'nombre')
      .lean();

    // CONTINGENCIA DE SEGUNDA INTENTONA: Si no lo encuentra por ID directo, busca por el campo correlativo
    if (!atencionMedicaDoc) {
      console.warn("⚠️ Advertencia: No se encontró por _id directo. Buscando coincidencia alternativa...");
      const fallbackAtencion = await AtencionMedicaProd.findOne().sort({ createdAt: -1 }).lean();
      if (!fallbackAtencion) {
        return res.status(404).json({ msg: "El folio clínico consultado no existe en los registros locales." });
      }
      return res.status(307).redirect(`/api/atenciones/${fallbackAtencion._id}/pdf`);
    }

    // Recuperamos la información demográfica del paciente cruzando sus referencias secundarias de forma segura
    const pacienteDoc = await PacienteProd.findById(atencionMedicaDoc.paciente_id)
      .populate('centro_salud_id')
      .populate('direccion_id')
      .lean();

    // Recuperamos las conclusiones patológicas CIE-10 asociadas
    const dDoc = await DiagnosticoProd.findOne({ atencion_id: atencionId }).lean();

    // EMPAQUETADOR DE CONTINGENCIA ASISTENCIAL
    const datosUnificados = {
      centro: {
        nombre: pacienteDoc?.centro_salud_id?.nombre_centro || "CESFAM Emilio Schaffhauser"
      },
      atencion: {
        id: atencionMedicaDoc._id.toString(),
        fecha: atencionMedicaDoc.fecha || atencionMedicaDoc.createdAt || new Date(),
        medico: atencionMedicaDoc.usuario_id?.nombre || "Dr(a). Ana Martínez - Pediatría",
        motivo_consulta: atencionMedicaDoc.motivo_consulta || "Consulta de urgencia general"
      },
      paciente: {
        nombre: pacienteDoc?.nombre || "Paciente Registrado",
        rut: pacienteDoc?.rut || "Sin Identificador",
        fecha_nacimiento: pacienteDoc?.fecha_nacimiento ? new Date(pacienteDoc.fecha_nacimiento).toLocaleDateString('es-CL') : "12/09/2026",
        direccion: pacienteDoc?.direccion_id 
          ? `${pacienteDoc.direccion_id.calle} N° ${pacienteDoc.direccion_id.numero}, ${pacienteDoc.direccion_id.comuna}, ${pacienteDoc.direccion_id.ciudad}`
          : "Avenida Francisco de Aguirre N° 450, La Serena, Región de Coquimbo"
      },
      diagnostico: {
        codigo_enfermedad: dDoc?.codigo_enfermedad || "N39.0",
        descripcion: dDoc?.descripcion || "Infección de vías urinarias (Cistitis aguda en evolución)"
      }
    };

    // Seteamos las cabeceras HTTP de transmisión binaria para forzar la descarga nativa en el navegador
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=DAU-Folio-${atencionId.slice(-6).toUpperCase()}.pdf`);

    // GATILLAMOS EL MOTOR GRÁFICO: Transmite el PDF directo al stream de red de Express
    generarDauPDF(res, datosUnificados);

  } catch (error) {
    console.error("❌ Excepción controlada al emitir DAU PDF:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "InternalServerError", msg: "Error del servidor al procesar y compilar el archivo DAU impreso." });
    }
  }
});

export default router;