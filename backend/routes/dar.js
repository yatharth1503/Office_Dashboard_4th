const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────
const toDateString = (d) => d.toISOString().split('T')[0];

const isDateAllowed = (dateStr) => {
  const today = toDateString(new Date());
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = toDateString(d);
  return dateStr === today || dateStr === yesterday;
};

/** Recalculate & persist total_minutes for a DAR header */
const refreshTotalMinutes = async (connection, darId) => {
  const [rows] = await connection.query(
    'SELECT COALESCE(SUM(minutes), 0) AS total FROM dar_activities WHERE dar_id = ?',
    [darId]
  );
  const total = rows[0].total;
  await connection.query('UPDATE dar_headers SET total_minutes = ? WHERE id = ?', [total, darId]);
  return total;
};

// ── Validation ───────────────────────────────────────────────────────────
const darValidation = [
  body('date').isDate().withMessage('Valid date is required (YYYY-MM-DD)'),
  body('activities').isArray({ min: 1 }).withMessage('Activities must be a non-empty array'),
  body('activities.*.activity_type_id').isInt({ min: 1 }).withMessage('Valid activity_type_id is required'),
  body('activities.*.minutes').isInt({ min: 1 }).withMessage('Minutes must be a positive integer'),
];

// ═════════════════════════════════════════════════════════════════════════
// POST /api/dar — Create/Append DAR activities (Employee, today/yesterday)
// ═════════════════════════════════════════════════════════════════════════
router.post('/', verifyToken, darValidation, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { date, activities } = req.body;
    const user_id = req.user.id;

    if (!isDateAllowed(date)) {
      return res.status(400).json({
        success: false,
        errors: [{ msg: 'You can only submit DAR for today or yesterday' }],
      });
    }

    await connection.beginTransaction();

    // Upsert header (keeps existing rows intact)
    const [headerResult] = await connection.query(
      `INSERT INTO dar_headers (user_id, date, total_minutes)
       VALUES (?, ?, 0)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [user_id, date]
    );
    const dar_id = headerResult.insertId;

    // Append new activities (existing ones are untouched)
    for (const activity of activities) {
      await connection.query(
        'INSERT INTO dar_activities (dar_id, activity_type_id, message, minutes, remarks) VALUES (?, ?, ?, ?, ?)',
        [dar_id, activity.activity_type_id, activity.message || null, activity.minutes, activity.remarks || null]
      );
    }

    // Recalculate total
    const total_minutes = await refreshTotalMinutes(connection, dar_id);

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'DAR activities added successfully',
      data: { dar_id, user_id, date, total_minutes, activities_count: activities.length },
    });
  } catch (error) {
    await connection.rollback();
    console.error('DAR creation error:', error);

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, errors: [{ msg: 'Invalid activity type ID' }] });
    }

    res.status(500).json({ success: false, errors: [{ msg: 'Failed to create DAR' }] });
  } finally {
    connection.release();
  }
});

// ═════════════════════════════════════════════════════════════════════════
// PUT /api/dar/activities/:activityId — Edit a single activity
// ═════════════════════════════════════════════════════════════════════════
router.put('/activities/:activityId', verifyToken, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { activityId } = req.params;
    const { activity_type_id, minutes, message, remarks } = req.body;
    const user_id = req.user.id;

    // Verify the activity belongs to the user and is today/yesterday
    const [rows] = await connection.query(
      `SELECT da.id, dh.id AS dar_id, dh.date, dh.user_id
       FROM dar_activities da
       JOIN dar_headers dh ON da.dar_id = dh.id
       WHERE da.id = ?`,
      [activityId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Activity not found' });
    }

    const row = rows[0];
    if (row.user_id !== user_id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const dateStr = toDateString(new Date(row.date));
    if (!isDateAllowed(dateStr)) {
      return res.status(400).json({
        success: false,
        error: 'You can only edit activities for today or yesterday',
      });
    }

    await connection.beginTransaction();

    await connection.query(
      `UPDATE dar_activities
       SET activity_type_id = ?,
           minutes          = ?,
           message          = ?,
           remarks          = ?
       WHERE id = ?`,
      [activity_type_id, minutes, message || null, remarks || null, activityId]
    );

    const total_minutes = await refreshTotalMinutes(connection, row.dar_id);

    await connection.commit();

    res.json({ success: true, message: 'Activity updated', data: { total_minutes } });
  } catch (error) {
    await connection.rollback();
    console.error('Activity update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update activity' });
  } finally {
    connection.release();
  }
});

// ═════════════════════════════════════════════════════════════════════════
// DELETE /api/dar/activities/:activityId — Delete a single activity
// ═════════════════════════════════════════════════════════════════════════
router.delete('/activities/:activityId', verifyToken, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { activityId } = req.params;
    const user_id = req.user.id;

    const [rows] = await connection.query(
      `SELECT da.id, dh.id AS dar_id, dh.date, dh.user_id
       FROM dar_activities da
       JOIN dar_headers dh ON da.dar_id = dh.id
       WHERE da.id = ?`,
      [activityId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Activity not found' });
    }

    const row = rows[0];
    if (row.user_id !== user_id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const dateStr = toDateString(new Date(row.date));
    if (!isDateAllowed(dateStr)) {
      return res.status(400).json({
        success: false,
        error: 'You can only delete activities for today or yesterday',
      });
    }

    await connection.beginTransaction();

    await connection.query('DELETE FROM dar_activities WHERE id = ?', [activityId]);
    const total_minutes = await refreshTotalMinutes(connection, row.dar_id);

    await connection.commit();

    res.json({ success: true, message: 'Activity deleted', data: { total_minutes } });
  } catch (error) {
    await connection.rollback();
    console.error('Activity delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete activity' });
  } finally {
    connection.release();
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/dar — My DARs (Employee)
// ═════════════════════════════════════════════════════════════════════════
router.get('/', verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { date, from_date, to_date } = req.query;

    let query = `
      SELECT dh.id, dh.date, dh.total_minutes, dh.created_at,
             u.name AS user_name, u.email AS user_email
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

    for (const header of headers) {
      const [activities] = await db.query(
        `SELECT da.id, da.activity_type_id, at.name AS activity_type_name,
                da.message, da.minutes, da.remarks
         FROM dar_activities da
         JOIN activity_types at ON da.activity_type_id = at.id
         WHERE da.dar_id = ?`,
        [header.id]
      );
      header.activities = activities;
    }

    res.json({ success: true, data: headers });
  } catch (error) {
    console.error('DAR fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch DAR entries' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/dar/employees — Employee list for admin dropdown
// ═════════════════════════════════════════════════════════════════════════
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

// ═════════════════════════════════════════════════════════════════════════
// GET /api/dar/all — All employees' DARs (Admin only)
// ═════════════════════════════════════════════════════════════════════════
router.get('/all', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { user_id } = req.query;

    let query = `
      SELECT dh.id, dh.date, dh.total_minutes, dh.created_at,
             dh.user_id, u.name AS user_name, u.email AS user_email
      FROM dar_headers dh
      JOIN users u ON dh.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      query += ' AND dh.user_id = ?';
      params.push(user_id);
    }

    query += ' ORDER BY dh.date DESC';

    if (!user_id) {
      query += ' LIMIT 20';
    }

    const [headers] = await db.query(query, params);

    for (const header of headers) {
      const [activities] = await db.query(
        `SELECT da.id, da.activity_type_id, at.name AS activity_type_name,
                da.message, da.minutes, da.remarks
         FROM dar_activities da
         JOIN activity_types at ON da.activity_type_id = at.id
         WHERE da.dar_id = ?`,
        [header.id]
      );
      header.activities = activities;
    }

    res.json({ success: true, data: headers });
  } catch (error) {
    console.error('All DARs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch DAR entries' });
  }
});

module.exports = router;
