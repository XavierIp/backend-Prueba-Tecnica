/**
 * @fileoverview Controlador para manejar la autenticación de usuarios.
 * Incluye funciones para iniciar sesión (login), registrar administradores y registrar clientes.
 * Utiliza los modelos User y Role, la librería JWT para tokens y dotenv para variables de entorno.
 */

// Importa los modelos necesarios de Mongoose.
const User = require('../models/User');
const Role = require('../models/Role');
// Importa la librería jsonwebtoken para crear y verificar tokens.
const jwt = require('jsonwebtoken');
// Carga las variables de entorno desde el archivo .env.
require('dotenv').config();

/**
 * Maneja el inicio de sesión de un usuario (admin o cliente).
 * Busca al usuario por email, compara la contraseña encriptada y, si es válida,
 * genera un token JWT que se devuelve junto con los datos del usuario.
 * @async
 * @function loginUser
 * @param {object} req - Objeto de solicitud de Express. Se espera `req.body` con `email` y `password`.
 * @param {object} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Envía una respuesta JSON con el token y el usuario (sin contraseña) o un mensaje de error.
 */
exports.loginUser = async (req, res) => {
    // Extrae email y contraseña del cuerpo de la solicitud.
    const { email, password } = req.body;
    try {
        // Busca un usuario en la base de datos que coincida con el email proporcionado.
        // .populate('idRol') reemplaza el ObjectId del rol con el documento completo del rol (para obtener el nombre del rol).
        const user = await User.findOne({ email }).populate('idRol');
        // Si no se encuentra un usuario con ese email, devuelve un error 401 (No autorizado).
        if (!user) {
            return res.status(401).json({ message: 'Credenciales inválidas (email)' });
        }

        // Compara la contraseña proporcionada con la contraseña encriptada almacenada en la base de datos.
        // 'comparePassword' es un método definido en el modelo User.js que usa bcrypt.compare.
        const isMatch = await user.comparePassword(password);
        // Si las contraseñas no coinciden, devuelve un error 401.
        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciales inválidas (contraseña)' });
        }

        // Si las credenciales son válidas, genera un token JWT.
        const token = jwt.sign(
            // Payload del token: Información que se guarda dentro del token.
            // Es útil incluir el ID del usuario y su rol para validaciones posteriores.
            { id: user._id, role: user.idRol.nombre },
            // Clave secreta para firmar el token (leída desde .env). Es crucial mantenerla segura.
            process.env.JWT_SECRET,
            // Opciones del token: expiresIn define cuánto tiempo será válido el token ('1d' = 1 día).
            { expiresIn: '1d' }
        );

        // Elimina la contraseña del objeto usuario antes de enviarlo en la respuesta por seguridad.
        user.password = undefined;
        // Envía la respuesta exitosa (código 200 OK por defecto) con el token y los datos del usuario.
        res.json({ token, user });

    } catch (error) {
        // Si ocurre cualquier otro error durante el proceso (ej: error de base de datos),
        // envía una respuesta de error 500 (Error Interno del Servidor).
        console.error("Login Error:", error); 
        res.status(500).json({ message: 'Error en el servidor al intentar iniciar sesión', error: error.message });
    }
};

/**
 * Maneja el registro de un nuevo usuario con el rol de 'admin'.
 * Verifica si el rol 'admin' existe, si el email ya está registrado,
 * y luego crea el nuevo usuario asignándole el rol de administrador.
 * La contraseña se encripta automáticamente gracias al hook 'pre-save' del modelo User.
 * @async
 * @function registerAdmin
 * @param {object} req - Objeto de solicitud de Express. Se espera `req.body` con `nombre`, `email` y `password`.
 * @param {object} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Envía una respuesta JSON con un mensaje de éxito y el usuario creado (sin contraseña) o un mensaje de error.
 */
exports.registerAdmin = async (req, res) => {
    // Extrae los datos del nuevo administrador del cuerpo de la solicitud.
    const { nombre, email, password } = req.body;
    try {
        // 1. Busca el documento del rol 'admin' para obtener su _id.
        const adminRole = await Role.findOne({ nombre: 'admin' });
        // Si no se encuentra el rol, es un problema de configuración. Devuelve error 500.
        if (!adminRole) {
            return res.status(500).json({ message: 'Error de configuración: El rol "admin" no existe en la BD.' });
        }

        // 2. Verifica si ya existe un usuario con el mismo email.
        const userExists = await User.findOne({ email });
        // Si el email ya está en uso, devuelve un error 400 (Solicitud incorrecta).
        if (userExists) {
            return res.status(400).json({ message: 'El email ya está registrado' });
        }

        // 3. Crea una nueva instancia del modelo User con los datos proporcionados.
        const newUser = new User({
            nombre,
            email,
            password, // La contraseña se pasa en texto plano; el hook 'pre-save' del modelo la encriptará.
            idRol: adminRole._id // Asigna el ObjectId del rol 'admin'.
        });

        // Guarda el nuevo usuario en la base de datos.
        const savedUser = await newUser.save();
        // Elimina la contraseña del objeto antes de enviarlo en la respuesta.
        savedUser.password = undefined;

        // Envía una respuesta de éxito 201 (Creado) con un mensaje y los datos del nuevo admin.
        res.status(201).json({ message: 'Administrador creado exitosamente', user: savedUser });

    } catch (error) {
        // envía una respuesta de error 500.
        console.error("Register Admin Error:", error);
        res.status(500).json({ message: 'Error al registrar administrador', error: error.message });
    }
};

/**
 * Maneja el registro de un nuevo usuario con el rol de 'cliente'.
 * Realiza validaciones básicas, verifica si el rol 'cliente' y el email existen,
 * crea el nuevo usuario y, opcionalmente, lo inicia sesión automáticamente generando un token JWT.
 * @async
 * @function registerClient
 * @param {object} req - Objeto de solicitud de Express. Se espera `req.body` con `nombre`, `email` y `password`.
 * @param {object} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Envía una respuesta JSON con mensaje, token y usuario (si es exitoso) o un mensaje de error.
 */
exports.registerClient = async (req, res) => {
    // Extrae los datos del nuevo cliente.
    const { nombre, email, password } = req.body;

    // Validación básica de campos obligatorios y longitud de contraseña.
    if (!nombre || !email || !password) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    try {
        // 1. Busca el _id del rol 'cliente'.
        const clientRole = await Role.findOne({ nombre: 'cliente' });
        // Si no existe, devuelve error 500.
        if (!clientRole) {
            return res.status(500).json({ message: 'Error de configuración: El rol "cliente" no existe.' });
        }

        // 2. Verifica si el email ya está registrado.
        const userExists = await User.findOne({ email });
        // Si existe, devuelve error 400.
        if (userExists) {
            return res.status(400).json({ message: 'El email ya está registrado.' });
        }

        // 3. Crea la nueva instancia de User con el rol de cliente.
        const newUser = new User({
            nombre,
            email,
            password, // Será encriptada por el hook 'pre-save'.
            idRol: clientRole._id // Asigna el ObjectId del rol 'cliente'.
        });

        // Guarda el nuevo cliente en la base de datos.
        const savedUser = await newUser.save();

        // 4. Genera un token JWT para iniciar sesión automáticamente al nuevo cliente.
        const token = jwt.sign(
            { id: savedUser._id, role: clientRole.nombre }, // Payload
            process.env.JWT_SECRET, // Secreto
            { expiresIn: '1d' } // Expiración
        );

        // Elimina la contraseña antes de enviar la respuesta.
        savedUser.password = undefined;

        // Envía respuesta 201 (Creado) con mensaje, token y datos del usuario.
        res.status(201).json({
            message: 'Usuario creado exitosamente.',
            token,
            user: savedUser
        });

    } catch (error) {
        // Captura errores y envía respuesta 500.
        console.error("Register Client Error:", error);
        res.status(500).json({ message: 'Error al registrar el usuario', error: error.message });
    }
};