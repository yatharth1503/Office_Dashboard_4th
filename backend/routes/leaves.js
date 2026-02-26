const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/leaves - Apply for leave (Protected)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { from_date, to_date, reason } = req.body;
    const user_id = req.user.id; // Get from JWT token

    // Validate input
    if (!from_date || !to_date) {
      return res.status(400).json({ 
        error: 'from_date and to_date are required' 
      });
    }

    // Validate dates
    if (new Date(from_date) > new Date(to_date)) {
      return res.status(400).json({ 
        error: 'from_date cannot be after to_date' 
      });
    }

    // Insert leave application
    const [result] = await db.query(
      'INSERT INTO leaves (user_id, from_date, to_date, reason, status) VALUES (?, ?, ?, ?, ?)',
      [user_id, from_date, to_date, reason || null, 'pending']
    );

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully',
      data: {
        id: result.insertId,
        user_id,
        from_date,
        to_date,
        reason,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Leave application error:', error);
    res.status(500).json({ 
      error: 'Failed to submit leave application' 
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
        l.from_date,
        l.to_date,
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

    query += ' ORDER BY l.created_at DESC';

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
        l.from_date,
        l.to_date,
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

    query += ' ORDER BY l.created_at DESC';

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
