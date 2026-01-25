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

// Global Middleware (Stream Safe)
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS || 'http://localhost:5173',
    credentials: true
}));

// Specific Auth Overrides (Handles its own body parsing)
app.use('/api/auth', authRoutes);

// Proxy Auth Requests (Processes raw stream)
app.use('/api/auth', createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL || 'http://localhost:4000',
    changeOrigin: true,
    logLevel: 'debug',
    pathRewrite: {
        '^/api/auth/': '/api/v1/auth/'
    }
}));

// Routes
app.use('/api', express.json(), cookieParser(), dashboardRoutes);
app.use('/api/profiles', express.json(), profileRoutes);

// Test Route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Sanctyr Core App Server Running' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
