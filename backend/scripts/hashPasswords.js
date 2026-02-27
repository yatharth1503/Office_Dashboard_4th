const bcrypt = require('bcryptjs');
const db = require('../db');
require('dotenv').config();

/**
 * One-time migration script to hash existing plain-text passwords
 * 
 * This script:
 * 1. Fetches all users from the database
 * 2. Checks if password is already hashed (starts with "$2")
 * 3. Hashes plain-text passwords using bcrypt
 * 4. Updates the database with hashed passwords
 * 
 * Usage: node scripts/hashPasswords.js
 */

async function hashExistingPasswords() {
  console.log('🔐 Starting password migration...\n');

  try {
    // Fetch all users
    const [users] = await db.query('SELECT id, email, password FROM users');

    if (users.length === 0) {
      console.log('⚠️  No users found in database');
      process.exit(0);
    }

    console.log(`📊 Found ${users.length} user(s) in database\n`);

    let hashedCount = 0;
    let skippedCount = 0;

    // Process each user
    for (const user of users) {
      // Check if password is already hashed (bcrypt hashes start with "$2")
      if (user.password.startsWith('$2')) {
        console.log(`⏭️  Skipping ${user.email} - password already hashed`);
        skippedCount++;
        continue;
      }

      // Hash the plain-text password
      console.log(`🔒 Hashing password for ${user.email}...`);
      const hashedPassword = await bcrypt.hash(user.password, 10);

      // Update the database
      await db.query(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, user.id]
      );

      console.log(`✅ Updated ${user.email}`);
      hashedCount++;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 Migration Summary:');
    console.log(`   • Total users: ${users.length}`);
    console.log(`   • Passwords hashed: ${hashedCount}`);
    console.log(`   • Already hashed (skipped): ${skippedCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✨ Password migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Error during password migration:', error.message);
    process.exit(1);
  } finally {
    // Close database connection
    await db.end();
    process.exit(0);
  }
}

// Run the migration
hashExistingPasswords();
