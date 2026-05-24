const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const _allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  process.env.DRAWIO_URL || 'http://localhost:8181',
];
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || _allowedOrigins.includes(origin)),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { message: 'יותר מדי בקשות, נסה שוב מאוחר יותר' },
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'ניסיונות התחברות רבים מדי' },
});

app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/systems', require('./routes/systems'));
app.use('/api/diagrams', require('./routes/diagrams'));
app.use('/api/nav', require('./routes/nav'));
app.use('/api/ai', require('./routes/ai'));

// Serve draw.io custom shape libraries — accessible by the draw.io iframe (CORS allowed above)
app.get('/api/libraries/postal.xml', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/public/postal-lib.xml'));
});

// 404 for unmatched API routes — logs the exact path so debugging is easy
app.use('/api', (req, res) => {
  console.warn(`[404] ${req.method} ${req.path}`);
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'שגיאת שרת פנימית' });
});

module.exports = app;
