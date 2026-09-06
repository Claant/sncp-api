// controllers/atencionController.js
import mongoose from 'mongoose'; 
import * as dbConfig from '../config/db.js'; // 🚀 Pool dinámico mediante getters ESM

// IMPORTACIÓN EXCLUSIVA DE ESQUEMAS CLÍNICOS: Previene el colapso del ModuleLoader en ESM
import { atencionMedicaSchema } from '../models/AtencionMedica.js';
import { direccionSchema } from '../models/Direccion.js';
import { pacienteSchema } from '../models/Paciente.js';
import { diagnosticoSchema } from '../models/Diagnostico.js';
import { bitacoraSchema } from '../models/BitacoraAcceso.js'; // 🚀 UNIFICADO: Esquema maestro definitivo
import { usuarioSchema } from '../models/Usuario.js';

// FUNCIÓN AUXILIAR MAESTRA: Asegura el formato de forma estricta (ej: 12345678-K)
const limpiarRut = (rutRaw) => {
    if (!rutRaw) return '';
    let limpio = rutRaw.replace(/[^0-9kK]/g, '').toUpperCase();
    if (limpio.length < 2) return limpio;
    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    return `${cuerpo}-${dv}`; 
};

// 🔹 AUXILIAR DE COMPILACIÓN EN CALIENTE: Garantiza que los modelos apunten a la conexión activa
const getModelosProd = (connProd) => {
    const AtencionMedicaProd = connProd.models.AtencionMedica || connProd.model("AtencionMedica", atencionMedicaSchema, "atencion-medica");
    const DiagnosticoProd = connProd.models.Diagnostico || connProd.model("Diagnostico", diagnosticoSchema, "diagnosticos");
    const PacienteProd = connProd.models.Paciente || connProd.model("Paciente", pacienteSchema, "pacientes");
    const DireccionProd = connProd.models.Direccion || connProd.model("Direccion", direccionSchema, "direcciones");
    
    // 🚀 CORRECCIÓN CRÍTICA: Se inyecta el esquema maestro unificado para evitar fallas estructurales de campos obligatorios
    const BitacoraAccesoProd = connProd.models.BitacoraAcceso || connProd.model("BitacoraAcceso", bitacoraSchema, "bitacora-accesos");

    if (!connProd.models.Usuario) connProd.model("Usuario", usuarioSchema, "usuarios");

    return { AtencionMedicaProd, DiagnosticoProd, PacienteProd, DireccionProd, BitacoraAccesoProd };
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

    const { AtencionMedicaProd, DiagnosticoProd, BitacoraAccesoProd } = getModelosProd(connProd);

    // Resolver identidad del médico firmante de manera tolerante
    const idMedicoAutenticado = req.usuario?._id || req.user?._id || req.usuario?.id || req.user?.id || null;

    if (!idMedicoAutenticado) {
      return res.status(401).json({ msg: "No se pudo verificar la identidad legal del médico firmante." });
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

    // 🚀 CORRECCIÓN CRÍTICA OWASP: Inyectamos los strings sanitizados requeridos por el esquema unificado
    await BitacoraAccesoProd.create({
      paciente_id: new mongoose.Types.ObjectId(paciente_id),
      usuario_id: new mongoose.Types.ObjectId(idMedicoAutenticado),
      nombre_medico: req.user?.nombre || req.usuario?.nombre || "Especialista de Turno", // Evita el ValidationError
      rol_consultado: req.usuario?.rol || req.user?.rol || "medico",
      atencion_id: nuevaAtencion._id,
      fecha_consulta: new Date()
    });

    console.log('🔒 Log de auditoría OWASP unificado registrado exitosamente en Atlas.');

    return res.status(201).json({
      msg: "Atención médica tradicional y diagnóstico CIE-10 registrados exitosamente en Atlas.",
      atencion: nuevaAtencion,
      diagnostico: nuevoDiagnostico
    });

  } catch (error) {
    console.error("❌ Error controlado en el controlador crearAtencion:", error.stack);
    return res.status(500).json({ 
      error: "InternalServerError",
      msg: "Ocurrió un error en el servidor al intentar registrar la atención clínica.", 
      detalles: error.message 
    });
  }
};
// =========================================================================
// Caso de Uso: Obtener el historial de consultas de un paciente específico
// =========================================================================
export const obtenerHistorialPaciente = async (req, res) => {
    const { pacienteId } = req.params;

    try {
        const connProd = dbConfig.getConnProd();
        if (!connProd) return res.status(503).json({ msg: "Base de datos desconectada temporalmente." });

        const { AtencionMedicaProd } = getModelosProd(connProd);

        const historial = await AtencionMedicaProd.find({ paciente_id: pacienteId })
            .populate({
                path: 'usuario_id',
                select: 'nombre especialidad rut'
            })
            .sort({ fecha: -1 });

        return res.json(historial);
    } catch (error) {
        console.error('❌ Error al obtener historial clínico:', error.message);
        return res.status(500).json({ msg: 'Error al cargar el historial clínico del paciente.' });
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
        return res.status(503).json({ error: "DbError", msg: "Base de datos de producción no disponible para operaciones compuestas." });
    }

    // Generar la sesión apuntando de forma estricta al pool connProd
    const session = await connProd.startSession();
    
    try {
        session.startTransaction(); 

        const { PacienteProd, DireccionProd, AtencionMedicaProd, DiagnosticoProd, BitacoraAccesoProd } = getModelosProd(connProd);
        const rutSanitizado = limpiarRut(rut);

        const pacienteExiste = await PacienteProd.findOne({ rut: rutSanitizado }).session(session);
        if (pacienteExiste) {
            await session.abortTransaction();  
            session.endSession();
            return res.status(400).json({ msg: 'El RUT de este paciente ya figura en el Sistema Nacional Clínico.' });
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

        // 🚀 REGISTRO FORENSE EN TRANSACCIÓN: Inyectamos auditoría unificada dentro de la sesión ACID
        await BitacoraAccesoProd.create([{
            paciente_id: pacienteGuardado._id,
            usuario_id: new mongoose.Types.ObjectId(usuario_id),
            nombre_medico: req.user?.nombre || req.usuario?.nombre || "Especialista de Turno",
            rol_consultado: req.user?.rol || req.usuario?.rol || "medico",
            atencion_id: atencionGuardada._id,
            fecha_consulta: new Date()
        }], { session });

        await session.commitTransaction();  
        session.endSession();

        return res.status(201).json({
            msg: 'Expediente clínico integral registrado exitosamente en el sistema nacional.',
            paciente_id: pacienteGuardado._id,
            atencion_id: atencionGuardada._id
        });

    } catch (error) {
        const errorMsg = error?.message || '';
        console.warn('⚠️ Flujo transaccional interrumpido. Evaluando contingencia local...', errorMsg);

        // EVALUACIÓN DE CONTINGENCIA SI EL MOTOR NO ADMITE TRANSACCIONES (Ej: Standalone local)
        if (errorMsg.includes('transact') || errorMsg.includes('replica set') || errorMsg.includes('transaction') || errorMsg.includes('session')) {
            try {
                try { await session.abortTransaction(); } catch (e) {}
                session.endSession();

                const { PacienteProd, DireccionProd, AtencionMedicaProd, DiagnosticoProd, BitacoraAccesoProd } = getModelosProd(connProd);
                const rutSanitizado = limpiarRut(rut);

                const pacienteExisteNormal = await PacienteProd.findOne({ rut: rutSanitizado });
                if (pacienteExisteNormal) {
                    return res.status(400).json({ msg: 'El RUT de este paciente ya figura en el Sistema Nacional Clínico.' });
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

                // Inyección forense resiliente local
                await BitacoraAccesoProd.create({
                    paciente_id: pacNormal._id,
                    usuario_id: new mongoose.Types.ObjectId(usuario_id),
                    nombre_medico: req.user?.nombre || req.usuario?.nombre || "Especialista de Turno",
                    rol_consultado: req.user?.rol || req.usuario?.rol || "medico",
                    atencion_id: atenNormal._id,
                    fecha_consulta: new Date()
                });

                console.log('🚀 Contingencia local completada exitosamente en el Pool activo.');
                return res.status(201).json({
                    msg: 'Expediente clínico registrado exitosamente (Modo Resiliente Local).',
                    paciente_id: pacNormal._id,
                    atencion_id: atenNormal._id
                });

            } catch (errNormal) {
                console.error('❌ Falla crítica real en cascada normal de respaldo:', errNormal.message);
                return res.status(500).json({ msg: `Falla crítica en inserción de datos directa: ${errNormal.message}` });
            }
        }

        // Control de excepciones tradicional si el error original no era de entorno transaccional
        try {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
        } catch (e) {}
        session.endSession();

        console.error('❌ Error definitivo abortado por el controlador:', error.message);
        return res.status(500).json({ msg: `Error interno al procesar el expediente compuesto: ${error.message}` });
    }
};
