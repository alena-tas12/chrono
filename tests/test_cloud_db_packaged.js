/**
 * 🧪 TEST: CLOUD DB PACKAGED RUNTIME INITIALIZATION
 *
 * Verifies that Supabase Cloud Client and Google Auth initialization
 * succeed when process.env variables are absent (simulating packaged app.asar).
 */

const assert = require('assert');

// Clear environment variables to simulate packaged execution
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;

const cloudDb = require('../main/cloudDb');

async function testPackagedCloudDb() {
    console.log("=========================================================================");
    console.log("🧪 TESTING SUPABASE CLOUD DB IN PACKAGED SIMULATION");
    console.log("=========================================================================\n");

    assert(cloudDb, "cloudDb proxy must exist");
    assert(cloudDb.auth, "cloudDb.auth must exist and be callable");
    assert(typeof cloudDb.auth.signInWithOAuth === 'function', "cloudDb.auth.signInWithOAuth must be a function");
    assert(typeof cloudDb.from === 'function', "cloudDb.from must be a function");

    console.log("  ✅ cloudDb.auth.signInWithOAuth is available and callable.");
    console.log("  ✅ cloudDb.from is available for database tables.");

    console.log("\n=========================================================================");
    console.log("🎉 CLOUD DB PACKAGED INITIALIZATION TEST PASSED 100%!");
    console.log("=========================================================================\n");
}

testPackagedCloudDb().catch(err => {
    console.error("Packaged cloudDb test failed:", err);
    process.exit(1);
});
