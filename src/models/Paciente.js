import mongoose from 'mongoose';

const pacienteSchema = new mongoose.Schema({
    rut: {
        type: String,
        required: true,
        unique: true, // Bloquea de forma atómica la duplicidad del RUT en MongoDB Atlas
        trim: true
    },
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    fecha_nacimiento: {
        type: String, // Guardado como String "YYYY-MM-DD" según la estructura de tu Atlas
        required: true
    },
    direccion_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Direccion', // Relación e indexación controlada con la colección direcciones
        required: true
    },
    centro_salud_id: {
        type: mongoose.Schema.Types.ObjectId,
        // 🚨 COMPROBACIÓN: Asegúrate de que en tu archivo models/CentroSalud.js el modelo esté registrado exactamente como 'CentroSalud'.
        // Si en ese archivo dice mongoose.model('centros-salud', ...), debes cambiar esta línea por: ref: 'centros-salud'
        ref: 'CentroSalud', 
        required: true
    }
}, {
    // Genera automáticamente los campos createdAt y updatedAt para auditoría cronológica del expediente
    timestamps: true 
});

// Forzamos explícitamente a Mongoose a usar el nombre exacto de tu colección física en el disco duro
const Paciente = mongoose.model('Paciente', pacienteSchema, 'pacientes');

export default Paciente;

