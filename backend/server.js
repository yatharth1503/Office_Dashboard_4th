const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const activityTypesRoutes = require('./routes/activityTypes');
const darRoutes = require('./routes/dar');
const leavesRoutes = require('./routes/leaves');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/activity-types', activityTypesRoutes);
app.use('/api/dar', darRoutes);
app.use('/api/leaves', leavesRoutes);

// New API endpoint to list available routes
app.get('/', (req, res) => {
  res.json({
    message: 'API is running successfully 🚀',
    availableRoutes: {
      auth: '/api/auth',
      activityTypes: '/api/activity-types',
      dar: '/api/dar',
      leaves: '/api/leaves',
      health: '/health'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});
