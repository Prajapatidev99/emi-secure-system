/**
 * make-admin.js
 * Usage: node scripts/make-admin.js <email>
 * 
 * This script upgrades any existing shopkeeper account to SuperAdmin.
 * Run it once from the backend directory:
 *   node scripts/make-admin.js admin@yourshop.com
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const config = require('../config/config');

const email = process.argv[2];

if (!email) {
    console.error('❌  Usage: node scripts/make-admin.js <email>');
    process.exit(1);
}

(async () => {
    try {
        console.log(`🔌  Connecting to MongoDB...`);
        await mongoose.connect(config.mongodbUri);
        console.log(`✅  Connected.`);

        const user = await User.findOneAndUpdate(
            { email: email.toLowerCase() },
            { $set: { role: 'SuperAdmin' } },
            { new: true }
        );

        if (!user) {
            console.error(`❌  No account found with email: ${email}`);
            console.error('    Please make sure the account is registered first.');
            process.exit(1);
        }

        console.log(`\n✅  Success! Account upgraded to SuperAdmin:`);
        console.log(`    Email:     ${user.email}`);
        console.log(`    Shop Name: ${user.shopName}`);
        console.log(`    Role:      ${user.role}`);
        console.log('\n    Log in with this account to access the Admin Panel.\n');

    } catch (err) {
        console.error('❌  Error:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
})();
