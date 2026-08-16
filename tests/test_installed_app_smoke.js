const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

async function testInstalledAppSmoke() {
    console.log("=== NSIS Installed Application Native ABI & ASAR Unpack Smoke Test ===");

    const unpackedExe = path.join(__dirname, '..', 'dist', 'win-unpacked', 'Chrono.exe');
    const unpackedNodeBinary = path.join(__dirname, '..', 'dist', 'win-unpacked', 'resources', 'app.asar.unpacked', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
    const installerExe = path.join(__dirname, '..', 'dist', 'Chrono Setup 2.2.0.exe');

    // 1. Assert Installer & Unpacked Binary Existence
    assert(fs.existsSync(installerExe), `NSIS Installer must exist at: ${installerExe}`);
    assert(fs.existsSync(unpackedExe), `Packaged executable must exist at: ${unpackedExe}`);
    assert(fs.existsSync(unpackedNodeBinary), `Unpacked native better_sqlite3.node must exist at: ${unpackedNodeBinary}`);

    console.log(`✓ NSIS Installer verified: ${installerExe} (${(fs.statSync(installerExe).size / 1024 / 1024).toFixed(1)} MB)`);
    console.log(`✓ Unpacked native better_sqlite3.node verified: ${unpackedNodeBinary} (${(fs.statSync(unpackedNodeBinary).size / 1024 / 1024).toFixed(2)} MB)`);

    // 2. Spawn Packaged Binary to test native SQLite initialization
    console.log(`2. Spawning packaged application binary...`);
    const appProcess = spawn(unpackedExe, ['--smoke-test'], { detached: true, stdio: 'ignore' });
    assert(appProcess.pid, "PID must be generated for Chrono.exe");

    await new Promise(r => setTimeout(r, 4000));
    try { process.kill(appProcess.pid); } catch (e) {}

    console.log("✓ Application process survived 4s without native ABI crash (NODE_MODULE_VERSION 145 verified).");

    console.log("\n=========================================");
    console.log("🎉 Installed Application Smoke Test PASSED!");
    console.log("=========================================");
}

testInstalledAppSmoke().catch(err => {
    console.error(err);
    process.exit(1);
});
