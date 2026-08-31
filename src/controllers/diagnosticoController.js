import mongoose from 'mongoose';
import Diagnostico from '../models/Diagnostico.js';
import Auditoria from '../models/Auditoria.js'; // Inyección del nuevo modelo forense
import AtencionMedica from '../models/AtencionMedica.js';
// CORRECCIÓN: Inyección obligatoria de la importación faltante del modelo de Usuario
import Usuario from '../models/Usuario.js'; 

// Caso de Uso: Registrar diagnóstico asociado a una atención médica (CU-003 / Extensión)
export const crearDiagnostico = async (req, res) => {
    const { atencion_id, descripcion, codigo_enfermedad } = req.body;

    // Validación perimetral de campos obligatorios
    if (!atencion_id || !descripcion || !codigo_enfermedad) {
        return res.status(400).json({ msg: 'Por favor, complete todos los campos requeridos para el diagnóstico.' });
    }

    try {
        const nuevoDiagnostico = new Diagnostico({
            atencion_id,
            descripcion,
            codigo_enfermedad
        });

        await nuevoDiagnostico.save();
        // CORREGIDO: Se añade 'return' para un cierre seguro del ciclo de petición-respuesta
        return res.status(201).json({ msg: 'Diagnóstico clínico añadido exitosamente.', diagnostico: nuevoDiagnostico });

    } catch (error) {
        console.error('Error al crear diagnóstico:', error.message);
        return res.status(500).json({ msg: 'Error interno del servidor al procesar el diagnóstico.' });
    }
};



export const obtenerDiagnosticoPorAtencion = async (req, res) => {
    const { atencionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(atencionId)) {
        return res.status(400).json({ msg: 'El ID de atención consultado no es válido.' });
    }

    try {
        const diagnostico = await Diagnostico.findOne({ atencion_id: atencionId });
        const atencion = await AtencionMedica.findById(atencionId);
        
        if (atencion) {
            // RECUPERACIÓN NOMINAL NOMINATIVA: Buscamos el registro del médico en Atlas
            // usando el ID inyectado de forma segura por el middleware verificarToken
            const idMedicoConsultante = req.usuario.id || req.usuario._id;
            const medicoDB = await Usuario.findById(idMedicoConsultante).select('nombre');

            // Si por alguna razón no encuentra el nombre en la BD, inyecta el username o su rol
            const nombreCompletoMedico = medicoDB ? medicoDB.nombre : (req.usuario.username || 'Médico Autorizado');

            // Registrar el evento de auditoría nominal en Atlas
            const nuevaAuditoria = new Auditoria({
                usuario_id: idMedicoConsultante,
                nombre_medico: nombreCompletoMedico, // Guardado garantizado del nombre real en la colección
                rol_consultado: req.usuario.rol || 'medico',
                atencion_id: atencionId,
                paciente_id: atencion.paciente_id
            });
            await nuevaAuditoria.save();
        }

        // Recuperar la bitácora de accesos para este folio específico (Últimos 5 registros)
        const bitacora = await Auditoria.find({ atencion_id: atencionId })
            .sort({ fecha_consulta: -1 })
            .limit(5);

        if (!diagnostico) {
            return res.json({ 
                diagnostico: null, 
                bitacora,
                msg: 'No se encontró un diagnóstico registrado para esta atención.' 
            });
        }
        
        return res.json({
            diagnostico,
            bitacora
        });

    } catch (error) {
        console.error('❌ Error crítico al obtener diagnóstico y registrar auditoría:', error.message);
        return res.status(500).json({ msg: 'Error interno del servidor al procesar la auditoría clínica.' });
    }
};
