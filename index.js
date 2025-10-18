const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./src/config/db');
require('dotenv').config();
const Role = require('./src/models/Role'); 
const productRoutes = require('./src/routes/productRoutes');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const catalogRoutes = require('./src/routes/catalogRoutes');

connectDB();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api', catalogRoutes);

app.get('/', (req, res) => {
  res.send('API funcionando!');
});


async function createInitialRoles() {
  try {
    const count = await Role.countDocuments();
    if (count > 0) return; 

    await Promise.all([
      new Role({ nombre: 'admin' }).save(),
      new Role({ nombre: 'cliente' }).save(),
    ]);
    console.log('Roles "admin" y "cliente" creados en la BD.');
  } catch (error) {
    console.error('Error al crear roles iniciales:', error);
  }
}

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
  createInitialRoles(); 
});