/**
 * @fileoverview Controlador para gestionar operaciones relacionadas con los usuarios administradores.
 * Incluye funciones para obtener, actualizar y eliminar usuarios.
 * Utiliza los modelos User y Role de Mongoose.
 */

// Importa los modelos de Mongoose necesarios.
const User = require('../models/User');
const Role = require('../models/Role');

/**
 * Obtiene una lista de todos los usuarios que tienen el rol de 'admin'.
 * Busca el ID del rol 'admin' y luego filtra los usuarios por ese ID de rol.
 * Popula el nombre del rol en los resultados y excluye la contraseña.
 * @async
 * @function getAdminUsers
 * @param {object} req - Objeto de solicitud de Express (no utilizado directamente aquí, pero presente por ser un controlador).
 * @param {object} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Envía una respuesta JSON con un array de usuarios administradores (sin contraseña) o un mensaje de error.
 */
exports.getAdminUsers = async (req, res) => {
    try {
        // Busca el documento del rol 'admin' para obtener su _id.
        const adminRole = await Role.findOne({ nombre: 'admin' });
        // Si no se encuentra el rol 'admin', devuelve un error 500 (problema de configuración).
        if (!adminRole) {
            return res.status(500).json({ message: 'Error de configuración: El rol "admin" no existe.' });
        }

        // Busca todos los documentos en la colección 'users' cuyo campo 'idRol' coincida con el _id del rol 'admin'.
        const admins = await User.find({ idRol: adminRole._id })
            .populate('idRol', 'nombre') // Reemplaza el ObjectId 'idRol' con el documento del rol, trayendo solo el campo 'nombre'.
            .select('-password'); // Excluye explícitamente el campo 'password' de los resultados devueltos.

        // Envía la lista de administradores encontrados como respuesta JSON (estado 200 OK por defecto).
        res.json(admins);

    } catch (error) {
        // Si ocurre un error durante la búsqueda en la base de datos.
        console.error("Error en getAdminUsers:", error); // Registra el error en el servidor.
        res.status(500).json({ message: 'Error al obtener los usuarios administradores', error: error.message });
    }
};

/**
 * Actualiza los datos de un usuario existente por su ID.
 * Permite modificar el nombre, email y opcionalmente la contraseña.
 * Si se proporciona una nueva contraseña, el hook 'pre-save' del modelo User se encarga de encriptarla.
 * Maneja errores específicos como email duplicado .
 * @async
 * @function updateUser
 * @param {object} req - Objeto de solicitud de Express. `req.params.id` contiene el ID del usuario a actualizar. `req.body` contiene los campos `nombre`, `email`, y opcionalmente `password`.
 * @param {object} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Envía una respuesta JSON con un mensaje de éxito y el usuario actualizado (sin contraseña), o un mensaje de error.
 */
exports.updateUser = async (req, res) => {
    // Obtiene el ID del usuario de los parámetros de la ruta.
    const { id } = req.params;
    // Obtiene los datos a actualizar del cuerpo de la solicitud.
    const { nombre, email, password } = req.body;

    try {
        // Busca al usuario por su ID.
        const user = await User.findById(id);
        // Si no se encuentra el usuario, devuelve un error 404 (No Encontrado).
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Actualiza los campos 'nombre' y 'email' solo si se proporcionaron en el body.
        // Si no vienen, mantiene los valores existentes.
        user.nombre = nombre || user.nombre;
        user.email = email || user.email;

        // Si se envió una nueva contraseña y tiene al menos 6 caracteres.
        if (password && password.length >= 6) {
            // Asigna la nueva contraseña en texto plano. El hook 'pre-save' del modelo
            // detectará este cambio y la encriptará antes de guardarla.
            user.password = password;
        }

        // Guarda los cambios en el documento del usuario. Esto dispara el hook 'pre-save'.
        const updatedUser = await user.save();
        // Elimina la contraseña del objeto antes de enviarlo en la respuesta.
        updatedUser.password = undefined;

        // Envía una respuesta JSON exitosa con un mensaje y el usuario actualizado.
        res.json({ message: 'Usuario actualizado exitosamente', user: updatedUser });

    } catch (error) {
        console.error("Error en updateUser:", error); // Registra el error en el servidor.
        // Manejo específico para el error de clave duplicada 
        if (error.code === 11000) {
            return res.status(400).json({ message: 'El email ya está en uso por otro usuario.' });
        }
        // Para cualquier otro error, envía una respuesta 500.
        res.status(500).json({ message: 'Error al actualizar el usuario', error: error.message });
    }
};


/**
 * Elimina un usuario existente por su ID.
 * Utiliza el ID proporcionado en los parámetros de la ruta (`req.params.id`).
 * @async
 * @function deleteUser
 * @param {object} req - Objeto de solicitud de Express. `req.params.id` contiene el ID del usuario a eliminar.
 * @param {object} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Envía una respuesta JSON con un mensaje de éxito y el ID eliminado, o un mensaje de error.
 */
exports.deleteUser = async (req, res) => {
    // Obtiene el ID del usuario de los parámetros de la ruta.
    const { id } = req.params;
    try {
        // Busca un usuario por su ID y lo elimina directamente de la base de datos.
        const user = await User.findByIdAndDelete(id);
        // Si no se encuentra (y por lo tanto no se elimina) ningún usuario con ese ID, devuelve 404.
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        // Si se eliminó correctamente, envía una respuesta JSON exitosa.
        res.json({ message: 'Usuario eliminado exitosamente', _id: id });
    } catch (error) {
        // Si ocurre un error durante la operación de eliminación.
        console.error("Error en deleteUser:", error); // Registra el error en el servidor.
        res.status(500).json({ message: 'Error al eliminar el usuario', error: error.message });
    }
};