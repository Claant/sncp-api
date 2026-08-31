
import Usuario from '../models/Usuario.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Login de usuario
export const login = async (req, res) => {
  const { correo, password } = req.body;

// valida que los campos obligaorios como correo y contraseña existan antes de buscar en la base de datos
  if (!correo || !password) {
        return res.status(400).json({ 
            msg: 'Por favor, ingrese todos los campos requeridos (correo y contraseña).' 
        });
    }


  try {
    // Buscar usuario por email
    const usuario = await Usuario.findOne({ correo });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Credenciales invalidas, correo no encontrado' });
    }

   // Verificar si el usuario está activo en el sistema clínico
    if (!usuario.activo) {
       return res.status(403).json({ msg: 'El usuario se encuentra deshabilitado' });
    }
    
    // Validar contraseña y generar token JWT que se enviará al frontend para mantener la sesión iniciada
    const passwordCorrecto = await bcrypt.compare(password, usuario.password);
    if (!passwordCorrecto) {
      return res.status(400).json({ mensaje: 'Credenciales invalidas, contraseña incorrecta' });
    }

   
   // Si todo es correcto, generar el Payload del JWT con su rol correspondiente
   // El payload guarda los datos del usuario que se incluirán en el token JWT, como su ID, RUT y rol. Esto permite que el frontend pueda identificar al usuario y sus permisos sin necesidad de consultar la base de datos en cada solicitud.
        const payload = {
            id: usuario._id,  // identificador unico del usuario en la base de datos
            rut: usuario.rut,  // el rut del usuario, clave nacional
            rol: usuario.rol   // rol del usuario, medico o administrador
        };

        // Firmar el Token JWT que se enviará al frontend para mantener la sesión iniciada. Se utiliza la librería jsonwebtoken para generar el token.
        jwt.sign(
            payload,    // <-- AQUÍ RECIBE LOS DATOS (1er parámetro)
            process.env.JWT_SECRET,   // <-- Recibe tu llave secreta (2do parámetro)
            { expiresIn: '8h' }, // El token expira en 8 horas (un turno médico estándar) 3er. parámetro
            (error, token) => {   // Función callback que recibe el resultado final
                if (error) throw error;
                
    // Responder al frontend con el token y datos básicos del perfil
                res.json({
                    token,
                    usuario: {
                        id: usuario._id,
                        nombre: usuario.nombre,
                        apellido: usuario.apellido,
                        rol: usuario.rol
                    }
                });
            }
        );
     // aca se maneja el error de conexion a la base de datos, si es que ocurre
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Hubo un error en el servidor al intentar iniciar sesión' });
    }
};
