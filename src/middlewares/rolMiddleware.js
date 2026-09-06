// Caso de Uso: Control de Acceso Basado en Roles (RBAC - OWASP)
export const permitirRoles = (...rolesPermitidos) => {
    return (req, res, next) => {
        // 1. Extraer de forma segura el rol inyectado previamente por tu authMiddleware
        const usuarioRol = req.user?.rol || req.usuario?.rol;

        if (!usuarioRol) {
            return res.status(401).json({ 
                msg: "No se pudo comprobar la identidad del usuario para este recurso." 
            });
        }

        // 2. Comprobar si el rol del profesional está explícitamente autorizado en la ruta
        const tienePermiso = rolesPermitidos.includes(usuarioRol);

        if (!tienePermiso) {
            return res.status(403).json({ 
                msg: `Acceso denegado. Privilegios insuficientes para el rol: ${usuarioRol}` 
            });
        }

        // 3. Dar paso de forma exitosa al controlador de la API
        return next();
    };
};

// Exportación por defecto secundaria por seguridad tipográfica
export default permitirRoles;
