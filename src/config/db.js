
import mongoose from 'mongoose';

export const connectDB = async () => {
  // Opciones de configuración empresarial para el pool de conexiones y sockets
  const dbOptions = {
    maxPoolSize: 20,             // Incrementa el límite de conexiones simultáneas (Ideal para alta concurrencia médica)
    minPoolSize: 10,             // Mantiene conexiones mínimas siempre abiertas y calientes para respuestas instantáneas
    socketTimeoutMS: 60000,      // establece un limite de un minuto de inactividad y cierra la conexión para liberar recursos
    serverSelectionTimeoutMS: 5000, // Tiempo límite (5s) para encontrar el clúster de Atlas antes de arrojar error
    heartbeatFrequencyMS: 10000, // Revisa la salud del clúster cada 10 segundos para anticipar fallos de red
  };

  try {
    // Inicializar la conexión inyectando las opciones optimizadas
    await mongoose.connect(process.env.MONGO_URI, dbOptions);
    console.log('Conectado exitosamente a MongoDB Atlas (Pool Optimizado).');

    // Escuchadores de eventos para monitorear la salud de la base de datos en tiempo real
    mongoose.connection.on('disconnected', () => {
      console.warn('Advertencia: Conexión con MongoDB Atlas perdida. Mongoose intentará reconectarse automáticamente...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('Éxito: Conexión restablecida de forma autónoma con el clúster.');
    });

    mongoose.connection.on('error', (err) => {
      console.error('Error crítico en el hilo de conexión de MongoDB:', err.message);
    });

  } catch (error) {
    console.error('Error catastrófico de enlace inicial:', error.message);
    // Cierre controlado y seguro del proceso de Node.js
    process.exit(1);
  }
};
