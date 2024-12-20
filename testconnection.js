const sql = require('mssql/msnodesqlv8');

const config = {
    server: 'ANSHAD',
    database: 'ecommerce',
    driver: 'msnodesqlv8',
    options: {
        trustServerCertificate: true,
        trustedConnection: true
    }
};

async function testConnection() {
    try {
        console.log('Attempting to connect to ANSHAD server...');
        
        await sql.connect(config);
        
        const result = await sql.query('SELECT SYSTEM_USER as CurrentUser');
        console.log('Connection successful!');
        console.log('Logged in as:', result.recordset[0].CurrentUser);
        
        // Test database access
        const dbTest = await sql.query('SELECT DB_NAME() as CurrentDatabase');
        console.log('Connected to database:', dbTest.recordset[0].CurrentDatabase);
        
        // Select all products
        const products = await sql.query('SELECT * FROM products');
        console.log('\nProducts in database:');
        console.table(products.recordset); // This will display the results in a nice table format
        
    } catch (error) {
        console.error('Connection error details:');
        console.error('- Message:', error.message);
        console.error('- Code:', error.code);
        if (error.originalError) {
            console.error('- Original error:', error.originalError.message);
        }
    } finally {
        await sql.close();
        console.log('Connection closed.');
    }
}

testConnection();