import { pool } from "../server/db";

async function runMigration() {
  try {
    console.log("Running migration: Adding share_token column to cycles table...");
    
    const client = await pool.connect();
    
    try {
      // Add the column if it doesn't exist
      await client.query(`
        ALTER TABLE cycles 
        ADD COLUMN IF NOT EXISTS share_token VARCHAR(255);
      `);
      
      // Create index for faster lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_cycles_share_token ON cycles(share_token);
      `);
      
      console.log("✅ Migration completed successfully!");
      console.log("   - Added share_token column to cycles table");
      console.log("   - Created index on share_token");
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runMigration();

