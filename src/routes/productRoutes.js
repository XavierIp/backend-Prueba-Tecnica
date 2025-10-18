const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const multer = require('multer');


const memoryStorage = multer.memoryStorage();
const uploadExcel = multer({
  storage: memoryStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'), false);
    }
  }
});

router.get('/', productController.getAllProducts);
router.post(
  '/', 
  protect, 
  upload.single('imagen'), 
  productController.createProduct 
);
router.put(
  '/:id',
  protect,
  upload.single('imagen'), 
  productController.updateProduct 
);

router.delete(
  '/:id', 
  protect,
  productController.deleteProduct 
);
router.get('/export', protect, productController.exportProducts);
router.post(
  '/upload',
  protect,
  uploadExcel.single('excelFile'), 
  productController.uploadMassProducts
);
router.get('/:id/pdf', protect, productController.getProductPdf);
module.exports = router;