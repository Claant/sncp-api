// src/utils/rutValidator.js

/**
 * Limpia el RUT eliminando puntos, guiones y espacios, dejando solo dígitos y K
 */
export const limpiarRut = (rut) => {
  if (typeof rut !== 'string') return '';
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
};

/**
 * Valida que la estructura del RUT tenga entre 8 y 9 caracteres limpios,
 * permitiendo formato con o sin puntos (ej: 12.345.678K o 12345678K)
 */
export const validarRutChileno = (rut) => {
  const rutLimpio = limpiarRut(rut);

  // Largo mínimo 8 y máximo 9 (ej: 7 u 8 dígitos + DV)
  if (rutLimpio.length < 8 || rutLimpio.length > 9) return false;

  // Estructura: 7 a 8 números seguidos de un dígito (0-9) o la letra K
  const patronRut = /^\d{7,8}[0-9K]$/;

  return patronRut.test(rutLimpio);
};