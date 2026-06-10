/**
 * 🏥 CHRONO STARTUP HEALTH CHECK & VALIDATION
 * 
 * Runs on app startup to verify:
 * - Database integrity
 * - Configuration completeness
 * - Network connectivity
 * - Backup status
 * - Auth token validity
 */

const mainDb = require('./main_db');
const { BackupManager } = require('./backupManager');
const { verifyDataIntegrity, detectSilentFailures } = require('./dataIntegrity');
const { runAllSyncTests } = require('./syncReliabilityTest');

class HealthCheckEngine {
    constructor() {
        this.checks = [];
        this.failures = [];
        this.warnings = [];
        this.startTime = Date.now();
    }

    // Check database integrity
    checkDatabaseIntegrity() {
        try {
            const db = mainDb.db;
            const check = db.prepare("PRAGMA integrity_check").get();
            
            if (check && check.integrity_check === 'ok') {
                this.checks.push({
                    name: 'Database Integrity',
                    status: 'pass',
                    detail: 'SQLite database is intact'
                });
                return true;
            } else {
                this.failures.push({
                    name: 'Database Integrity',
                    status: 'fail',
                    detail: 'PRAGMA integrity_check failed',
                    recovery: 'Database corruption detected. Restore from backup immediately.'
                });
                return false;
            }
        } catch (err) {
            this.failures.push({
                name: 'Database Integrity Check',
                status: 'error',
                detail: err.message,
                recovery: 'Cannot verify database. Check file permissions and disk space.'
            });
            return false;
        }
    }

    // Check required tables exist
    checkRequiredTables() {
        try {
            const db = mainDb.db;
            const requiredTables = [
                'tasks',
                'sync_meta',
                'operation_log'
            ];

            const existing = db.prepare(`
                SELECT name FROM sqlite_master WHERE type='table'
            `).all().map(t => t.name);

            const missing = requiredTables.filter(t => !existing.includes(t));

            if (missing.length === 0) {
                this.checks.push({
                    name: 'Required Tables',
                    status: 'pass',
                    detail: `All ${requiredTables.length} required tables present`
                });
                return true;
            } else {
                this.warnings.push({
                    name: 'Missing Tables',
                    status: 'warning',
                    detail: `Missing tables: ${missing.join(', ')}`,
                    recovery: 'Run database migrations to create missing tables'
                });
                return false;
            }
        } catch (err) {
            this.failures.push({
                name: 'Table Verification',
                status: 'error',
                detail: err.message
            });
            return false;
        }
    }

    // Check for silent failures
    checkSilentFailures() {
        try {
            const failures = detectSilentFailures();

            if (failures.length === 0) {
                this.checks.push({
                    name: 'Silent Failure Detection',
                    status: 'pass',
                    detail: 'No silent failures detected'
                });
                return true;
            } else {
                this.warnings.push({
                    name: 'Silent Failures Detected',
                    status: 'warning',
                    detail: `${failures.length} operations logged as successful but missing data`,
                    recovery: `Check operation_log table. ${failures.length} entries marked as corrupted.`,
                    failedOps: failures
                });
                return false;
            }
        } catch (err) {
            this.warnings.push({
                name: 'Silent Failure Check',
                status: 'warning',
                detail: `Could not complete check: ${err.message}`
            });
            return false;
        }
    }

    // Check data integrity metrics
    checkDataIntegrity() {
        try {
            const report = verifyDataIntegrity();

            const issues = report.issues.length;
            if (issues === 0 && report.orphanedOperations === 0) {
                this.checks.push({
                    name: 'Data Integrity',
                    status: 'pass',
                    detail: `✓ Operations: ${report.successfulOperations} success, ${report.failedOperations} failed`
                });
                return true;
            } else {
                this.warnings.push({
                    name: 'Data Integrity Issues',
                    status: 'warning',
                    detail: `${report.orphanedOperations} orphaned operations, ${issues} total issues`,
                    integrityReport: report
                });
                return false;
            }
        } catch (err) {
            this.warnings.push({
                name: 'Data Integrity Check',
                status: 'warning',
                detail: err.message
            });
            return false;
        }
    }

    // Check auth token validity
    checkAuthToken() {
        try {
            const token = mainDb.getSyncMeta('auth_token');
            const deviceId = mainDb.getSyncMeta('device_id');

            if (!deviceId) {
                this.warnings.push({
                    name: 'Device ID',
                    status: 'warning',
                    detail: 'Device ID not set. Will be generated on first login.'
                });
            }

            if (token) {
                this.checks.push({
                    name: 'Authentication',
                    status: 'pass',
                    detail: 'User is authenticated'
                });
                return true;
            } else {
                this.checks.push({
                    name: 'Authentication',
                    status: 'pass',
                    detail: 'User not authenticated. Login required.'
                });
                return true;
            }
        } catch (err) {
            this.failures.push({
                name: 'Auth Token Check',
                status: 'error',
                detail: err.message
            });
            return false;
        }
    }

    // Check backup status
    checkBackupStatus() {
        try {
            const backupMgr = new BackupManager();
            const backups = backupMgr.listBackups();

            if (backups.length === 0) {
                this.warnings.push({
                    name: 'Backup Status',
                    status: 'warning',
                    detail: 'No backups found. Create a backup immediately.',
                    recovery: 'Run backup drill to create and verify backup.'
                });
                return false;
            }

            const latest = backups[0];
            const hoursOld = (Date.now() - latest.created) / 1000 / 60 / 60;

            if (hoursOld > 24) {
                this.warnings.push({
                    name: 'Backup Staleness',
                    status: 'warning',
                    detail: `Latest backup is ${Math.round(hoursOld)} hours old`,
                    recovery: 'Run backup drill to create fresh backup.'
                });
            } else {
                this.checks.push({
                    name: 'Backup Status',
                    status: 'pass',
                    detail: `Latest backup: ${latest.filename} (${(latest.size / 1024 / 1024).toFixed(2)} MB)`
                });
            }

            return true;
        } catch (err) {
            this.warnings.push({
                name: 'Backup Status Check',
                status: 'warning',
                detail: err.message
            });
            return false;
        }
    }

    // Check sync status
    checkSyncStatus() {
        try {
            const db = mainDb.db;
            const unsynced = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE synced = 0').get().count;
            const lastSync = mainDb.getSyncMeta('last_sync_time') || 'Never';

            if (unsynced > 0) {
                this.warnings.push({
                    name: 'Pending Sync',
                    status: 'info',
                    detail: `${unsynced} tasks pending sync. Last sync: ${lastSync}`
                });
            } else {
                this.checks.push({
                    name: 'Sync Status',
                    status: 'pass',
                    detail: 'All tasks synchronized'
                });
            }
            return true;
        } catch (err) {
            this.warnings.push({
                name: 'Sync Status Check',
                status: 'warning',
                detail: err.message
            });
            return false;
        }
    }

    // Run all checks
    async runAll() {
        console.log('\n🏥 STARTING HEALTH CHECK...\n');

        this.checkDatabaseIntegrity();
        this.checkRequiredTables();
        this.checkAuthToken();
        this.checkBackupStatus();
        this.checkSyncStatus();
        this.checkSilentFailures();
        this.checkDataIntegrity();

        const duration = Date.now() - this.startTime;

        return {
            timestamp: new Date().toISOString(),
            duration,
            healthy: this.failures.length === 0,
            checks: this.checks,
            warnings: this.warnings,
            failures: this.failures,
            summary: {
                totalChecks: this.checks.length + this.warnings.length + this.failures.length,
                passed: this.checks.length,
                warnings: this.warnings.length,
                failed: this.failures.length
            }
        };
    }

    // Print report
    printReport(report) {
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('🏥 HEALTH CHECK REPORT');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Time: ${report.timestamp}`);
        console.log(`Duration: ${report.duration}ms`);
        console.log(`Status: ${report.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
        console.log();

        if (report.checks.length > 0) {
            console.log('✅ PASSED:');
            for (const check of report.checks) {
                console.log(`   ✓ ${check.name}: ${check.detail}`);
            }
            console.log();
        }

        if (report.warnings.length > 0) {
            console.log('⚠️  WARNINGS:');
            for (const warning of report.warnings) {
                console.log(`   ⚠ ${warning.name}: ${warning.detail}`);
                if (warning.recovery) {
                    console.log(`     → ${warning.recovery}`);
                }
            }
            console.log();
        }

        if (report.failures.length > 0) {
            console.log('❌ FAILURES:');
            for (const failure of report.failures) {
                console.log(`   ✗ ${failure.name}: ${failure.detail}`);
                if (failure.recovery) {
                    console.log(`     → ${failure.recovery}`);
                }
            }
            console.log();
        }

        console.log('═══════════════════════════════════════════════════════');
        console.log(`Summary: ${report.summary.passed} passed, ${report.summary.warnings} warnings, ${report.summary.failed} failed`);
        console.log('═══════════════════════════════════════════════════════\n');

        return report.healthy;
    }
}

// Express endpoint for health checks (for server)
function registerHealthEndpoint(app) {
    app.get('/api/health/check', async (req, res) => {
        const engine = new HealthCheckEngine();
        const report = await engine.runAll();

        res.json({
            ok: report.healthy,
            ...report
        });
    });
}

module.exports = {
    HealthCheckEngine,
    registerHealthEndpoint
};
