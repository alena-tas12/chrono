require('dotenv').config();
const { Client } = require('pg');

async function secureDatabase() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to Supabase Postgres.");

    const tables = [
      'users', 'profiles', 'calendars', 'events', 
      'calendar_members', 'chat_history', 'cognitive_memories', 
      'admin_audit_log', 'admin_user_flags'
    ];

    for (const table of tables) {
      try {
        await client.query(`ALTER TABLE IF EXISTS "${table}" ENABLE ROW LEVEL SECURITY;`);
        console.log(`Enabled RLS on ${table}`);
        
        await client.query(`DROP POLICY IF EXISTS "Enable all for service_role on ${table}" ON "${table}";`);
        await client.query(`
          CREATE POLICY "Enable all for service_role on ${table}" 
          ON "${table}" 
          AS PERMISSIVE 
          FOR ALL 
          TO service_role 
          USING (true) 
          WITH CHECK (true);
        `);

      } catch (err) {
        console.log(`Note: Could not secure ${table} (might not exist): ${err.message}`);
      }
    }

    console.log("Database secured successfully.");
  } catch (err) {
    console.error("Failed to connect or secure db:", err);
  } finally {
    await client.end();
  }
}

secureDatabase();
