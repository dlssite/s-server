const mongoose = require('mongoose');
const RoleMapping = require('../models/RoleMapping');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const roles = [
    // Nations
    { role_id: '1452273115756232737', name: 'Arcanum', category: 'nation', priority: 0 },
    { role_id: '1452272727858745415', name: 'Battir', category: 'nation', priority: 0 },
    { role_id: '1410662113151815911', name: 'Chromar', category: 'nation', priority: 0 },
    { role_id: '1452272816522268756', name: 'Lyris', category: 'nation', priority: 0 },
    { role_id: '1452272470404104274', name: 'Mythos', category: 'nation', priority: 0 },
    { role_id: '1452272919777640530', name: 'Quillian', category: 'nation', priority: 0 },
    { role_id: '1452273012396265534', name: 'Voxen', category: 'nation', priority: 0 },
    { role_id: '1452273277933453397', name: 'Nexara', category: 'nation', priority: 0 },

    // Elite Status (Titles)
    { role_id: '1411046773212053564', name: 'Eternal Queen', category: 'status', priority: 100 },
    { role_id: '1415296114307108964', name: 'Eternal Prince', category: 'status', priority: 90 },
    { role_id: '1411313427292487681', name: 'Eternal Princess', category: 'status', priority: 90 },
    { role_id: '1410650279019286650', name: 'High Council', category: 'governance', priority: 70 },
    { role_id: '1410650429867425853', name: 'Warden of Order', category: 'governance', priority: 60 },
    { role_id: '1410650617571049573', name: 'Archivist', category: 'governance', priority: 50 },
    { role_id: '1432005591139745813', name: 'Flamebearer', category: 'status', priority: 5 }, // Fallback title

    // Level Ranks (Rank displayed in card)
    { role_id: '1410653079308861582', name: 'Summoned Soul', category: 'level', priority: 1 },
    { role_id: '1410653079421980703', name: 'Commoner', category: 'level', priority: 5 },
    { role_id: '1410653079812050954', name: 'Villager', category: 'level', priority: 10 },
    { role_id: '1410654550297280542', name: 'City Guard', category: 'level', priority: 15 },
    { role_id: '1410654551362764923', name: 'Courier', category: 'level', priority: 20 },
    { role_id: '1410656589597118666', name: 'D\'Enchanter', category: 'level', priority: 25 },
    { role_id: '1410654568034992150', name: 'Knight of the Realm', category: 'level', priority: 30 },
    { role_id: '1410654568051904674', name: 'Magistrate', category: 'level', priority: 35 },
    { role_id: '1410655737276792923', name: 'Skybound', category: 'level', priority: 40 },
    { role_id: '1410654569322643559', name: 'The Wanderer', category: 'level', priority: 45 },
    { role_id: '1410654569343619192', name: 'Adventurer', category: 'level', priority: 50 },
    { role_id: '1410654569490419772', name: 'Pathfinder', category: 'level', priority: 55 },
    { role_id: '1410654569658318888', name: 'Elite Hunter', category: 'level', priority: 60 },
    { role_id: '1410655743119724704', name: 'D\'Starborn', category: 'level', priority: 70 },
    { role_id: '1410655738942193754', name: 'Legendwalker', category: 'level', priority: 100 },

    // Patrons
    { role_id: '1435434616403001380', name: 'Patron of Arcanum', category: 'status', priority: 80 },
    { role_id: '1435434118719737967', name: 'Patron of Voxen', category: 'status', priority: 80 },
    { role_id: '1435433935705342034', name: 'Patron of Lyris', category: 'status', priority: 80 },
    { role_id: '1435432587052187669', name: 'Patron of Chromar', category: 'status', priority: 80 },
    { role_id: '1435433653357379674', name: 'Patron of Mythos', category: 'status', priority: 80 },
    { role_id: '1435434402506084423', name: 'Patron of Nexara', category: 'status', priority: 80 },
    { role_id: '1435433759947096115', name: 'Patron of Quillian', category: 'status', priority: 80 },
    { role_id: '1435433425346498652', name: 'Patron of Battir', category: 'status', priority: 80 },

    // Special
    { role_id: '1422807632116191232', name: 'Supporter', category: 'special', priority: 10 },
    { role_id: '1411082328830246973', name: 'Booster', category: 'special', priority: 20 }
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to Sanctyr Database');

        await RoleMapping.deleteMany({});
        console.log('Cleared existing role mappings');

        await RoleMapping.insertMany(roles);
        console.log(`Successfully seeded ${roles.length} role mappings`);

        await mongoose.disconnect();
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    }
}

seed();
