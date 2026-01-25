const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Configure dotenv
dotenv.config({ path: path.join(__dirname, '../.env') });

// Profile model (Local)
const Profile = require('../models/Profile');

// Connection strings
const CORE_MONGO_URI = process.env.MONGO_URI;
// We need the AUTH URI which is in different file normally, but let's hardcode for the script run based on what I found
const AUTH_MONGO_URI = 'mongodb+srv://sanctyrdls_db_user:i52g0U1CVwgZyvKy@auth.g7g9mv8.mongodb.net/?appName=auth';

async function sync() {
    console.log('--- Sanctyr Identity Sync: Discord ID Linker ---');

    try {
        // 1. Connect to both databases
        console.log('Connecting to databases...');
        const coreConn = await mongoose.createConnection(CORE_MONGO_URI).asPromise();
        const authConn = await mongoose.createConnection(AUTH_MONGO_URI).asPromise();
        console.log('✅ Connections established.');

        // 2. Define models for the script
        const ProfileModel = coreConn.model('Profile', Profile.schema);
        const LinkedAccountSchema = new mongoose.Schema({
            sanctyr_user_id: String,
            provider: String,
            provider_user_id: String
        });
        const LinkedAccountModel = authConn.model('LinkedAccount', LinkedAccountSchema, 'linkedaccounts');

        // 3. Fetch all Discord links
        console.log('Fetching Discord links from Auth Service...');
        const discordLinks = await LinkedAccountModel.find({ provider: 'discord' });
        console.log(`Found ${discordLinks.length} Discord connections.`);

        // 4. Update local profiles
        let updatedCount = 0;
        for (const link of discordLinks) {
            const result = await ProfileModel.updateOne(
                { user_id: link.sanctyr_user_id },
                { $set: { discord_user_id: link.provider_user_id } }
            );

            if (result.modifiedCount > 0) {
                updatedCount++;
                console.log(`Synced: ${link.sanctyr_user_id} -> ${link.provider_user_id}`);
            }
        }

        console.log(`--- Sync Complete: Linked ${updatedCount} profiles. ---`);

        await coreConn.close();
        await authConn.close();
    } catch (err) {
        console.error('❌ Sync failed:', err.message);
    }
}

sync();
