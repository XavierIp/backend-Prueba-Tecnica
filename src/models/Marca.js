const mongoose = require('mongoose');
const { Schema } = mongoose;

const marcaSchema = new Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre de la marca es obligatorio'],
    unique: true,
    trim: true 
  }
}, {
  timestamps: true 
});

module.exports = mongoose.model('Marca', marcaSchema);