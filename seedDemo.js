
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Importamos los esquemas y modelos unificados de tu proyecto
import Expediente from './src/models/Expediente.js';
import AtencionMedica from './src/models/AtencionMedica.js';
import Diagnostico from './src/models/Diagnostico.js';
import CentroSalud from './src/models/CentroSalud.js';
import Paciente from './src/models/Paciente.js';
import Direccion from './src/models/Direccion.js';

dotenv.config();

const formatearRutSeed = (rutRaw) => {
  if (!rutRaw) return '';
  // Elimina cualquier residuo o carácter invisible BOM y fuerza mayúsculas
  let limpio = rutRaw.replace(/^\uFEFF/, '').replace(/[^0-9kK]/g, '').toUpperCase();
  if (limpio.length < 2) return limpio;
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
};


const runSeed = async () => {
  try {
    // Conexión al clúster DEMO de interoperabilidad
    await mongoose.connect(process.env.MONGO_URI_DEMO, {
      dbName: 'sistema-informacion-clinica-demo'
    });

    console.log('✅ Conectado exitosamente al clúster DEMO');

    /* Limpieza total previa para evitar colisiones de índices únicos
    await Paciente.deleteMany({});
    await Expediente.deleteMany({});
    await AtencionMedica.deleteMany({});
    await Diagnostico.deleteMany({});
    await CentroSalud.deleteMany({});
    await Direccion.deleteMany({});

    console.log('🧹 Base de datos DEMO vaciada con éxito.');
*/


    // 1. Crear centro de salud ficticio remoto para simular la pasarela nacional
    const centro = await CentroSalud.create({
      nombre_centro: 'Hospital San Juan de Dios - La Serena',
      tipo_prestador: 'Publico'
    });

    // 2. Crear direcciones ficticias variadas alineadas estrictamente al esquema nacional real (La Serena/Coquimbo)
    const direcciones = await Direccion.insertMany([
     { calle: 'Avenida Francisco de Aguirre', numero: '450', comuna: 'La Serena', ciudad: 'La Serena' },
     { calle: 'Calle Aldunate', numero: '1025', comuna: 'Coquimbo', ciudad: 'Coquimbo' },
     { calle: 'Avenida Juan Cisternas', numero: '2380', comuna: 'La Serena', ciudad: 'La Serena' },
     { calle: 'Calle Videla', numero: '742', comuna: 'Coquimbo', ciudad: 'Coquimbo' },
     { calle: 'Calle Alberto Solari', numero: '300', comuna: 'La Serena', ciudad: 'La Serena' },
     { calle: 'Avenida El Culebrón', numero: '15', comuna: 'Coquimbo', ciudad: 'Coquimbo' }
    ]);

    // 3. Insertar una nómina con RUTs, nombres y fechas de nacimiento totalmente NUEVOS
    const pacientes = await Paciente.insertMany([
  {
    rut: formatearRutSeed('12345736-k'), // se guarda como rut limpio 
    nombre: 'Camilo Renzo Tapia Ogalde',
    fecha_nacimiento: new Date('1986-03-14'),
    centro_salud_id: centro._id,
    direccion_id: direcciones[0]._id
  },
  {
    rut: formatearRutSeed('13453219-5'),
    nombre: 'Alejandro Eduardo Hernandez Guzman',
    fecha_nacimiento: new Date('1989-11-01'),
    centro_salud_id: centro._id,
    direccion_id: direcciones[1]._id
  },
  {
    rut: formatearRutSeed('18576752-1'),
    nombre: 'Fabian Andres Garcia Mendez',
    fecha_nacimiento: new Date('1996-03-01'),
    centro_salud_id: centro._id,
    direccion_id: direcciones[0]._id
  },
   {
    rut: formatearRutSeed('19546752-k'),
    nombre: 'Rene Andres Toledo Mendez',
    fecha_nacimiento: new Date('1998-07-01'),
    centro_salud_id: centro._id,
    direccion_id: direcciones[0]._id
  },
  {
    rut: formatearRutSeed('20346752-k'),
    nombre: 'Harold Antonio Guzman Tapia',
    fecha_nacimiento: new Date('1999-07-01'),
    centro_salud_id: centro._id,
    direccion_id: direcciones[0]._id
  }

], { ordered: false });


    // 4. Diagnósticos clínicos realistas con códigos CIE-10 estrictos
    const diagnosticosBase = [
      { descripcion: 'Infección de vías urinarias, sitio no especificado (Cistitis aguda sintomática en evolución)', codigo_enfermedad: 'N39.0' },
      { descripcion: 'Lumbago no especificado (Dorsalgia lumbar aguda por esfuerzo físico moderado)', codigo_enfermedad: 'M54.5' },
      { descripcion: 'Amigdalitis aguda, no especificada (Cuadro congestivo purulento con odinofagia severa)', codigo_enfermedad: 'J03.9' },
      { descripcion: 'Bronquitis aguda, no especificada (Sintomatología respiratoria obstructiva leve sin apremio respiratorio)', codigo_enfermedad: 'J20.9' },
      { descripcion: 'Diabetes mellitus no insulinodependiente (Control metabólico preventivo de rutina)', codigo_enfermedad: 'E11.9' },
      ];

    // 5. Motivos de consulta médica correlativos actualizados
    const motivosConsulta = [
      'Paciente femenina consulta por disuria intensa de 48 horas de evolución, asociado a poliaquiuria y tenesmo vesical leve. Niega fiebre alta.',
      'Varón refiere dolor punzante en zona lumbar baja tras levantar carga pesada en su lugar de trabajo hace 12 horas. Limitación de movimiento.',
      'Consulta por odinofagia severa que impide deglución normal de alimentos, acompañado de calofríos y cefalea frontal difusa.',
      'Paciente refiere tos productiva con expectoración mucosa de 5 días de evolución, asociado a sibilancias audibles intermitentes en reposo.',
      'Asiste a control crónico programado. Trae exámenes de laboratorio con glicemia en ayunas levemente elevada. Buen estado general.',
      ];

    // 6. Ciclo transaccional coordinado para inyectar los expedientes híbridos
    for (let i = 0; i < pacientes.length; i++) {
      const expediente = await Expediente.create({
        paciente_id: pacientes[i]._id,
        centro_salud_id: centro._id,
        estado: 'activo'
      });

      const atencion = await AtencionMedica.create({
        paciente_id: pacientes[i]._id,
        fecha: new Date(Date.now() - (i * 3 * 24 * 60 * 60 * 1000)), // Escalonamiento intercalado cada 3 días
        motivo_consulta: motivosConsulta[i],
        usuario_id: new mongoose.Types.ObjectId() // Firma médica remota simulada externa
      });

      // Vinculamos de manera explícita el paciente_id al diagnóstico según el esquema definitivo
      const diagnostico = await Diagnostico.create({
        ...diagnosticosBase[i],
        atencion_id: atencion._id,
        paciente_id: pacientes[i]._id 
      });

      // Consolidamos los ObjectIds en el documento del expediente maestro
      expediente.atenciones.push(atencion._id);
      expediente.diagnosticos.push(diagnostico._id);
      await expediente.save();
    }

    console.log(`🎉 ¡Población de datos finalizada! 6 pacientes con nuevos RUTs y datos clínicos insertados con éxito en DEMO.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error crítico al poblar la base de datos DEMO:', error.message);
    process.exit(1);
  }
};

runSeed();

