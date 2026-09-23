import mongoose from 'mongoose';

// 🔹 EXPORTACIÓN EXPLÍCITA DEL ESQUEMA (Para inyección y población dinámica en pools concurrentes)
export const diagnosticoSchema = new mongoose.Schema({
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
    timestamps: true,
    versionKey: false // Remueve el campo __v interno de Mongoose para tus paquetes unificados
});

// ADICIÓN CRÍTICA: Índice físico en Atlas para resolver búsquedas en cascada por ID de atención
diagnosticoSchema.index({ atencion_id: 1 });


const Diagnostico = mongoose.models.Diagnostico || mongoose.model('Diagnostico', diagnosticoSchema, 'diagnosticos');

// EXPORTACIÓN POR DEFECTO DEL MODELO UNIFICADO PARA EL CANAL TRADICIONAL
export default Diagnostico;
