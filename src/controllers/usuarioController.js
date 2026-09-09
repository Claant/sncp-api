// controllers/usuarioController.js
import mongoose from 'mongoose'; 
import * as dbConfig from '../config/db.js'; // CORRECCIÓN: Uso de getters dinámicos de ESM

// IMPORTACIÓN EXCLUSIVA DE ESQUEMAS: Previene el colapso del ModuleLoader en ESM
import { usuarioSchema } from '../models/Usuario.js';
import { centroSaludSchema } from '../models/CentroSalud.js';

// FUNCIÓN AUXILIAR MAESTRA: Asegura el formato de forma estricta (ej: 12345678-K)
const limpiarRut = (rutRaw) => {
    if (!rutRaw) return '';
    let limpio = rutRaw.replace(/[^0-9kK]/g, '').toUpperCase();
    if (limpio.length < 2) return limpio;
    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    return `${cuerpo}-${dv}`; 
};

// Función auxiliar para sanitizar el correo electrónico
const limpiarCorreo = (correoRaw) => {
    if (!correoRaw) return '';
    return correoRaw.trim().toLowerCase();
};

// ====================================================================
// Caso de Uso: Registrar un nuevo usuario (Médico o Administrador) - CU-005
// ====================================================================
export const crearUsuario = async (req, res) => {
    const { rut, nombre, correo, rol, especialidad, centro_salud_id, username, password } = req.body;

    if (!rut || !nombre || !correo || !rol || !centro_salud_id || !username || !password) {
        return res.status(400).json({ msg: 'Por favor, complete todos los campos obligatorios.' });
    }

    try {
        // CORRECCIÓN: Resolvemos el pool mediante el getter dinámico
        const connProd = dbConfig.getConnProd();
        if (!connProd) {
            return res.status(503).json({ msg: "Base de datos de producción no disponible temporalmente." });
        }

        // Enlazar dinámicamente el modelo al pool activo de producción
        const UsuarioProd = connProd.models.Usuario || connProd.model('Usuario', usuarioSchema, 'usuarios');

        const correoSanitizado = limpiarCorreo(correo);
        const rutSanitizado = limpiarRut(rut); 

        // Verificar si el RUT, Username o Correo ya existen para evitar duplicados
        const usuarioExistente = await UsuarioProd.findOne({ 
            $or: [{ rut: rutSanitizado }, { username }, { correo: correoSanitizado }] 
        }).lean();
        
        if (usuarioExistente) {
            return res.status(400).json({ msg: 'El RUT, correo o username ya se encuentran registrados.' });
        }

        const nuevoUsuario = new UsuarioProd({
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
        console.error('⚠️ Error al crear usuario:', error.message);
        return res.status(500).json({ msg: 'Error en el servidor al registrar el usuario.' });
    }
};

// ====================================================================
// 🚀 OPTIMIZADO: Obtener usuarios con paginación a nivel de servidor
// Evita la sobrecarga de la CPU de Atlas y la saturación del ancho de banda de red
// ====================================================================
export const obtenerUsuarios = async (req, res) => {
    try {
        // CORRECCIÓN: Resolvemos el pool mediante el getter dinámico
        const connProd = dbConfig.getConnProd();
        if (!connProd) {
            return res.status(503).json({ msg: "Base de datos de producción no disponible." });
        }

        const UsuarioProd = connProd.models.Usuario || connProd.model('Usuario', usuarioSchema, 'usuarios');
        
        // Asegurar que el submodelo de población esté inyectado en el pool activo
        if (!connProd.models.CentroSalud) {
            connProd.model('CentroSalud', centroSaludSchema, 'centro-salud');
        }

        // Parámetros de paginación extraídos de la URL query string
        const pagina = parseInt(req.query.page) || 1;
        const limite = parseInt(req.query.limit) || 10;
        const saltar = (pagina - 1) * limite;

        // Ejecución concurrente ultra eficiente utilizando el índice físico en Mongo Atlas
        const [usuarios, totalUsuarios] = await Promise.all([
            UsuarioProd.find()
                .populate('centro_salud_id', 'nombre_centro nombre') 
                .select('-password')
                .sort({ createdAt: -1 }) 
                .skip(saltar)
                .limit(limite)
                .lean(),
            UsuarioProd.countDocuments()
        ]);
            
        // Retornamos payload paginado estructurado idóneo para el consumo del frontend
        return res.json({
            usuarios,
            paginacion: {
                total: totalUsuarios,
                paginasTotales: Math.ceil(totalUsuarios / limite),
                paginaActual: pagina,
                limite
            }
        });
    } catch (error) {
        console.error('⚠️ Error al obtener usuarios:', error.message);
        return res.status(500).json({ msg: 'Error al obtener la lista de usuarios.' });
    }
};
// ====================================================================
// CRUD ACCIÓN 1: Alternar estado operativo (Habilitar / Suspender Médico)
// ====================================================================
export const actualizarEstadoUsuario = async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body; 

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ msg: 'El ID de usuario proporcionado no es válido.' });
    }

    try {
        // CORRECCIÓN: Resolvemos el pool mediante el getter dinámico
        const connProd = dbConfig.getConnProd();
        if (!connProd) {
            return res.status(503).json({ msg: "Base de datos fuera de línea temporalmente." });
        }

        const UsuarioProd = connProd.models.Usuario || connProd.model('Usuario', usuarioSchema, 'usuarios');

        const usuarioActualizado = await UsuarioProd.findByIdAndUpdate(
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
        console.error('⚠️ Error al actualizar estado del usuario:', error.message);
        return res.status(500).json({ msg: 'Error interno del servidor al procesar el cambio de estado.' });
    }
};

// ====================================================================
// CRUD ACCIÓN 2: Editar antecedentes básicos (Especialidad y Centro Base)
// ====================================================================
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
        // CORRECCIÓN: Resolvemos el pool mediante el getter dinámico
        const connProd = dbConfig.getConnProd();
        if (!connProd) {
            return res.status(503).json({ msg: "Base de datos fuera de línea temporalmente." });
        }

        const UsuarioProd = connProd.models.Usuario || connProd.model('Usuario', usuarioSchema, 'usuarios');

        const usuarioModificado = await UsuarioProd.findByIdAndUpdate(
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
        console.error('⚠️ Error al editar datos del médico:', error.message);
        return res.status(500).json({ msg: 'Error en el servidor al intentar modificar el perfil del especialista.' });
    }
};

// ====================================================================
// CRUD ACCIÓN 3: Remoción Física Permanente de la Base de Datos
// ====================================================================
export const eliminarUsuarioDefinitivo = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ msg: 'El ID de usuario proporcionado no es válido.' });
    }

    try {
        // CORRECCIÓN: Resolvemos el pool mediante el getter dinámico
        const connProd = dbConfig.getConnProd();
        if (!connProd) {
            return res.status(503).json({ msg: "Base de datos fuera de línea temporalmente." });
        }

        const UsuarioProd = connProd.models.Usuario || connProd.model('Usuario', usuarioSchema, 'usuarios');

        const usuarioEliminado = await UsuarioProd.findByIdAndDelete(id).lean();

        if (!usuarioEliminado) {
            return res.status(404).json({ msg: 'El usuario que intenta remover no existe en la base de datos de este centro de salud.' });
        }

        return res.json({ 
            msg: `El usuario ${usuarioEliminado.nombre} (RUT: ${usuarioEliminado.rut}) fue removido permanentemente de MongoDB Atlas.` 
        });

    } catch (error) {
        console.error('⚠️ Error al eliminar usuario de Atlas:', error.message);
        return res.status(500).json({ msg: 'Error interno del servidor al procesar la baja física del registro.' });
    }
};

