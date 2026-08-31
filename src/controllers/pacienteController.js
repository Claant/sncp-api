import Paciente from '../models/Paciente.js';

// FUNCIÓN AUXILIAR MAESTRA UNIFICADA: Asegura el formato de forma estricta (ej: 12345678-K)
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

// Caso de Uso: Registrar un nuevo paciente tradicional (CU-002 / Registro)
export const crearPaciente = async (req, res) => {
    const { rut, nombre, fecha_nacimiento, direccion_id, centro_salud_id } = req.body;

    if (!rut || !nombre || !fecha_nacimiento || !direccion_id || !centro_salud_id) {
        return res.status(400).json({ msg: 'Por favor, complete todos los campos del paciente.' });
    }

    try {
        // CORREGIDO: Formatea de forma inteligente e inyecta el guion si el usuario lo olvidó
        const rutSanitizado = limpiarRut(rut);

        const pacienteExiste = await Paciente.findOne({ rut: rutSanitizado });
        if (pacienteExiste) {
            return res.status(400).json({ msg: 'El RUT de este paciente ya se encuentra registrado.' });
        }

        const nuevoPaciente = new Paciente({
            rut: rutSanitizado, // Guardado exacto sin puntos y con guion
            nombre,
            fecha_nacimiento,
            direccion_id,
            centro_salud_id
        });

        await nuevoPaciente.save();
        return res.status(201).json({ msg: 'Paciente registrado exitosamente.', paciente: nuevoPaciente });

    } catch (error) {
        console.error('Error al registrar paciente:', error.message);
        return res.status(500).json({ msg: 'Error interno del servidor al registrar paciente.' });
    }
};

// Caso de Uso: Buscar Paciente por RUT en el Dashboard (Ficha Clínica)
export const obtenerPacientePorRut = async (req, res) => {
    const { rut } = req.params;

    try {
        // CORREGIDO: Transforma lo que viene de la URL al formato estricto: XXXXXXXX-X
        const rutSanitizado = limpiarRut(rut);

        const paciente = await Paciente.findOne({ rut: rutSanitizado })
            .populate('direccion_id') 
            .populate('centro_salud_id'); 

        if (!paciente) {
            return res.status(404).json({ msg: 'Paciente no encontrado en el sistema nacional.' });
        }

        return res.json(paciente);
    } catch (error) {
        console.error('Error al buscar paciente:', error.message);
        return res.status(500).json({ msg: 'Error al procesar la búsqueda del paciente.' });
    }
};
