const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const pino = require('pino');
const pinoHttp = require('pino-http');
const { celebrate, Joi } = require('celebrate');
const cors = require('cors'); //Import cors

// Set up Pino logger
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

const app = express();
app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors()); // Enable CORS for all origins (adjust as needed)

// MongoDB Atlas Connection String
const mongoUri = 'mongodb+srv://dilippalani5511:AO5bli7IxbWYH1AY@cluster0.stv6p.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Enable Mongoose debugging for detailed logs
mongoose.set('debug', true);

// Check MongoDB Atlas connection
function checkConnection() {
  return mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
}

checkConnection()
  .then(() => {
    logger.info('Connected to MongoDB Atlas');
    const PORT = 3000;
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    logger.error('Error connecting to MongoDB Atlas:', err.message);
    process.exit(1);
  });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  description: { type: String, trim: true },
});

const Product = mongoose.model('Product', productSchema);

const productValidationSchema = celebrate({
  body: Joi.object({
    name: Joi.string().required().min(3).max(50),
    price: Joi.number().required().min(0),
    description: Joi.string().allow(""),
  })
});

// CRUD Operations with improved error handling and input validation
app.post('/products', productValidationSchema, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(e => ({
        field: e.path,
        message: e.message
      }));
      return res.status(422).json({ success: false, errors: validationErrors });
    }
    logger.error('Error creating product:', err);
    res.status(500).json({ success: false, error: 'Failed to create product' });
  }
});

app.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json({ success: true, data: products });
  } catch (err) {
    logger.error('Error retrieving products:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve products' });
  }
});

app.put('/products/:id', productValidationSchema, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(e => ({
        field: e.path,
        message: e.message
      }));
      return res.status(422).json({ success: false, errors: validationErrors });
    }
    logger.error('Error updating product:', err);
    res.status(500).json({ success: false, error: 'Failed to update product' });
  }
});

app.delete('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (err) {
    logger.error('Error deleting product:', err);
    res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
});
