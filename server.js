const express = require('express');
const session = require('express-session'); // to store shop ID in session
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const Shop = require('./models/shop');
const Product = require('./models/product');
const Price = require('./models/price');

const app = express();

const ProductOption = require('./models/productOption');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// MongoDB connection (make sure it's already established before initializing)
mongoose.connect('mongodb://localhost:27017/meatPricingApp');
mongoose.connection.on('connected', async () => {
  console.log('Connected to MongoDB');
  await initializeProductOptions(); // Initialize product options on server start
});
mongoose.connection.on('error', (err) => console.log('MongoDB connection error:', err));

async function initializeProductOptions() {
  const defaultOptions = [
    { category: 'Chicken', products: ['Chicken Wings', 'Chicken Thigh', 'Chicken Drumstick'] },
    { category: 'Mutton', products: ['Mutton Ribs', 'Mutton Shoulder', 'Mutton Leg'] },
    { category: 'Lamb', products: ['Lamb Chops', 'Lamb Shoulder', 'Lamb Leg'] },
    { category: 'Beef', products: ['Beef Steak', 'Beef Ribs', 'Beef Mince'] },
  ];

  for (const option of defaultOptions) {
    const exists = await ProductOption.findOne({ category: option.category });
    if (!exists) {
      await ProductOption.create(option);
    }
  }
}


// Middleware
app.use(session({ secret: 'yourSecret', resave: false, saveUninitialized: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Serve the login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Main form with shops list - this will render index.ejs
app.get('/', async (req, res) => {
  try {
    const shops = await Shop.find();
    const productOptionsData = await ProductOption.find();

    // Map productOptions into a category-product object
    const productOptions = productOptionsData.reduce((acc, option) => {
      acc[option.category] = option.products || [];
      return acc;
    }, {});

    // Log the final structure of productOptions
    // console.log("Final Product Options:", productOptions);

    res.render('index', { 
      shops, 
      productOptions, 
      currentRoute: '/' // Added currentRoute
    });
  } catch (error) {
    console.error("Error loading data:", error);
    res.status(500).send("An error occurred while loading data.");
  }
});



// Handle shop submission and store the shop ID in the session
app.post('/submit-shop', async (req, res) => {
  const { shopLocation, shopName, shopId } = req.body;

  if (!shopId) {
    // If no shopId, create a new shop
    let shop = await Shop.findOne({ location: shopLocation, name: shopName });
    if (!shop) {
      shop = new Shop({ location: shopLocation, name: shopName });
      await shop.save();
    }
    req.session.shopId = shop._id;
  } else {
    req.session.shopId = shopId; // Use existing shop if provided
  }

  res.redirect('/'); // Reload main form with updated shop list
});

// Helper function to normalize input to an array
const normalizeToArray = (field) => {
  // If the field is already an array, return it; otherwise, wrap it in an array
  return Array.isArray(field) ? field : field ? [field] : [];
};


// Handle product submission and associate it with the current shop
app.post('/submit-products', async (req, res) => {
  let shopId = req.body.shopId; // Extract the shopId
  const meatCategory = normalizeToArray(req.body.meatCategory);
  const product = normalizeToArray(req.body.product);
  const pricePerKg = normalizeToArray(req.body.pricePerKg);
  const customMeatCategory = normalizeToArray(req.body.customMeatCategory);
  const customProduct = normalizeToArray(req.body.customProduct);

  // Handle shopId if it's sent as an array
  if (Array.isArray(shopId)) {
    shopId = shopId[0]; // Take the first value if it's an array
  }

  if (!shopId) {
    console.log("No shop selected.");
    return res.send("Please select or add a shop first.");
  }

  try {
    console.log("Form Data Received:", req.body);

    for (let i = 0; i < meatCategory.length; i++) {
      let category = meatCategory[i];
      let customCategory = null;

      if (category === "Others") {
        customCategory = customMeatCategory && customMeatCategory[i] ? customMeatCategory[i] : null;
      }
      
      if (!category) {
        console.log(`Skipping row ${i + 1} due to missing category.`);
        continue;
      }

      let productName = product && product[i] ? product[i] : null;
      let customProductName = null;

      if (productName === "custom" || !productName) {
        customProductName = customProduct && customProduct[i] ? customProduct[i] : null;
        productName = customProductName;
      }

      if (!productName) {
        console.log(`Skipping row ${i + 1} due to missing product name.`);
        continue;
      }

      const price = pricePerKg[i] || 0;

      console.log(`Processing row ${i + 1}`);
      console.log(`Meat Category: ${category}`);
      console.log(`Custom Meat Category: ${customCategory}`);
      console.log(`Product: ${productName}`);
      console.log(`Custom Product: ${customProductName}`);
      console.log(`Price: ${price}`);

      if (category === "Others" && customCategory) {
        let productOption = await ProductOption.findOne({ category: customCategory });
        if (!productOption) {
          console.log(`Saving new Custom Meat Category: ${customCategory}`);
          await ProductOption.create({ category: customCategory, products: [] });
        } else {
          console.log(`Custom Meat Category "${customCategory}" already exists.`);
        }
      }

      let productRecord = await Product.findOne({ name: productName, category });
      if (!productRecord) {
        console.log(`Saving new product: ${productName}, category: ${category}`);
        productRecord = new Product({ name: productName, category });
        await productRecord.save();

        let productOption = await ProductOption.findOne({ category: category === "Others" ? customCategory : category });
        if (productOption && !productOption.products.includes(productName)) {
          productOption.products.push(productName);
          await productOption.save();
          console.log(`Added "${productName}" to ProductOption for category: ${customCategory || category}`);
        }
      } else {
        console.log(`Product "${productName}" already exists in category "${category}".`);
      }

      console.log(`Saving price entry for ${productName} at price: ${price}`);
      const priceEntry = new Price({
        shop: shopId, // Ensure shopId is a single value
        product: productRecord._id,
        pricePerKg: price,
        customMeatCategory: customCategory,
        customProduct: customProductName,
      });
      await priceEntry.save();
      console.log(`Price entry saved with ID: ${priceEntry._id}`);
    }

    res.redirect('/view-records');
  } catch (error) {
    console.error("Error saving products:", error);
    res.status(500).send("An error occurred while saving products.");
  }
});



// View all records with optional search and pagination
app.get('/view-records', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page
    const limit = 10; // Records per page
    const searchQuery = req.query.search || ''; // Search query

    const searchCondition = searchQuery
      ? {
          $or: [
            { 'shop.name': { $regex: searchQuery, $options: 'i' } },    // Shop name
            { 'product.name': { $regex: searchQuery, $options: 'i' } }, // Product name
            { 'product.category': { $regex: searchQuery, $options: 'i' } } // Category
          ],
        }
      : {};

    // Use aggregation to filter and populate
    const pipeline = [
      { $lookup: { from: 'shops', localField: 'shop', foreignField: '_id', as: 'shop' } }, // Populate shop
      { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } }, // Populate product
      { $unwind: { path: '$shop', preserveNullAndEmptyArrays: true } }, // Unwind shop
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } }, // Unwind product
      { $match: searchCondition }, // Apply search condition
      { $skip: (page - 1) * limit }, // Skip records for pagination
      { $limit: limit }, // Limit records for the page
    ];

    const records = await Price.aggregate(pipeline);
    const totalRecords = await Price.countDocuments(searchCondition);
    const totalPages = Math.ceil(totalRecords / limit);

    // Render the template with filtered results
    res.render('view-records', {
      records,
      totalPages,
      currentPage: page,
      searchQuery,
      currentRoute: '/view-records',
    });
  } catch (error) {
    console.error("Error retrieving records:", error);
    res.status(500).send("An error occurred.");
  }
});

// Route to handle deletion of selected records
app.post('/delete-records', async (req, res) => {
  const recordIds = req.body.recordIds; // Get selected record IDs from the form

  if (!recordIds || recordIds.length === 0) {
    console.log("No records selected for deletion.");
    return res.status(400).send("No records selected for deletion.");
  }

  try {
    // Delete all records with the selected IDs
    await Price.deleteMany({ _id: { $in: recordIds } });
    console.log(`Deleted records with IDs: ${recordIds}`);
    res.redirect('/view-records'); // Redirect back to the View Records page
  } catch (error) {
    console.error("Error deleting records:", error);
    res.status(500).send("An error occurred while deleting records.");
  }
});


// Render a page listing all shops with edit and delete options
app.get('/manage-shops', async (req, res) => {
  try {
    const shops = await Shop.find();
    res.render('manage-shops', { 
      shops, 
      currentRoute: '/manage-shops' // Added currentRoute
    });
  } catch (error) {
    console.error("Error fetching shops:", error);
    res.status(500).send("An error occurred while fetching shops.");
  }
});

// Render update form for shops
app.get('/update-shop/:id', async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    res.render('update-shop', { shop });
  } catch (error) {
    console.error("Error fetching shop:", error);
    res.status(500).send("An error occurred while fetching the shop.");
  }
});

// Handle update submission for shops
app.post('/update-shop/:id', async (req, res) => {
  try {
    const { location, name } = req.body;
    await Shop.findByIdAndUpdate(req.params.id, { location, name });
    res.redirect('/manage-shops');
  } catch (error) {
    console.error("Error updating shop:", error);
    res.status(500).send("An error occurred while updating the shop.");
  }
});

app.get('/delete-shop/:id', async (req, res) => {
  try {
    await Shop.findByIdAndDelete(req.params.id);
    res.redirect('/manage-shops');
  } catch (error) {
    console.error("Error deleting shop:", error);
    res.status(500).send("An error occurred while deleting the shop.");
  }
});

// Render a page listing all products with edit and delete options
app.get('/manage-products', async (req, res) => {
  try {
    const searchQuery = req.query.search || ''; // Get the search query from the request
    const searchCondition = searchQuery
      ? {
          $or: [
            { name: { $regex: searchQuery, $options: 'i' } }, // Search in product name
            { category: { $regex: searchQuery, $options: 'i' } }, // Search in category
          ],
        }
      : {};

    const products = await Product.find(searchCondition); // Apply search condition
    res.render('manage-products', { 
      products, 
      searchQuery, // Pass the search query back to the template
      currentRoute: '/manage-products' // Pass current route for navigation
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("An error occurred while fetching products.");
  }
});


// Render update form for products
app.get('/update-product/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    res.render('update-product', { product });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).send("An error occurred while fetching the product.");
  }
});

// Handle update submission for products
app.post('/update-product/:id', async (req, res) => {
  try {
    const { name, category } = req.body;
    await Product.findByIdAndUpdate(req.params.id, { name, category });
    res.redirect('/manage-products');
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).send("An error occurred while updating the product.");
  }
});

// Handle product deletion
app.get('/delete-product/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect('/manage-products');
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).send("An error occurred while deleting the product.");
  }
});


// Route to handle deletion of selected products
app.post('/delete-products', async (req, res) => {
  const productIds = req.body.productIds; // Get selected product IDs from the form

  if (!productIds || productIds.length === 0) {
    console.log("No products selected for deletion.");
    return res.status(400).send("No products selected for deletion.");
  }

  try {
    // Delete all products with the selected IDs
    await Product.deleteMany({ _id: { $in: productIds } });
    console.log(`Deleted products with IDs: ${productIds}`);
    res.redirect('/manage-products'); // Redirect back to the Manage Products page
  } catch (error) {
    console.error("Error deleting products:", error);
    res.status(500).send("An error occurred while deleting products.");
  }
});

app.get('/analytics', async (req, res) => {
  const { location, category, product } = req.query;

  try {
    // Fetch all prices and populate references
    const prices = await Price.find()
      .populate('shop', 'location')
      .populate('product', 'name category');

    // Extract unique dropdown values
    const locations = [...new Set(prices.map((price) => price.shop?.location).filter(Boolean))];
    const categories = [...new Set(prices.map((price) => price.product?.category).filter(Boolean))];
    const products = [...new Set(prices.map((price) => price.product?.name).filter(Boolean))];

    // Render the analytics page
    res.render('analytics', {
      locations, // Available locations
      categories, // Available categories
      products, // Available products
      currentRoute: '/analytics', // For active navigation highlighting
      location: location || null, // Pre-select location if query exists
      category: category || null, // Pre-select category if query exists
      product: product || null, // Pre-select product if query exists
    });
  } catch (error) {
    console.error('Error fetching analytics dropdown data:', error);
    res.status(500).send('An error occurred while loading analytics.');
  }
});

app.get('/analytics-data', async (req, res) => {
  const { location, category, product } = req.query;

  try {
    // Match conditions for filtering
    const matchCondition = {};
    if (location) matchCondition['shop.location'] = location;
    if (category) matchCondition['product.category'] = category;
    if (product) matchCondition['product.name'] = product;

    // Populate references and filter
    const prices = await Price.find()
      .populate({
        path: 'shop',
        select: 'location', // Only fetch `location` from `Shop`
      })
      .populate({
        path: 'product',
        select: 'name category', // Only fetch `name` and `category` from `Product`
      })
      .lean(); // Convert Mongoose documents to plain objects for easier manipulation

    console.log('Populated Prices:', prices);

    // Filter populated data according to the matchCondition
    const filteredPrices = prices.filter((price) => {
      const shopLocationMatch = !location || price.shop?.location === location;
      const productCategoryMatch = !category || price.product?.category === category;
      const productNameMatch = !product || price.product?.name === product;

      return shopLocationMatch && productCategoryMatch && productNameMatch;
    });

    if (filteredPrices.length === 0) {
      return res.status(404).json({ message: 'No data found' });
    }

    // Extract `pricePerKg` for analytics
    const priceValues = filteredPrices.map((price) => price.pricePerKg);

    // Calculate Metrics
    const averagePrice = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
    const highestPrice = Math.max(...priceValues);
    const lowestPrice = Math.min(...priceValues);

    // Calculate Median
    priceValues.sort((a, b) => a - b);
    const median =
      priceValues.length % 2 === 0
        ? (priceValues[priceValues.length / 2 - 1] + priceValues[priceValues.length / 2]) / 2
        : priceValues[Math.floor(priceValues.length / 2)];

    // Calculate Mode
    const freq = {};
    let mode = priceValues[0];
    let maxCount = 0;
    priceValues.forEach((price) => {
      freq[price] = (freq[price] || 0) + 1;
      if (freq[price] > maxCount) {
        maxCount = freq[price];
        mode = price;
      }
    });

    // Respond with analytics data
    res.json({
      averagePrice,
      highestPrice,
      lowestPrice,
      median,
      mode,
    });
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    res.status(500).json({ message: 'An error occurred while fetching analytics data.' });
  }
});

/// Server-Side PIN
// Add this to your server.js or routes file

const correctPin = process.env.APP_PIN || '1234'; // Securely store PIN in environment variable

// Route to handle PIN validation
app.post('/validate-pin', (req, res) => {
  const { pin } = req.body; // Retrieve the PIN from the request body

  if (!pin) {
    return res.status(400).json({ message: 'PIN is required.' });
  }

  if (pin === correctPin) {
    return res.json({ success: true });
  } else {
    return res.status(401).json({ success: false, message: 'Incorrect PIN.' });
  }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
