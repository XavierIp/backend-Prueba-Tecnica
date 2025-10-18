const mongoose = require('mongoose');
const { Schema } = mongoose;

const tallaSchema = new Schema({
  nombre: {
    type: String, 
    required: [true, 'El nombre de la talla es obligatorio'],
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Talla', tallaSchema);