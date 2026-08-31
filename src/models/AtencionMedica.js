import mongoose from 'mongoose';

const atencionMedicaSchema = new mongoose.Schema({
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
    timestamps: true
});

const AtencionMedica = mongoose.model('AtencionMedica', atencionMedicaSchema, 'atencion-medica');
export default AtencionMedica;


