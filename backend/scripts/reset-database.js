/**
 * Database Reset Script
 * 
 * WARNING: This will DELETE ALL DATA from the database!
 * Use this to start fresh with the new userId-based multi-tenant system.
 * 
 * BEFORE RUNNING:
 * 1. Update your .env file with actual MongoDB Atlas connection string
 * 2. Make sure MONGODB_URI is set correctly
 * 
 * Run with: node scripts/reset-database.js
 */

const mongoose = require('mongoose');
const config = require('../config/config');

// Import models
const Customer = require('../models/customer.model');
const { Device } = require('../models/device.model');
const { Payment } = require('../models/payment.model');
const User = require('../models/user.model');

async function resetDatabase() {
    try {
        // Check if MongoDB URI is configured
        if (!config.mongodbUri || config.mongodbUri.includes('your-username') || config.mongodbUri.includes('your-password')) {
            console.error('❌ ERROR: MongoDB URI is not configured!');
            console.error('\n📝 Please update your .env file with your actual MongoDB Atlas connection string:');
            console.error('   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/emi-secure\n');
            console.error('🔗 Get your connection string from: https://cloud.mongodb.com/');
            console.error('   → Clusters → Connect → Connect your application → Copy connection string\n');
            process.exit(1);
        }

        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(config.mongodbUri);
        console.log('✅ Connected to MongoDB\n');

        console.log('⚠️  WARNING: This will delete ALL data from the database!');
        console.log('⚠️  This includes:');
        console.log('     - All customers');
        console.log('     - All devices');
        console.log('     - All payments');
        console.log('     - All user accounts');
        console.log('\n⚠️  Press Ctrl+C within 5 seconds to cancel...\n');

        // Wait 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('🗑️  Deleting all data...\n');

        // Delete all collections
        const customersDeleted = await Customer.deleteMany({});
        console.log(`   ✓ Deleted ${customersDeleted.deletedCount} customers`);

        const devicesDeleted = await Device.deleteMany({});
        console.log(`   ✓ Deleted ${devicesDeleted.deletedCount} devices`);

        const paymentsDeleted = await Payment.deleteMany({});
        console.log(`   ✓ Deleted ${paymentsDeleted.deletedCount} payments`);

        const usersDeleted = await User.deleteMany({});
        console.log(`   ✓ Deleted ${usersDeleted.deletedCount} users`);

        console.log('\n✅ Database reset complete!');
        console.log('📝 Next steps:');
        console.log('   1. Restart your backend server');
        console.log('   2. Register a new account in the dashboard');
        console.log('   3. Start adding customers and devices\n');

        await mongoose.connection.close();
        console.log('🔌 Database connection closed.');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error resetting database:', error.message);

        if (error.message.includes('ENOTFOUND') || error.message.includes('querySrv')) {
            console.error('\n💡 This looks like a MongoDB connection error.');
            console.error('   Please check:');
            console.error('   1. Your MONGODB_URI in .env file is correct');
            console.error('   2. Your IP address is whitelisted in MongoDB Atlas');
            console.error('   3. Your MongoDB cluster is running\n');
        }

        process.exit(1);
    }
}

// Run the script
resetDatabase();
