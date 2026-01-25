const express = require('express');
const axios = require('axios');
const router = express.Router();
const Profile = require('../models/Profile');
const emberService = require('../services/emberService');

// GET /api/profiles/:username - Public Profile fetching
router.get('/:username', async (req, res) => {
    try {
        const { username } = req.params;

        // Find profile by username (display handle)
        let profile = await Profile.findOne({ username });

        if (!profile) {
            return res.status(404).json({ message: 'Identity not found in the Void' });
        }

        let serverStats = null;
        console.log(`[PublicProfile] Fetching profile: ${username}. Discord ID: ${profile.discord_user_id || 'NONE'}`);

        // 1. Attempt Real-time Fetch
        if (profile.discord_user_id) {
            try {
                console.log(`[PublicProfile] Syncing Ember for ${profile.discord_user_id}...`);
                const fetchPromise = emberService.getRealtimeServerStats(profile.discord_user_id);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Void Timeout')), 8000)
                );

                serverStats = await Promise.race([fetchPromise, timeoutPromise]);

                // Wait for the cache update to finish so we can return the freshest data
                if (serverStats) {
                    console.log(`[PublicProfile] Real-time success for ${username}. Updating storage...`);
                    await Profile.updateOne({ _id: profile._id }, {
                        $set: {
                            'discord_server_data.nation': serverStats.nation,
                            'discord_server_data.roles': serverStats.roles,
                            'discord_server_data.level': serverStats.leveling?.level || 1,
                            'discord_server_data.banner': serverStats.discordBanner,
                            'discord_server_data.avatar_decoration': serverStats.discordDecoration,
                            'discord_server_data.serverName': serverStats.serverName,
                            'discord_server_data.nationRoles': serverStats.nationRoles || [],
                            'discord_server_data.eliteRoles': serverStats.eliteRoles || [],
                            'discord_server_data.specialRoles': serverStats.specialRoles || [],
                            'discord_server_data.last_synced': new Date()
                        }
                    });

                    // Refresh the local profile object
                    profile = await Profile.findById(profile._id);
                }
            } catch (err) {
                console.warn(`[PublicProfile] Real-time fetch skipped for ${username}:`, err.message);
            }
        }

        // 2. Prepare Response with Fallback logic
        const statsSource = serverStats || profile.discord_server_data;

        // Elite Role (Title) Selection
        const availableElite = statsSource?.eliteRoles || [];
        let eliteTitle = availableElite.length > 0 ? availableElite[0] : (statsSource?.status || 'Flameborn');
        if (profile.selected_elite_role && availableElite.includes(profile.selected_elite_role)) {
            eliteTitle = profile.selected_elite_role;
        }

        // Special Role Selection
        const availableSpecial = statsSource?.specialRoles || [];
        let specialRole = availableSpecial.length > 0 ? availableSpecial[0] : null;
        if (profile.selected_special_role && availableSpecial.includes(profile.selected_special_role)) {
            specialRole = profile.selected_special_role;
        }

        const rankDisplay = statsSource?.rankRole || (statsSource?.leveling ? `Initiate (Lvl ${statsSource.leveling.level || 1})` : profile.rank);

        const response = {
            identity: {
                name: profile.username,
                username: profile.username,
                display_name: profile.display_name || statsSource?.serverName || profile.username,
                title: eliteTitle,
                special_role: specialRole,
                avatar: profile.avatar,
                avatar_frame: profile.avatar_frame || statsSource?.avatar_decoration || statsSource?.discordDecoration || '',
                banner: profile.banner || statsSource?.banner || statsSource?.discordBanner || '',
                bio: profile.bio,
                rank: rankDisplay,
                xp: statsSource?.leveling ? { current: statsSource.leveling.xp || 0, max: (statsSource.leveling.level || 1) * 1000 } : profile.xp,
                socials: profile.socials || [],
                eliteRoles: availableElite.slice(0, 1),
                specialRoles: availableSpecial.slice(0, 1),
                theme: profile.selected_theme
            },
            nation: {
                name: statsSource?.nation || 'Unaligned',
                level: statsSource?.leveling?.level || statsSource?.level || 1,
                roles: statsSource?.nationRoles || []
            },
            apps: profile.connected_apps,
            activity: profile.activity.slice(0, 10),
            economy: statsSource?.economy || { wallet: 0, bank: 0, streak: 0 },
            analytics: statsSource?.analytics || { topChannel: 'None', mostActiveDay: 'None' }
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching public profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
