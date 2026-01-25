const mongoose = require('mongoose');

const RoleMappingSchema = new mongoose.Schema({
    role_id: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['nation', 'status', 'governance', 'level', 'special'],
        required: true
    },
    priority: {
        type: Number,
        default: 0 // Higher priority roles show up as the primary "Status/Title"
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('RoleMapping', RoleMappingSchema);
