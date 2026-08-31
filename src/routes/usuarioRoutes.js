import express from 'express';
import { 
    crearUsuario, 
    obtenerUsuarios, 
    actualizarEstadoUsuario, 
    editarUsuarioMedico, 
    eliminarUsuarioDefinitivo 
} from '../controllers/usuarioController.js';
import { verificarToken } from '../midlewares/authMidleware.js';
import { permitirRoles } from '../midlewares/rolMidleware.js'; 

const router = express.Router();

// ====================================================================
// 1. ENDPOINTS DE CONSULTA Y CREACIÓN BASE
// ====================================================================

// RESTRICCIÓN: Solo un Administrador puede crear nuevos usuarios en MongoDB Atlas (CU-005)
router.post('/', verificarToken, permitirRoles('administrador'), crearUsuario); 

// ACCESO CLÍNICO HÍBRIDO: Tanto médicos como administradores necesitan listar personal para renderizar historiales y perfiles
// CORREGIDO: Se añade 'medico' a la lista blanca para evitar errores 403 al cargar el Dashboard
router.get('/', verificarToken, permitirRoles('administrador', 'medico'), obtenerUsuarios); 

// ====================================================================
// ENDPOINTS EXPUESTOS PARA EL COMPONENTE ADMINMEDICOSCRUD.VUE (CRUD SEGURO)
// ====================================================================

// Alternar Estado Operativo (Habilitar / Suspender Profesional) -> PUT /api/usuarios/:id/estado [INDEX]
router.put('/:id/estado', verificarToken, permitirRoles('administrador'), actualizarEstadoUsuario);

// Editar Antecedentes Básicos (Especialidad y Centro Base) -> PUT /api/usuarios/:id [INDEX]
router.put('/:id', verificarToken, permitirRoles('administrador'), editarUsuarioMedico);

// Eliminar Registro Físico Permanente de la Base de Datos -> DELETE /api/usuarios/:id [INDEX]
router.delete('/:id', verificarToken, permitirRoles('administrador'), eliminarUsuarioDefinitivo);

export default router;
