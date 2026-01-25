const express = require('express');
const axios = require('axios');
const router = express.Router();
const Profile = require('../models/Profile');

const AUTH_SERVICE_URL = 'http://127.0.0.1:4000/api/v1/auth';

// POST /api/auth/register - Create account in Auth Service AND Profile in Sanctyr
router.post('/register', express.json(), async (req, res) => {
    const { username, email, password } = req.body;

    try {
        console.log('[Auth] Intercepting registration for:', email);

        // 1. Forward to Auth Service
        const authResponse = await axios.post(`${AUTH_SERVICE_URL}/register`, { email, password });
        const { userId } = authResponse.data;

        // 2. Create Profile in local Sanctyr DB
        const profile = await Profile.create({
            user_id: userId,
            username: username || 'Flameborn User',
            avatar: 'https://via.placeholder.com/80',
            nation: 'Unaligned',
            rank: 'Initiate (Lvl 1)',
            title: 'Awakened Sovereign',
            xp: { current: 0, max: 1000 },
            wallet: { embers: 0, obols: 0 },
            activity: [
                { time: 'Just now', text: 'Identity forged in the Void' }
            ],
            connected_apps: [],
            nation_standing: {
                name: 'DIGNIS',
                title: 'The Realm of Ash',
                reputation: 'Neutral',
                role: 'Visitor'
            }
        });

        console.log('[Auth] Profile created for:', userId);

        res.status(201).json({
            message: 'Initiation successful',
            userId,
            profile: { username: profile.username }
        });
    } catch (error) {
        console.error('[Auth] Registration error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { message: 'Internal server error' });
    }
});

// The rest of the routes will still be handled by the proxy in index.js
// so we don't need to duplicate login/logout logic here if index.js mounts the proxy AFTER this router.

module.exports = router;
