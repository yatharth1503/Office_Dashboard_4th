const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Validation middleware for register
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'employee']).withMessage('Role must be either admin or employee')
];

// Validation middleware for login
const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// POST /register - User registration
router.post('/register', registerValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array()
      });
    }

    const { name, email, password, role } = req.body;

    // Check if user already exists
    const [existingUsers] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ 
        success: false,
        errors: [{ msg: 'Email already registered' }]
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: result.insertId,
        name,
        email,
        role
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      errors: [{ msg: 'An error occurred during registration' }]
    });
  }
});

// POST /login - User authentication
router.post('/login', loginValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Query user from database
    const [rows] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    // Check if user exists
    if (rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        errors: [{ msg: 'Invalid email or password' }]
      });
    }

    const user = rows[0];

    // Compare password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        errors: [{ msg: 'Invalid email or password' }]
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
        name: user.name,
        email: user.email,
        role: user.role,
        profile_photo: user.profile_photo || null,
        dob: user.dob || null,
        address: user.address || null,
        mobile: user.mobile || null,
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      errors: [{ msg: 'An error occurred during login' }]
    });
  }
});

// GET /me — fetch the current user's full profile
router.get('/me', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, profile_photo, dob, address, mobile, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

// PUT /profile — update current user's editable fields
const profileValidation = [
  body('mobile')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^[0-9+\-\s()]{7,15}$/)
    .withMessage('Invalid mobile number'),
  body('dob')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Date of birth must be a valid date (YYYY-MM-DD)'),
];

router.put('/profile', verifyToken, profileValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { profile_photo, dob, address, mobile } = req.body;

    await db.query(
      'UPDATE users SET profile_photo = ?, dob = ?, address = ?, mobile = ? WHERE id = ?',
      [
        profile_photo || null,
        dob || null,
        address || null,
        mobile || null,
        req.user.id,
      ]
    );

    const [rows] = await db.query(
      'SELECT id, name, email, role, profile_photo, dob, address, mobile FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ success: true, message: 'Profile updated successfully', data: rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

module.exports = router;

