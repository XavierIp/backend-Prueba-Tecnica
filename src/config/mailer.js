/**
 * @fileoverview Configuración y función para enviar correos electrónicos usando Resend.
 * Específicamente, contiene la lógica para notificar a todos los administradores
 * cuando el precio de un producto cambia.
 */

// Importa la clase Resend desde la librería 'resend'.
const { Resend } = require('resend');
// Importa el modelo 'User' para buscar las direcciones de correo de los administradores.
const User = require('../models/User');
// Importa el modelo 'Role' para encontrar el ID del rol de administrador.
const Role = require('../models/Role');
// Importa y configura dotenv para cargar variables de entorno desde un archivo .env.
require('dotenv').config();

// Crea una instancia del cliente Resend utilizando la API Key
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Función asíncrona para buscar a todos los administradores y enviarles
 * una notificación por correo electrónico sobre un cambio de precio de producto.
 * @async
 * @function sendPriceChangeEmail
 * @param {object} product - El objeto del producto que cambió de precio. Debe incluir al menos `_id`, `NombreProducto`, `PrecioVenta` e `imagen` (URL).
 * @param {number} oldPrice - El precio que tenía el producto antes del cambio.
 */
const sendPriceChangeEmail = async (product, oldPrice) => {
    try {
        // --- Buscar Administradores ---
        // Busca el documento del rol 'admin' en la base de datos para obtener su _id.
        const adminRole = await Role.findOne({ nombre: 'admin' });
        // Si el rol 'admin' no existe, es un error de configuración crítico. No se puede continuar.
        if (!adminRole) {
            console.error('Error: Rol "admin" no encontrado en la base de datos. No se puede enviar correo.');
            return; // Termina la ejecución de la función.
        }
        // Busca todos los documentos de usuario que tengan el idRol correspondiente al rol 'admin'.
        // .select('email') optimiza la consulta para traer solo el campo 'email'.
        const adminUsers = await User.find({ idRol: adminRole._id }).select('email');
        // Extrae las direcciones de correo de los documentos de usuario encontrados.
        const adminEmails = adminUsers.map(user => user.email);

        // Si no se encontraron usuarios admin.
        if (adminEmails.length === 0) {
            console.warn('Advertencia: No se encontraron usuarios administradores para notificar.');
            return; // Termina la ejecución.
        }

        // --- Enviar Correo usando Resend ---
        // Llama al método `emails.send` de la instancia de Resend.
        // Este método es asíncrono y devuelve un objeto con `data` (si es exitoso) o `error`.
        const { data, error } = await resend.emails.send({
            // y verificado en la cuenta de Resend. Se usa un formato amigable.
            from:'Actualización <onboarding@resend.dev>', // Añadido fallback
            // Destinatarios. Resend acepta un array de strings directamente.
            to: adminEmails,
            // Asunto del correo, incluyendo el nombre del producto.
            subject: `⚠️ Cambio de Precio: ${product.NombreProducto}`,
            // Contenido del correo en formato HTML. Incluye detalles del cambio y la imagen.
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #f8f8f8; padding: 20px; text-align: center; border-bottom: 1px solid #ddd;">
                  <h1 style="margin: 0; font-size: 24px; color: #4F46E5;">⚠️ Alerta de Cambio de Precio</h1>
                </div>
                <div style="padding: 20px;">
                  <p style="margin-bottom: 15px;">Se ha detectado un cambio en el precio del siguiente producto:</p>
                  <div style="margin-bottom: 20px; text-align: center;">
                    <img src="${product.imagen || '/'}" alt="${product.NombreProducto}" style="max-width: 150px; max-height: 150px; border: 1px solid #eee; border-radius: 4px; object-fit: contain; margin-bottom: 10px;" />
                    <p style="font-size: 16px; font-weight: bold; margin: 5px 0;">${product.NombreProducto}</p>
                    <p style="font-size: 12px; color: #777; margin: 0;">ID: ${product._id}</p>
                  </div>
                  <div style="background-color: #f0f0f0; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                      <p style="margin: 5px 0;">Precio anterior: <strong style="color: #d9534f;">S/ ${oldPrice.toFixed(2)}</strong></p>
                      <p style="margin: 5px 0;">Nuevo precio: <strong style="color: #5cb85c; font-size: 1.1em;">S/ ${product.PrecioVenta.toFixed(2)}</strong></p>
                  </div>
                  <p>Por favor, inicia sesión en el panel de administración para verificar si este cambio es correcto.</p>
                  <div style="text-align: center; margin-top: 25px;">
                      <a href="${process.env.FRONTEND_URL || 'https://frontend-qxupbs9cn-xaviers-projects-88fe9411.vercel.app/'}/admin/products" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ir al Panel de Admin</a>
                  </div>
                </div>
                <div style="background-color: #f8f8f8; padding: 15px; text-align: center; border-top: 1px solid #ddd; font-size: 12px; color: #777;">
                  <p style="margin: 0;">Este es un correo automático enviado desde XaviStore.</p>
                </div>
              </div>
            `,
        });

        // Si la API de Resend devolvió un error, lo registra en consola.
        if (error) {
            console.error('Error al enviar correo con Resend:', error);
            return; // Termina la ejecución si hubo error.
        }

        // Si el envío fue exitoso, registra el ID del mensaje devuelto por Resend.
        console.log(`Correo de cambio de precio enviado a ${adminEmails.length} admin(s) via Resend. ID: ${data.id}`);

    } catch (error) {
        // Captura cualquier otro error inesperado y muestra en consola

        console.error('Error general en sendPriceChangeEmail (Resend):', error);
    }
};

// Exporta la función sendPriceChangeEmail usando module.exports 
module.exports = { sendPriceChangeEmail };