require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./utils/dbUtils');
const { mongoose } = require('./config/database');
const logger = require('./utils/logger');

// Create Express app
const app = express();


// ...existing code...
app.use('/outputs', express.static('outputs'));
// ...existing code...

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
  
}));
app.use(express.json());


app.use(express.urlencoded({ extended: false }));


// Import routes
const reconstructionRoutes = require('./routes/reconstruction');

// Health check endpoint
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({ 
    status: 'ok', 
    db: dbStatus,
    timestamp: new Date().toISOString() 
  });
});

// API Routes
app.use('/api/reconstruction', reconstructionRoutes);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve static files from the 'outputs' directory (for 3D models)
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

// Root route (for testing API)
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Ruins to Reality API!' });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  logger.error(err.stack); // Log the error stack
  res.status(err.statusCode || 500).json({
    message: err.message || 'An unexpected error occurred',
    // Only send stack trace in development
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Initialize database and start server
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  try {
    await initDatabase();
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      console.log(`Server running on port ${PORT}`);
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }
      switch (error.code) {
        case 'EACCES':
          logger.error(`Port ${PORT} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`Port ${PORT} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});
