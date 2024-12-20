// Import necessary modules
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const sql = require('mssql/msnodesqlv8');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Middleware to parse JSON
app.use(bodyParser.json({ limit: '50mb' }));

// SQL Server configuration
const config = {
    server: 'ANSHAD',
    database: 'ecommerce',
    driver: 'msnodesqlv8',
    options: {
        trustServerCertificate: true,
        trustedConnection: true,
    },
};

// Directory to store images
const imageDirectory = path.join(__dirname, 'uploads');

// Ensure the image directory exists
if (!fs.existsSync(imageDirectory)) {
    fs.mkdirSync(imageDirectory);
    console.log('Created uploads directory at:', imageDirectory);
}

// Configure static file serving with explicit paths
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, imageDirectory);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
        console.log('Generated filename:', filename);
        cb(null, filename);
    },
});

// Enhanced upload middleware with logging
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        console.log('Processing upload:', file);
        // Add file type validation if needed
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
            cb(new Error('Invalid file type'), false);
            return;
        }
        cb(null, true);
    }
});

// Connect to the database
async function connectToDatabase() {
    try {
        await sql.connect(config);
        console.log('Connected to the database successfully');
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1); // Exit if database connection fails
    }
}

// Debug route to check if image exists
app.get('/check-image/:filename', (req, res) => {
    const imagePath = path.join(imageDirectory, req.params.filename);
    if (fs.existsSync(imagePath)) {
        res.json({ 
            exists: true, 
            path: imagePath,
            stats: fs.statSync(imagePath)
        });
    } else {
        res.json({ 
            exists: false, 
            path: imagePath,
            uploadsDirContent: fs.readdirSync(imageDirectory)
        });
    }
});

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// GET all products with image paths
app.get('/products', async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT id, name, description, price, image 
            FROM products
        `);

        const products = result.recordset.map(product => {
            if (product.image) {
                const imagePath = path.join(imageDirectory, product.image);
                const imageExists = fs.existsSync(imagePath);
                product.image = `/uploads/${product.image}`;
                product.imageExists = imageExists;
                console.log('Product image path:', {
                    url: product.image,
                    physicalPath: imagePath,
                    exists: imageExists
                });
            }
            return product;
        });

        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST a new product with form data
app.post('/products', upload.single('image'), async (req, res) => {
    const { name, price, description } = req.body;
    const image = req.file;

    console.log('Upload request received:', {
        body: req.body,
        file: image
    });

    if (!name || !price || !description) {
        return res.status(400).json({ error: 'Missing required fields: name, price, or description' });
    }

    try {
        const request = new sql.Request();
        request.input('name', sql.NVarChar, name);
        request.input('price', sql.Decimal, parseFloat(price));
        request.input('description', sql.NVarChar, description);
        request.input('image', sql.VarChar, image ? image.filename : null);

        await request.query(`
            INSERT INTO products (name, price, description, image) 
            VALUES (@name, @price, @description, @image)
        `);

        if (image) {
            console.log('File saved successfully:', {
                filename: image.filename,
                path: image.path,
                size: image.size
            });
        }

        res.status(201).json({ 
            message: 'Product added successfully',
            imagePath: image ? `/uploads/${image.filename}` : null
        });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Server error', 
        message: err.message 
    });
});

// Start the server
app.listen(port, async () => {
    await connectToDatabase();
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Image directory: ${imageDirectory}`);
});