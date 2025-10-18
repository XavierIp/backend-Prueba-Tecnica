const mongoose = require('mongoose');
const { Schema } = mongoose;

const modeloSchema = new Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del modelo es obligatorio'],
    unique: true,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Modelo', modeloSchema);