import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pool from './db.js';

// Route imports
import authRouter from './routes/auth.js';
import productsRouter from './routes/products.js';
import locationsRouter from './routes/locations.js';
import suppliersRouter from './routes/suppliers.js';
import ordersRouter from './routes/orders.js';
import auditRouter from './routes/audit.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 1. HTTP Security Headers via Helmet
app.use(helmet());

// 2. Cookie Parser middleware for reading secure refresh cookies
app.use(cookieParser());

// 3. CORS Whitelisting with credentials support
const allowedOrigins = [process.env.CORS_ORIGIN || 'http://localhost:5173'];
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true
}));

// 4. Input payload size limit (prevent Deny-of-Service via massive payloads)
app.use(express.json({ limit: '10kb' }));

// 5. Global API Rate Limiter (Max 100 requests per 15 minutes per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'TooManyRequests', message: 'Too many requests from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', globalLimiter);

// Database connection health check
app.get('/api/health', async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT NOW()');
    res.json({ status: 'OK', database: 'Connected', timestamp: dbCheck.rows[0].now });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', database: 'Disconnected', error: error.message });
  }
});

// Configure API Routes
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/audit-logs', auditRouter);

// Centralized error handler
app.use((err, req, res, _next) => {
  console.error("Unhandled Error:", err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`CISMS Backend Server running on port ${PORT}`);
});
