const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/dar - Create DAR header with activities (Protected)
router.post('/', verifyToken, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { date, activities } = req.body;
    const user_id = req.user.id; // Get from JWT token

    // Validate input
    if (!date || !activities || !Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({ 
        error: 'Date and activities array are required' 
      });
    }

    // Calculate total minutes
    const total_minutes = activities.reduce((sum, activity) => {
      return sum + (parseInt(activity.minutes) || 0);
    }, 0);

    // Start transaction
    await connection.beginTransaction();

    // Insert DAR header
    const [headerResult] = await connection.query(
      'INSERT INTO dar_headers (user_id, date, total_minutes) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE total_minutes = VALUES(total_minutes), id = LAST_INSERT_ID(id)',
      [user_id, date, total_minutes]
    );

    const dar_id = headerResult.insertId;

    // Delete existing activities for this DAR (if updating)
    await connection.query(
      'DELETE FROM dar_activities WHERE dar_id = ?',
      [dar_id]
    );

    // Insert activities
    for (const activity of activities) {
      if (!activity.activity_type_id || !activity.minutes) {
        await connection.rollback();
        return res.status(400).json({ 
          error: 'Each activity must have activity_type_id and minutes' 
        });
      }

      await connection.query(
        'INSERT INTO dar_activities (dar_id, activity_type_id, message, minutes, remarks) VALUES (?, ?, ?, ?, ?)',
        [
          dar_id,
          activity.activity_type_id,
          activity.message || null,
          activity.minutes,
          activity.remarks || null
        ]
      );
    }

    // Commit transaction
    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'DAR created successfully',
      data: {
        dar_id,
        user_id,
        date,
        total_minutes,
        activities_count: activities.length
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('DAR creation error:', error);
    
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ 
        error: 'Invalid activity type ID' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create DAR' 
    });
  } finally {
    connection.release();
  }
});

// GET /api/dar - Get DAR entries for logged-in user (Protected)
router.get('/', verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { date, from_date, to_date } = req.query;

    let query = `
      SELECT 
        dh.id,
        dh.date,
        dh.total_minutes,
        dh.created_at,
        u.name as user_name,
        u.email as user_email
      FROM dar_headers dh
      JOIN users u ON dh.user_id = u.id
      WHERE dh.user_id = ?
    `;
    
    const params = [user_id];

    if (date) {
      query += ' AND dh.date = ?';
      params.push(date);
    } else if (from_date && to_date) {
      query += ' AND dh.date BETWEEN ? AND ?';
      params.push(from_date, to_date);
    }

    query += ' ORDER BY dh.date DESC';

    const [headers] = await db.query(query, params);

    // Get activities for each header
    for (let header of headers) {
      const [activities] = await db.query(`
        SELECT 
          da.id,
          da.activity_type_id,
          at.name as activity_type_name,
          da.message,
          da.minutes,
          da.remarks
        FROM dar_activities da
        JOIN activity_types at ON da.activity_type_id = at.id
        WHERE da.dar_id = ?
      `, [header.id]);
      
      header.activities = activities;
    }

    res.json({
      success: true,
      data: headers
    });

  } catch (error) {
    console.error('DAR fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch DAR entries' 
    });
  }
});

module.exports = router;
