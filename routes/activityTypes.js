const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/activity-types - Get all activity types (Protected)
router.get('/', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, created_at FROM activity_types ORDER BY name ASC'
    );

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Activity types fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch activity types' 
    });
  }
});

module.exports = router;
