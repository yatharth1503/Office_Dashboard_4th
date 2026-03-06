const mysql = require('mysql2');
require('dotenv').config();

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

// Get the promise-based version of the pool
const promisePool = pool.promise();

// Test the connection
promisePool.query('SELECT 1')
  .then(() => {
    console.log('✓ Database connected successfully');
  })
  .catch((err) => {
    console.error('✗ Database connection failed:', err.message);
  });

module.exports = promisePool;
