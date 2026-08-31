import mongoose from 'mongoose';

const direccionSchema = new mongoose.Schema({
    calle: {
        type: String,
        required: true,
        trim: true
    },
    numero: {
        type: String, // String para permitir formatos mixtos como "S/N" o "1040-B"
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
    timestamps: true
});

// Forzamos explícitamente el uso del nombre exacto de la colección en Atlas
const Direccion = mongoose.model('Direccion', direccionSchema, 'direcciones');
export default Direccion;
