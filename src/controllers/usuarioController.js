import mongoose from 'mongoose'; 
import Usuario from '../models/Usuario.js';

// FUNCIÓN AUXILIAR MAESTRA: Asegura el formato de forma estricta (ej: 12345678-K)
// esta funcion limpia el RUT eliminando caracteres no numéricos y asegurando que la letra verificador esté en mayúscula
const limpiarRut = (rutRaw) => {
    if (!rutRaw) return '';
    let limpio = rutRaw.replace(/[^0-9kK]/g, '').toUpperCase();
    if (limpio.length < 2) return limpio;
    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    return `${cuerpo}-${dv}`; 
};

// Función auxiliar para sanitizar el correo electrónico
// lo que hace esta función es eliminar espacios en blanco al inicio y al final, y convertir todo a minúsculas
const limpiarCorreo = (correoRaw) => {
    if (!correoRaw) return '';
    return correoRaw.trim().toLowerCase();
};

// Caso de Uso: Registrar un nuevo usuario (Médico o Administrador) - CU-005
export const crearUsuario = async (req, res) => {
    const { rut, nombre, correo, rol, especialidad, centro_salud_id, username, password } = req.body;

    if (!rut || !nombre || !correo || !rol || !centro_salud_id || !username || !password) {
        return res.status(400).json({ msg: 'Por favor, complete todos los campos obligatorios.' });
    }

    try {
        const correoSanitizado = limpiarCorreo(correo);
        const rutSanitizado = limpiarRut(rut); // [Seguridad] Sanitización homóloga a Paciente

        // Verificar si el RUT, Username o Correo ya existen para evitar duplicados
        const usuarioExistente = await Usuario.findOne({ 
            $or: [{ rut: rutSanitizado }, { username }, { correo: correoSanitizado }] 
        }).lean();
        
        if (usuarioExistente) {
            return res.status(400).json({ msg: 'El RUT, correo o username ya se encuentran registrados.' });
        }

        const nuevoUsuario = new Usuario({
            rut: rutSanitizado,
            nombre: nombre.trim(),
            correo: correoSanitizado, 
            rol,
            especialidad: rol === 'medico' && especialidad ? especialidad.trim() : undefined,
            centro_salud_id,
            username: username.trim().toLowerCase(),
            password 
        });

        await nuevoUsuario.save();

        return res.status(201).json({
            msg: 'Usuario creado exitosamente en el sistema clínico.',
            usuario: {
                id: nuevoUsuario._id,
                nombre: nuevoUsuario.nombre,
                rol: nuevoUsuario.rol
            }
        });

    } catch (error) {
        console.error('Error al crear usuario:', error.message);
        return res.status(500).json({ msg: 'Error en el servidor al registrar el usuario.' });
    }
};

// Obtener todos los usuarios (para listar médicos en Vue)
export const obtenerUsuarios = async (req, res) => {
    try {
        // [Optimización] .lean() acelera las peticiones GET de alta concurrencia
        const usuarios = await Usuario.find()
            .populate('centro_salud_id', 'nombre_centro nombre') 
            .select('-password')
            .sort({ createdAt: -1 })
            .lean();
            
        return res.json(usuarios);
    } catch (error) {
        console.error('Error al obtener usuarios:', error.message);
        return res.status(500).json({ msg: 'Error al obtener la lista de usuarios.' });
    }
};

// CRUD ACCIÓN 1: Alternar estado operativo (Habilitar / Suspender Médico)
export const actualizarEstadoUsuario = async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body; 

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ msg: 'El ID de usuario proporcionado no es válido.' });
    }

    try {
        const usuarioActualizado = await Usuario.findByIdAndUpdate(
            id,
            { activo },
            { new: true }
        ).select('-password').lean();

        if (!usuarioActualizado) {
            return res.status(404).json({ msg: 'El profesional de salud no existe en el sistema nacional.' });
        }

        const accionTexto = activo ? 'habilitado' : 'suspendido';
        return res.json({ 
            msg: `El profesional ${usuarioActualizado.nombre} ha sido ${accionTexto} exitosamente en Atlas.`,
            usuario: usuarioActualizado
        });

    } catch (error) {
        console.error('Error al actualizar estado del usuario:', error.message);
        return res.status(500).json({ msg: 'Error interno del servidor al procesar el cambio de estado.' });
    }
};

// CRUD ACCIÓN 2: Editar antecedentes básicos (Especialidad y Centro Base)
export const editarUsuarioMedico = async (req, res) => {
    const { id } = req.params;
    const { especialidad, centro_salud_id } = req.body; 

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ msg: 'El ID de usuario proporcionado no es válido.' });
    }

    if (!especialidad || !centro_salud_id) {
        return res.status(400).json({ msg: 'Por favor, complete todos los campos obligatorios para la actualización.' });
    }

    try {
        const usuarioModificado = await Usuario.findByIdAndUpdate(
            id,
            { especialidad: especialidad.trim(), centro_salud_id },
            { new: true }
        ).select('-password').lean();

        if (!usuarioModificado) {
            return res.status(404).json({ msg: 'El registro médico solicitado no figura en la red asistencial.' });
        }

        return res.json({ 
            msg: `Perfil clínico de Dra./Dr. ${usuarioModificado.nombre} actualizado de forma exitosa.`,
            usuario: usuarioModificado
        });

    } catch (error) {
        console.error('Error al editar datos del médico:', error.message);
        return res.status(500).json({ msg: 'Error en el servidor al intentar modificar el perfil del especialista.' });
    }
};

// CRUD ACCIÓN 3: Remoción Física Permanente de la Base de Datos
export const eliminarUsuarioDefinitivo = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ msg: 'El ID de usuario proporcionado no es válido.' });
    }

    try {
        const usuarioEliminado = await Usuario.findByIdAndDelete(id).lean();

        if (!usuarioEliminado) {
            return res.status(404).json({ msg: 'El usuario que intenta remover no existe en el sistema nacional.' });
        }

        return res.json({ 
            msg: `El usuario ${usuarioEliminado.nombre} (RUT: ${usuarioEliminado.rut}) fue removido permanentemente de MongoDB Atlas.` 
        });

    } catch (error) {
        console.error('Error al eliminar usuario de Atlas:', error.message);
        return res.status(500).json({ msg: 'Error interno del servidor al procesar la baja física del registro.' });
    }
};
