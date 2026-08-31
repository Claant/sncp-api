// Asegúrate de importar el modelo correcto de tu carpeta de modelos
import CentroSalud from '../models/CentroSalud.js'; 

// Caso de Uso: Registrar un nuevo establecimiento (Solo Administrador)
// CORREGIDO: Asegurar el uso exacto del nombre 'crearCentroSalud' con su export
export const crearCentroSalud = async (req, res) => {
    const { nombre_centro, tipo_prestador } = req.body;

    if (!nombre_centro || !tipo_prestador) {
        return res.status(400).json({ msg: 'Por favor, complete todos los campos obligatorios del establecimiento.' });
    }

    try {
        const nuevoCentro = new CentroSalud({
            nombre_centro,
            tipo_prestador
        });

        await nuevoCentro.save();
        return res.status(201).json({ 
            msg: 'Establecimiento asistencial dado de alta exitosamente en la Red Nacional.', 
            centro: nuevoCentro 
        });

    } catch (error) {
        console.error('Error al crear centro de salud:', error.message);
        return res.status(500).json({ msg: 'Error interno del servidor al registrar la infraestructura.' });
    }
};

// Caso de Uso: Obtener el catálogo completo de establecimientos (Acceso híbrido)
// CORREGIDO: Asegurar el uso exacto del nombre 'obtenerCentrosSalud' con su export
export const obtenerCentrosSalud = async (req, res) => {
    try {
        // Busca todos los centros y los ordena alfabéticamente por su nombre
        const centros = await CentroSalud.find().sort({ nombre_centro: 1 });
        return res.json(centros);
    } catch (error) {
        console.error('Error al obtener centros de salud:', error.message);
        return res.status(500).json({ msg: 'Error al cargar la información de la red asistencial.' });
    }
};
