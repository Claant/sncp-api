import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const usuarioSchema = new mongoose.Schema({
    rut: {
        type: String,
        required: true,
        unique: true,   // Bloquea duplicados de RUT en MongoDB Atlas
        trim: true
    },
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    correo: {
        type: String,
        required: true,
        unique: true,
        trim: true,  
        lowercase: true  // Asegura que el correo se guarde siempre en minúsculas
    },
    rol: {
        type: String,
        required: true,
        enum: ['medico', 'administrador'], // Valores controlados por la lógica de negocio
        default: 'medico'
    },
    especialidad: {
        type: String,
        required: function() { return this.rol === 'medico'; }, // Obligatorio de forma estricta solo si es médico
        trim: true
    },
    centro_salud_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CentroSalud', // Relación e indexación controlada con la colección de centros de salud
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    activo: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true // Inyecta automáticamente los campos createdAt y updatedAt para auditoría
});

// ====================================================================
// 🔐 HOOK PRE-SAVE: Encriptación Automática y Segura de Contraseñas
// ====================================================================
usuarioSchema.pre('save', async function() { 
    // Si la contraseña no ha sido modificada o no viene en la petición, saltamos el proceso
    if (!this.isModified('password')) {
        return; 
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        throw error; // Cancela el guardado de forma automática si falla bcryptjs
    }
});

// FORZADO EXPLICITO DE COLECCIÓN: Sincronizado con tu carpeta de producción 'usuarios' en Atlas
const Usuario = mongoose.model('Usuario', usuarioSchema, 'usuarios'); 

export default Usuario;
