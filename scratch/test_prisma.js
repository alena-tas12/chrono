const { Pool } = require('pg');

async function testPgPool() {
    console.log('Testing raw pg pool connection to Supabase pooler...');
    const pool = new Pool({
        connectionString: "postgresql://postgres.kimzqukobytxhzltytvx:Alena-10052007TAS@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
    });

    try {
        const client = await pool.connect();
        console.log('Connected to pg pool!');
        const res = await client.query('SELECT 1 as num');
        console.log('Query result:', res.rows);
        client.release();
    } catch (err) {
        console.error('pg pool error:', err.message);
    } finally {
        await pool.end();
    }
}

testPgPool();
