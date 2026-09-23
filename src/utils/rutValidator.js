// src/utils/rutValidator.js

/**
 * Limpia el RUT dejando solo dígitos y K
 */
export const limpiarRut = (rut) => {
  if (typeof rut !== 'string') return '';
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
};

/**
 * Valida un RUT chileno mediante el algoritmo Módulo 11
 */
export const validarRutChileno = (rut) => {
  const rutLimpio = limpiarRut(rut);
  if (rutLimpio.length < 8 || rutLimpio.length > 9) return false;

  const cuerpo = rutLimpio.slice(0, -1);
  const dvIngresado = rutLimpio.slice(-1);

  if (!/^\d+$/.test(cuerpo)) return false;

  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo.charAt(i), 10) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = suma % 11;
  const dvEsperado = 11 - resto;

  let dvCalculado = '';
  if (dvEsperado === 11) dvCalculado = '0';
  else if (dvEsperado === 10) dvCalculado = 'K';
  else dvCalculado = dvEsperado.toString();

  return dvIngresado === dvCalculado;
};