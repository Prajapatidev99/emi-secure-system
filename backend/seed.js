require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user.model');

const MONGODB_URI = process.env.MONGODB_URI;

const seedAdminUser = async () => {
  try {
    // Connect to the database
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected for seeding...');

    // Admin user details
    const adminEmail = 'admin@example.com';
    const adminPassword = 'password123';
    const shopName = 'My Awesome Shop';

    // Check if the admin user already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('Admin user already exists. Deleting and recreating...');
      await User.deleteOne({ email: adminEmail });
    }

    // Create the new admin user
    const adminUser = new User({
      email: adminEmail,
      password: adminPassword,
      shopName: shopName,
    });

    await adminUser.save();
    console.log('Admin user created successfully!');
    console.log('------------------------------------');
    console.log('Login with the following credentials:');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('------------------------------------');

  } catch (error) {
    console.error('Error seeding the database:', error);
  } finally {
    // Disconnect from the database
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
};

seedAdminUser();
