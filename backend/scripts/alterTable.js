/**
 * Run this migration once to change profile_photo from TEXT/VARCHAR
 * to MEDIUMTEXT so large base64 images are stored without truncation.
 *
 * Usage: node scripts/alterTable.js
 */
const db = require('../db');

const runMigration = async () => {
  try {
    console.log('Running migration: profile_photo column → MEDIUMTEXT …');

    await db.query(`
      ALTER TABLE users
      MODIFY COLUMN profile_photo MEDIUMTEXT
    `);

    console.log('✓ Migration complete. profile_photo is now MEDIUMTEXT.');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
  } finally {
    process.exit(0);
  }
};

runMigration();
