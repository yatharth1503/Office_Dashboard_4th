const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// POST /login - User authentication
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Query user from database
    const [rows] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    // Check if user exists
    if (rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    const user = rows[0];

    // Check password (assuming plain text comparison for now)
    // In production, use bcrypt.compare for hashed passwords
    if (user.password !== password) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Return success response
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'An error occurred during login' 
    });
  }
});

module.exports = router;
