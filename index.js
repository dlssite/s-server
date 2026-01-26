const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const profileRoutes = require('./routes/profiles');

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

const app = express();
const PORT = process.env.PORT || 3001;

const { createProxyMiddleware } = require('http-proxy-middleware');

// Parse ALLOWED_ORIGINS into array
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:5173'];

// Global Middleware
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Cookie parser must be global for refresh token to work
app.use(cookieParser());

// Specific Auth Overrides (Handles its own body parsing for register)
app.use('/api/auth', authRoutes);

// Proxy Auth Requests (Processes raw stream) - Must come AFTER custom routes
app.use('/api/auth', createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL || 'http://localhost:4000',
    changeOrigin: true,
    logLevel: 'debug',
    pathRewrite: {
        '^/': '/api/v1/auth/' // Prepend /api/v1/auth/ to the relative path
    },
    onProxyReq: (proxyReq, req, res) => {
        // Forward cookies to auth service
        if (req.headers.cookie) {
            proxyReq.setHeader('cookie', req.headers.cookie);
        }
    },
    onProxyRes: (proxyRes, req, res) => {
        // Forward set-cookie headers from auth service
        const setCookie = proxyRes.headers['set-cookie'];
        if (setCookie) {
            res.setHeader('set-cookie', setCookie);
        }
    }
}));

// Routes
app.use('/api', express.json(), dashboardRoutes);
app.use('/api/profiles', express.json(), profileRoutes);

// Test Route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Sanctyr Core App Server Running' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
