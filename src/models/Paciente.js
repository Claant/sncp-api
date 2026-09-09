import mongoose from "mongoose";

export const pacienteSchema = new mongoose.Schema(
  {
    rut: { type: String, required: true, unique: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    fecha_nacimiento: { type: String, required: true },
    direccion_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Direccion",
      required: true,
    },
    centro_salud_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CentroSalud",
      required: true,
    },
  },
  { 
    timestamps: true,
    versionKey: false
  },
);


const Paciente = mongoose.models.Paciente || mongoose.model("Paciente", pacienteSchema, "pacientes");
export default Paciente;
