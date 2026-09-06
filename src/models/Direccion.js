import mongoose from 'mongoose';

// 🔹 EXPORTACIÓN EXPLÍCITA DEL ESQUEMA (Para inyección y población dinámica en pools concurrentes)
export const direccionSchema = new mongoose.Schema({
    calle: {
        type: String,
        required: true,
        trim: true
    },
    numero: {
        type: String, // Permite formatos mixtos del formato nacional como "S/N" o "1040-B"
        required: true,
        trim: true
    },
    comuna: {
        type: String,
        required: true,
        trim: true
    },
    ciudad: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true,
    versionKey: false // Remueve el campo __v interno de Mongoose para tus paquetes unificados
});

// 🚀 ADICIÓN CRÍTICA: Índice compuesto físico en Atlas para optimizar búsquedas masivas y ordenamiento geográfico
direccionSchema.index({ comuna: 1, ciudad: 1 });

// Verificación condicional para evitar OverwriteModelError durante el desarrollo en caliente
const Direccion = mongoose.models.Direccion || mongoose.model('Direccion', direccionSchema, 'direcciones');

// 🔹 EXPORTACIÓN POR DEFECTO DEL MODELO TRADICIONAL
export default Direccion;
