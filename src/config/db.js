/**
 * @fileoverview Configuración y función para conectar a la base de datos MongoDB usando Mongoose.
 */
// Importa la librería 
const mongoose = require('mongoose');
// Importa y configura dotenv para cargar variables de entorno desde un archivo .env.
require('dotenv').config();
/**
 * Función asíncrona para establecer la conexión con la base de datos MongoDB.
 * Muestra un mensaje en consola si la conexión es exitosa.
 * Si la conexión falla, muestra un error y termina el proceso de Node.js.
 * @async
 * @function connectDB
 */
const connectDB = async () => {
  try {
    // Intenta conectar a MongoDB usando la URI del archivo .env.
    // mongoose.connect devuelve una promesa, por eso usamos await.
    await mongoose.connect(process.env.MONGODB_URI);
    // Si la conexión es exitosa, imprime un mensaje en la consola.
    console.log('MongoDB conectado exitosamente.');
  } catch (error) {
    // Si ocurre un error durante la conexión:
    // Imprime un mensaje de error detallado en la consola.
    console.error('Error al conectar con MongoDB:', error.message);
    // Termina el proceso de Node.js con un código de error
    // Esto previene que la aplicación corra sin conexión a la base de datos.
    process.exit(1);
  }
};
// Exporta la función connectDB 
module.exports = connectDB;