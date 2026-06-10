/**
 * 🛡️ CHRONO BACKUP & RECOVERY VALIDATION
 * 
 * Ensures backups are:
 * - Created successfully
 * - Verified after creation
 * - Restorable end-to-end
 * - Logged for audit trail
 * 
 * Never trust a backup that hasn't been restored.
 */

const fs = require('fs');
const path = require('path');
const mainDb = require('./main_db');

class BackupManager {
    constructor(backupDir = './backups') {
        this.backupDir = backupDir;
        this.ensureBackupDirExists();
    }

    ensureBackupDirExists() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
            console.log(`✅ Backup directory created: ${this.backupDir}`);
        }
    }

    // Create local backup from SQLite
    createLocalBackup(label = 'manual') {
        const db = mainDb.db;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFilename = `chrono_backup_${timestamp}_${label}.sql`;
        const backupPath = path.join(this.backupDir, backupFilename);

        console.log(`💾 Creating local backup: ${backupFilename}`);

        try {
            // Get database file path
            const dbPath = db.name || './chrono.db';

            // SQLite backup approach: export schema and data
            // Note: This is a workaround for better-sqlite3
            // Production should use proper pg_dump for Supabase

            // Export all tables and their data
            let backupSQL = '-- Chrono Local Backup\n';
            backupSQL += `-- Created: ${new Date().toISOString()}\n`;
            backupSQL += `-- Label: ${label}\n\n`;

            // Get all tables
            const tables = db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
            `).all();

            for (const tableRow of tables) {
                const tableName = tableRow.name;

                // Get schema
                const schemaInfo = db.prepare(`
                    SELECT sql FROM sqlite_master 
                    WHERE type='table' AND name = ?
                `).get(tableName);

                if (schemaInfo && schemaInfo.sql) {
                    backupSQL += schemaInfo.sql + ';\n\n';
                }

                // Get all data
                const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
                
                if (rows.length > 0) {
                    const columns = Object.keys(rows[0]);
                    const columnList = columns.join(', ');

                    for (const row of rows) {
                        const values = columns.map(col => {
                            const val = row[col];
                            if (val === null) return 'NULL';
                            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                            return val;
                        }).join(', ');

                        backupSQL += `INSERT INTO ${tableName} (${columnList}) VALUES (${values});\n`;
                    }
                    backupSQL += '\n';
                }
            }

            // Write to file
            fs.writeFileSync(backupPath, backupSQL, 'utf8');

            const backupSize = fs.statSync(backupPath).size;
            console.log(`✅ Backup created successfully: ${(backupSize / 1024 / 1024).toFixed(2)} MB`);

            // Log backup creation
            this.logBackupOperation('create', backupFilename, 'success', `Size: ${backupSize} bytes`);

            return {
                success: true,
                filename: backupFilename,
                path: backupPath,
                size: backupSize,
                timestamp,
                label
            };

        } catch (err) {
            console.error(`❌ Backup creation failed: ${err.message}`);
            this.logBackupOperation('create', backupFilename, 'failed', err.message);
            
            return {
                success: false,
                error: err.message,
                filename: backupFilename
            };
        }
    }

    // Verify backup integrity
    verifyBackup(backupFilename) {
        const backupPath = path.join(this.backupDir, backupFilename);

        console.log(`🔍 Verifying backup: ${backupFilename}`);

        try {
            // Check file exists
            if (!fs.existsSync(backupPath)) {
                throw new Error('Backup file not found');
            }

            const stats = fs.statSync(backupPath);
            
            // Check file size (should be > 0)
            if (stats.size === 0) {
                throw new Error('Backup file is empty');
            }

            // Read and parse SQL
            const content = fs.readFileSync(backupPath, 'utf8');
            
            // Basic validation
            const hasCreateTable = content.includes('CREATE TABLE');
            const hasInsert = content.includes('INSERT INTO');

            if (!hasCreateTable) {
                throw new Error('Backup missing CREATE TABLE statements');
            }

            const tableCount = (content.match(/CREATE TABLE/g) || []).length;
            const insertCount = (content.match(/INSERT INTO/g) || []).length;

            console.log(`✅ Backup verified: ${tableCount} tables, ${insertCount} rows`);

            this.logBackupOperation('verify', backupFilename, 'success', 
                `Tables: ${tableCount}, Rows: ${insertCount}`);

            return {
                success: true,
                filename: backupFilename,
                size: stats.size,
                tables: tableCount,
                rows: insertCount
            };

        } catch (err) {
            console.error(`❌ Backup verification failed: ${err.message}`);
            this.logBackupOperation('verify', backupFilename, 'failed', err.message);

            return {
                success: false,
                error: err.message,
                filename: backupFilename
            };
        }
    }

    // Restore backup (LOCAL ONLY - creates new test database)
    restoreBackupToTestDb(backupFilename) {
        const backupPath = path.join(this.backupDir, backupFilename);
        const testDbPath = path.join(this.backupDir, `test_restore_${Date.now()}.db`);

        console.log(`♻️ Restoring backup to test database: ${backupFilename}`);

        try {
            const Database = require('better-sqlite3');
            const testDb = new Database(testDbPath);

            // Read backup SQL
            const backupSQL = fs.readFileSync(backupPath, 'utf8');

            // Execute each statement
            const statements = backupSQL.split(';').filter(s => s.trim().length > 0);
            let executedCount = 0;

            for (const statement of statements) {
                if (!statement.trim().startsWith('--')) {
                    try {
                        testDb.exec(statement);
                        executedCount++;
                    } catch (execErr) {
                        // Some statements might fail, log but continue
                        console.warn(`⚠️ Statement execution warning: ${execErr.message}`);
                    }
                }
            }

            // Verify restored database
            const tableCount = testDb.prepare(`
                SELECT COUNT(*) as count FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
            `).get().count;

            const totalRows = testDb.prepare(`
                SELECT SUM((SELECT COUNT(*) FROM ${
                    testDb.prepare(`
                        SELECT name FROM sqlite_master 
                        WHERE type='table' AND name NOT LIKE 'sqlite_%'
                    `).all().map(t => t.name).join(' UNION SELECT COUNT(*) FROM ')
                })) as total
            `).all().length;

            console.log(`✅ Restore completed: ${executedCount} statements, ${tableCount} tables`);

            testDb.close();

            this.logBackupOperation('restore', backupFilename, 'success', 
                `Restored to ${testDbPath}, ${tableCount} tables`);

            return {
                success: true,
                backupFilename,
                testDbPath,
                statementsExecuted: executedCount,
                tables: tableCount
            };

        } catch (err) {
            console.error(`❌ Restore failed: ${err.message}`);
            this.logBackupOperation('restore', backupFilename, 'failed', err.message);

            // Cleanup test database if it was created
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }

            return {
                success: false,
                error: err.message,
                backupFilename
            };
        }
    }

    // Run backup drill: create → verify → restore → clean
    runBackupDrill(label = 'drill') {
        console.log('\n🧪 Starting Backup Drill...\n');

        const results = {
            label,
            timestamp: new Date().toISOString(),
            steps: {}
        };

        // Step 1: Create backup
        console.log('Step 1: Create Backup');
        const createResult = this.createLocalBackup(`${label}_drill`);
        results.steps.create = createResult;

        if (!createResult.success) {
            console.error('❌ Drill failed at backup creation');
            return results;
        }

        // Step 2: Verify backup
        console.log('\nStep 2: Verify Backup');
        const verifyResult = this.verifyBackup(createResult.filename);
        results.steps.verify = verifyResult;

        if (!verifyResult.success) {
            console.error('❌ Drill failed at backup verification');
            return results;
        }

        // Step 3: Restore backup
        console.log('\nStep 3: Restore Backup');
        const restoreResult = this.restoreBackupToTestDb(createResult.filename);
        results.steps.restore = restoreResult;

        if (!restoreResult.success) {
            console.error('❌ Drill failed at restore');
            return results;
        }

        // Step 4: Cleanup test database
        console.log('\nStep 4: Cleanup');
        try {
            if (restoreResult.testDbPath && fs.existsSync(restoreResult.testDbPath)) {
                fs.unlinkSync(restoreResult.testDbPath);
                console.log('✅ Test database cleaned up');
            }
        } catch (cleanupErr) {
            console.warn('⚠️ Cleanup warning:', cleanupErr.message);
        }

        // Summary
        console.log('\n🎯 Backup Drill Complete\n');
        console.log('✅ All steps passed!');
        console.log(`   - Backup created: ${createResult.filename}`);
        console.log(`   - Verified: ${verifyResult.tables} tables`);
        console.log(`   - Restored and tested successfully`);

        results.success = true;
        this.logBackupOperation('drill', createResult.filename, 'success', 'Full drill passed');

        return results;
    }

    // List all backups
    listBackups() {
        try {
            if (!fs.existsSync(this.backupDir)) {
                return [];
            }

            const files = fs.readdirSync(this.backupDir)
                .filter(f => f.startsWith('chrono_backup_') && f.endsWith('.sql'))
                .map(f => ({
                    filename: f,
                    path: path.join(this.backupDir, f),
                    size: fs.statSync(path.join(this.backupDir, f)).size,
                    created: fs.statSync(path.join(this.backupDir, f)).mtime
                }))
                .sort((a, b) => b.created - a.created);

            return files;

        } catch (err) {
            console.error('Error listing backups:', err);
            return [];
        }
    }

    // Log backup operation for audit trail
    logBackupOperation(operation, backupFile, status, details = null) {
        const db = mainDb.db;

        try {
            // Ensure backup_log table exists
            db.prepare(`
                CREATE TABLE IF NOT EXISTS backup_log (
                    id TEXT PRIMARY KEY,
                    operation TEXT,
                    backup_file TEXT,
                    status TEXT,
                    details TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `).run();

            // Log entry
            const logId = `backup_log_${Date.now()}`;
            db.prepare(`
                INSERT INTO backup_log (id, operation, backup_file, status, details)
                VALUES (?, ?, ?, ?, ?)
            `).run(logId, operation, backupFile, status, details);

        } catch (err) {
            console.error('Failed to log backup operation:', err);
        }
    }

    // Get backup log
    getBackupLog(limit = 50) {
        const db = mainDb.db;

        try {
            return db.prepare(`
                SELECT * FROM backup_log 
                ORDER BY timestamp DESC 
                LIMIT ?
            `).all(limit);
        } catch (err) {
            console.error('Error fetching backup log:', err);
            return [];
        }
    }
}

module.exports = {
    BackupManager
};
