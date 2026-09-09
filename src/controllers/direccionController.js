// controllers/direccionController.js
import mongoose from 'mongoose';
import * as dbConfig from '../config/db.js'; // CORRECCIÓN: Uso del getter dinámico de ESM
import Direccion from '../models/Direccion.js'; // Importamos para extraer su .schema nativo

// ====================================================================
// Caso de Uso: Registrar una nueva dirección en el sistema nacional clínico
// ====================================================================
export const crearDireccion = async (req, res) => {
    // CORREGIDO: Se remueve 'ciudad' de la destructuración inicial para evitar el SyntaxError
    const { calle, numero, comuna } = req.body; 

    // CORREGIDO: Estandarización segura capturando 'ciudad' o 'city' directamente desde req.body
    const ciudad = req.body.ciudad || req.body.city;

    // Validación perimetral de campos requeridos geográficos
    if (!calle || !numero || !comuna || !ciudad) {
        return res.status(400).json({ msg: 'Por favor, complete todos los campos obligatorios de la dirección.' });
    }

    try {
        // CORRECCIÓN: Extraemos el pool de conexiones en caliente
        const connProd = dbConfig.getConnProd();

        if (!connProd) {
            console.error("⚠️ Error: El pool de conexiones connProd no está inicializado en direccionController.");
            return res.status(503).json({ msg: "Base de datos desconectada temporalmente." });
        }

        // Enlazar dinámicamente el modelo al pool activo de producción
        const DireccionProd = connProd.models.Direccion || connProd.model('Direccion', Direccion.schema, 'direcciones');

        const nuevaDireccion = new DireccionProd({
            calle,
            numero,
            comuna,
            ciudad
        });

        await nuevaDireccion.save();
        // CORREGIDO: Se añade 'return' para garantizar la detención del hilo de Express
        return res.status(201).json({ msg: 'Dirección registrada con éxito.', direccion: nuevaDireccion });

    } catch (error) {
        console.error('⚠️ Error al registrar dirección:', error.stack);
        return res.status(500).json({ msg: 'Error interno del servidor al procesar la dirección.' });
    }
};

// ====================================================================
// Caso de Uso: Obtener detalles de una dirección mediante su ID de MongoDB
// ====================================================================
export const obtenerDireccionPorId = async (req, res) => {
    const { id } = req.params;

    try {
        // CORRECCIÓN: Extraemos el pool de conexiones en caliente
        const connProd = dbConfig.getConnProd();

        if (!connProd) {
            console.error("⚠️ Error: El pool de conexiones connProd no está inicializado en direccionController.");
            return res.status(503).json({ msg: "Base de datos desconectada temporalmente." });
        }

        // Enlazar de forma estricta el modelo de lectura al pool activo
        const DireccionProd = connProd.models.Direccion || connProd.model('Direccion', Direccion.schema, 'direcciones');

        const direccion = await DireccionProd.findById(id);
        if (!direccion) {
            return res.status(404).json({ msg: 'Dirección no encontrada.' });
        }
        // CORREGIDO: Retorno limpio del objeto hacia el cliente de Vue
        return res.json(direccion);
    } catch (error) {
        console.error('⚠️ Error al obtener dirección:', error.message);
        return res.status(500).json({ msg: 'Error al cargar los datos de la dirección.' });
    }
};
