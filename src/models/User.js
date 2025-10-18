const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 
const { Schema } = mongoose;


const addressSchema = new Schema({
  alias: { type: String, default: 'Casa' },
  calle: { type: String, required: true },
  ciudad: { type: String, required: true },
  distrito: { type: String, required: true },
  codigoPostal: { type: String },
  esPrincipal: { type: Boolean, default: false }
}, { _id: false }); 

const userSchema = new Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/\S+@\S+\.\S+/, 'Por favor, usa un email válido']
  },
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria'],
    minlength: 6 // Mínimo 6 caracteres
  },
  idRol: {
    type: Schema.Types.ObjectId,
    ref: 'Role', 
    required: true
  },
  direcciones: [addressSchema] 
}, {
  timestamps: true
});
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);