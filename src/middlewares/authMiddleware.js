import jwt from "jsonwebtoken";

export const verificarToken = (req, res, next) => {
  // 1. Obtener la cabecera de autorización de la petición HTTP de forma segura
  const token = req.header("Authorization")?.replace("Bearer ", "");

  // 2. Validar presencia perimetral del token en la red
  if (!token) {
    return res.status(401).json({
      msg: "Acceso denegado. No se proporcionó un token de autenticación.",
    });
  }

  try {
    // 3. Verificar la firma digital del token usando tu clave secreta de entorno
    const decodificado = jwt.verify(token, process.env.JWT_SECRET);

    // 4. SISTEMA DE COMPATIBILIDAD DOBLE (Evita quiebres 500 en tus controladores)
    // Nos aseguramos de que req.user y req.usuario respondan transparentemente a todo el ecosistema
    req.user = {
      ...decodificado,
      _id: decodificado.id || decodificado._id // Mapeo cruzado de seguridad
    };

    req.usuario = {
      ...decodificado,
      _id: decodificado.id || decodificado._id // Duplicación de contingencia para controladores antiguos
    };

    // 5. Dar paso al siguiente eslabón de la ruta (permitirRoles o controlador final)
    return next();
    
  } catch (error) {
    console.error('Fallo controlado en el validador de tokens:', error.message);
    return res.status(403).json({ 
      msg: "Token inválido o expirado. Autenticación fallida." 
    });
  }
};
