// src/utils/pdfGenerator.js (VERSIÓN DINÁMICA PURA - SIN TEXTO PLANO HARDCODED)
import PDFDocument from 'pdfkit';

/**
 * Generador Dinámico del Documento DAU Oficial de Urgencias (Ley 20.584)
 * @param {Object} res - Objeto de respuesta HTTP de Express
 * @param {Object} datosUnificados - JSON unificado proveniente de MongoDB Atlas
 */
export const generarDauPDF = (res, datosUnificados) => {
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 40, bottom: 40, left: 40, right: 40 } });

  // Conexión de tubería directa a la respuesta HTTP de Express
  doc.pipe(res);

  // Desestructuración limpia de las variables reactivas inyectadas por la ruta
  const { paciente, atencion, diagnostico, centro } = datosUnificados;

  // ====================================================================
  // 🏛️ DISEÑO VISUAL: CABECERA INSTITUTIONAL CHILENA
  // ====================================================================
  doc.rect(40, 40, 532, 4).fill('#10b981'); // Verde Turquesa Asistencial
  doc.fillColor('#000000');

  // Cabecera Izquierda
  doc.fontSize(10).font('Helvetica-Bold').text('SERVICIO DE SALUD COQUIMBO', 40, 55);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#115e59').text(centro.nombre.toUpperCase(), 40, 70);
  doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('Red de Atención Primaria de Urgencias (SAPU / SAR)', 40, 85);

  // Cabecera Derecha: Recuadro del Folio Único
  doc.rect(380, 55, 192, 45).lineWidth(1.5).stroke('#ef4444'); // Borde Rojo de Urgencia
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#ef4444').text('DATO DE ATENCIÓN DE URGENCIA', 385, 62, { width: 182, align: 'center' });
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text(`FOLIO: #${atencion.id.slice(-6).toUpperCase()}`, 385, 78, { width: 182, align: 'center' });

  doc.moveTo(40, 115).lineTo(572, 115).lineWidth(1).stroke('#cbd5e1');

  // Título del documento de cara a la Ley 20.584
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a').text('REGISTRO CLÍNICO UNIFICADO INTEROPERABLE', 40, 125, { align: 'center' });

  // ====================================================================
  // 👥 BLOQUE 1: ANTECEDENTES DEMOGRÁFICOS (Recurso: Patient + Location)
  // ====================================================================
  doc.rect(40, 145, 532, 20).fill('#f1f5f9');
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b').text('1. ANTECEDENTES DEMOGRÁFICOS DEL PACIENTE', 45, 151);

  // Despliegue dinámico de la Ficha Ciudadana
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text('Nombre Paciente:', 45, 175);
  doc.font('Helvetica').fillColor('#334155').text(paciente.nombre, 135, 175);

  doc.font('Helvetica-Bold').fillColor('#0f172a').text('RUT Nacional:', 360, 175);
  doc.font('Helvetica').fillColor('#334155').text(paciente.rut, 440, 175);

  doc.font('Helvetica-Bold').fillColor('#0f172a').text('Fecha Nacimiento:', 45, 195);
  doc.font('Helvetica').fillColor('#334155').text(paciente.fecha_nacimiento, 135, 195);

  doc.font('Helvetica-Bold').fillColor('#0f172a').text('Domicilio:', 45, 215);
  doc.font('Helvetica').fillColor('#334155').text(paciente.direccion, 135, 215);

  // ====================================================================
  // 🩺 BLOQUE 2: EVOLUCIÓN ASISTENCIAL EN URGENCIAS (Recurso: Encounter)
  // ====================================================================
  doc.rect(40, 240, 532, 20).fill('#f1f5f9');
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b').text('2. ANTECEDENTES DE LA ATENCIÓN Y ENCUENTRO MÉDICO', 45, 246);

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text('Fecha/Hora Consulta:', 45, 270);
  doc.font('Helvetica').fillColor('#334155').text(new Date(atencion.fecha).toLocaleString('es-CL'), 155, 270);

  doc.font('Helvetica-Bold').fillColor('#0f172a').text('Médico Tratante:', 360, 270);
  doc.font('Helvetica').fillColor('#334155').text(atencion.medico, 445, 270);

  doc.font('Helvetica-Bold').fillColor('#0f172a').text('Anamnesis / Sintomatología Inicial de Ingreso:', 45, 295);
  doc.font('Helvetica').fillColor('#475569').text(atencion.motivo_consulta, 44, 310, { width: 522, align: 'justify', lineGap: 3 });

  // ====================================================================
  // 🧫 BLOQUE 3: CONCLUSIÓN PATOLÓGICA DE ALTA (Recurso: Condition CIE-10)
  // ====================================================================
  doc.rect(40, 365, 532, 20).fill('#f1f5f9');
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b').text('3. DIAGNÓSTICO MÉDICO ASOCIADO (ESTÁNDAR INTEROPERABLE)', 45, 371);

  // Cuadro destacado para el código CIE-10 regulado
  doc.rect(40, 395, 532, 45).fill('#f8fafc').stroke('#e2e8f0');
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#ef4444').text(`[ ${diagnostico.codigo_enfermedad} ]`, 50, 410);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(diagnostico.descripcion.toUpperCase(), 130, 410, { width: 430 });

  // ====================================================================
  // 🔒 BLOQUE 4: TRAZA FORENSE LEGAL Y REGISTRO DE RECEPCIÓN
  // ====================================================================
  doc.rect(40, 460, 532, 20).fill('#f1f5f9');
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b').text('4. CERTIFICACIÓN DE LECTURA Y CONFORMIDAD ASISTENCIAL', 45, 466);

  doc.fontSize(8).font('Helvetica-Oblique').fillColor('#64748b').text(
    'Estampa de Seguridad Forense OWASP: Este documento digital fue visado por el personal clínico autorizado de la Red Nacional de Interoperabilidad. Toda consulta queda registrada de manera irrevocable en la colección de auditorías lógicas de la institución.',
    45, 490, { width: 522 }
  );

  // Líneas físicas vectoriales dinámicas para firmas impresas
  doc.moveTo(80, 580).lineTo(230, 580).lineWidth(1).stroke('#94a3b8');
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text(atencion.medico, 80, 588, { width: 150, align: 'center' });
  doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Firma y Timbre Profesional', 80, 600, { width: 150, align: 'center' });

  doc.moveTo(380, 580).lineTo(530, 580).lineWidth(1).stroke('#94a3b8');
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text(paciente.nombre, 380, 588, { width: 150, align: 'center' });
  doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Firma Paciente o Tutor Conforme', 380, 600, { width: 150, align: 'center' });

  // Pie de página institucional del Instituto Profesional Iplacex
  doc.fontSize(8).font('Helvetica').fillColor('#cbd5e1').text('www.iplacex.cl | Sistema Nacional Clínico de Pacientes 2026', 40, 740, { align: 'center' });

  // Cierre definitivo del lienzo y despacho del buffer por red
  doc.end();
};
