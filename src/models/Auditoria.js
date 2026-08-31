import mongoose from 'mongoose';

const auditoriaSchema = new mongoose.Schema({
    usuario_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario', // Quién consultó (Relación con el médico)
        required: [true, 'El ID del usuario auditor es obligatorio.']
    },
    nombre_medico: {
        type: String, // Respaldo rápido del nombre del profesional para renderizado directo
        required: true,
        trim: true
    },
    rol_consultado: {
        type: String, // Desde qué rol (médico)
        required: true,
        trim: true
    },
    atencion_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AtencionMedica', // Qué ficha clínica / atención médica revisó
        required: [true, 'El ID de la atención consultada es obligatorio.']
    },
    paciente_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Paciente', // A qué paciente pertenecía la ficha consultada
        required: [true, 'El ID del paciente es obligatorio.']
    },
    fecha_consulta: {
        type: Date, // Cuándo consultó (Marca de tiempo inalterable)
        default: Date.now,
        required: true
    }
}, {
    versionKey: false // Remueve el campo __v interno de Mongoose
});

// CONFIGURACIÓN DE ÍNDICE DE ALTO RENDIMIENTO (INDEXES)
// Optimiza de forma drástica la consulta de bitácoras por atención médica
// Busca por 'atencion_id' de forma directa y ordena por 'fecha_consulta' descendente (-1)
auditoriaSchema.index({ atencion_id: 1, fecha_consulta: -1 });

const Auditoria = mongoose.model('Auditoria', auditoriaSchema, 'auditorias');
export default Auditoria;
