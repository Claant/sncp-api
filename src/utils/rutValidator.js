// src/utils/rutValidator.js

/**
 * Quita puntos, guiones y caracteres especiales.
 * Retorna solo dígitos y la letra K en mayúscula.
 */
export const limpiarRut = (rutRaw) => {
  if (!rutRaw || typeof rutRaw !== 'string') return '';
  return rutRaw.replace(/[^0-9kK]/g, '').toUpperCase();
};

/**
 * Recibe un valor crudo y devuelve la cadena formateada con puntos y guion.
 * Ejemplos:
 *  - "174329816"   -> "17.432.981-6"
 *  - "17432981k"   -> "17.432.981-K"
 *  - "17.432.9816" -> "17.432.981-6"
 */
export const formatearRut = (rutRaw) => {
  const limpio = limpiarRut(rutRaw);
  if (limpio.length < 2) return limpio;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);

  // Aplica los puntos cada 3 dígitos de derecha a izquierda
  const cuerpoConPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${cuerpoConPuntos}-${dv}`;
};

/**
 * Valida que la cadena tenga una longitud equivalente a un RUT chileno
 * (Mínimo 8 caracteres limpios, máximo 9 caracteres limpios: 7-8 dígitos + DV 0-9/K)
 */
export const validarRutChileno = (rutRaw) => {
  const limpio = limpiarRut(rutRaw);

  // Exige longitud de 8 a 9 caracteres limpios
  if (limpio.length < 8 || limpio.length > 9) return false;

  // Evalúa que la estructura sean números seguidos de un dígito o K al final
  const patronRut = /^\d{7,8}[0-9K]$/;
  return patronRut.test(limpio);
};