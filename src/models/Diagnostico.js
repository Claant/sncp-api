import mongoose from 'mongoose';

const diagnosticoSchema = new mongoose.Schema({
    atencion_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AtencionMedica', // Vinculación con el modelo de atencionmedicas
        required: true
    },
    descripcion: {
        type: String,
        required: true,
        trim: true
    },
    codigo_enfermedad: {
        type: String,
        required: true,
        trim: true
        // Ejemplo estándar: "I10" (Código CIE-10 para Hipertensión)
    }
}, {
    // Registra automáticamente createdAt y updatedAt para auditoría cronológica del alta
    timestamps: true 
});

// CORREGIDO: Se cambia 'diagnostico' por 'diagnosticos' para coincidir exactamente con el nombre de tu colección física en plural dentro de Atlas
const Diagnostico = mongoose.model('Diagnostico', diagnosticoSchema, 'diagnosticos');

export default Diagnostico;
