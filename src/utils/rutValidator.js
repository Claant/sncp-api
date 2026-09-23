// src/utils/rutValidator.js

/**
 * Limpia el RUT eliminando puntos, guiones y espacios, dejando solo dígitos y K
 */
export const limpiarRut = (rut) => {
  if (typeof rut !== 'string') return '';
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
};

/**
 * Valida la estructura del RUT formateado con guion
 * Exige:
 * - Mínimo 8 dígitos en total (7 u 8 de cuerpo + 1 DV) -> Resultado limpio con guion: "1234567-8" o "12345678-K"
 * - Formato: números antes del guion y un dígito (0-9) o K después del guion
 */
export const validarRutChileno = (rutRaw) => {
  const rutConGuion = limpiarRut(rutRaw);

  // Verificación de formato con guion: entre 7 y 8 dígitos antes del guion, y un DV (0-9 o K)
  const patronRut = /^\d{7,8}-[0-9K]$/;

  return patronRut.test(rutConGuion);
};