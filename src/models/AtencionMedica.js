import mongoose from 'mongoose';

// 🔹 EXPORTACIÓN EXPLÍCITA DEL ESQUEMA (Para inyección dinámica en connProd / connDemo)
export const atencionMedicaSchema = new mongoose.Schema({
    paciente_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Paciente', // Relación con la colección pacientes
        required: true
    },
    usuario_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario', // Relación con la colección usuarios (médico)
        required: true
    },
    diagnostico_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Diagnostico', // ADICIÓN: Mapeo explícito relacional para guardar el ID del diagnóstico CIE-10
        default: null
    },
    fecha: {
        type: Date, // Tipo Date nativo para manejar el formato ISO de tu Atlas
        required: true,
        default: Date.now // Si no se envía, toma la fecha y hora actual automáticamente
    },
    motivo_consulta: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true,
    versionKey: false // Remueve el campo __v interno de Mongoose para tus paquetes unificados
});

// Configuración preventiva para evitar OverwriteModelError durante el desarrollo caliente
const AtencionMedica = mongoose.models.AtencionMedica || mongoose.model('AtencionMedica', atencionMedicaSchema, 'atencion-medica');

// 🔹 EXPORTACIÓN POR DEFECTO DEL MODELO TRADICIONAL
export default AtencionMedica;
