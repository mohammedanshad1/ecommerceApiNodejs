const express = require('express');
const sql = require('mssql');
const multer = require('multer');
const upload = multer();
const app = express();

const config = {
    server: 'localhost', // Use 'localhost' since you connected to the database locally
    database: 'ecommerce',
    options: {
        trustedConnection: true, // Ensure Windows Authentication
        encrypt: false, // Adjust based on your SQL Server setup
        trustServerCertificate: true, // Adjust based on your SQL Server certificate configuration
        enableArithAbort: true,
    },
    authentication: {
        type: 'default',
    },
};


// Middleware
app.use(express.json());

// Connect to database
async function connectDB() {
    try {
        await sql.connect(config);
        console.log('Connected to SQL Server');
    } catch (err) {
        console.error('Database connection failed:', err);
    }
}
connectDB();

// GET all products
app.get('/api/products', async (req, res) => {
    try {
        const result = await sql.query`
            SELECT id, name, description, price, 
                   CAST(image AS VARCHAR(MAX)) AS image 
            FROM products
        `;
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// GET product by ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const result = await sql.query`
            SELECT id, name, description, price, 
                   CAST(image AS VARCHAR(MAX)) AS image 
            FROM products 
            WHERE id = ${req.params.id}
        `;
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json(result.recordset[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// POST new product
app.post('/api/products', upload.single('image'), async (req, res) => {
    try {
        const { name, description, price } = req.body;
        const image = req.file ? req.file.buffer : null;

        // Input validation
        if (!name || !price) {
            return res.status(400).json({ error: 'Name and price are required' });
        }

        const result = await sql.query`
            INSERT INTO products (name, description, price, image)
            OUTPUT INSERTED.id, INSERTED.name, INSERTED.description, INSERTED.price
            VALUES (${name}, ${description}, ${price}, ${image})
        `;

        res.status(201).json(result.recordset[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});