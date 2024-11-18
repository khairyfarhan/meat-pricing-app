const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
  location: String,
  name: String
});

const Price = require('./price');

shopSchema.pre('findOneAndDelete', async function(next) {
  const shopId = this.getQuery()._id;
  await Price.deleteMany({ shop: shopId });
  next();
});


module.exports = mongoose.model('Shop', shopSchema);
