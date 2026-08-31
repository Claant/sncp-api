import mongoose from 'mongoose'; 
import AtencionMedica from '../models/AtencionMedica.js';
import Direccion from '../models/Direccion.js';
import Paciente from '../models/Paciente.js';
import Diagnostico from '../models/Diagnostico.js';

// FUNCIÓN AUXILIAR MAESTRA: Asegura el formato de forma estricta (ej: 12345678-K)
const limpiarRut = (rutRaw) => {
    if (!rutRaw) return '';
    
    // 1. Filtra y limpia puntos, espacios o guiones mal puestos, dejando solo números y la letra K
    let limpio = rutRaw.replace(/[^0-9kK]/g, '').toUpperCase();
    
    if (limpio.length < 2) return limpio;

    // 2. Extrae el dígito verificador (último carácter) y el cuerpo numérico
    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    
    // 3. Retorna la cadena unificada garantizando el guion intermedio
    return `${cuerpo}-${dv}`; 
};

// Caso de Uso: Registrar una nueva consulta médica tradicional (CU-003)
export const crearAtencion = async (req, res) => {
    const { paciente_id, fecha, motivo_consulta, codigo_enfermedad, descripcion } = req.body;

    // Validación de entrada unificada
    if (!paciente_id || !motivo_consulta || !codigo_enfermedad || !descripcion) {
        return res.status(400).json({ msg: 'Por favor, complete todos los campos obligatorios (Datos de Consulta y Conclusiones Patológicas).' });
    }

    try {
        // Doble trazabilidad compatible del ID del médico proveniente del JWT
        const usuario_id = req.usuario?.id || req.usuario?._id || req.usuario?.usuario?.id;

        // PASO 1: Persistencia directa de la atención
        const nuevaAtencion = new AtencionMedica({
            paciente_id,
            usuario_id, 
            fecha: fecha || new Date(), 
            motivo_consulta
        });
        const atencionGuardada = await nuevaAtencion.save();

        // PASO 2: Persistencia directa del diagnóstico amarrado a la consulta
        const nuevoDiagnostico = new Diagnostico({
            atencion_id: atencionGuardada._id,
            codigo_enfermedad,
            descripcion
        });
        await nuevoDiagnostico.save();

        return res.status(201).json({ 
            msg: 'Atención médica e informe de diagnóstico registrados de forma exitosa.', 
            atencion: atencionGuardada 
        });

    } catch (error) {
        console.error('Error al registrar atención médica:', error.message);
        return res.status(500).json({ msg: `Error interno del servidor al procesar la atención: ${error.message}` });
    }
};

// Caso de Uso: Obtener el historial de consultas de un paciente específico
export const obtenerHistorialPaciente = async (req, res) => {
    const { pacienteId } = req.params;

    try {
        const historial = await AtencionMedica.find({ paciente_id: pacienteId })
            .populate({
                path: 'usuario_id',
                select: 'nombre especialidad rut'
            })
            .sort({ fecha: -1 });

        return res.json(historial);
    } catch (error) {
        console.error('Error al obtener historial clínico:', error.message);
        return res.status(500).json({ msg: 'Error al cargar el historial clínico del paciente.' });
    }
};

// Caso de Uso: Registrar una consulta completa con alta de paciente express (4 Formularios en 1 Transacción ACID)
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

    const session = await mongoose.startSession();
    
    try {
        session.startTransaction();  // aca inicia la transacción ACID, significando que todas las operaciones siguientes deben completarse correctamente o ninguna se aplicará.

        const rutSanitizado = limpiarRut(rut);

        const pacienteExiste = await Paciente.findOne({ rut: rutSanitizado }).session(session);
        if (pacienteExiste) {
            await session.abortTransaction();  // aca aborta la transacción si el paciente ya existe, asegurando que no se guarden datos parciales.
            session.endSession();
            return res.status(400).json({ msg: 'El RUT de este paciente ya figura en el Sistema Nacional Clínico.' });
        }

        const nuevaDireccion = new Direccion({ calle, numero, comuna, ciudad });
        const [direccionGuardada] = await Direccion.create([nuevaDireccion], { session });

        const nuevoPaciente = new Paciente({
            rut: rutSanitizado, // Guardado exacto sin puntos y con guion
            nombre,
            fecha_nacimiento,
            direccion_id: direccionGuardada._id, 
            centro_salud_id
        });
        const [pacienteGuardado] = await Paciente.create([nuevoPaciente], { session });

        const usuario_id = req.usuario?.id || req.usuario?._id || req.usuario?.usuario?.id;

        const nuevaAtencion = new AtencionMedica({
            paciente_id: pacienteGuardado._id, 
            usuario_id,        
            fecha: fecha || new Date(),
            motivo_consulta
        });
        const [atencionGuardada] = await AtencionMedica.create([nuevaAtencion], { session });

        const nuevoDiagnostico = new Diagnostico({
            atencion_id: atencionGuardada._id, 
            codigo_enfermedad, 
            descripcion
        });
        await Diagnostico.create([nuevoDiagnostico], { session });

        await session.commitTransaction();  
        session.endSession();

        return res.status(201).json({
            msg: 'Expediente clínico integral registrado exitosamente en el sistema nacional.',
            paciente_id: pacienteGuardado._id,
            atencion_id: atencionGuardada._id
        });

    } catch (error) {
        const errorMsg = error?.message || '';
        console.warn('Flujo transaccional interrumpido. Evaluando contingencia local...', errorMsg);

        // ====================================================================
        // MODO RESILIENTE LOCAL: Bypass automático si la BD no tiene réplicas
        // ====================================================================
        if (errorMsg.includes('transact') || errorMsg.includes('replica set') || errorMsg.includes('transaction') || errorMsg.includes('session')) {
            try {
                try { await session.abortTransaction(); } catch (e) {}
                session.endSession();

                const rutSanitizado = limpiarRut(rut);

                const pacienteExisteNormal = await Paciente.findOne({ rut: rutSanitizado });
                if (pacienteExisteNormal) {
                    return res.status(400).json({ msg: 'El RUT de este paciente ya figura en el Sistema Nacional Clínico.' });
                }

                const dirNormal = await Direccion.create({ calle, numero, comuna, ciudad });
                
                const pacNormal = await Paciente.create({
                    rut: rutSanitizado, // Contingencia local también guardada con guion
                    nombre,
                    fecha_nacimiento,
                    direccion_id: dirNormal._id,
                    centro_salud_id
                });

                const usuario_id = req.usuario?.id || req.usuario?._id || req.usuario?.usuario?.id;

                const atenNormal = await AtencionMedica.create({
                    paciente_id: pacNormal._id,
                    usuario_id,
                    fecha: fecha || new Date(),
                    motivo_consulta
                });

                await Diagnostico.create({
                    atencion_id: atenNormal._id,
                    codigo_enfermedad,
                    descripcion
                });

                console.log('Contingencia local completada exitosamente.');
                return res.status(201).json({
                    msg: 'Expediente clínico registrado exitosamente (Modo Resiliente Local).',
                    paciente_id: pacNormal._id,
                    atencion_id: atenNormal._id
                });

            } catch (errNormal) {
                console.error('Falla crítica real en cascada normal de respaldo:', errNormal.message);
                return res.status(500).json({ msg: `Falla crítica en inserción de datos directa: ${errNormal.message}` });
            }
        }

        // Control de excepciones tradicional si el error no era de entorno
        try {
            await session.abortTransaction();
        } catch (e) {}
        session.endSession();

        console.error('Error definitivo abortado por el controlador:', error.message);
        return res.status(500).json({ msg: `Error interno al procesar el expediente compuesto: ${error.message}` });
    }
};
