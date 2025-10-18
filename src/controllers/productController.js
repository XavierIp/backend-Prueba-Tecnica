/**
 * @fileoverview Controlador para las operaciones CRUD y otras acciones relacionadas con los productos.
 * Maneja la creación, lectura (con filtros, paginación y ordenamiento), actualización,
 * eliminación de productos, así como la exportación a Excel, carga masiva desde Excel
 * y generación de fichas técnicas en PDF. Interactúa con el modelo Product de Mongoose,
 * Cloudinary para imágenes y servicios de correo/PDF.
 */

// Importa el modelo Product de Mongoose.
const Product = require('../models/Product');
// Importa la librería 'exceljs' para generar archivos Excel.
const exceljs = require('exceljs');
// Importa la librería 'xlsx' para leer archivos Excel (carga masiva).
const xlsx = require('xlsx');
// Importa la librería 'pdfkit' para generar documentos PDF.
const PDFDocument = require('pdfkit');
// Importa la instancia configurada de Cloudinary (para borrar imágenes).
const { cloudinaryInstance } = require('../middleware/uploadMiddleware');
// Importa la función para enviar correos de cambio de precio.
const { sendPriceChangeEmail } = require('../config/mailer');
// Importa 'axios' para descargar imágenes desde URLs para el PDF.
const axios = require('axios');
// Importa el módulo 'path' de Node.js para construir rutas de archivo.
const path = require('path');

// --- CREAR PRODUCTO ---
/**
 * Crea un nuevo producto en la base de datos.
 * Recibe los datos del producto del cuerpo de la solicitud (`req.body`)
 * y el archivo de imagen a través de `req.file`.
 * Guarda la URL de la imagen proporcionada por Cloudinary en el campo 'imagen'.
 * Realiza validación básica de campos obligatorios.
 * En caso de error al guardar en la BD después de subir la imagen, intenta borrar la imagen de Cloudinary.
 * @async
 * @function createProduct
 * @param {object} req - Objeto de solicitud de Express. `req.body` contiene los datos del producto, `req.file` la información de la imagen subida a Cloudinary.
 * @param {object} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Envía una respuesta JSON con el producto creado (estado 201) o un mensaje de error (estado 400 o 500).
 */
exports.createProduct = async (req, res) => {
    try {
        const { NombreProducto, PrecioVenta, stock, idMarca, idModelo, idColor, idTalla } = req.body;

        // Obtiene la URL segura de la imagen subida a Cloudinary desde req.file.path.
        const imagenPath = req.file ? req.file.path : null;

        // Validación básica de campos requeridos.
        if (!NombreProducto || !PrecioVenta || !stock || !idMarca) {
            return res.status(400).json({ message: 'Nombre, Precio, Stock y Marca son obligatorios.' });
        }

        // Crea una nueva instancia del modelo Product.
        const newProduct = new Product({
            NombreProducto,
            PrecioVenta: parseFloat(PrecioVenta), // Asegura que el precio sea un número.
            stock: parseInt(stock, 10),       // Asegura que el stock sea un número entero.
            idMarca, // ID de la marca (ObjectId).
            idModelo: idModelo || null,      // IDs opcionales, se guardan como null si no se proporcionan.
            idColor: idColor || null,
            idTalla: idTalla || null,
            imagen: imagenPath // Guarda la URL completa de Cloudinary.
        });

        // Guarda el nuevo producto en MongoDB.
        const savedProduct = await newProduct.save();
        // Envía el producto guardado como respuesta con estado 201 (Creado).
        res.status(201).json(savedProduct);

    } catch (error) {
        console.error("Create Product Error:", error); // Registra el error detallado en el servidor.

        // Intenta limpiar Cloudinary si la imagen se subió pero la BD falló.
        if (req.file && req.file.filename) { // 'filename' contiene el public_id asignado por multer-storage-cloudinary
            cloudinaryInstance.uploader.destroy(req.file.filename)
                .then(result => console.log('Imagen de Cloudinary borrada tras error en BD:', result))
                .catch(err => console.error('Error borrando imagen de Cloudinary tras error en BD:', err));
        }
        // Envía una respuesta de error genérica al cliente.
        res.status(500).json({ message: 'Error al crear el producto', error: error.message });
    }
};

// --- OBTENER TODOS LOS PRODUCTOS ---
/**
 * Obtiene una lista paginada y filtrada de productos.
 * Acepta parámetros de consulta (`req.query`) para búsqueda por nombre (`search`),
 * filtrado por ID de marca (`marca`), ID de color (`color`), rango de precios (`minPrice`, `maxPrice`),
 * ordenamiento (`sort`) y paginación (`page`, `limit`).
 * Popula los nombres de las referencias (marca, modelo, color, talla).
 * @async
 * @function getAllProducts
 * @param {object} req - Objeto de solicitud de Express. `req.query` contiene los parámetros de filtrado/paginación.
 * @param {object} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Envía una respuesta JSON con la lista de productos y metadatos de paginación o un mensaje de error.
 */
exports.getAllProducts = async (req, res) => {
    try {
        // Lee los parámetros de la URL, estableciendo valores por defecto para paginación y orden.
        const {
            search, marca, color, minPrice, maxPrice,
            sort = 'newest', // Orden por defecto: los más nuevos primero.
            page = 1,
            limit = 8 // Límite por defecto: 8 productos por página.
        } = req.query;

        console.log("BACKEND - Received Params:", req.query);

        // Construye el objeto de filtro para la consulta a MongoDB.
        const filterObject = {};
        if (search) {
            filterObject.NombreProducto = { $regex: search, $options: 'i' }; // Búsqueda insensible a mayúsculas/minúsculas.
        }
        if (marca) {
            filterObject.idMarca = marca; // Filtra por el ObjectId de la marca.
        }
        if (color) {
            filterObject.idColor = color; // Filtra por el ObjectId del color.
        }
        // Construye el filtro de rango de precios si se proporciona minPrice o maxPrice.
        if (minPrice || maxPrice) {
            filterObject.PrecioVenta = {};
            if (minPrice) {
                filterObject.PrecioVenta.$gte = parseFloat(minPrice); // Mayor o igual que minPrice.
            }
            if (maxPrice) {
                filterObject.PrecioVenta.$lte = parseFloat(maxPrice); // Menor o igual que maxPrice.
            }
        }

        console.log("BACKEND - Constructed Filter:", filterObject); 

        // Determina el objeto de ordenamiento basado en el parámetro 'sort'.
        let sortObject = {};
        switch (sort) {
            case 'price-asc': sortObject = { PrecioVenta: 1 }; break; // Precio ascendente.
            case 'price-desc': sortObject = { PrecioVenta: -1 }; break; // Precio descendente.
            case 'newest': default: sortObject = { createdAt: -1 }; break; // Más nuevos primero (por fecha de creación).
        }

        // Calcula los valores para la paginación.
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum; 

        // Cuenta el número total de productos que coinciden con los filtros (para calcular totalPages).
        const totalProducts = await Product.countDocuments(filterObject);
        // Calcula el número total de páginas.
        const totalPages = Math.ceil(totalProducts / limitNum);

        // Realiza la consulta principal a la base de datos.
        const products = await Product.find(filterObject) // Aplica los filtros.
            .populate('idMarca', 'nombre')   // Obtiene el nombre de la marca referenciada.
            .populate('idModelo', 'nombre')  // Obtiene el nombre del modelo.
            .populate('idColor', 'nombre')   // Obtiene el nombre del color.
            .populate('idTalla', 'nombre')   // Obtiene el nombre de la talla.
            .sort(sortObject)               // Aplica el ordenamiento.
            .skip(skip)                     // Aplica el salto de paginación.
            .limit(limitNum);                // Aplica el límite de resultados por página.

        console.log(`BACKEND - Found ${products.length} products for page ${pageNum}`); 

        // Envía la respuesta exitosa con los productos y la información de paginación.
        res.status(200).json({
            products,
            currentPage: pageNum,
            totalPages,
            totalProducts,
        });
    } catch (error) {
        console.error("Get All Products Error:", error);
        res.status(500).json({ message: 'Error al obtener los productos', error: error.message });
    }
};

// --- ACTUALIZAR PRODUCTO ---
/**
 * Actualiza un producto existente por su ID.
 * Recibe el ID del producto de los parámetros de la ruta (`req.params.id`)
 * y los datos actualizados del cuerpo (`req.body`).
 * Si se sube una nueva imagen (`req.file`), actualiza la URL en la BD
 * y elimina la imagen anterior de Cloudinary.
 * Verifica si el precio ha cambiado y, de ser así, envía una notificación por correo.
 * @async
 * @function updateProduct
 * @param {object} req - Objeto de solicitud de Express. `req.params.id` es el ID del producto, `req.body` los datos, `req.file` la nueva imagen (opcional).
 * @param {object} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Envía una respuesta JSON con el producto actualizado o un mensaje de error.
 */
exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { NombreProducto, PrecioVenta, stock, idMarca, idModelo, idColor, idTalla } = req.body;
        const numericPrecioVenta = parseFloat(PrecioVenta);
        const numericStock = parseInt(stock, 10);

        // Obtiene el estado del producto  de la actualización para comparar precios y obtener la URL de imagen antigua.
        // .lean() devuelve un objeto JS plano, más eficiente para lectura.
        const productBeforeUpdate = await Product.findById(id).lean();
        if (!productBeforeUpdate) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }
        const oldPrice = productBeforeUpdate.PrecioVenta;
        const oldImagePath = productBeforeUpdate.imagen; // URL de Cloudinary antigua.

        // Prepara el objeto con los datos a actualizar.
        const updateData = {
            NombreProducto,
            // Usa el valor numérico o el original si la conversión falla.
            PrecioVenta: isNaN(numericPrecioVenta) ? productBeforeUpdate.PrecioVenta : numericPrecioVenta,
            stock: isNaN(numericStock) ? productBeforeUpdate.stock : numericStock,
            idMarca,
            idModelo: idModelo || null,
            idColor: idColor || null,
            idTalla: idTalla || null
        };

        // Si se subió un nuevo archivo de imagen.
        if (req.file) {
            updateData.imagen = req.file.path; // Asigna la nueva URL de Cloudinary.
            // Si había una imagen antigua, intenta borrarla de Cloudinary.
            if (oldImagePath) {
                try {
                    // Extrae el public_id de la URL de Cloudinary.
                    const urlParts = oldImagePath.split('/');
                    const folderIndex = urlParts.indexOf('prostore_products');
                    if (folderIndex > -1) {
                         const publicIdWithFolderAndExt = urlParts.slice(folderIndex).join('/');
                         // Quita la extensión del archivo.
                         const publicId = publicIdWithFolderAndExt.substring(0, publicIdWithFolderAndExt.lastIndexOf('.'));
                         if (publicId) {
                             // Llama a la API de Cloudinary para destruir 
                             cloudinaryInstance.uploader.destroy(publicId)
                                 .then(result => console.log('Imagen antigua de Cloudinary borrada:', result))
                                 .catch(err => console.error('Error borrando imagen antigua de Cloudinary:', publicId, err));
                         }
                    }
                } catch(e){ console.error("No se pudo extraer public_id para borrar:", oldImagePath, e)}
            }
        }

        // Realiza la actualización en la base de datos.
        // { new: true } devuelve el documento modificado.
        // { runValidators: true } asegura que se apliquen las validaciones del esquema.
        const updatedProduct = await Product.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

        // --- Notificación por Cambio de Precio ---
        const newPrice = updatedProduct.PrecioVenta;
        console.log('--- Verificación de Cambio de Precio ---');
        console.log('Precio Antiguo (oldPrice):', oldPrice, typeof oldPrice);
        console.log('Precio Nuevo (newPrice):', newPrice, typeof newPrice);
        console.log('¿Son diferentes?:', oldPrice !== newPrice);

        if (oldPrice !== newPrice) {
            console.log(`Precio cambiado para ${updatedProduct.NombreProducto}: ${oldPrice} -> ${newPrice}. Intentando enviar notificación...`);
            // Llama a la función de envío de correo 
            sendPriceChangeEmail(updatedProduct, oldPrice);
        } else {
            console.log(`El precio para ${updatedProduct.NombreProducto} no cambió. No se envía correo.`);
        }

        // Envía el producto actualizado como respuesta.
        res.status(200).json(updatedProduct);

    } catch (error) {
        console.error("Update Product Error:", error);
        // Si la actualización de la BD falla pero se subió una imagen nueva, intenta borrarla de Cloudinary.
         if (req.file && req.file.filename) { // 'filename' contiene el public_id
             cloudinaryInstance.uploader.destroy(req.file.filename)
                .then(result => console.log('Imagen nueva de Cloudinary borrada tras error en BD:', result))
                .catch(err => console.error('Error borrando imagen nueva de Cloudinary tras error en BD:', err));
         }
        res.status(500).json({ message: 'Error al actualizar el producto', error: error.message });
    }
};

// --- ELIMINAR PRODUCTO ---
/**
 * Elimina un producto por su ID.
 * También intenta eliminar la imagen asociada de Cloudinary.
 * @async
 * @function deleteProduct
 * @param {object} req - Objeto de solicitud de Express. `req.params.id` es el ID del producto a eliminar.
 * @param {object} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Envía una respuesta JSON con un mensaje de éxito o un mensaje de error.
 */
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        // Busca y elimina el documento de la base de datos.
        const deletedProduct = await Product.findByIdAndDelete(id);

        // Si no se encontró el producto, devuelve 404.
        if (!deletedProduct) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        // Si el producto eliminado tenía una imagen asociada, intenta borrarla de Cloudinary.
        if (deletedProduct.imagen) {
            try {
                // Extrae el public_id de la URL de Cloudinary 
                const urlParts = deletedProduct.imagen.split('/');
                const folderIndex = urlParts.indexOf('prostore_products');
                 if (folderIndex > -1) {
                    const publicIdWithFolderAndExt = urlParts.slice(folderIndex).join('/');
                    const publicId = publicIdWithFolderAndExt.substring(0, publicIdWithFolderAndExt.lastIndexOf('.'));
                    if (publicId) {
                        // Llama a la API de Cloudinary para destruir la imagen.
                        cloudinaryInstance.uploader.destroy(publicId)
                            .then(result => console.log('Imagen de Cloudinary borrada al eliminar producto:', result))
                            .catch(err => console.error('Error borrando imagen de Cloudinary al eliminar producto:', publicId, err));
                    }
                 }
            } catch(e){ console.error("No se pudo extraer public_id para borrar al eliminar producto:", deletedProduct.imagen, e)}
        }

        // Envía una respuesta de éxito.
        res.status(200).json({ message: 'Producto eliminado exitosamente', _id: id });

    } catch (error) {
        console.error("Delete Product Error:", error);
        res.status(500).json({ message: 'Error al eliminar el producto', error: error.message });
    }
};

// --- EXPORTAR A EXCEL ---
/**
 * Genera y envía un archivo Excel (.xlsx) con los productos filtrados.
 * Acepta parámetros de consulta `search` y `marca` para filtrar los productos a exportar.
 * Utiliza la librería `exceljs` para crear el archivo.
 * @async
 * @function exportProducts
 * @param {object} req - Objeto de solicitud de Express. `req.query` puede contener `search` y `marca`.
 * @param {object} res - Objeto de respuesta de Express. Envía el archivo Excel como descarga.
 * @returns {Promise<void>} Envía el archivo Excel o un mensaje de error JSON.
 */
exports.exportProducts = async (req, res) => {
     try {
        const { search, marca } = req.query;
        // Construye el objeto de filtro (igual que en getAllProducts).
        const filterObject = {};
        if (search) filterObject.NombreProducto = { $regex: search, $options: 'i' };
        if (marca && marca !== '') filterObject.idMarca = marca;

        // Obtiene TODOS los productos que coinciden con los filtros (sin paginación).
        // Popula los nombres necesarios para el reporte.
        const products = await Product.find(filterObject)
            .populate('idMarca', 'nombre')
            .populate('idModelo', 'nombre')
            .populate('idColor', 'nombre')
            .sort({ createdAt: -1 });

        // Crea un nuevo libro de trabajo Excel.
        const workbook = new exceljs.Workbook();
        // Añade una hoja llamada 'Productos'.
        const worksheet = workbook.addWorksheet('Productos');

        // Define las columnas del archivo Excel.
        worksheet.columns = [
            { header: 'ID', key: '_id', width: 30 }, // 'key' debe coincidir con las claves del objeto que se añadirá
            { header: 'Nombre', key: 'NombreProducto', width: 40 },
            { header: 'Marca', key: 'idMarca', width: 20 },
            { header: 'Modelo', key: 'idModelo', width: 20 },
            { header: 'Color', key: 'idColor', width: 20 },
            { header: 'Precio (S/)', key: 'PrecioVenta', width: 15, style: { numFmt: '"S/"#,##0.00' } }, // Formato de moneda
            { header: 'Stock', key: 'stock', width: 10 },
        ];

        // Aplica estilo a la fila de encabezado.
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; // Letra blanca y negrita
        worksheet.getRow(1).fill = { type: 'pattern', pattern:'solid', fgColor:{argb:'FF4F46E5'} }; // Fondo índigo

        // Añade cada producto como una fila en la hoja.
        products.forEach(product => {
            worksheet.addRow({
                _id: product._id.toString(), // Convierte ObjectId a string
                NombreProducto: product.NombreProducto,
                idMarca: product.idMarca?.nombre || 'N/A', // Accede al nombre populado de forma segura
                idModelo: product.idModelo?.nombre || 'N/A',
                idColor: product.idColor?.nombre || 'N/A',
                PrecioVenta: product.PrecioVenta,
                stock: product.stock
            });
        });

        // Configura las cabeceras HTTP para indicar que la respuesta es un archivo Excel descargable.
        res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition','attachment; filename=' + 'Reporte_Productos_Filtrados.xlsx');

        // Escribe el contenido del libro de trabajo Excel en el stream de respuesta HTTP.
        await workbook.xlsx.write(res);
        // Finaliza la respuesta.
        res.end();

    } catch (error) {
        console.error("Export Products Error:", error);
        // Si las cabeceras ya se enviaron (el archivo empezó a escribirse), no se puede enviar JSON.
        if (!res.headersSent) {
             res.status(500).json({ message: 'Error al exportar productos', error: error.message });
        }
    }
};

// --- CARGA MASIVA ---
/**
 * Procesa un archivo Excel subido para crear múltiples productos en la base de datos.
 * Lee el archivo desde `req.file.buffer` (usando `memoryStorage` de Multer).
 * Mapea las columnas del Excel a los campos del modelo Product.
 * Utiliza `insertMany` para una inserción eficiente.
 * @async
 * @function uploadMassProducts
 * @param {object} req - Objeto de solicitud de Express. `req.file` contiene la información del archivo Excel subido a memoria.
 * @param {object} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Envía una respuesta JSON indicando el resultado de la carga o un mensaje de error.
 */
exports.uploadMassProducts = async (req, res) => {
    // Verifica si Multer procesó un archivo.
    if (!req.file) {
        return res.status(400).json({ message: 'No se subió ningún archivo Excel.' });
    }
    try {
        // Lee el buffer del archivo Excel usando la librería 'xlsx'.
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        // Obtiene el nombre de la primera hoja.
        const sheetName = workbook.SheetNames[0];
        // Obtiene los datos de la primera hoja.
        const worksheet = workbook.Sheets[sheetName];
        // Convierte los datos de la hoja a un array de arrays JSON (fila por fila).
        // header: 1 indica que la primera fila debe tratarse como encabezados.
        const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        // Verifica si el archivo tiene datos además de la cabecera.
        if (jsonData.length <= 1) {
           return res.status(400).json({ message: 'El archivo Excel está vacío o solo contiene encabezados.' });
        }

        // Extrae los encabezados (primera fila) y los datos (filas restantes).
        const headers = jsonData[0].map(h => h.toString().trim()); // Limpia espacios y asegura que sean strings.
        const rows = jsonData.slice(1);

        // Mapea cada fila de datos a un objeto de producto listo para Mongoose.
        const productsToCreate = rows.map((row, rowIndex) => { // rowIndex para logs de error
            let productData = {};
            headers.forEach((header, index) => {
                // Lógica de mapeo de nombres de columna del Excel a nombres de campo del modelo Mongoose.
                // ¡IMPORTANTE! Ajusta esto para que coincida exactamente con tus encabezados de Excel.
                let modelField = header; // Asume coincidencia directa por defecto
                if (header === 'Nombre Producto') modelField = 'NombreProducto';
                if (header === 'Precio Venta') modelField = 'PrecioVenta';
                if (header === 'Marca ID') modelField = 'idMarca';
                if (header === 'Modelo ID') modelField = 'idModelo';
                if (header === 'Color ID') modelField = 'idColor';
                if (header === 'Talla ID') modelField = 'idTalla';
                

                // Si la celda tiene un valor, lo asigna al campo correspondiente.
                if (modelField && row[index] !== undefined && row[index] !== null) {
                    let cellValue = row[index];
                    // Conversión básica de tipos para precio y stock.
                    if (['PrecioVenta', 'stock'].includes(modelField)) {
                        const numValue = parseFloat(cellValue);
                        productData[modelField] = isNaN(numValue) ? 0 : numValue;
                    } else {
                         // Asegura que otros valores sean strings y sin espacios extra.
                         productData[modelField] = cellValue.toString().trim();
                    }
                }
            });

            // Validación básica de campos requeridos antes de intentar insertar.
            // Los IDs de Marca, etc., también deben ser válidos ObjectIds de MongoDB.
            // Una validación más robusta verificaría el formato de los IDs aquí.
            if (!productData.NombreProducto || productData.PrecioVenta === undefined || productData.stock === undefined || !productData.idMarca) {
               console.warn(`Saltando fila ${rowIndex + 2} por campos requeridos faltantes o inválidos:`, row, productData); // +2 por header y index 0
              return null; // Marca la fila como inválida para filtrarla después.
            }
        
            return productData;

        }).filter(p => p !== null); // Elimina las filas marcadas como inválidas.

        // Si ninguna fila era válida.
        if (productsToCreate.length === 0) {
            return res.status(400).json({ message: 'No se encontraron productos válidos para importar en el archivo.' });
        }

        // Intenta insertar todos los productos válidos en la base de datos.
        let insertedCount = 0;
        let errors = [];
        try {
            // insertMany es más eficiente que múltiples .save().
            // ordered: false permite continuar insertando aunque algunas filas fallen 
            const result = await Product.insertMany(productsToCreate, { ordered: false });
            insertedCount = result.length; // Número de documentos insertados exitosamente.
        } catch (error) {
            if (error.name === 'BulkWriteError') {
                 insertedCount = error.result.nInserted; // Documentos insertados antes del error.
                 // Recopila información sobre las filas que fallaron.
                 errors = error.writeErrors.map(e => ({ index: e.index, message: e.errmsg, rowData: productsToCreate[e.index] })); // Incluye datos de la fila
                 console.warn(`Carga masiva completada con ${errors.length} errores.`);
            } else {
               
                throw error;
            }
        }

        // Envía la respuesta indicando cuántos productos se crearon y detalles de errores 
        res.status(201).json({
            message: `Carga masiva completada. ${insertedCount} de ${productsToCreate.length} productos procesados creados.`,
            errors: errors // Devuelve los errores individuales si los hubo.
        });

    } catch (error) {
        console.error("Mass Upload Error:", error);
        res.status(500).json({ message: 'Error procesando el archivo Excel.', error: error.message });
    }
};

// --- OBTENER PDF ---
/**
 * Genera una Ficha Técnica en PDF para un producto específico por su ID.
 * Obtiene los datos del producto, descarga la imagen desde Cloudinary 
 * y utiliza `pdfkit` para crear el documento PDF y enviarlo como descarga.
 * @async
 * @function getProductPdf
 * @param {object} req - Objeto de solicitud de Express. `req.params.id` es el ID del producto.
 * @param {object} res - Objeto de respuesta de Express. Envía el archivo PDF.
 * @returns {Promise<void>} Envía el stream del PDF o un mensaje de error JSON.
 */
exports.getProductPdf = async (req, res) => {
    try {
        const { id } = req.params;

        // Busca el producto y popula todos los campos referenciados.
        const product = await Product.findById(id)
            .populate('idMarca', 'nombre')
            .populate('idModelo', 'nombre')
            .populate('idColor', 'nombre')
            .populate('idTalla', 'nombre');

        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        // Crea un nuevo documento PDF en memoria.
        const doc = new PDFDocument({ margin: 50 });
        // Limpia el nombre del producto para usarlo en el nombre del archivo.
        const filename = `Ficha-${product.NombreProducto.replace(/[^a-zA-Z0-9]/g, '_')}-${id}.pdf`;
        // Configura las cabeceras para la descarga del PDF.
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        // Conecta el stream de salida del PDF a la respuesta HTTP.
        doc.pipe(res);

        // --- Añade Contenido al PDF ---
        doc.fontSize(20).font('Helvetica-Bold').text('Ficha Técnica de Producto', { align: 'center' });
        doc.moveDown(1.5);

        // Intenta descargar e incrustar la imagen desde la URL de Cloudinary.
        if (product.imagen) {
            console.log(`Intentando descargar imagen para PDF desde: ${product.imagen}`);
            try {
                // Descarga la imagen usando axios, esperando un arraybuffer.
                const imageResponse = await axios.get(product.imagen, {
                    responseType: 'arraybuffer',
                    timeout: 15000 // Aumenta el timeout por si la descarga es lenta.
                });
                const imageBuffer = Buffer.from(imageResponse.data, 'binary');

                // Calcula la posición X para centrar la imagen.
                const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
                const imageWidth = 250;
                const imageHeight = 250;
                const imageX = doc.page.margins.left + (pageWidth - imageWidth) / 2;
                const imageY = doc.y; // Posición Y actual.

                // Incrusta la imagen en el PDF desde el buffer.
                doc.image(imageBuffer, imageX, imageY, {
                    fit: [imageWidth, imageHeight], // Limita el tamaño.
                    align: 'center'
                });
                doc.moveDown(1.5); // Espacio después de la imagen.

            } catch (imageError) {
                // Si falla la descarga o incrustación, registra el error y añade un texto al PDF.
                console.error("Error al descargar/incrustar imagen en PDF:", imageError.message);
                doc.fontSize(10).fillColor('red').text(`(Error al cargar imagen)`, { align: 'center' });
                doc.moveDown(1.5);
            }
        } else {
            // Si no hay imagen, añade un texto indicándolo.
            doc.fontSize(10).fillColor('grey').text('(Sin imagen asignada)', { align: 'center' });
            doc.moveDown(1.5);
        }
        doc.fillColor('black'); // Restablece el color de texto.

        // --- Añade los Datos del Producto ---
        const dataStartY = doc.y; // Posición Y donde empiezan los datos.
        const labelX = 50;
        const valueX = 150;
        const lineSpacing = 0.7; // Espaciado entre líneas.

        // Añade cada campo con su etiqueta y valor.
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Nombre:', labelX, dataStartY)      .font('Helvetica').text(product.NombreProducto || 'N/A', valueX, dataStartY);
        doc.moveDown(lineSpacing);
        doc.font('Helvetica-Bold').text('Marca:', labelX, doc.y).font('Helvetica').text(product.idMarca?.nombre || 'N/A', valueX, doc.y - 12 * lineSpacing);
        doc.moveDown(lineSpacing);
        doc.font('Helvetica-Bold').text('Modelo:', labelX, doc.y).font('Helvetica').text(product.idModelo?.nombre || 'N/A', valueX, doc.y - 12 * lineSpacing);
        doc.moveDown(lineSpacing);
        doc.font('Helvetica-Bold').text('Color:', labelX, doc.y).font('Helvetica').text(product.idColor?.nombre || 'N/A', valueX, doc.y - 12 * lineSpacing);
        doc.moveDown(lineSpacing);
        doc.font('Helvetica-Bold').text('Talla:', labelX, doc.y).font('Helvetica').text(product.idTalla?.nombre || 'N/A', valueX, doc.y - 12 * lineSpacing);
        doc.moveDown(lineSpacing);
        doc.font('Helvetica-Bold').text('Precio:', labelX, doc.y).font('Helvetica').text(`S/ ${product.PrecioVenta?.toFixed(2) || '0.00'}`, valueX, doc.y - 12 * lineSpacing);
        doc.moveDown(lineSpacing);
        doc.font('Helvetica-Bold').text('Stock:', labelX, doc.y).font('Helvetica').text(`${product.stock ?? 'N/A'}`, valueX, doc.y - 12 * lineSpacing);
        doc.moveDown(lineSpacing);
        doc.font('Helvetica-Bold').text('ID Producto:', labelX, doc.y).font('Helvetica').text(`${product._id}`, valueX, doc.y - 12 * lineSpacing);

        // Posiciona el cursor cerca del final de la página.
        doc.y = doc.page.height - doc.page.margins.bottom - 20; // Ajusta según necesidad
        // Añade la fecha de generación.
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('grey').text(`Documento generado el: ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`, { align: 'center' });

        // Finaliza el documento PDF.
        doc.end();

    } catch (error) {
        console.error("Get Product PDF Error General:", error);
        // Si las cabeceras HTTP aún no se han enviado, envía una respuesta de error JSON.
        if (!res.headersSent) {
            res.status(500).json({ message:'Error al generar el PDF', error: error.message });
        } else {
            // Si ya se empezó a enviar el PDF, solo podemos terminar la conexión abruptamente.
            // El error ya se registró en la consola del servidor.
            res.end();
        }
    }
};