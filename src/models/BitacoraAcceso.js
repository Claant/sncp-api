// models/BitacoraAcceso.js
import mongoose from "mongoose";

export const bitacoraSchema = new mongoose.Schema({
  paciente_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Paciente", 
    required: [true, "El ID del paciente es obligatorio."] 
  },
  usuario_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Usuario", 
    required: [true, "El ID del usuario auditor es obligatorio."] 
  },
  nombre_medico: { 
    type: String, 
    required: true,
    trim: true 
  },
  rol_consultado: { 
    type: String, 
    required: true,
    trim: true 
  },
  atencion_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "AtencionMedica",
    default: null
  },
  fecha_consulta: { 
    type: Date, 
    default: Date.now,
    required: true 
  }
}, { 
  timestamps: true,
  versionKey: false 
});

// 🚀 ÍNDICES OPTIMIZADOS PARA BÚSQUEDAS FORENSES RÁPIDAS
bitacoraSchema.index({ paciente_id: 1, fecha_consulta: -1 });
bitacoraSchema.index({ atencion_id: 1, fecha_consulta: -1 });

const BitacoraAcceso = mongoose.models.BitacoraAcceso || mongoose.model("BitacoraAcceso", bitacoraSchema, "bitacora-accesos");

export default BitacoraAcceso;
