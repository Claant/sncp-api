// src/validators/atencionValidator.js
import { z } from 'zod';
import {validarRutChileno, limpiarRut} from '../utils/rutValidator.js'

/**
 * REGLA 1: Para consultas tradicionales de pacientes recurrentes (POST /)
 * Validada perimetralmente con la aduana genérica de Express
 */


export const crearAtencionSchema = z.object({
  paciente_id: z.string({ required_error: "El identificador del paciente (paciente_id) es obligatorio." })
    .regex(/^[0-9a-fA-F]{24}$/, "El paciente_id provisto debe ser un ObjectId de MongoDB válido."),
  
  motivo_consulta: z.string({ required_error: "El motivo de la consulta médica es mandatorio." })
    .min(10, "El motivo de consulta debe ser clínico y descriptivo (mínimo 10 caracteres).")
    .trim(),
  
  codigo_enfermedad: z.string({ required_error: "El código de enfermedad estandarizado es obligatorio." })
    .regex(/^[A-Z][0-9]{2}(\.[0-9])?$/, "El código debe cumplir estrictamente con la nomenclatura internacional CIE-10 (Ej: M79.6).")
    .trim(),
  
  descripcion: z.string({ required_error: "La descripción diagnóstica detallada es obligatoria." })
    .min(10, "La descripción del cuadro patológico debe ser explícita (mínimo 10 caracteres).")
    .trim()
});

/**
 * REGLA 2: Para el Alta Express Unificada (POST /completa)
 * Sincronizada con el RUT para evitar fallas relacionales en la transacción ACID
 */
export const crearAtencionFichaNuevaSchema = z.object({
  calle: z.string({ required_error: "La calle es obligatoria." }).trim(),
  numero: z.string({ required_error: "El número de domicilio es obligatorio." }).trim(),
  comuna: z.string({ required_error: "La comuna es obligatoria." }).trim(),
  ciudad: z.string({ required_error: "La ciudad es obligatoria." }).trim(),
  
  // CORREGIDO: Usamos el RUT como identificador primario del formulario de Vue
  rut: z.string({ required_error: "El RUT nacional es obligatorio." })
  .trim()
  .refine((val)=> validarRutChileno(val),{
    message: "El RUT ingresado no es valido (verifique el digito verificador)."
  }),
  
  nombre: z.string({ required_error: "El nombre completo es obligatorio." }).trim(),
  fecha_nacimiento: z.string({ required_error: "La fecha de nacimiento es obligatoria." }),
  
  centro_salud_id: z.string({ required_error: "El centro_salud_id es requerido." })
    .regex(/^[0-9a-fA-F]{24}$/, "El ID del centro de salud no válido."),
  
  motivo_consulta: z.string({ required_error: "El motivo de consulta es obligatorio." }).min(10,"El motivo de consulta debe contener al menos 10 caracteres descriptivos.").trim(),
  
  codigo_enfermedad: z.string({ required_error: "El código CIE-10 es requerido." })
    .regex(/^[A-Z][0-9]{2}(\.[0-9])?$/, "El código debe cumplir con el formato internacional CIE-10 (Ej: M79.6)."),
  
  descripcion: z.string({ required_error: "La descripción es requerida." }).min(10,"La descripción del diagnóstico debe contener al menos 10 caracteres.").trim()
});
