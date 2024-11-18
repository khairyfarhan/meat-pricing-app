const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  category: String  // Remove the enum restriction to allow custom categories
});

const Price = require('./price');

productSchema.pre('findOneAndDelete', async function(next) {
  const productId = this.getQuery()._id;
  await Price.deleteMany({ product: productId });
  next();
});


module.exports = mongoose.model('Product', productSchema);
