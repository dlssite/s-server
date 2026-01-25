const express = require('express');
const axios = require('axios');
const router = express.Router();
const Profile = require('../models/Profile');
const { verifyToken } = require('../middleware/auth');
const emberService = require('../services/emberService');

// GET /api/me - Fetch or create user profile
router.get('/me', verifyToken, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.userId || req.user.sanctyr_user_id;

        if (!userId) {
            return res.status(400).json({ message: 'User ID not found in token' });
        }

        let profile = await Profile.findOne({ user_id: userId });
        let isDiscordLinked = false;
        let serverStats = null;

        // 1. Check Discord Link Status & Fetch Real-time Stats
        try {
            const authHeader = req.headers.authorization;
            const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:4000';

            const linkedResponse = await axios.get(`${authServiceUrl}/api/v1/auth/linked-accounts`, {
                headers: { Authorization: authHeader }
            });

            const discordAccount = linkedResponse.data.find(a => a.provider === 'discord');
            isDiscordLinked = !!discordAccount;

            if (discordAccount) {
                const discordId = discordAccount.provider_user_id;

                // Sync discord_user_id to Profile if missing
                if (profile && profile.discord_user_id !== discordId) {
                    await Profile.updateOne({ user_id: userId }, { $set: { discord_user_id: discordId } });
                }

                // REAL-TIME FETCH: Get live data from Ember Bot
                console.log('[Dashboard] Fetching live Ember stats for Discord ID:', discordId);
                serverStats = await emberService.getRealtimeServerStats(discordId);
            }
        } catch (authError) {
            console.warn('[Dashboard] Social/Ember fetch failed:', authError.message);
        }

        // 2. If no profile, create default
        if (!profile) {
            profile = await Profile.create({
                user_id: userId,
                username: 'Flameborn User',
                avatar: 'https://via.placeholder.com/80',
                rank: 'Initiate (Lvl 1)',
                title: 'Awakened Sovereign',
                xp: { current: 0, max: 1000 },
                wallet: { embers: 0, obols: 0 },
                activity: [{ time: 'Just now', text: 'Identity forged in the Void' }],
                connected_apps: []
            });
        }

        // 3. Sync Discord assets & structured roles
        if (serverStats) {
            const updateFields = {
                'discord_server_data.nation': serverStats.nation,
                'discord_server_data.roles': serverStats.roles,
                'discord_server_data.level': serverStats.leveling?.level || 1,
                'discord_server_data.banner': serverStats.discordBanner,
                'discord_server_data.avatar': serverStats.discordAvatar,
                'discord_server_data.avatar_decoration': serverStats.discordDecoration,
                'discord_server_data.serverName': serverStats.serverName,
                'discord_server_data.nationRoles': serverStats.nationRoles || [],
                'discord_server_data.eliteRoles': serverStats.eliteRoles || [],
                'discord_server_data.specialRoles': serverStats.specialRoles || [],
                'discord_server_data.status': serverStats.status,
                'discord_server_data.rankRole': serverStats.rankRole,
                'discord_server_data.last_synced': new Date()
            };

            // AUTO-SYNC IDENTITY: adopt Discord identity if current values are defaults
            const isDefaultAvatar = profile.avatar.includes('via.placeholder.com');
            if (profile.username === 'Flameborn User' || !profile.display_name || isDefaultAvatar) {
                if (serverStats.serverName) {
                    if (profile.username === 'Flameborn User') {
                        updateFields.username = serverStats.serverName.toLowerCase().replace(/\s+/g, '_');
                    }
                    if (!profile.display_name) {
                        updateFields.display_name = serverStats.serverName;
                    }
                }
                if (serverStats.discordAvatar && isDefaultAvatar) {
                    updateFields.avatar = serverStats.discordAvatar;
                }
                if (serverStats.discordDecoration && !profile.avatar_frame) {
                    updateFields.avatar_frame = serverStats.discordDecoration;
                }
            }

            await Profile.updateOne({ user_id: userId }, { $set: updateFields });
        }

        // Always refresh profile object for accurate response delivery
        profile = await Profile.findOne({ user_id: userId });

        // 4. Format response
        const availableElite = serverStats?.eliteRoles || profile.discord_server_data?.eliteRoles || [];
        const availableSpecial = serverStats?.specialRoles || profile.discord_server_data?.specialRoles || [];

        // Determine which elite role to display
        let displayElite = serverStats?.status || profile.title;
        if (profile.selected_elite_role && availableElite.includes(profile.selected_elite_role)) {
            displayElite = profile.selected_elite_role;
        }

        // Determine which special role to display (if any)
        let displaySpecial = null;
        if (profile.selected_special_role && availableSpecial.includes(profile.selected_special_role)) {
            displaySpecial = profile.selected_special_role;
        } else if (availableSpecial.length > 0) {
            displaySpecial = availableSpecial[0];
        }

        const response = {
            identity: {
                name: profile.username,
                username: profile.username,
                display_name: profile.display_name || serverStats?.serverName || profile.username,
                title: displayElite,
                special_role: displaySpecial,
                avatar: profile.avatar,
                avatar_frame: profile.avatar_frame,
                banner: profile.banner || serverStats?.discordBanner || '',
                nation: serverStats?.nation || profile.discord_server_data?.nation || 'Unaligned',
                rank: serverStats?.leveling ? `Initiate (Lvl ${serverStats.leveling.level})` : profile.rank,
                xp: serverStats?.leveling ? { current: serverStats.leveling.xp, max: serverStats.leveling.level * 1000 } : profile.xp,
                bio: profile.bio,
                date_of_birth: profile.date_of_birth,
                socials: profile.socials || [],
                // Customization Data
                available_elite_roles: availableElite,
                available_special_roles: availableSpecial,
                selected_elite_role: profile.selected_elite_role,
                selected_special_role: profile.selected_special_role,
                selected_theme: profile.selected_theme
            },
            wallet: {
                embers: serverStats?.economy?.wallet || profile.wallet.embers,
                obols: profile.wallet.obols,
                bank: serverStats?.economy?.bank || 0
            },
            activity: profile.activity,
            apps: profile.connected_apps,
            nation: {
                name: serverStats?.nation || profile.discord_server_data?.nation || 'Unaligned',
                roles: serverStats?.roles || [],
                level: serverStats?.leveling?.level || 1,
                streak: serverStats?.economy?.streak || 0,
                messages: serverStats?.leveling?.messages || 0,
                voiceMinutes: serverStats?.leveling?.voiceMinutes || 0,
                attachmentCount: serverStats?.leveling?.attachmentCount || 0,
                emojiCount: serverStats?.leveling?.emojiCount || 0
            },
            analytics: serverStats?.analytics || {
                topChannel: 'None',
                mostActiveDay: 'None',
                weeklyActivity: {},
                weeklyVoice: {},
                engagement: { messages: 0, voice: 0, reactions: 0, artifacts: 0 }
            },
            isDiscordLinked
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/me - Update user profile
router.put('/me', verifyToken, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.userId || req.user.sanctyr_user_id;
        console.log('[Dashboard] Updating profile for user:', userId);

        if (!userId) {
            return res.status(400).json({ message: 'User ID not found in token' });
        }

        const {
            username, display_name, avatar, avatar_frame, banner,
            bio, date_of_birth, socials,
            selected_elite_role, selected_special_role,
            selected_theme
        } = req.body;

        // Update profile with partial fields to prevent wiping existing data
        const updateFields = { user_id: userId };
        const fields = [
            'username', 'display_name', 'avatar', 'avatar_frame', 'banner',
            'bio', 'date_of_birth', 'socials',
            'selected_elite_role', 'selected_special_role', 'selected_theme'
        ];

        fields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateFields[field] = req.body[field];
            }
        });

        const profile = await Profile.findOneAndUpdate(
            { user_id: userId },
            { $set: updateFields },
            { new: true, upsert: true }
        );

        res.json({ message: 'Profile updated successfully', profile });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
