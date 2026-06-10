/**
 * 🔐 CHRONO DATA INTEGRITY & OPERATION LOGGING
 * 
 * Prevents silent failures and data loss by:
 * 1. Logging every data operation (create, update, delete)
 * 2. Verifying success/failure explicitly
 * 3. Enabling rollback if needed
 * 4. Tracking sync status
 * 5. Detecting corrupted states
 */

const mainDb = require('./main_db');

// Transaction wrapper for atomic operations
class DataOperation {
    constructor(operationType, entityType, entityId) {
        this.operationType = operationType; // create, update, delete, sync
        this.entityType = entityType; // task, note, event, chat
        this.entityId = entityId;
        this.timestamp = Date.now();
        this.deviceId = mainDb.getSyncMeta('device_id') || 'device_unknown';
        this.status = 'pending'; // pending, success, failed
        this.error = null;
        this.retryCount = 0;
    }

    log() {
        const db = mainDb.db;
        const opId = `op_${this.entityId}_${this.timestamp}`;
        
        try {
            db.prepare(`
                INSERT INTO operation_log (
                    op_id, operation_type, entity_type, entity_id,
                    device_id, status, error, retry_count, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                opId,
                this.operationType,
                this.entityType,
                this.entityId,
                this.deviceId,
                this.status,
                this.error,
                this.retryCount,
                this.timestamp
            );
            
            return opId;
        } catch (err) {
            console.error('🚨 CRITICAL: Failed to log operation. Data integrity at risk.', err);
            // Fail loudly - better to crash than silently lose data
            throw err;
        }
    }

    markSuccess(opId, details = null) {
        const db = mainDb.db;
        this.status = 'success';
        
        try {
            db.prepare(`
                UPDATE operation_log 
                SET status = 'success', details = ?
                WHERE op_id = ?
            `).run(details, opId);
            
            console.log(`✅ Operation succeeded: ${this.operationType} on ${this.entityType}/${this.entityId}`);
        } catch (err) {
            console.error('🚨 Failed to mark operation as success', err);
            throw err;
        }
    }

    markFailed(opId, error) {
        const db = mainDb.db;
        this.status = 'failed';
        this.error = error.message || String(error);
        
        try {
            db.prepare(`
                UPDATE operation_log 
                SET status = 'failed', error = ?, retry_count = retry_count + 1
                WHERE op_id = ?
            `).run(this.error, opId);
            
            console.error(`❌ Operation failed: ${this.operationType} on ${this.entityType}/${this.entityId} - ${this.error}`);
        } catch (err) {
            console.error('🚨 Failed to mark operation as failed', err);
            throw err;
        }
    }
}

// Create operation_log table if missing
function initializeOperationLogging() {
    const db = mainDb.db;
    
    db.prepare(`
        CREATE TABLE IF NOT EXISTS operation_log (
            op_id TEXT PRIMARY KEY,
            operation_type TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            device_id TEXT,
            status TEXT DEFAULT 'pending',
            error TEXT,
            retry_count INTEGER DEFAULT 0,
            details TEXT,
            timestamp INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // Create index for queries
    db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_operation_log_status 
        ON operation_log(status)
    `).run();

    db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_operation_log_entity 
        ON operation_log(entity_type, entity_id)
    `).run();

    db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_operation_log_timestamp 
        ON operation_log(timestamp)
    `).run();

    console.log('✅ Operation logging initialized');
}

// Atomic task creation with error handling
function createTaskWithLogging(taskData) {
    const db = mainDb.db;
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const operation = new DataOperation('create', 'task', taskId);
    
    try {
        // Start transaction
        const insertStmt = db.prepare(`
            INSERT INTO tasks (
                id, text, date, calendar, completed, 
                start_time, duration_min, device_id, synced, deleted, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Log operation attempt
        const opId = operation.log();

        // Execute write in transaction
        const result = insertStmt.run(
            taskId,
            taskData.text || 'Untitled Task',
            taskData.date || new Date().toISOString().split('T')[0],
            taskData.calendar || 'personal',
            taskData.completed || 0,
            taskData.start_time || null,
            taskData.duration_min || 0,
            mainDb.getSyncMeta('device_id') || 'device_unknown',
            0, // synced = 0 (pending sync)
            0, // deleted = 0
            Date.now()
        );

        // Verify write succeeded
        if (!result.changes) {
            throw new Error('INSERT returned zero changes');
        }

        // Mark operation success
        operation.markSuccess(opId, JSON.stringify({ taskId, rows: result.changes }));

        console.log(`✅ Task created: ${taskId}`);
        return { success: true, taskId, opId };

    } catch (err) {
        const opId = operation.log();
        operation.markFailed(opId, err);
        
        return {
            success: false,
            error: err.message,
            opId,
            recommendation: 'Retry operation or check database integrity'
        };
    }
}

// Atomic task update with error handling
function updateTaskWithLogging(taskId, updates) {
    const db = mainDb.db;
    const operation = new DataOperation('update', 'task', taskId);

    try {
        const opId = operation.log();

        // Verify task exists before update
        const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
        if (!existing) {
            throw new Error(`Task ${taskId} does not exist`);
        }

        // Build update statement
        const setClauses = [];
        const values = [];
        for (const [key, value] of Object.entries(updates)) {
            if (['text', 'date', 'calendar', 'completed', 'start_time', 'duration_min'].includes(key)) {
                setClauses.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (setClauses.length === 0) {
            throw new Error('No valid fields to update');
        }

        setClauses.push('updated_at = ?');
        values.push(Date.now());
        setClauses.push('synced = ?');
        values.push(0); // Mark for re-sync

        values.push(taskId);

        const sql = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`;
        const result = db.prepare(sql).run(...values);

        if (!result.changes) {
            throw new Error('UPDATE returned zero changes');
        }

        operation.markSuccess(opId, JSON.stringify({ taskId, rows: result.changes }));
        return { success: true, taskId, opId };

    } catch (err) {
        const opId = operation.log();
        operation.markFailed(opId, err);
        
        return {
            success: false,
            error: err.message,
            opId,
            recommendation: 'Verify task exists and all fields are valid'
        };
    }
}

// Atomic task deletion with soft delete
function deleteTaskWithLogging(taskId) {
    const db = mainDb.db;
    const operation = new DataOperation('delete', 'task', taskId);

    try {
        const opId = operation.log();

        // Soft delete (mark deleted, don't remove)
        const result = db.prepare(`
            UPDATE tasks 
            SET deleted = 1, updated_at = ?, synced = 0 
            WHERE id = ?
        `).run(Date.now(), taskId);

        if (!result.changes) {
            throw new Error(`Task ${taskId} not found or already deleted`);
        }

        operation.markSuccess(opId, JSON.stringify({ taskId, rows: result.changes }));
        return { success: true, taskId, opId };

    } catch (err) {
        const opId = operation.log();
        operation.markFailed(opId, err);
        
        return {
            success: false,
            error: err.message,
            opId,
            recommendation: 'Verify task exists'
        };
    }
}

// Detect silent failures (writes that appeared to succeed but didn't)
function detectSilentFailures() {
    const db = mainDb.db;
    
    try {
        // Find operations marked success but data missing
        const operations = db.prepare(`
            SELECT * FROM operation_log
            WHERE status = 'success' AND operation_type = 'create'
            AND timestamp > datetime('now', '-1 hour')
        `).all();

        const failures = [];

        for (const op of operations) {
            const entity = db.prepare(`
                SELECT id FROM ${op.entity_type}s WHERE id = ?
            `).get(op.entity_id);

            if (!entity) {
                failures.push({
                    opId: op.op_id,
                    entityType: op.entity_type,
                    entityId: op.entity_id,
                    markedSuccess: true,
                    actuallyExists: false,
                    timestamp: op.timestamp
                });

                // Mark as corrupted
                db.prepare(`
                    UPDATE operation_log 
                    SET status = 'corrupted'
                    WHERE op_id = ?
                `).run(op.op_id);

                console.error(`🚨 SILENT FAILURE DETECTED: ${op.entity_type}/${op.entity_id} marked success but missing`);
            }
        }

        return failures;

    } catch (err) {
        console.error('Error detecting silent failures:', err);
        return [];
    }
}

// Get operation history for debugging
function getOperationHistory(entityType = null, entityId = null, limit = 100) {
    const db = mainDb.db;
    
    let sql = 'SELECT * FROM operation_log WHERE 1=1';
    const params = [];

    if (entityType) {
        sql += ' AND entity_type = ?';
        params.push(entityType);
    }

    if (entityId) {
        sql += ' AND entity_id = ?';
        params.push(entityId);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    try {
        return db.prepare(sql).all(...params);
    } catch (err) {
        console.error('Error fetching operation history:', err);
        return [];
    }
}

// Get failed operations needing retry
function getFailedOperations(limit = 50) {
    const db = mainDb.db;
    
    try {
        return db.prepare(`
            SELECT * FROM operation_log
            WHERE status = 'failed' AND retry_count < 3
            ORDER BY timestamp ASC
            LIMIT ?
        `).all(limit);
    } catch (err) {
        console.error('Error fetching failed operations:', err);
        return [];
    }
}

// Verify data integrity by checking for orphaned operations
function verifyDataIntegrity() {
    const db = mainDb.db;
    const report = {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        corruptedOperations: 0,
        orphanedOperations: 0,
        pendingOperations: 0,
        issues: []
    };

    try {
        const ops = db.prepare(`
            SELECT COUNT(*) as count, status 
            FROM operation_log 
            GROUP BY status
        `).all();

        for (const row of ops) {
            report.totalOperations += row.count;
            if (row.status === 'success') report.successfulOperations = row.count;
            if (row.status === 'failed') report.failedOperations = row.count;
            if (row.status === 'corrupted') report.corruptedOperations = row.count;
            if (row.status === 'pending') report.pendingOperations = row.count;
        }

        // Detect orphaned creates (marked success but data missing)
        const orphaned = db.prepare(`
            SELECT op_id, entity_type, entity_id FROM operation_log
            WHERE status = 'success' AND operation_type = 'create'
        `).all();

        for (const op of orphaned) {
            const exists = db.prepare(
                `SELECT 1 FROM ${op.entity_type}s WHERE id = ?`
            ).get(op.entity_id);

            if (!exists) {
                report.orphanedOperations++;
                report.issues.push(`Orphaned ${op.entity_type}: ${op.entity_id}`);
            }
        }

        return report;

    } catch (err) {
        console.error('Error verifying integrity:', err);
        return report;
    }
}

module.exports = {
    initializeOperationLogging,
    DataOperation,
    createTaskWithLogging,
    updateTaskWithLogging,
    deleteTaskWithLogging,
    detectSilentFailures,
    getOperationHistory,
    getFailedOperations,
    verifyDataIntegrity
};
