/**
 * 🔌 CHRONO IPC HANDLERS FOR TRUST & RELIABILITY
 * 
 * Ensures all operations have visible success/failure to user
 * Prevents silent failures by making every result explicit
 * 
 * Add to main.js ipcMain handlers
 */

const { ipcMain } = require('electron');
const dataIntegrity = require('./dataIntegrity');
const { BackupManager } = require('./backupManager');
const { runAllSyncTests, runLoadTest } = require('./syncReliabilityTest');
const { HealthCheckEngine } = require('./healthCheck');

function registerTrustKillerHandlers() {
    // ═══════════════════════════════════════════════════════════
    // TIER 1: TRUST KILLER #1 - Data Disappears
    // ═══════════════════════════════════════════════════════════

    // Create task with explicit result
    ipcMain.handle('createTask', async (event, taskData) => {
        try {
            const result = dataIntegrity.createTaskWithLogging(taskData);
            
            return {
                success: result.success,
                taskId: result.taskId,
                opId: result.opId,
                error: result.error,
                message: result.success 
                    ? `✅ Task created successfully (${result.taskId})`
                    : `❌ Failed to create task: ${result.error}`
            };
        } catch (err) {
            return {
                success: false,
                error: err.message,
                message: `❌ Critical error: ${err.message}`,
                recommendation: 'Please report this error to founder'
            };
        }
    });

    // Update task with explicit result
    ipcMain.handle('updateTask', async (event, taskId, updates) => {
        try {
            const result = dataIntegrity.updateTaskWithLogging(taskId, updates);
            
            return {
                success: result.success,
                taskId: result.taskId,
                opId: result.opId,
                error: result.error,
                message: result.success
                    ? `✅ Task updated successfully`
                    : `❌ Failed to update task: ${result.error}`
            };
        } catch (err) {
            return {
                success: false,
                error: err.message,
                message: `❌ Critical error: ${err.message}`
            };
        }
    });

    // Delete task with explicit result
    ipcMain.handle('deleteTask', async (event, taskId) => {
        try {
            const result = dataIntegrity.deleteTaskWithLogging(taskId);
            
            return {
                success: result.success,
                taskId: result.taskId,
                opId: result.opId,
                error: result.error,
                message: result.success
                    ? `✅ Task deleted successfully`
                    : `❌ Failed to delete task: ${result.error}`
            };
        } catch (err) {
            return {
                success: false,
                error: err.message,
                message: `❌ Critical error: ${err.message}`
            };
        }
    });

    // Check for silent failures
    ipcMain.handle('checkSilentFailures', async (event) => {
        try {
            const failures = dataIntegrity.detectSilentFailures();
            
            return {
                success: true,
                count: failures.length,
                failures,
                message: failures.length === 0
                    ? '✅ No silent failures detected'
                    : `⚠️ ${failures.length} silent failures detected. Data integrity compromised.`
            };
        } catch (err) {
            return {
                success: false,
                error: err.message,
                message: `❌ Could not check for silent failures: ${err.message}`
            };
        }
    });

    // Get operation history
    ipcMain.handle('getOperationHistory', async (event, entityType, entityId, limit) => {
        try {
            const history = dataIntegrity.getOperationHistory(entityType, entityId, limit);
            
            return {
                success: true,
                count: history.length,
                operations: history,
                message: `Retrieved ${history.length} operations`
            };
        } catch (err) {
            return {
                success: false,
                error: err.message
            };
        }
    });

    // ═══════════════════════════════════════════════════════════
    // TIER 1: TRUST KILLER #1 - Backup & Recovery
    // ═══════════════════════════════════════════════════════════

    // Create backup with verification
    ipcMain.handle('createBackup', async (event, label = 'manual') => {
        try {
            const backupMgr = new BackupManager();
            const result = backupMgr.createLocalBackup(label);
            
            if (!result.success) {
                return {
                    success: false,
                    error: result.error,
                    message: `❌ Backup failed: ${result.error}`
                };
            }

            // Verify immediately
            const verifyResult = backupMgr.verifyBackup(result.filename);
            
            return {
                success: verifyResult.success,
                filename: result.filename,
                size: result.size,
                tables: verifyResult.tables,
                rows: verifyResult.rows,
                message: verifyResult.success
                    ? `✅ Backup created and verified: ${result.filename}`
                    : `⚠️ Backup created but verification failed`
            };
        } catch (err) {
            return {
                success: false,
                error: err.message,
                message: `❌ Critical error: ${err.message}`
            };
        }
    });

    // Run backup drill
    ipcMain.handle('runBackupDrill', async (event) => {
        try {
            const backupMgr = new BackupManager();
            const result = backupMgr.runBackupDrill('scheduled');
            
            return {
                success: result.success,
                filename: result.steps.create?.filename,
                message: result.success
                    ? `✅ Backup drill PASSED: Create → Verify → Restore all successful`
                    : `❌ Backup drill FAILED at step ${Object.keys(result.steps).find(k => !result.steps[k].success)}`,
                steps: result.steps
            };
        } catch (err) {
            return {
                success: false,
                error: err.message,
                message: `❌ Critical error in backup drill: ${err.message}`
            };
        }
    });

    // List backups
    ipcMain.handle('listBackups', async (event) => {
        try {
            const backupMgr = new BackupManager();
            const backups = backupMgr.listBackups();
            
            return {
                success: true,
                count: backups.length,
                backups,
                message: `Found ${backups.length} backups`
            };
        } catch (err) {
            return {
                success: false,
                error: err.message
            };
        }
    });

    // ═══════════════════════════════════════════════════════════
    // TIER 2: SYNC RELIABILITY TESTING
    // ═══════════════════════════════════════════════════════════

    // Run sync reliability tests
    ipcMain.handle('runSyncTests', async (event) => {
        try {
            const result = runAllSyncTests();
            
            return {
                success: true,
                summary: result.summary,
                details: result.details,
                message: `Sync tests complete: ${result.summary.passed} passed, ${result.summary.failed} failed`
            };
        } catch (err) {
            return {
                success: false,
                error: err.message,
                message: `❌ Sync tests failed: ${err.message}`
            };
        }
    });

    // Run load test
    ipcMain.handle('runLoadTest', async (event, taskCount = 1000) => {
        try {
            const result = runLoadTest(taskCount, 10);
            
            return {
                success: true,
                tasksCreated: result.passed,
                duration: result.duration,
                message: `Load test complete: Created ${result.passed} tasks in ${result.duration}ms`
            };
        } catch (err) {
            return {
                success: false,
                error: err.message,
                message: `❌ Load test failed: ${err.message}`
            };
        }
    });

    // ═══════════════════════════════════════════════════════════
    // MONITORING: HEALTH CHECKS
    // ═══════════════════════════════════════════════════════════

    // Run comprehensive health check
    ipcMain.handle('runHealthCheck', async (event) => {
        try {
            const engine = new HealthCheckEngine();
            const report = await engine.runAll();
            
            return {
                success: true,
                healthy: report.healthy,
                ...report,
                message: report.healthy
                    ? `✅ System HEALTHY: ${report.summary.passed} checks passed`
                    : `❌ System UNHEALTHY: ${report.summary.failed} checks failed`
            };
        } catch (err) {
            return {
                success: false,
                error: err.message,
                message: `❌ Health check failed: ${err.message}`
            };
        }
    });

    // Get data integrity report
    ipcMain.handle('getIntegrityReport', async (event) => {
        try {
            const report = dataIntegrity.verifyDataIntegrity();
            
            return {
                success: true,
                ...report,
                message: report.orphanedOperations === 0
                    ? `✅ Data integrity OK: ${report.successfulOperations} successful operations`
                    : `⚠️ Data integrity issues: ${report.orphanedOperations} orphaned operations`
            };
        } catch (err) {
            return {
                success: false,
                error: err.message
            };
        }
    });

    console.log('✅ Trust Killer IPC handlers registered');
}

module.exports = {
    registerTrustKillerHandlers
};
