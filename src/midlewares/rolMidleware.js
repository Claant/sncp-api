// Middleware de control de acceso según el rol del usuario autenticado (médico o administrador)
export const permitirRoles = (...rolesPermitidos) => {
    return (req, res, next) => {
        // 1. VALIDACIÓN DE SECUENCIA: Verificar si el middleware previo (verificarToken) inyectó al usuario
        if (!req.usuario) {
            // CORREGIDO: Se cambia el estado al estándar 500 (Internal Server Error) para indicar falla de configuración en rutas
            return res.status(500).json({ 
                msg: 'Error crítico de secuencia del servidor: El validador de roles requiere una verificación de token previa.' 
            });
        }

        // 2. CONTROL DE ACCESO ACCESIBLE: Comprobar si el rol del usuario está dentro de los autorizados
        if (!rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({ 
                msg: `Acceso denegado. Tu rol (${req.usuario.rol}) no cuenta con los permisos requeridos para realizar esta acción.` 
            });
        }

        // 3. CORREGIDO: Se añade 'return' para dar paso seguro y limpio al controlador final de la ruta
        return next();
    };
};
