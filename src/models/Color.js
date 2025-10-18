const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Define el esquema para los documentos de la colección 'colores'.
 * @const {mongoose.Schema} colorSchema
 */
const colorSchema = new Schema({
    /**
     * @property {string} nombre
     */
    nombre: {
        type: String, 
        required: [true, 'El nombre del color es obligatorio'], 
        unique: true,
        trim: true
    },
    hexCode: {
        type: String, 
        trim: true
    }
}, {
    timestamps: true
});
module.exports = mongoose.model('Color', colorSchema);