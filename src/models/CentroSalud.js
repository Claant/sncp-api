import mongoose from 'mongoose';

// 🔹 EXPORTACIÓN EXPLÍCITA DEL ESQUEMA (Para inyección y población dinámica en pools concurrentes)
export const centroSaludSchema = new mongoose.Schema({
    nombre_centro: {
        type: String,
        required: true,
        trim: true
        // Ejemplo: "CESFAM Emilio Schaffhauser" o "Hospital San Juan de Dios"
    },
    tipo_prestador: {
        type: String,
        required: true,
        trim: true
        // Ejemplo: "Publico", "Privado"
    }
}, {
    timestamps: true,
    versionKey: false // Remueve el campo __v interno de Mongoose para tus paquetes unificados
});

// ADICIÓN CRÍTICA: Índice físico en Atlas para acelerar la ordenación alfabética en los catálogos del frontend
centroSaludSchema.index({ nombre_centro: 1 });

// Configuración preventiva para evitar OverwriteModelError durante el desarrollo en caliente
const CentroSalud = mongoose.models.CentroSalud || mongoose.model('CentroSalud', centroSaludSchema, 'centro-salud');

// 🔹 EXPORTACIÓN POR DEFECTO DEL MODELO TRADICIONAL
export default CentroSalud;
