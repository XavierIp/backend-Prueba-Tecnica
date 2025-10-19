/**
 * @fileoverview Configuración y función para enviar correos usando Nodemailer con Gmail.
 * Contiene la lógica para notificar a todos los administradores cuando el precio de un producto cambia.
 */

// Importa la librería Nodemailer.
const nodemailer = require('nodemailer');
// Importa los modelos necesarios.
const User = require('../models/User');
const Role = require('../models/Role');
// Carga las variables de entorno.
require('dotenv').config();

// --- Configuración del "Transportador" de Nodemailer ---
// Crea un objeto transportador que sabe cómo enviar correos a través del SMTP de Gmail.
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER, // tu.correo@gmail.com
        pass: process.env.EMAIL_PASS  // La contraseña de aplicación de 16 letras
    }
});

/**
 * Función asíncrona para buscar a todos los administradores y enviarles
 * una notificación por correo electrónico sobre un cambio de precio de producto.
 * @async
 * @function sendPriceChangeEmail
 * @param {object} product - El objeto del producto que cambió de precio.
 * @param {number} oldPrice - El precio que tenía el producto antes del cambio.
 */
const sendPriceChangeEmail = async (product, oldPrice) => {
    try {
        // --- Buscar Administradores ---
        const adminRole = await Role.findOne({ nombre: 'admin' });
        if (!adminRole) {
            console.error('Error: Rol "admin" no encontrado. No se puede enviar correo.');
            return;
        }
        const adminUsers = await User.find({ idRol: adminRole._id }).select('email');
        const adminEmails = adminUsers.map(user => user.email);

        if (adminEmails.length === 0) {
            console.warn('Advertencia: No se encontraron administradores para notificar.');
            return;
        }

        // --- Definir las opciones del correo ---
        const mailOptions = {
            from: process.env.EMAIL_FROM, // Remitente (ej: '"ProStore Admin" <tu.correo@gmail.com>')
            to: adminEmails.join(', '),   // Destinatarios (una cadena de correos separados por coma)
            subject: `⚠️ Cambio de Precio: ${product.NombreProducto}`,
            // Contenido HTML del correo (la misma plantilla de antes).
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #f8f8f8; padding: 20px; text-align: center; border-bottom: 1px solid #ddd;">
                  <h1 style="margin: 0; font-size: 24px; color: #4F46E5;">⚠️ Alerta de Cambio de Precio</h1>
                </div>
                <div style="padding: 20px;">
                  <p style="margin-bottom: 15px;">Se ha detectado un cambio en el precio del siguiente producto:</p>
                  <div style="margin-bottom: 20px; text-align: center;">
                    <img src="${product.imagen || 'https://via.placeholder.com/150?text=No+Imagen'}" alt="${product.NombreProducto}" style="max-width: 150px; max-height: 150px; border: 1px solid #eee; border-radius: 4px; object-fit: contain; margin-bottom: 10px;" />
                    <p style="font-size: 16px; font-weight: bold; margin: 5px 0;">${product.NombreProducto}</p>
                    <p style="font-size: 12px; color: #777; margin: 0;">ID: ${product._id}</p>
                  </div>
                  <div style="background-color: #f0f0f0; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                      <p style="margin: 5px 0;">Precio anterior: <strong style="color: #d9534f;">S/ ${oldPrice.toFixed(2)}</strong></p>
                      <p style="margin: 5px 0;">Nuevo precio: <strong style="color: #5cb85c; font-size: 1.1em;">S/ ${product.PrecioVenta.toFixed(2)}</strong></p>
                  </div>
                  <p>Por favor, inicia sesión en el panel de administración para verificar si este cambio es correcto.</p>
                  <div style="text-align: center; margin-top: 25px;">
                      <a href="${process.env.FRONTEND_URL || 'https://frontend-qxupbs9cn-xaviers-projects-88fe9411.vercel.app'}/admin/products" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ir al Panel de Admin</a>
                  </div>
                </div>
                <div style="background-color: #f8f8f8; padding: 15px; text-align: center; border-top: 1px solid #ddd; font-size: 12px; color: #777;">
                  <p style="margin: 0;">Este es un correo automático enviado desde ProStore.</p>
                </div>
              </div>
            `,
        };

        // --- Enviar Correo usando Nodemailer ---
        // Llama al método `sendMail` del transportador.
        const info = await transporter.sendMail(mailOptions);

        // Si el envío fue exitoso, registra el ID del mensaje.
        console.log(`Correo de cambio de precio enviado a ${adminEmails.length} admin(s) via Nodemailer. Message ID: ${info.messageId}`);

    } catch (error) {
        // Captura cualquier error durante el proceso y lo muestra en consola.
        console.error('Error general en sendPriceChangeEmail (Nodemailer):', error);
    }
};

// Exporta la función para que pueda ser usada en otros archivos (como productController.js).
module.exports = { sendPriceChangeEmail };