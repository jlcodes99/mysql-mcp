/**
 * MySQL数据库连接和查询模块
 * 支持多种安全模式和灵活的访问控制
 * 
 * Copyright (c) 2025 lijie
 * Licensed under the MIT License.
 */

import mysql from 'mysql2/promise';
import winston from 'winston';
import { getConfigInstance, SecurityMode } from './config.js';

// 配置日志 - 输出到stderr避免污染stdio通道
const logger = winston.createLogger({
    level: 'info', // 支持info级别日志用于查询日志
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}] ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console({
            stderrLevels: ['error', 'warn', 'info', 'verbose', 'debug', 'silly']
        })
    ]
});

/**
 * SQL语句验证器
 */
export class SQLValidator {
    // 只读操作
    static READONLY_OPERATIONS = new Set([
        'SELECT', 'WITH', 'SHOW', 'DESCRIBE', 'EXPLAIN', 'ANALYZE'
    ]);

    // 写入操作
    static WRITE_OPERATIONS = new Set([
        'INSERT', 'UPDATE'
    ]);

    // 危险操作
    static DANGEROUS_OPERATIONS = new Set([
        'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE'
    ]);

    /**
     * 验证SQL语句是否符合当前安全模式
     */
    static validateSql(sql, securityMode) {
        const sqlUpper = sql.toUpperCase().trim();
        const firstKeyword = this.extractFirstKeyword(sqlUpper);

        switch (securityMode) {
            case SecurityMode.READONLY:
                return this.validateReadonly(firstKeyword, sqlUpper);
            case SecurityMode.LIMITED_WRITE:
                return this.validateLimitedWrite(firstKeyword, sqlUpper);
            case SecurityMode.FULL_ACCESS:
                return true; // 完全访问模式允许所有操作
            default:
                return false;
        }
    }

    /**
     * 提取SQL的第一个关键字
     */
    static extractFirstKeyword(sqlUpper) {
        const words = sqlUpper.split(/\s+/);
        return words[0] || '';
    }

    /**
     * 验证只读模式的SQL
     */
    static validateReadonly(firstKeyword, sqlUpper) {
        if (!this.READONLY_OPERATIONS.has(firstKeyword)) {
            return false;
        }

        // 对于SELECT查询，进行更精确的检查
        if (firstKeyword === 'SELECT') {
            const dangerousPatterns = [
                /\bDROP\s+TABLE\b/i,
                /\bTRUNCATE\s+TABLE\b/i,
                /\bDELETE\s+FROM\b/i,
                /\bINSERT\s+INTO\b/i,
                /\bUPDATE\s+\w+\s+SET\b/i,
                /\bCREATE\s+TABLE\b/i,
                /\bALTER\s+TABLE\b/i
            ];

            for (const pattern of dangerousPatterns) {
                if (pattern.test(sqlUpper)) {
                    return false;
                }
            }
        } else {
            // 对于其他只读操作，检查是否包含写入操作的关键字
            const forbiddenOperations = new Set([
                ...this.WRITE_OPERATIONS,
                ...this.DANGEROUS_OPERATIONS
            ]);
            
            for (const forbidden of forbiddenOperations) {
                if (sqlUpper.includes(forbidden)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * 验证限制写入模式的SQL
     */
    static validateLimitedWrite(firstKeyword, sqlUpper) {
        const allowedOperations = new Set([
            ...this.READONLY_OPERATIONS,
            ...this.WRITE_OPERATIONS
        ]);

        if (!allowedOperations.has(firstKeyword)) {
            return false;
        }

        // 检查是否包含危险操作
        for (const dangerous of this.DANGEROUS_OPERATIONS) {
            if (sqlUpper.includes(dangerous)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 获取具体的错误信息
     */
    static getErrorMessage(sql, securityMode) {
        const sqlUpper = sql.toUpperCase().trim();
        const firstKeyword = this.extractFirstKeyword(sqlUpper);

        switch (securityMode) {
            case SecurityMode.READONLY:
                if (this.WRITE_OPERATIONS.has(firstKeyword)) {
                    return `只读模式下禁止写入操作: ${firstKeyword}`;
                } else if (this.DANGEROUS_OPERATIONS.has(firstKeyword)) {
                    return `只读模式下禁止危险操作: ${firstKeyword}`;
                } else {
                    return `只读模式下不支持的操作: ${firstKeyword}`;
                }

            case SecurityMode.LIMITED_WRITE:
                if (this.DANGEROUS_OPERATIONS.has(firstKeyword)) {
                    return `限制写入模式下禁止危险操作: ${firstKeyword}`;
                } else {
                    return `限制写入模式下不支持的操作: ${firstKeyword}`;
                }

            default:
                return '操作被安全策略禁止';
        }
    }
}

/**
 * MySQL数据库操作类
 */
export class MySQLDatabase {
    constructor() {
        this.config = getConfigInstance();
        this.pool = null;
        this.initializePool();
        logger.info(`MySQL数据库服务初始化完成，安全模式: ${this.config.securityMode}`);
    }

    /**
     * 初始化连接池
     */
    initializePool() {
        const connectionConfig = this.config.getConnectionConfig();
        this.pool = mysql.createPool({
            ...connectionConfig,
            connectionLimit: 10,
            queueLimit: 0
        });

        logger.info('MySQL连接池初始化完成');
    }

    /**
     * 获取数据库连接
     */
    async getConnection() {
        try {
            const connection = await this.pool.getConnection();
            
            // 根据安全模式设置事务属性
            if (this.config.isReadonlyMode()) {
                await connection.execute('SET SESSION TRANSACTION READ ONLY');
                logger.info('已设置MySQL数据库连接为只读模式');
            }

            return connection;
        } catch (error) {
            logger.error(`MySQL数据库连接错误: ${error.message}`);
            throw error;
        }
    }

    /**
     * 执行查询语句
     */
    async executeQuery(sql, params = []) {
        // 安全检查：验证SQL是否符合当前安全模式
        if (!SQLValidator.validateSql(sql, this.config.securityMode)) {
            const errorMsg = SQLValidator.getErrorMessage(sql, this.config.securityMode);
            throw new Error(`SQL操作被安全策略禁止: ${errorMsg}`);
        }

        // 记录查询日志（如果启用）
        if (this.config.enableQueryLog) {
            const paramsInfo = params && params.length > 0 ? ` | 参数: [${params.join(', ')}]` : '';
            logger.info(`执行SQL (${this.config.securityMode}): ${sql}${paramsInfo}`);
        }

        // 实现重试逻辑
        let lastError;
        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            let connection;
            try {
                connection = await this.getConnection();
                
                // 设置查询超时
                await connection.execute(`SET SESSION wait_timeout = ${this.config.queryTimeout}`);
                
                const [results] = await connection.execute(sql, params);

                // 对于查询操作，获取结果
                if (/^(SELECT|WITH|SHOW|DESCRIBE|EXPLAIN)/i.test(sql.trim())) {
                    let queryResults = Array.isArray(results) ? results : [results];
                    
                    // 限制返回结果数量
                    if (queryResults.length > this.config.maxResultRows) {
                        logger.warn(`查询结果超过限制(${this.config.maxResultRows})，截断返回`);
                        queryResults = queryResults.slice(0, this.config.maxResultRows);
                    }

                    logger.info(`查询执行成功，返回 ${queryResults.length} 条记录`);
                    return queryResults;
                } else {
                    // 对于非查询操作（INSERT、UPDATE等），返回影响的行数
                    const affectedRows = results.affectedRows || 0;
                    logger.info(`操作执行成功，影响 ${affectedRows} 行`);
                    return [{ affected_rows: affectedRows, status: 'success' }];
                }
            } catch (error) {
                lastError = error;
                logger.warn(`SQL执行失败 (尝试 ${attempt}/${this.config.maxRetries}): ${error.message}`);
                
                // 如果不是最后一次尝试，等待后重试
                if (attempt < this.config.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 递增延迟
                }
            } finally {
                if (connection) {
                    connection.release();
                }
            }
        }
        
        // 所有重试都失败，抛出最后一个错误
        logger.error(`SQL执行失败，已重试 ${this.config.maxRetries} 次: ${lastError.message}`);
        throw lastError;
    }

    /**
     * 执行安全查询（强制只读，用于系统查询）
     */
    async executeSafeQuery(sql, params = []) {
        // 强制验证为只读操作
        if (!SQLValidator.validateSql(sql, SecurityMode.READONLY)) {
            throw new Error('系统查询必须是只读操作');
        }

        return this.executeQuery(sql, params);
    }

    /**
     * 获取所有表信息（适配MySQL数据库）
     */
    async getAllTables(database = null) {
        if (!database) {
            database = this.config.database;
        }

        // 验证数据库是否在允许列表中
        if (!this.isSchemaAllowed(database)) {
            const allowedSchemas = this.getAllowedSchemasDisplay();
            throw new Error(`不允许访问数据库: ${database}，允许的数据库: ${allowedSchemas}`);
        }

        // MySQL查询表信息的SQL
        const sql = `
            SELECT 
                TABLE_SCHEMA AS schemaname,
                TABLE_NAME AS tablename,
                TABLE_TYPE AS tabletype,
                ENGINE AS engine,
                TABLE_ROWS AS row_count,
                TABLE_COMMENT AS table_comment
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = ? 
            ORDER BY TABLE_NAME
        `;
        return this.executeSafeQuery(sql, [database]);
    }

    /**
     * 检查数据库是否被允许访问
     */
    isSchemaAllowed(database) {
        // 如果配置为允许所有数据库
        if (this.config.isAllSchemasAllowed()) {
            return true;
        }

        // 如果配置为自动发现数据库
        if (this.config.isAutoDiscoverSchemas()) {
            // 这里可以实现检查数据库是否存在的逻辑
            return true; // 简化处理
        }

        // 否则检查是否在明确允许的列表中
        return this.config.allowedSchemas.includes(database);
    }

    /**
     * 获取允许的数据库的显示字符串
     */
    getAllowedSchemasDisplay() {
        if (this.config.isAllSchemasAllowed()) {
            return '所有数据库(*)';
        } else if (this.config.isAutoDiscoverSchemas()) {
            return '自动发现(auto)';
        } else {
            return this.config.allowedSchemas.join(', ');
        }
    }

    /**
     * 获取用户有权限访问的所有数据库（适配MySQL）
     */
    async getAvailableSchemas() {
        const sql = `
            SELECT SCHEMA_NAME as schemaname
            FROM INFORMATION_SCHEMA.SCHEMATA 
            WHERE SCHEMA_NAME NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
            ORDER BY SCHEMA_NAME
        `;
        return this.executeSafeQuery(sql);
    }

    /**
     * 获取表结构信息（适配MySQL数据库）
     */
    async getTableStructure(tableName, database = null) {
        if (!database) {
            database = this.config.database;
        }

        // 验证数据库是否在允许列表中
        if (!this.isSchemaAllowed(database)) {
            const allowedSchemas = this.getAllowedSchemasDisplay();
            throw new Error(`不允许访问数据库: ${database}，允许的数据库: ${allowedSchemas}`);
        }

        // MySQL查询表结构的SQL
        const sql = `
            SELECT 
                c.COLUMN_NAME as column_name,
                c.DATA_TYPE as data_type,
                c.CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
                c.NUMERIC_PRECISION as numeric_precision,
                c.NUMERIC_SCALE as numeric_scale,
                c.IS_NULLABLE as is_nullable,
                c.COLUMN_DEFAULT as column_default,
                c.ORDINAL_POSITION as ordinal_position,
                CASE 
                    WHEN c.COLUMN_KEY = 'PRI' THEN 'YES'
                    ELSE 'NO'
                END as is_primary_key,
                c.COLUMN_COMMENT as column_comment
            FROM INFORMATION_SCHEMA.COLUMNS c
            WHERE c.TABLE_NAME = ?
                AND c.TABLE_SCHEMA = ?
            ORDER BY c.ORDINAL_POSITION
        `;
        return this.executeSafeQuery(sql, [tableName, database]);
    }

    /**
     * 获取表索引信息（适配MySQL数据库）
     */
    async getTableIndexes(tableName, database = null) {
        if (!database) {
            database = this.config.database;
        }

        if (!this.isSchemaAllowed(database)) {
            const allowedSchemas = this.getAllowedSchemasDisplay();
            throw new Error(`不允许访问数据库: ${database}，允许的数据库: ${allowedSchemas}`);
        }

        try {
            const sql = `
                SELECT 
                    INDEX_NAME as indexname,
                    CONCAT('CREATE INDEX ', INDEX_NAME, ' ON ', TABLE_NAME, ' (', 
                           GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX), ')') as indexdef,
                    CASE WHEN NON_UNIQUE = 0 THEN 'YES' ELSE 'NO' END as is_unique
                FROM INFORMATION_SCHEMA.STATISTICS 
                WHERE TABLE_NAME = ? 
                    AND TABLE_SCHEMA = ?
                    AND INDEX_NAME != 'PRIMARY'
                GROUP BY INDEX_NAME, NON_UNIQUE
                ORDER BY INDEX_NAME
            `;
            return this.executeSafeQuery(sql, [tableName, database]);
        } catch (error) {
            logger.warn(`获取索引信息失败: ${error.message}`);
            return []; // 返回空数组而不是抛出异常
        }
    }

    /**
     * 获取表约束信息（适配MySQL数据库）
     */
    async getTableConstraints(tableName, database = null) {
        if (!database) {
            database = this.config.database;
        }

        if (!this.isSchemaAllowed(database)) {
            const allowedSchemas = this.getAllowedSchemasDisplay();
            throw new Error(`不允许访问数据库: ${database}，允许的数据库: ${allowedSchemas}`);
        }

        try {
            const sql = `
                SELECT 
                    tc.CONSTRAINT_NAME as constraint_name,
                    tc.CONSTRAINT_TYPE as constraint_type,
                    kcu.COLUMN_NAME as column_name,
                    CASE 
                        WHEN tc.CONSTRAINT_TYPE = 'FOREIGN KEY' THEN
                            CONCAT(kcu.REFERENCED_TABLE_SCHEMA, '.', 
                                   kcu.REFERENCED_TABLE_NAME, '.', 
                                   kcu.REFERENCED_COLUMN_NAME)
                        ELSE NULL
                    END as foreign_key_references
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                    ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                    AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
                    AND tc.TABLE_NAME = kcu.TABLE_NAME
                WHERE tc.TABLE_NAME = ?
                    AND tc.TABLE_SCHEMA = ?
                ORDER BY tc.CONSTRAINT_TYPE, tc.CONSTRAINT_NAME
            `;
            return this.executeSafeQuery(sql, [tableName, database]);
        } catch (error) {
            logger.warn(`获取约束信息失败: ${error.message}`);
            return []; // 返回空数组而不是抛出异常
        }
    }

    /**
     * 测试数据库连接
     */
    async testConnection() {
        try {
            const result = await this.executeSafeQuery('SELECT 1 as test_connection');
            return result.length > 0 && result[0].test_connection === 1;
        } catch (error) {
            logger.error(`连接测试失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 获取当前安全配置信息
     */
    getSecurityInfo() {
        return {
            security_mode: this.config.securityMode,
            allowed_schemas: this.config.allowedSchemas,
            readonly_mode: this.config.isReadonlyMode(),
            write_allowed: this.config.isWriteAllowed(),
            dangerous_operations_allowed: this.config.isDangerousOperationAllowed(),
            max_result_rows: this.config.maxResultRows,
            query_log_enabled: this.config.enableQueryLog
        };
    }

    /**
     * 安全检查：验证当前模式是否允许执行操作
     */
    validateSecurity(allowedModes) {
        if (!allowedModes.includes(this.config.securityMode)) {
            throw new Error(`当前安全模式 '${this.config.securityMode}' 不允许此操作。允许的模式: ${allowedModes.join(', ')}`);
        }
    }

    /**
     * 获取表的统计信息
     */
    async getTableStats(tableName) {
        this.validateSecurity(['readonly', 'limited_write', 'full_access']);
        
        const query = `
            SELECT 
                TABLE_NAME as table_name,
                TABLE_ROWS as table_rows,
                DATA_LENGTH as data_length,
                INDEX_LENGTH as index_length,
                (DATA_LENGTH + INDEX_LENGTH) as total_size,
                AUTO_INCREMENT as auto_increment,
                TABLE_COMMENT as table_comment
            FROM information_schema.tables 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        `;
        
        const results = await this.executeQuery(query, [this.config.database, tableName]);
        if (results.length === 0) {
            throw new Error(`表 '${tableName}' 不存在`);
        }
        
        const stats = results[0];
        return {
            table_name: stats.table_name,
            row_count: stats.table_rows || 0,
            data_size: stats.data_length || 0,
            index_size: stats.index_length || 0,
            total_size: stats.total_size || 0,
            auto_increment: stats.auto_increment || null,
            comment: stats.table_comment || ''
        };
    }

    /**
     * 获取表的样本数据
     */
    async getSampleData(tableName, limit = 5) {
        this.validateSecurity(['readonly', 'limited_write', 'full_access']);
        
        // 验证表名安全性（只允许字母、数字、下划线）
        if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
            throw new Error('无效的表名');
        }
        
        const query = `SELECT * FROM \`${tableName}\` LIMIT ${parseInt(limit)}`;
        return await this.executeQuery(query);
    }

    /**
     * 按名称搜索表（支持精准匹配和模糊匹配）
     * 
     * @param {string} keyword 搜索关键词
     * @param {boolean} exactMatch 是否精准匹配，默认false（模糊匹配）
     * 
     * Author: 李杰
     * Date: 2025/09/10
     */
    async findTables(keyword, exactMatch = false) {
        this.validateSecurity(['readonly', 'limited_write', 'full_access']);
        
        let query;
        let params;
        
        if (exactMatch) {
            // 精准匹配
            query = `
                SELECT 
                    TABLE_NAME as table_name, 
                    TABLE_COMMENT as table_comment, 
                    TABLE_ROWS as table_rows
                FROM information_schema.tables 
                WHERE TABLE_SCHEMA = ? 
                AND TABLE_NAME = ?
                ORDER BY TABLE_NAME
            `;
            params = [this.config.database, keyword];
        } else {
            // 模糊匹配
            query = `
                SELECT 
                    TABLE_NAME as table_name, 
                    TABLE_COMMENT as table_comment, 
                    TABLE_ROWS as table_rows
                FROM information_schema.tables 
                WHERE TABLE_SCHEMA = ? 
                AND TABLE_NAME LIKE ?
                ORDER BY TABLE_NAME
            `;
            params = [this.config.database, `%${keyword}%`];
        }
        
        const results = await this.executeQuery(query, params);
        return results.map(row => ({
            table_name: row.table_name,
            comment: row.table_comment || '',
            row_count: row.table_rows || 0,
            match_type: exactMatch ? 'exact' : 'fuzzy'
        }));
    }

    /**
     * 关闭连接池
     */
    async close() {
        if (this.pool) {
            await this.pool.end();
            logger.info('MySQL连接池已关闭');
        }
    }
}

// 全局数据库实例 - 延迟初始化
let dbInstance = null;

/**
 * 获取全局数据库实例
 */
export function getDbInstance() {
    if (!dbInstance) {
        dbInstance = new MySQLDatabase();
    }
    return dbInstance;
}

/**
 * 重置数据库实例（主要用于测试）
 */
export function resetDbInstance() {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}