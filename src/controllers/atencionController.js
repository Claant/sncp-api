// controllers/atencionController.js
import mongoose from 'mongoose'; 
import * as dbConfig from '../config/db.js'; // Pool dinámico mediante getters ESM
import { construirFHIRBundle } from '../utils/fhirMapper.js';

// FUNCIÓN AUXILIAR MAESTRA: Asegura el formato de forma estricta (ej: 12345678-K)
const limpiarRut = (rutRaw) => {
    if (!rutRaw) return '';
    let limpio = rutRaw.replace(/[^0-9kK]/g, '').toUpperCase();
    if (limpio.length < 2) return limpio;
    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    return `${cuerpo}-${dv}`; 
};

// =========================================================================
// Caso de Uso: Registrar una nueva consulta médica tradicional (CU-003)
// =========================================================================
export const crearAtencion = async (req, res) => {
  const { paciente_id, motivo_consulta, codigo_enfermedad, descripcion } = req.body;

  if (!paciente_id || !motivo_consulta || !codigo_enfermedad || !descripcion) {
    return res.status(400).json({ msg: "Todos los campos son obligatorios." });
  }

  try {
    const connProd = dbConfig.getConnProd();

    if (!connProd) {
      console.error("❌ Error: El pool de conexiones connProd no está inicializado.");
      return res.status(503).json({ error: "DbError", msg: "Base de datos desconectada temporalmente." });
    }

    // OBTENCIÓN DIRECTA DE MODELOS DESDE LA CONEXIÓN (PUNTO 2)
    const AtencionMedicaProd = connProd.model("AtencionMedica");
    const DiagnosticoProd = connProd.model("Diagnostico");

    // Resolver identidad del médico firmante de manera tolerante
    const idMedicoAutenticado = req.usuario?._id || req.user?._id || req.usuario?.id || req.user?.id || null;

    if (!idMedicoAutenticado) {
      return res.status(401).json({ msg: "No se pudo verificar la identidad del médico que autoriza" });
    }

    const nuevaAtencion = new AtencionMedicaProd({
      paciente_id,
      usuario_id: idMedicoAutenticado,
      fecha: new Date(),
      motivo_consulta
    });
    await nuevaAtencion.save();

    const nuevoDiagnostico = new DiagnosticoProd({
      atencion_id: nuevaAtencion._id,
      paciente_id,
      codigo_enfermedad: codigo_enfermedad.trim().toUpperCase(),
      descripcion
    });
    await nuevoDiagnostico.save();

    nuevaAtencion.diagnostico_id = nuevoDiagnostico._id;
    await nuevaAtencion.save();

    return res.status(201).json({
      msg: "Atención médica y diagnóstico registrados exitosamente en la base de datos.",
      atencion: nuevaAtencion,
      diagnostico: nuevoDiagnostico
    });

  } catch (error) {
    console.error("⚠️ Error controlado en el controlador crearAtencion:", error.stack);
    return res.status(500).json({ 
      error: "InternalServerError",
      msg: "Ocurrió un error en el servidor al intentar registrar la atención clínica.", 
      detalles: error.message 
    });
  }
};

// =========================================================================
// Caso de Uso Reestructurado: Obtener el historial local en formato HL7 FHIR
// =========================================================================
export const obtenerHistorialPaciente = async (req, res) => {
    const { pacienteId } = req.params;
    try {
        if (!mongoose.Types.ObjectId.isValid(pacienteId)) {
            return res.status(400).json({ msg: "El ID del paciente no es válido." });
        }

        const connProd = dbConfig.getConnProd();
        if (!connProd) return res.status(503).json({ msg: "Base de datos desconectada temporalmente." });
        
        // OBTENCIÓN DIRECTA DE MODELOS DESDE LA CONEXIÓN (PUNTO 2)
        const AtencionMedicaProd = connProd.model("AtencionMedica");
        const DiagnosticoProd = connProd.model("Diagnostico");
        const PacienteProd = connProd.model("Paciente");

        // 1. Extraer los datos demográficos básicos del paciente local con .lean() (PUNTO 3)
        const pacienteLocal = await PacienteProd.findById(pacienteId).populate("direccion_id").lean();
        if (!pacienteLocal) {
            return res.status(404).json({ msg: "Paciente no registrado en la base de datos local (sistema-informacion-clinica) de este centro de salud" });
        }

        // 2. Extraer el historial de consultas cronológicas locales con .lean() (PUNTO 3)
        const historialAtenciones = await AtencionMedicaProd.find({ paciente_id: pacienteId })
            .populate({
                path: 'usuario_id',
                select: 'nombre especialidad rut'
            })
            .sort({ fecha: -1 })
            .lean();

        // 3. Extraer los diagnósticos locales amarrados a este bloque de atenciones con .lean() (PUNTO 3)
        const diagnosticosLocales = await DiagnosticoProd.find({
            atencion_id: { $in: historialAtenciones.map(a => a._id) }
        }).lean();

        // CAPA DE TRADUCCIÓN INTEROPERABLE: MONGO LOCAL JSON ➡️ HL7 FHIR BUNDLE
        const fhirBundleLocal = construirFHIRBundle(pacienteLocal, historialAtenciones, diagnosticosLocales);

        // 4. Retorno de Interoperabilidad Homologado
        return res.status(200).json({
            origen: "local (pool-producción)",
            msg: "Historial asistencial de producción convertido exitosamente al estándar clínico HL7 FHIR.",
            fhirBundle: fhirBundleLocal
        });

    } catch (error) {
        console.error('⚠️ Error controlado al procesar historial clínico local FHIR:', error.message);
        return res.status(500).json({ 
            error: "InternalServerError",
            msg: 'Error del servidor al procesar y convertir el historial clínico local a FHIR.' 
        });
    }
};

// =========================================================================
// Caso de Uso: Registrar consulta completa con alta express (4 Form / Transacción ACID)
// =========================================================================
export const crearAtencionFichaNueva = async (req, res) => {
    const {
        calle, numero, comuna, ciudad,
        rut, nombre, fecha_nacimiento, centro_salud_id,
        motivo_consulta, fecha,
        codigo_enfermedad, descripcion
    } = req.body;

    if (!calle || !numero || !comuna || !ciudad || !rut || !nombre || !fecha_nacimiento || !centro_salud_id || !motivo_consulta || !codigo_enfermedad || !descripcion) {
        return res.status(400).json({ msg: 'Por favor, complete todos los campos requeridos en la ficha unificada.' });
    }

    const connProd = dbConfig.getConnProd();
    if (!connProd) {
        return res.status(503).json({ error: "DbError", msg: "Base de datos sistema-informacion-clinica no disponible para operaciones compuestas" });
    }

    // Generar la sesión apuntando de forma estricta al pool connProd
    const session = await connProd.startSession();
    
    try {
        session.startTransaction(); 

        // OBTENCIÓN DIRECTA DE MODELOS DESDE LA CONEXIÓN (PUNTO 2)
        const PacienteProd = connProd.model("Paciente");
        const DireccionProd = connProd.model("Direccion");
        const AtencionMedicaProd = connProd.model("AtencionMedica");
        const DiagnosticoProd = connProd.model("Diagnostico");

        const rutSanitizado = limpiarRut(rut);

        const pacienteExiste = await PacienteProd.findOne({ rut: rutSanitizado }).session(session);
        if (pacienteExiste) {
            await session.abortTransaction();  
            session.endSession();
            return res.status(400).json({ msg: 'El RUT de este paciente ya existe en los registros de la base de datos sistema-informacion-clinica de este CESFAM' });
        }

        const nuevaDireccion = new DireccionProd({ calle, numero, comuna, ciudad });
        const [direccionGuardada] = await DireccionProd.create([nuevaDireccion], { session });

        const nuevoPaciente = new PacienteProd({
            rut: rutSanitizado, 
            nombre,
            fecha_nacimiento,
            direccion_id: direccionGuardada._id, 
            centro_salud_id
        });
        const [pacienteGuardado] = await PacienteProd.create([nuevoPaciente], { session });

        const usuario_id = req.usuario?.id || req.usuario?._id || req.usuario?.usuario?.id || req.user?._id || req.user?.id;

        const nuevaAtencion = new AtencionMedicaProd({
            paciente_id: pacienteGuardado._id, 
            usuario_id,        
            fecha: fecha || new Date(),
            motivo_consulta
        });
        const [atencionGuardada] = await AtencionMedicaProd.create([nuevaAtencion], { session });

        const nuevoDiagnostico = new DiagnosticoProd({
            atencion_id: atencionGuardada._id, 
            paciente_id: pacienteGuardado._id,
            codigo_enfermedad: codigo_enfermedad.trim().toUpperCase(), 
            descripcion
        });
        await DiagnosticoProd.create([nuevoDiagnostico], { session });

        await session.commitTransaction();  
        session.endSession();

        return res.status(201).json({
            msg: 'Expediente clínico registrado con éxito en la base de datos de este centro médico',
            paciente_id: pacienteGuardado._id,
            atencion_id: atencionGuardada._id
        });

    } catch (error) {
        const errorMsg = error?.message || '';
        console.warn('⚠️ Flujo transaccional interrumpido. Evaluando contingencia local...', errorMsg);

        // EVALUACIÓN DE CONTINGENCIA SI EL MOTOR NO ADMITE TRANSACCIONES
        if (errorMsg.includes('transact') || errorMsg.includes('replica set') || errorMsg.includes('transaction') || errorMsg.includes('session')) {
            try {
                try { await session.abortTransaction(); } catch (e) {}
                session.endSession();

                // OBTENCIÓN DIRECTA DE MODELOS
                const PacienteProd = connProd.model("Paciente");
                const DireccionProd = connProd.model("Direccion");
                const AtencionMedicaProd = connProd.model("AtencionMedica");
                const DiagnosticoProd = connProd.model("Diagnostico");

                const rutSanitizado = limpiarRut(rut);

                const pacienteExisteNormal = await PacienteProd.findOne({ rut: rutSanitizado });
                if (pacienteExisteNormal) {
                    return res.status(400).json({ msg: 'El RUT de este paciente ya figura en los registros de este centro médico.' });
                }

                const dirNormal = await DireccionProd.create({ calle, numero, comuna, ciudad });
                
                const pacNormal = await PacienteProd.create({
                    rut: rutSanitizado, 
                    nombre,
                    fecha_nacimiento,
                    direccion_id: dirNormal._id,
                    centro_salud_id
                });

                const usuario_id = req.usuario?.id || req.usuario?._id || req.usuario?.usuario?.id || req.user?._id || req.user?.id;

                const atenNormal = await AtencionMedicaProd.create({
                    paciente_id: pacNormal._id,
                    usuario_id,
                    fecha: fecha || new Date(),
                    motivo_consulta
                });

                await DiagnosticoProd.create({
                    atencion_id: atenNormal._id,
                    paciente_id: pacNormal._id,
                    codigo_enfermedad: codigo_enfermedad.trim().toUpperCase(),
                    descripcion
                });

                console.log('Contingencia local completada exitosamente en el Pool activo.');

                return res.status(201).json({
                    msg: 'Expediente clínico registrado exitosamente (Modo Resiliente Local).',
                    paciente_id: pacNormal._id,
                    atencion_id: atenNormal._id
                });

            } catch (errNormal) {
                console.error('⚠️ Falla crítica real en cascada normal de respaldo:', errNormal.message);
                return res.status(500).json({ msg: `Falla crítica en inserción de datos directa: ${errNormal.message}` });
            }
        }

        try {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
        } catch (e) {}
        session.endSession();

        console.error('⚠️ Error definitivo abortado por el controlador:', error.message);
        return res.status(500).json({ msg: `Error interno al procesar el expediente compuesto: ${error.message}` });
    }
};