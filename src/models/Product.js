const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
  NombreProducto: { type: String, required: true },
  PrecioVenta: { type: Number, required: true, min: 0 },
  imagen: { type: String },
  stock: { type: Number, required: true, default: 0 },
  idMarca: { type: Schema.Types.ObjectId, ref: 'Marca', required: true },
  idModelo: { type: Schema.Types.ObjectId, ref: 'Modelo' },
  idColor: { type: Schema.Types.ObjectId, ref: 'Color' },
  idTalla: { type: Schema.Types.ObjectId, ref: 'Talla' }
}, { timestamps: true });


module.exports = mongoose.model('Producto', productSchema);