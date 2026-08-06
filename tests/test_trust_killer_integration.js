/**
 * 🛡️ TRUST KILLER FRAMEWORK - INTEGRATION TEST
 * 
 * Verifies that all trust killer modules load correctly,
 * have no syntax errors, and integrate without conflicts
 * with the existing Chrono codebase.
 */

const path = require('path');
const mainDb = require('../main/main_db');

console.log('\n' + '='.repeat(80));
console.log('🛡️  TRUST KILLER FRAMEWORK - INTEGRATION TEST');
console.log('='.repeat(80));

let testsPassed = 0;
let testsFailed = 0;

function logTest(name, passed, error = null) {
    if (passed) {
        console.log(`✅ PASS: ${name}`);
        testsPassed++;
    } else {
        console.log(`❌ FAIL: ${name}`);
        if (error) console.log(`   Error: ${error.message}`);
        testsFailed++;
    }
}

async function runTests() {
    // Test 1: Load all modules
    console.log('\n📦 MODULE LOADING TESTS');
    console.log('-'.repeat(80));

    let dataIntegrity, trustKillerHandlers, healthCheck, backupManager, syncReliabilityTest;

    try {
        dataIntegrity = require('../main/dataIntegrity');
        logTest('Load dataIntegrity module', !!dataIntegrity);
    } catch (err) {
        logTest('Load dataIntegrity module', false, err);
    }

    try {
        trustKillerHandlers = require('../main/trustKillerHandlers');
        logTest('Load trustKillerHandlers module', !!trustKillerHandlers);
    } catch (err) {
        logTest('Load trustKillerHandlers module', false, err);
    }

    try {
        healthCheck = require('../main/healthCheck');
        logTest('Load healthCheck module', !!healthCheck);
    } catch (err) {
        logTest('Load healthCheck module', false, err);
    }

    try {
        backupManager = require('../main/backupManager');
        logTest('Load backupManager module', !!backupManager);
    } catch (err) {
        logTest('Load backupManager module', false, err);
    }

    try {
        syncReliabilityTest = require('../main/syncReliabilityTest');
        logTest('Load syncReliabilityTest module', !!syncReliabilityTest);
    } catch (err) {
        logTest('Load syncReliabilityTest module', false, err);
    }

    // Test 2: Verify module exports
    console.log('\n📤 MODULE EXPORTS TESTS');
    console.log('-'.repeat(80));

    logTest('dataIntegrity exports initializeOperationLogging', typeof dataIntegrity?.initializeOperationLogging === 'function');
    logTest('dataIntegrity exports verifyDataIntegrity', typeof dataIntegrity?.verifyDataIntegrity === 'function');
    logTest('dataIntegrity exports detectSilentFailures', typeof dataIntegrity?.detectSilentFailures === 'function');

    logTest('trustKillerHandlers exports registerTrustKillerHandlers', typeof trustKillerHandlers?.registerTrustKillerHandlers === 'function');

    logTest('healthCheck exports HealthCheckEngine', typeof healthCheck?.HealthCheckEngine === 'function');

    logTest('backupManager exports BackupManager', typeof backupManager?.BackupManager === 'function');

    logTest('syncReliabilityTest exports runAllSyncTests', typeof syncReliabilityTest?.runAllSyncTests === 'function');
    logTest('syncReliabilityTest exports runLoadTest', typeof syncReliabilityTest?.runLoadTest === 'function');

    // Test 3: Database schema validation
    console.log('\n🗄️  DATABASE SCHEMA TESTS');
    console.log('-'.repeat(80));

    try {
        const db = mainDb.db;
        
        // Check operation_log table exists
        const opLogSchema = db.prepare("PRAGMA table_info(operation_log)").all();
        logTest('operation_log table exists and has columns', Array.isArray(opLogSchema) && opLogSchema.length > 0);
        
        // Check backup_log table exists
        const backupLogSchema = db.prepare("PRAGMA table_info(backup_log)").all();
        logTest('backup_log table exists and has columns', Array.isArray(backupLogSchema) && backupLogSchema.length > 0);
        
        // Check that operation_log has required columns
        const opLogColumns = opLogSchema.map(col => col.name);
        logTest('operation_log has op_id column', opLogColumns.includes('op_id'));
        logTest('operation_log has status column', opLogColumns.includes('status'));
        logTest('operation_log has operation_type column', opLogColumns.includes('operation_type'));
        
        // Check that backup_log has required columns
        const backupLogColumns = backupLogSchema.map(col => col.name);
        logTest('backup_log has backup_file column', backupLogColumns.includes('backup_file'));
        logTest('backup_log has status column', backupLogColumns.includes('status'));
        
    } catch (err) {
        logTest('Database schema validation', false, err);
    }

    // Test 4: Data integrity operations
    console.log('\n🔐 DATA INTEGRITY TESTS');
    console.log('-'.repeat(80));

    try {
        // Test that operation logging doesn't crash on initialization
        dataIntegrity.initializeOperationLogging();
        logTest('initializeOperationLogging() runs without error', true);
    } catch (err) {
        logTest('initializeOperationLogging() runs without error', false, err);
    }

    try {
        // Test that we can detect silent failures without crashing
        const result = dataIntegrity.detectSilentFailures();
        logTest('detectSilentFailures() returns result', result !== undefined);
    } catch (err) {
        logTest('detectSilentFailures() returns result', false, err);
    }

    try {
        // Test that data integrity verification runs
        const result = dataIntegrity.verifyDataIntegrity();
        logTest('verifyDataIntegrity() returns result', result !== undefined);
    } catch (err) {
        logTest('verifyDataIntegrity() returns result', false, err);
    }

    // Test 5: Health check operations
    console.log('\n❤️  HEALTH CHECK TESTS');
    console.log('-'.repeat(80));

    try {
        const engine = new healthCheck.HealthCheckEngine();
        const result = await engine.runAll();
        logTest('healthCheck.runAll() executes without error', result !== undefined);
    } catch (err) {
        logTest('healthCheck.runAll() executes without error', false, err);
    }

    // Test 6: Backup manager operations
    console.log('\n💾 BACKUP MANAGER TESTS');
    console.log('-'.repeat(80));

    try {
        const backupMgr = new backupManager.BackupManager();
        backupMgr.scheduleBackupDrill();
        logTest('backupManager.scheduleBackupDrill() runs without error', true);
    } catch (err) {
        logTest('backupManager.scheduleBackupDrill() runs without error', false, err);
    }

    try {
        const backupMgr = new backupManager.BackupManager();
        const backups = backupMgr.listBackups();
        logTest('backupManager.listBackups() returns result', Array.isArray(backups));
    } catch (err) {
        logTest('backupManager.listBackups() returns result', false, err);
    }

    // Test 7: No conflicts with existing code
    console.log('\n🔄 COMPATIBILITY TESTS');
    console.log('-'.repeat(80));

    try {
        // Verify existing main_db still works
        const tasks = await mainDb.fetchTasks();
        logTest('main_db.fetchTasks() still works', Array.isArray(tasks));
    } catch (err) {
        logTest('main_db.fetchTasks() still works', false, err);
    }

    try {
        // Verify we can still get sync meta
        const deviceId = mainDb.getDeviceId();
        logTest('main_db.getDeviceId() still works', typeof deviceId === 'string');
    } catch (err) {
        logTest('main_db.getDeviceId() still works', false, err);
    }

    try {
        // Verify we can set sync meta
        mainDb.setSyncMeta('test_key', 'test_value');
        const value = mainDb.getSyncMeta('test_key');
        logTest('main_db setSyncMeta/getSyncMeta still work', value === 'test_value');
    } catch (err) {
        logTest('main_db setSyncMeta/getSyncMeta still work', false, err);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log(`📊 TEST SUMMARY`);
    console.log('='.repeat(80));
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log(`📈 Total: ${testsPassed + testsFailed}`);
    console.log(`🎯 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(80));

    if (testsFailed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! 🎉');
        console.log('\n✅ Trust Killer Framework is fully integrated and ready for deployment!');
        process.exit(0);
    } else {
        console.log(`\n⚠️  ${testsFailed} test(s) failed. Please review the errors above.`);
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Critical error running integration tests:', err);
    process.exit(1);
});
