const mongoose = require('mongoose');

const productOptionSchema = new mongoose.Schema({
  category: { type: String, required: true },
  products: [{ type: String }]
});

module.exports = mongoose.model('ProductOption', productOptionSchema);
