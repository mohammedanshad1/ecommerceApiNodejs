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

// Serve static files for images and other assets
app.use(express.static('uploads'));
app.use(express.static('public'));

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
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, imageDirectory);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({ storage: storage });

// Connect to the database
async function connectToDatabase() {
    try {
        await sql.connect(config);
        console.log('Connected to the database');
    } catch (error) {
        console.error('Database connection error:', error);
    }
}

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// GET all products with image paths
app.get('/products', async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT 
                id, 
                name, 
                description, 
                price, 
                image 
            FROM products
        `);

        // Map image paths to URLs
        result.recordset.forEach((product) => {
            if (product.image) {
                product.image = `http://localhost:${port}/uploads/${product.image}`;
            }
        });

        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST a new product with form data
app.post('/products', upload.single('image'), async (req, res) => {
    const { name, price, description } = req.body;
    const image = req.file;

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

        res.status(201).json({ message: 'Product added successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(port, async () => {
    await connectToDatabase();
    console.log(`Server is running at http://localhost:${port}`);
});
