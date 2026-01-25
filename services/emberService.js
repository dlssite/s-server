const mongoose = require('mongoose');
const axios = require('axios');
const RoleMapping = require('../models/RoleMapping');

// Using a custom connection for Ember DB to avoid mixing with Sanctyr DB
let emberConnection = null;

const connectEmber = async () => {
    if (emberConnection) return emberConnection;

    try {
        emberConnection = await mongoose.createConnection(process.env.EMBER_MONGO_URI).asPromise();
        console.log('[EmberService] Connected to Ember Database');
        return emberConnection;
    } catch (error) {
        console.error('[EmberService] Connection failed:', error.message);
        return null;
    }
};

/**
 * Fetch real-time stats for a user from Ember's database and Discord API
 */
const getRealtimeServerStats = async (discordId) => {
    const guildId = process.env.SANCTYR_GUILD_ID;
    const connection = await connectEmber();

    if (!connection) return null;

    try {
        // 1. Fetch Economy Data
        const EconomyModel = connection.models.Economy || connection.model('Economy', new mongoose.Schema({}, { strict: false }), 'economies');
        const economy = await EconomyModel.findOne({ userId: discordId, guildId });

        // 2. Fetch Leveling Data
        const LevelModel = connection.models.UserLevel || connection.model('UserLevel', new mongoose.Schema({}, { strict: false }), 'userlevels');
        const leveling = await LevelModel.findOne({ userId: discordId, guildId });

        // 3. Fetch Discord Data and resolve Sanctyr-specific identity
        let allManagedRoles = [];
        let nationRoles = [];
        let eliteRoles = [];
        let specialRoles = [];

        let detectedNation = 'Unaligned';
        let detectedStatus = null;
        let detectedLevelRole = null;
        let highestStatusPriority = -1;
        let highestLevelPriority = -1;
        let serverName = null;
        let discordBanner = null;
        let discordDecoration = null;
        let guildChannels = [];

        try {
            const apiOptions = {
                headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
            };

            const [rolesResponse, memberResponse, userResponse, channelsResponse, dbMappings] = await Promise.all([
                axios.get(`https://discord.com/api/v10/guilds/${guildId}/roles`, apiOptions).catch(() => ({ data: [] })),
                axios.get(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, apiOptions).catch(() => ({ data: { roles: [] } })),
                axios.get(`https://discord.com/api/v10/users/${discordId}`, apiOptions).catch(() => ({ data: {} })),
                axios.get(`https://discord.com/api/v10/guilds/${guildId}/channels`, apiOptions).catch(() => ({ data: [] })),
                RoleMapping.find({})
            ]);

            const allGuildRoles = rolesResponse.data;
            const memberData = memberResponse.data;
            const userData = userResponse.data;
            guildChannels = channelsResponse.data;
            const memberRoleIds = memberData.roles || [];
            const managedRoleIdMap = new Map(dbMappings.map(m => [m.role_id, m]));

            // Get Server Display Name
            serverName = memberData.nick || userData.global_name || userData.username;

            // Get Discord Assets
            if (userData.banner) {
                discordBanner = `https://cdn.discordapp.com/banners/${discordId}/${userData.banner}.${userData.banner.startsWith('a_') ? 'gif' : 'png'}?size=600`;
            }
            if (userData.avatar_decoration_data) {
                discordDecoration = `https://cdn.discordapp.com/avatar-decoration-presets/${userData.avatar_decoration_data.asset}.png`;
            }

            // Get Discord Avatar (Server Specific > Global > Default)
            if (memberData.avatar) {
                discordAvatar = `https://cdn.discordapp.com/guilds/${guildId}/users/${discordId}/avatars/${memberData.avatar}.${memberData.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`;
            } else if (userData.avatar) {
                discordAvatar = `https://cdn.discordapp.com/avatars/${discordId}/${userData.avatar}.${userData.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`;
            } else {
                // Default Discord Avatar
                const defaultIndex = (userData.id % 5);
                discordAvatar = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
            }

            // 1. Sort all guild roles by position descending
            const sortedGuildRoles = allGuildRoles.sort((a, b) => b.position - a.position);

            // 2. Categorize roles
            sortedGuildRoles.forEach(role => {
                if (memberRoleIds.includes(role.id)) {
                    const mapping = managedRoleIdMap.get(role.id);
                    if (mapping) {
                        const roleName = mapping.name || role.name;
                        allManagedRoles.push(roleName);

                        if (mapping.category === 'nation') {
                            nationRoles.push(roleName);
                            detectedNation = roleName;
                        }
                        else if (['status', 'governance'].includes(mapping.category)) {
                            eliteRoles.push(roleName);
                            if (mapping.priority > highestStatusPriority) {
                                highestStatusPriority = mapping.priority;
                                detectedStatus = roleName;
                            }
                        }
                        else if (mapping.category === 'level') {
                            if (mapping.priority > highestLevelPriority) {
                                highestLevelPriority = mapping.priority;
                                detectedLevelRole = roleName;
                            }
                        }
                        else if (mapping.category === 'special') {
                            specialRoles.push(roleName);
                        }
                    }
                }
            });

        } catch (discordError) {
            console.warn('[EmberService] Failed to fetch Discord/Mapping data:', discordError.message);
        }

        // ===== ANALYTICS CALCULATION (v11) =====
        let topChannelStr = 'None';
        let mostActiveDayStr = 'None';
        let weeklyActivityRes = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 };
        let engagement = { messages: 0, voice: 0, reactions: 0, artifacts: 0 };

        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayName = dayNames[new Date().getDay()];

        // Utility to convert Maps or Objects to plain JSON
        const toPlain = (val) => val?.toJSON ? val.toJSON() : (val || {});

        if (leveling) {
            const analytics = leveling.analytics || {};

            const wMessages = toPlain(analytics.weeklyActivity);
            const wVoice = toPlain(analytics.weeklyVoice);
            const wReactions = toPlain(analytics.weeklyReactions);
            const wArtifacts = toPlain(analytics.weeklyAttachments);

            // 1. Engagement Percentages (Daily Targets - v11)
            // Targets: 50 msgs, 60m voice, 25 reactions, 5 artifacts
            engagement = {
                messages: Math.min(Math.round(((wMessages[todayName] || 0) / 50) * 100), 100),
                voice: Math.min(Math.round(((wVoice[todayName] || 0) / 60) * 100), 100),
                reactions: Math.min(Math.round(((wReactions[todayName] || 0) / 25) * 100), 100),
                artifacts: Math.min(Math.round(((wArtifacts[todayName] || 0) / 5) * 100), 100)
            };

            // 2. Top Channel (Resolve ID to Name)
            const cData = toPlain(analytics.channelParticipation);
            let maxC = -1;
            let topId = null;
            for (const [id, count] of Object.entries(cData)) {
                if (count > maxC) { maxC = count; topId = id; }
            }
            if (topId) {
                const channel = guildChannels.find(c => c.id === topId);
                topChannelStr = channel ? `#${channel.name}` : `ID: ${topId}`;
            }

            // 3. Weekly activity (Robust Serialization for Charts)
            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
                weeklyActivityRes[day] = wMessages[day] || 0;
            });

            let maxD = -1;
            for (const [day, count] of Object.entries(weeklyActivityRes)) {
                if (count > maxD) { maxD = count; mostActiveDayStr = day; }
            }
        }

        return {
            economy: {
                wallet: economy?.wallet || 0,
                bank: economy?.bank || 0,
                streak: economy?.dailyStreak || 0
            },
            leveling: {
                level: leveling?.level || 1,
                xp: leveling?.xp || 0,
                messages: leveling?.messageCount || 0,
                voiceMinutes: leveling?.voiceStats?.totalMinutes || 0,
                attachmentCount: leveling?.attachmentCount || 0,
                emojiCount: leveling?.emojiCount || 0,
                reactionCount: leveling?.reactionCount || 0,
                receivedReactionCount: leveling?.receivedReactionCount || 0
            },
            analytics: {
                topChannel: topChannelStr,
                mostActiveDay: mostActiveDayStr?.toUpperCase() || 'NONE',
                weeklyActivity: weeklyActivityRes,
                weeklyVoice: toPlain(leveling?.analytics?.weeklyVoice),
                engagement
            },
            roles: allManagedRoles,
            nationRoles,
            eliteRoles,
            specialRoles,
            nation: detectedNation,
            status: detectedStatus,
            rankRole: detectedLevelRole,
            serverName,
            discordBanner,
            discordAvatar,
            discordDecoration
        };
    } catch (error) {
        console.error('[EmberService] Data fetch error:', error.message);
        return null;
    }
};

module.exports = {
    getRealtimeServerStats
};
