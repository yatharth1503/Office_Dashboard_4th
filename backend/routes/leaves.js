const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Validation middleware for leave application
const leaveValidation = [
  body('from_date').isDate().withMessage('Valid from_date is required (YYYY-MM-DD)'),
  body('to_date').isDate().withMessage('Valid to_date is required (YYYY-MM-DD)'),
  body('to_date').custom((to_date, { req }) => {
    if (new Date(req.body.from_date) > new Date(to_date)) {
      throw new Error('from_date cannot be after to_date');
    }
    return true;
  })
];

// POST /api/leaves - Apply for leave (Protected)
router.post('/', verifyToken, leaveValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array()
      });
    }

    const { from_date, to_date, reason } = req.body;
    const user_id = req.user.id;

    // Build list of individual leave days (to_date is the return day, so excluded)
    const start = new Date(from_date);
    const end   = new Date(to_date);
    const days  = [];
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().split('T')[0]);
    }

    if (days.length === 0) {
      return res.status(400).json({
        success: false,
        errors: [{ msg: 'from_date must be before to_date' }]
      });
    }

    // Insert one row per day; IGNORE silently skips already-existing dates
    let inserted = 0;
    for (const date of days) {
      const [result] = await db.query(
        'INSERT IGNORE INTO leaves (user_id, leave_date, reason, status) VALUES (?, ?, ?, ?)',
        [user_id, date, reason || null, 'pending']
      );
      inserted += result.affectedRows;
    }

    res.status(201).json({
      success: true,
      message: `Leave submitted for ${inserted} day(s). ${days.length - inserted} day(s) already existed and were skipped.`,
      data: {
        user_id,
        from_date,
        to_date,
        days_requested: days,
        days_inserted: inserted
      }
    });

  } catch (error) {
    console.error('Leave application error:', error);
    res.status(500).json({ 
      success: false,
      errors: [{ msg: 'Failed to submit leave application' }]
    });
  }
});

// GET /api/leaves - Get leave history for logged-in user (Protected)
router.get('/', verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { status } = req.query;

    let query = `
      SELECT 
        l.id,
        l.leave_date,
        l.reason,
        l.status,
        l.created_at,
        u.name as user_name,
        u.email as user_email
      FROM leaves l
      JOIN users u ON l.user_id = u.id
      WHERE l.user_id = ?
    `;
    
    const params = [user_id];

    if (status) {
      query += ' AND l.status = ?';
      params.push(status);
    }

    query += ' ORDER BY l.leave_date DESC';

    const [rows] = await db.query(query, params);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Leaves fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch leave history' 
    });
  }
});

// GET /api/leaves/employees - Get all employees list (Admin only)
router.get('/employees', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const [rows] = await db.query(
      "SELECT id, name, email FROM users WHERE role = 'employee' ORDER BY name ASC"
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Employees fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// GET /api/leaves/all - Get all leaves (Admin only)
router.get('/all', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied. Admin only.' 
      });
    }

    const { status, user_id } = req.query;

    let query = `
      SELECT 
        l.id,
        l.user_id,
        l.leave_date,
        l.reason,
        l.status,
        l.created_at,
        u.name as user_name,
        u.email as user_email
      FROM leaves l
      JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];

    if (status) {
      query += ' AND l.status = ?';
      params.push(status);
    }

    if (user_id) {
      query += ' AND l.user_id = ?';
      params.push(user_id);
    }

    query += ' ORDER BY l.leave_date DESC';

    // When fetching all employees without a specific user filter, limit to latest 50 days
    if (!user_id) {
      query += ' LIMIT 50';
    }

    const [rows] = await db.query(query, params);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('All leaves fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch all leaves' 
    });
  }
});

// PATCH /api/leaves/:id/status - Update leave status (Admin only)
router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied. Admin only.' 
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status. Must be: approved, rejected, or pending' 
      });
    }

    // Update leave status
    const [result] = await db.query(
      'UPDATE leaves SET status = ? WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Leave application not found' 
      });
    }

    res.json({
      success: true,
      message: `Leave ${status} successfully`
    });

  } catch (error) {
    console.error('Leave status update error:', error);
    res.status(500).json({ 
      error: 'Failed to update leave status' 
    });
  }
});

module.exports = router;
