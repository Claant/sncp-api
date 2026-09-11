import mongoose from 'mongoose';

// Usamos variables internas para mantener el estado real de la conexión
let _connProd = null;
let _connDemo = null;

// CORRECCIÓN ENLACE ESM: Usamos getters para asegurar la exportación en vivo siempre actualizada
export const getConnProd = () => _connProd;
export const getConnDemo = () => _connDemo;

const dbOptionsDefault = {
  maxPoolSize: 50,    // maximo 20 conexiones simultaneas    
  minPoolSize: 15,   // mínimo 10 conexiones simultaneas          
  socketTimeoutMS: 60000,     // se define el tiempo de 60 segundos si la conexion no realiza operaciones, se cierra la conexion. tiempo de inactividad
  serverSelectionTimeoutMS: 5000, // tiempo de 5 segundos para que alguna conexion se libere
  heartbeatFrequencyMS: 10000,  // Ping. verifica cada 10 segundos si existe conexion entre el api rest y la base de datos
};

export const connectDB = async () => {
  try {
    // Inicializar la conexión en la variable interna
    _connProd = mongoose.createConnection(process.env.MONGO_URI, dbOptionsDefault);
    
    await _connProd.asPromise();
    console.log('Conectado exitosamente a MongoDB Atlas (Pool Optimizado - Producción).');

    // Escuchadores de eventos para monitorear la salud
    _connProd.on('disconnected', () => {
      console.warn('Advertencia: Conexión con MongoDB Atlas (Prod) perdida. Intentando reconexión...');
    });

    _connProd.on('reconnected', () => {
      console.log('Éxito: Conexión restablecida de forma autónoma con el clúster de producción.');
    });

    _connProd.on('error', (err) => {
      console.error('Error crítico en el hilo de conexión de MongoDB (Prod):', err.message);
    });

    return _connProd;
  } catch (error) {
    console.error('Error de enlace inicial en producción:', error.message);
    process.exit(1); // Producción es vital; si falla, el proceso debe morir
  }
};
// aca se conecta a la base de datos demo, si falla no se cierra el proceso, solo se loguea el error
export const connectDemoDB = async () => {
  try {
    _connDemo = mongoose.createConnection(process.env.MONGO_URI_DEMO, {
      dbName: 'sistema-informacion-clinica-demo', 
      maxPoolSize: 20,  // pool de 20 conexiones simultáneas para la demo
      minPoolSize: 5, 
      socketTimeoutMS: 60000, 
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000,
    });

    await _connDemo.asPromise();
    console.log('Conectado exitosamente al cluster express (sistema-informacion-clinica-demo).');

    _connDemo.on('disconnected', () => {
      console.warn('Advertencia: Conexión con el clúster express perdida. Reintentando...');
    });

    _connDemo.on('error', (err) => {
      console.error('Error en el hilo de conexión de MongoDB del cluster express:', err.message);
    });

    return _connDemo;
  } catch (error) {
    console.error('Error al conectar al cluster express (El servidor seguirá corriendo para Prod):', error.message);
    // un fallo en el cluster secundario de fhir no debe detener el proceso principal, solo se loguea el error
    return null;
  }
};
