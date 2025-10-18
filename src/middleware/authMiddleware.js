/**
 * @fileoverview Middleware de autenticación para proteger rutas en Express.
 * Utiliza JSON Web Tokens (JWT) para verificar si un usuario está autenticado.
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Middleware 'protect' para verificar la autenticidad del token JWT.
 * Busca un token en la cabecera 'Authorization' de la solicitud HTTP.
 * Si encuentra un token válido, extrae el ID del usuario del payload del token
 * y lo adjunta al objeto `req` (`req.userId`). Luego, pasa el control al siguiente middleware o controlador.
 * Si no hay token o el token es inválido (expirado o malformado), envía una respuesta
 * de error 401 (No Autorizado) y detiene la cadena de ejecución.
 * @function protect
 * @param {object} req - Objeto de solicitud de Express. Se espera `req.headers.authorization` en formato 'Bearer <token>'.
 * @param {object} res - Objeto de respuesta de Express.
 * @param {function} next - Función callback para pasar el control al siguiente middleware.
 * @returns {void} Llama a `next()` si el token es válido, o envía una respuesta de error 401.
 */
exports.protect = (req, res, next) => {
    let token; // Variable para almacenar el token extraído.
    // Verifica si la cabecera 'Authorization' existe y si comienza con 'Bearer '.
    // Este es el formato estándar para enviar tokens JWT.
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extrae el token de la cabecera.
            token = req.headers.authorization.split(' ')[1];
            // Verifica la validez del token usando la clave secreta (JWT_SECRET) de las variables de entorno.
            // jwt.verify decodifica el token y comprueba si la firma es correcta y si no ha expirado.
            // Si es inválido, lanzará un error que será capturado por el 'catch'.
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Si el token es válido, 'decoded' contiene el payload que se usó al firmar el token
            // Esto permite que los siguientes controladores sepan qué usuario está haciendo la solicitud.
            req.userId = decoded.id;
            // Pasa el control al siguiente middleware o controlador en la cadena de la ruta.
            next();
        } catch (error) {
            // Si jwt.verify lanza un error (token inválido, expirado, malformado).
            console.error('Error de verificación de token:', error.message); // Registra el error específico.
            // Envía una respuesta 401 (No Autorizado) indicando que el token no es válido.
            res.status(401).json({ message: 'Token no válido o expirado' });
        }
    }

    // Si la cabecera 'Authorization' no existe, no empieza con 'Bearer ', o si hubo un error al extraer el token antes del 'try'.
    if (!token) {
        // Envía una respuesta 401 (No Autorizado) indicando que falta el token.
        res.status(401).json({ message: 'No autorizado, no se proporcionó token' });
    }
};
