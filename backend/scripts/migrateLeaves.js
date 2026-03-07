/**
 * Migration: change leaves table from date-range structure
 * (from_date, to_date) to per-day structure (leave_date).
 *
 * Usage: node scripts/migrateLeaves.js
 */
const db = require('../db');

const runMigration = async () => {
  try {
    // Check if old columns still exist
    const [fromDateCol] = await db.query(
      `SHOW COLUMNS FROM leaves LIKE 'from_date'`
    );

    if (fromDateCol.length > 0) {
      console.log('Old structure detected. Migrating leaves table...');

      // Drop old date-range columns
      await db.query(`ALTER TABLE leaves DROP COLUMN from_date`);
      await db.query(`ALTER TABLE leaves DROP COLUMN to_date`);
      console.log('✓ Dropped from_date and to_date columns');

      // Add per-day column with a temporary nullable state so we can clean up first
      await db.query(`
        ALTER TABLE leaves
          ADD COLUMN leave_date DATE NULL AFTER user_id
      `);
      console.log('✓ Added leave_date column (nullable)');

      // Delete stale rows before enforcing the unique constraint
      await db.query(`DELETE FROM leaves WHERE leave_date IS NULL`);
      console.log('✓ Cleaned up rows with no leave_date');

      // Make column NOT NULL now that bad rows are gone
      await db.query(`
        ALTER TABLE leaves MODIFY COLUMN leave_date DATE NOT NULL
      `);
      console.log('✓ Set leave_date to NOT NULL');

      // Add unique constraint to prevent duplicate leave days per user
      await db.query(`
        ALTER TABLE leaves
          ADD UNIQUE KEY user_leave_date_unique (user_id, leave_date)
      `);
      console.log('✓ Added UNIQUE KEY (user_id, leave_date)');

      console.log('\n✓ Migration complete. leaves table now uses leave_date.');
    } else {
      // Verify the new column exists
      const [leaveDateCol] = await db.query(
        `SHOW COLUMNS FROM leaves LIKE 'leave_date'`
      );
      if (leaveDateCol.length > 0) {
        // Check if unique key is missing (partial migration)
        const [keys] = await db.query(`SHOW KEYS FROM leaves WHERE Key_name = 'user_leave_date_unique'`);
        if (keys.length === 0) {
          console.log('Partial migration detected. Adding missing UNIQUE KEY...');
          // Clean up duplicate rows from the old default date before adding key
          await db.query(`DELETE FROM leaves WHERE leave_date = '2000-01-01'`);
          // Ensure column is NOT NULL
          await db.query(`ALTER TABLE leaves MODIFY COLUMN leave_date DATE NOT NULL`);
          await db.query(`ALTER TABLE leaves ADD UNIQUE KEY user_leave_date_unique (user_id, leave_date)`);
          console.log('✓ UNIQUE KEY added. Migration complete.');
        } else {
          console.log('✓ Already fully migrated — leave_date and UNIQUE KEY already exist.');
        }
      } else {
        console.log('⚠ Unexpected table structure. Please check the leaves table manually.');
      }
    }
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
  } finally {
    process.exit(0);
  }
};

runMigration();
