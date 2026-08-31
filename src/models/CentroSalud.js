import mongoose from 'mongoose';

const centroSaludSchema = new mongoose.Schema({
    nombre_centro: {
        type: String,
        required: true,
        trim: true
        // Ejemplo: "cesfam emilio schaffhauser"
    },
    tipo_prestador: {
        type: String,
        required: true,
        trim: true
        // Ejemplo: "Publico", "Privado"
    }
}, {
    timestamps: true
});

// evita la pluralización automática del nombre de la colección y fuerza el uso del nombre exacto de tu colección en MongoDB Atlas
// Forzamos el uso del nombre exacto de tu colección en MongoDB Atlas
// es un patrón de diseño que asegura que la colección se mantenga consistente con tu entorno de producción
const CentroSalud = mongoose.model('CentroSalud', centroSaludSchema, 'centro-salud');
export default CentroSalud;
