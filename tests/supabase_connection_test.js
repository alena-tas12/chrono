const cloudDb = require('../main/cloudDb');

async function runTests() {
    console.log("=== CHRONO 2.0 SUPABASE DEBUGGING TEST ===");
    
    if (!cloudDb) {
        console.error("❌ cloudDb is null. Check if SUPABASE_URL and SUPABASE_ANON_KEY are set in .env.");
        process.exit(1);
    }
    
    console.log("✅ Supabase client successfully initialized.");

    try {
        // 1. Test ping (reading public profiles)
        // Since we are unauthenticated in this test context, we should be rejected by RLS.
        // This actually proves RLS is working!
        console.log("\n--- Test 1: RLS Protection Check ---");
        const { data, error } = await cloudDb.from('profiles').select('*').limit(1);
        
        if (error) {
            console.log("✅ RLS successfully blocked anonymous read access (Error:", error.message, ")");
        } else if (data && data.length > 0) {
            console.error("❌ SECURITY FLAW: Anonymous read access is allowed! The RLS policies might not be active on 'profiles'.");
        } else {
            console.log("✅ RLS successfully returned empty array (no access to profiles).");
        }

        // 2. Test inserting into events anonymously
        console.log("\n--- Test 2: RLS Write Protection Check ---");
        const { error: insertError } = await cloudDb.from('events').insert({
            id: 'test_event_' + Date.now(),
            text: 'Should fail',
            date: '2026-01-01',
            created_by: '00000000-0000-0000-0000-000000000000',
            calendar_id: 'personal',
            duration_min: 30
        });

        if (insertError) {
            console.log("✅ RLS successfully blocked anonymous write access (Error:", insertError.message, ")");
        } else {
            console.error("❌ SECURITY FLAW: Anonymous write access is allowed! The RLS policies might not be active on 'events'.");
        }

        console.log("\n=== ALL TESTS COMPLETED ===");
        process.exit(0);
        
    } catch (err) {
        console.error("❌ Unexpected test failure:", err);
        process.exit(1);
    }
}

runTests();
