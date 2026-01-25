const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    discord_user_id: {
        type: String,
        index: true
    },
    username: {
        type: String,
        default: 'Flameborn User'
    },
    display_name: {
        type: String,
        default: ''
    },
    selected_elite_role: {
        type: String,
        default: ''
    },
    selected_special_role: {
        type: String,
        default: ''
    },
    selected_theme: {
        type: String,
        default: 'ornate'
    },
    avatar: {
        type: String,
        default: 'https://via.placeholder.com/80'
    },
    avatar_frame: {
        type: String,
        default: ''
    },
    banner: {
        type: String,
        default: ''
    },
    bio: {
        type: String,
        default: '',
        maxlength: 500
    },
    socials: [{
        platform: String,
        url: String,
        icon: String
    }],
    date_of_birth: {
        type: Date,
        default: null
    },
    // Nation will be provided by Ember bot from Discord server data
    // Removed from user-editable fields
    rank: {
        type: String,
        default: 'Initiate (Lvl 1)'
    },
    title: {
        type: String,
        default: 'Awakened Sovereign'
    },
    xp: {
        current: { type: Number, default: 0 },
        max: { type: Number, default: 1000 }
    },
    wallet: {
        embers: { type: Number, default: 0 },
        obols: { type: Number, default: 0 }
    },
    activity: [{
        time: String,
        text: String,
        timestamp: { type: Date, default: Date.now }
    }],
    connected_apps: [{
        name: String,
        status: String,
        icon: String
    }],
    // Server-provided data from Discord (via Ember bot)
    discord_server_data: {
        nation: String,
        roles: [String],
        level: Number,
        banner: String,
        avatar: String,
        avatar_decoration: String,
        last_synced: Date
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Profile', ProfileSchema);
