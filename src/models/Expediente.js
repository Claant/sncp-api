import mongoose from "mongoose";

// EXPORTACIÓN EXPLÍCITA DEL ESQUEMA (Para inyección y población dinámica en pools concurrentes)
export const expedienteSchema = new mongoose.Schema(
  {
    paciente_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Paciente",
      required: true,
      unique: true // Asegura que exista un único expediente maestro por paciente en el clúster
    },
    centro_salud_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CentroSalud",
      required: true,
    },
    fecha_creacion: { type: Date, default: Date.now },
    atenciones: [
      { type: mongoose.Schema.Types.ObjectId, ref: "AtencionMedica" },
    ],
    diagnosticos: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Diagnostico" },
    ],
    estado: { type: String, enum: ["activo", "cerrado"], default: "activo" },
  },
  { 
    timestamps: true,
    versionKey: false // Remueve el campo __v interno de Mongoose para tus paquetes unificados
  },
);

// ADICIÓN CRÍTICA: Forzamos la creación del índice físico único en Atlas para búsquedas instantáneas
expedienteSchema.index({ paciente_id: 1 }, { unique: true });

// Verificación condicional para evitar OverwriteModelError durante el desarrollo en caliente (Nodemon)
const Expediente = mongoose.models.Expediente || mongoose.model("Expediente", expedienteSchema, "expedientes");

// EXPORTACIÓN POR DEFECTO DEL MODELO TRADICIONAL
export default Expediente;
