const mongoose = require('mongoose');

const priceSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  pricePerKg: Number,
  customMeatCategory: String,
  customProduct: String,
  date: { type: Date, default: Date.now }, // Automatically set the submission date
});

const mongoosePaginate = require('mongoose-paginate-v2');
priceSchema.plugin(mongoosePaginate);


module.exports = mongoose.model('Price', priceSchema);
