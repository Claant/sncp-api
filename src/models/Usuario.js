import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const usuarioSchema = new mongoose.Schema({
  rut: {
    type: String,
    required: true,
    unique: true,
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
    lowercase: true
  },
  rol: {
    type: String,
    required: true,
    enum: ['medico', 'administrador'],
    default: 'medico'
  },
  especialidad: {
    type: String,
    required: function() { return this.rol === 'medico'; },
    trim: true
  },
  centro_salud_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CentroSalud',
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true,   // ya basta con esto
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
  timestamps: true,
  versionKey: false
});

// Solo índices adicionales que no estén duplicados
usuarioSchema.index({ createdAt: -1 }); 


usuarioSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema, 'usuarios');
export default Usuario;
