/**
 * @fileoverview Controlador genérico para operaciones CRUD (Crear, Leer, Actualizar, Eliminar).
 * Proporciona funciones reutilizables que pueden operar sobre diferentes modelos de Mongoose
 * para manejar las operaciones básicas de base de datos solicitadas a través de rutas de Express.
 */

/**
 * Funcion de manejo de errores
 * @function handleError
 * @param {object} res - Objeto de respuesta de Express.
 * @param {Error} error - El objeto de error capturado.
 * @param {string} message - Un mensaje descriptivo de la operación que falló.
 */
const handleError = (res, error, message) => {
    // Imprime el error completo en la consola del servidor para depuración
    console.error(`${message}:`, error);
    // Envía una respuesta de error 500 al cliente
    res.status(500).json({ message, error: error.message });
};

/**
 * Función de orden superior que devuelve un controlador Express para crear.
 * Acepta un modelo de Mongoose como argumento y devuelve una función async que maneja req y res.
 * @function createOne
 * @param {mongoose.Model} Model - El modelo de Mongoose sobre el cual operar.
 * @returns {function} Un controlador Express asíncrono `async (req, res) => {...}`.
 */
exports.createOne = (Model) => async (req, res) => {
    try {
        // Crea una nueva instancia del modelo con los datos recibidos en el cuerpo de la solicitud (req.body).
        const newItem = new Model(req.body);
        // Guarda el nuevo documento en la base de datos.
        const savedItem = await newItem.save();
        // Envía una respuesta 201 (Creado) con el documento guardado.
        res.status(201).json(savedItem);
    } catch (error) {
        // Si ocurre un error , usa handleError.
        handleError(res, error, 'Error al crear el item');
    }
};

/**
 * Función de orden superior que devuelve un controlador Express de obtener todo.
 * Acepta un modelo de Mongoose y devuelve una función async que maneja req y res.
 * Ordena los resultados alfabéticamente por el campo 'nombre'.
 * @function getAll
 * @param {mongoose.Model} Model - El modelo de Mongoose 
 * @returns {function} Un controlador Express asíncrono `async (req, res) => {...}`.
 */
exports.getAll = (Model) => async (req, res) => {
    try {
        // Busca todos los documentos en la colección correspondiente al modelo.
        const items = await Model.find().sort({ nombre: 1 });
        // Envía una respuesta 200 (OK) con el array de documentos encontrados.
        res.json(items);
    } catch (error) {
        // Si ocurre un error, usa handleError.
        handleError(res, error, 'Error al obtener los items');
    }
};

/**
 * Función de orden superior que devuelve un controlador Express para actualizar
 * Acepta un modelo de Mongoose y devuelve una función async que maneja req y res.
 * Utiliza el ID proporcionado en los parámetros de la ruta (req.params.id) y los datos del cuerpo (req.body).
 * @function updateOne
 * @param {mongoose.Model} Model - El modelo de Mongoose 
 * @returns {function} Un controlador Express asíncrono `async (req, res) => {...}`.
 */
exports.updateOne = (Model) => async (req, res) => {
    try {
        // Busca un documento por su ID y lo actualiza con los datos de req.body.
        const updatedItem = await Model.findByIdAndUpdate(
            req.params.id, // ID del documento a actualizar.
            req.body,      // Nuevos datos para el documento.
            {
                new: true, // Opción para devolver el documento despues de la actualización.
                runValidators: true // Opción para ejecutar las validaciones del esquema durante la actualización.
            }
        );
        // Si findByIdAndUpdate no encuentra un documento con ese ID, devuelve null.
        if (!updatedItem) {
            // Envía una respuesta 404 (No Encontrado) si el item no existe.
            return res.status(404).json({ message: 'Item no encontrado' });
        }
        // Envía una respuesta 200 (OK) con el documento actualizado.
        res.json(updatedItem);
    } catch (error) {
        // Si ocurre un error (ej: validación fallida), usa handleError.
        handleError(res, error, 'Error al actualizar el item');
    }
};

/**
 * Función de orden superior que devuelve un controlador Express para eliminar.
 * Acepta un modelo de Mongoose y devuelve una función async que maneja req y res.
 * Utiliza el ID proporcionado en los parámetros de la ruta (req.params.id).
 * @function deleteOne
 * @param {mongoose.Model} Model - El modelo de Mongoose (ej: Marca, Color).
 * @returns {function} Un controlador Express asíncrono `async (req, res) => {...}`.
 */
exports.deleteOne = (Model) => async (req, res) => {
    try {
        // Busca un documento por su ID  y lo elimina.
        const deletedItem = await Model.findByIdAndDelete(req.params.id);
        // Si findByIdAndDelete no encuentra un documento con ese ID, devuelve null.
        if (!deletedItem) {
            // Envía una respuesta 404 (No Encontrado) si el item no existe.
            return res.status(404).json({ message: 'Item no encontrado' });
        }
        // Envía una respuesta 200 (OK) con un mensaje de éxito y el ID del item eliminado.
        res.json({ message: 'Item eliminado exitosamente', _id: req.params.id });
    } catch (error) {
        // Si ocurre un error, usa handleError.
        handleError(res, error, 'Error al eliminar el item');
    }
};