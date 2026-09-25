// controllers/authController.js
import * as dbConfig from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const login = async (req, res) => {
  const { correo, password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({ 
        msg: 'Por favor, ingrese todos los campos requeridos (correo y contraseña).' 
    });
  }

  try {
    const connProd = dbConfig.getConnProd();

    if (!connProd) {
      console.error("⚠️ Error: El pool de conexiones connProd no está inicializado al autenticar.");
      return res.status(503).json({ msg: "Servicio de autenticación no disponible temporalmente." });
    }

    // OBTENCIÓN DIRECTA DEL MODELO PRECOMPILADO EN db.js (PUNTO 2)
    const UsuarioProd = connProd.model('Usuario');

    // Buscar usuario por email en el pool correcto de producción
    const usuario = await UsuarioProd.findOne({ correo: correo.toLowerCase().trim() });
    if (!usuario) {
      return res.status(404).json({ msg: 'Credenciales inválidas, correo no encontrado.' });
    }

    // Verificar si el usuario está activo en el sistema clínico
    if (!usuario.activo) {
       return res.status(403).json({ msg: 'El usuario se encuentra deshabilitado.' });
    }
    
    // Validar contraseña
    const passwordCorrecto = await bcrypt.compare(password, usuario.password);
    if (!passwordCorrecto) {
      return res.status(400).json({ msg: 'Credenciales inválidas, contraseña incorrecta.' });
    }

    // Generar el Payload del JWT
    const payload = {
        id: usuario._id,  
        rut: usuario.rut,  
        rol: usuario.rol   
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    // Responder al frontend con el token y datos básicos del perfil
    return res.json({
        token,
        usuario: {
            id: usuario._id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            rol: usuario.rol
        }
    });

  } catch (error) {
      console.error('⚠️ Error crítico en controlador de login:', error.stack);
      return res.status(500).json({ msg: 'Hubo un error en el servidor al intentar iniciar sesión' });
  }
};