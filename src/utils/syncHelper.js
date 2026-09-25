// utils/syncHelper.js
import * as dbConfig from '../config/db.js';

/**
 * Reconcilia e integra atenciones y diagnósticos externos en un paciente local preexistente.
 * Compara las marcas de tiempo de las atenciones para prevenir duplicados.
 */
export const fusionarAtencionesExternas = async (pacienteLocalId, atencionesExternas = [], idMedicoAutenticado) => {
  if (!atencionesExternas || atencionesExternas.length === 0) return 0;

  const connProd = dbConfig.getConnProd();
  if (!connProd) throw new Error("Pool de conexiones de producción no disponible para la sincronización.");

  // Obtención directa de modelos precompilados en db.js
  const AtencionMedicaProd = connProd.model("AtencionMedica");
  const DiagnosticoProd = connProd.model("Diagnostico");

  // 1. Cargar las fechas de atenciones locales existentes para comparación ágil (.lean())
  const atencionesLocales = await AtencionMedicaProd.find({ paciente_id: pacienteLocalId })
    .select("fecha")
    .lean();

  const fechasLocalesSet = new Set(
    atencionesLocales.map(a => new Date(a.fecha).getTime())
  );

  let nuevosRegistros = 0;

  // 2. Iterar sobre las atenciones traídas de la base de datos externa / Bundle FHIR
  for (const atenExt of atencionesExternas) {
    const timestampExt = new Date(atenExt.fecha).getTime();

    // Si la atención externa NO existe en el historial local, la importamos
    if (!fechasLocalesSet.has(timestampExt)) {
      const nombreCentroRemoto = atenExt.nombre_centro || atenExt.centro_salud_nombre || "CESFAM Las Compañías";
      const nuevaAtencion = new AtencionMedicaProd({
  paciente_id: pacienteLocalId,
  usuario_id: idMedicoAutenticado,
  fecha: atenExt.fecha || new Date(),
  // Guardamos la procedencia y el establecimiento original en el motivo clínico
  motivo_consulta: `[RED EXTERNA - ${nombreCentroRemoto}] ${atenExt.motivo_consulta || 'Consulta de Interoperabilidad'}`
});
      await nuevaAtencion.save();

      // Si la atención externa incluye un diagnóstico CIE-10, se vincula
      if (atenExt.diagnostico || atenExt.codigo_enfermedad) {
        const codigo = atenExt.diagnostico?.codigo_enfermedad || atenExt.codigo_enfermedad || "Z00.0";
        const descripcion = atenExt.diagnostico?.descripcion || atenExt.descripcion || "Diagnóstico importado desde red externa";

        const nuevoDiagnostico = new DiagnosticoProd({
          atencion_id: nuevaAtencion._id,
          paciente_id: pacienteLocalId,
          codigo_enfermedad: codigo.trim().toUpperCase(),
          descripcion: descripcion.trim()
        });
        await nuevoDiagnostico.save();

        nuevaAtencion.diagnostico_id = nuevoDiagnostico._id;
        await nuevaAtencion.save();
      }

      // Agregar la fecha al Set para evitar duplicados en la misma iteración
      fechasLocalesSet.add(timestampExt);
      nuevosRegistros++;
    }
  }

  return nuevosRegistros;
};