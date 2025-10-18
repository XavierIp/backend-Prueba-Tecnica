const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const genericController = require('../controllers/genericController');

// Importa todos tus modelos de catálogo
const Marca = require('../models/Marca');
const Modelo = require('../models/Modelo');
const Color = require('../models/Color');
const Talla = require('../models/Talla');


const createCrudRoutes = (resource, Model) => {
  router.get(`/${resource}`, genericController.getAll(Model));
  router.post(`/${resource}`, protect, genericController.createOne(Model));
  router.put(`/${resource}/:id`, protect, genericController.updateOne(Model));
  router.delete(`/${resource}/:id`, protect, genericController.deleteOne(Model));
};
// Crea las 4 rutas CRUD automáticamente
createCrudRoutes('marcas', Marca);
createCrudRoutes('modelos', Modelo);
createCrudRoutes('colores', Color);
createCrudRoutes('tallas', Talla);

module.exports = router;