const express = require('express');
const router = express.Router();
const controller = require('../controllers/cart.controller');

router.get('/', controller.getCart);
router.delete('/', controller.clearCart);
router.post('/products', controller.addProduct);
router.delete('/products/:id', controller.removeProduct);
router.put('/products/:id', controller.updateProduct);
router.get('/checkout', controller.checkout);
router.get('/shipment', controller.getShipment);

module.exports = router;
