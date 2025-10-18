/**
 * @fileoverview Middleware de configuración para Multer y Cloudinary.
 * para que suba los archivos directamente
 * al servicio de almacenamiento en la nube Cloudinary, en lugar de guardarlos localmente.
 * También exporta la instancia configurada de Cloudinary para poder usarla en otras partes
 * de la aplicación.
 */

// Importa la librería oficial de Cloudinary para Node.js (v2).
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
// Importa la librería `multer`.
const multer = require('multer');
// Carga las variables de entorno del archivo .env.
require('dotenv').config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY,       
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Configuración del Almacenamiento para Multer ---
const storage = new CloudinaryStorage({
    // Pasa la instancia de Cloudinary configurada.
    cloudinary: cloudinary,
    // Define parámetros para la subida a Cloudinary.
    params: {
        // Carpeta dentro de tu cuenta de Cloudinary donde se guardarán las imágenes.
        folder: 'prostore_products',
        // Array de formatos de archivo permitidos por Cloudinary para esta subida.
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
      
        /**
         * @param {object} req - Objeto de solicitud de Express.
         * @param {object} file - Objeto de archivo proporcionado por Multer.
         * @returns {string} El public_id deseado para el archivo en Cloudinary (sin extensión).
         */
        public_id: (req, file) => {
            // Genera un sufijo único basado en la fecha y un número aleatorio.
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            // Obtiene el nombre original del archivo sin la extensión.
            const filenameWithoutExt = file.originalname.split('.').slice(0, -1).join('.');
            // Construye un nombre descriptivo y único.
            return `product-${filenameWithoutExt}-${uniqueSuffix}`;
        },
    },
});

// --- Filtro de Archivos para Multer ---
/**
 * @function fileFilter
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} file - Objeto de archivo proporcionado por Multer. Contiene `mimetype`.
 * @param {function} cb - Callback a llamar para indicar si se acepta (true) o rechaza (false) el archivo.
 */
const fileFilter = (req, file, cb) => {
    // Verifica si el tipo MIME del archivo indica que es una imagen.
    if (file.mimetype.startsWith('image/')) {
        // Acepta el archivo.
        cb(null, true);
    } else {
        // Rechaza el archivo y pasa un error.
        cb(new Error('Formato de archivo no soportado. Solo se permiten imágenes.'), false);
    }
};

// --- Creación y Exportación del Middleware Multer ---
const upload = multer({ storage: storage, fileFilter: fileFilter });

// Exporta la instancia de Multer configurada. Esta instancia se usará en las rutas
module.exports = upload;
module.exports.cloudinaryInstance = cloudinary;