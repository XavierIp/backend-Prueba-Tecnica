const mongoose = require('mongoose');
const { Schema } = mongoose;

const roleSchema = new Schema({
  nombre: {
    type: String,
    required: true,
    unique: true,
    enum: ['admin', 'cliente'] 
  }
});

module.exports = mongoose.model('Role', roleSchema);