/**
 * MySQL数据库连接配置模块
 * 支持环境变量配置
 * 
 * Copyright (c) 2025 lijie
 * Licensed under the MIT License.
 */

import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

/**
 * 安全模式枚举
 */
export const SecurityMode = {
    READONLY: 'readonly',           // 只读模式：仅允许SELECT、SHOW、DESCRIBE、EXPLAIN、ANALYZE、WITH等查询操作
    LIMITED_WRITE: 'limited_write', // 限制写入模式：只读模式的基础上额外支持INSERT、UPDATE操作，禁止DELETE、DROP、CREATE、ALTER等危险操作
    FULL_ACCESS: 'full_access'      // 完全访问模式：允许所有操作（谨慎使用）
};

/**
 * MySQL配置类
 */
export class MySQLConfig {
    constructor() {
        this.loadFromEnv();
        this.validate();
    }

    /**
     * 从环境变量加载配置
     */
    loadFromEnv() {
        // 必需的环境变量
        const requiredEnvVars = {
            'MYSQL_HOST': 'host',
            'MYSQL_PORT': 'port',
            'MYSQL_USERNAME': 'username',
            'MYSQL_PASSWORD': 'password',
            'MYSQL_DATABASE': 'database'
        };

        const missingVars = [];
        
        for (const [envVar, fieldName] of Object.entries(requiredEnvVars)) {
            const value = process.env[envVar];
            if (!value) {
                missingVars.push(envVar);
            } else {
                this[fieldName] = fieldName === 'port' ? parseInt(value, 10) : value;
            }
        }

        if (missingVars.length > 0) {
            throw new Error(`缺少必需的环境变量: ${missingVars.join(', ')}`);
        }

        // 可选的环境变量
        this.connectTimeout = parseInt(process.env.MYSQL_CONNECT_TIMEOUT || '30', 10);
        this.queryTimeout = parseInt(process.env.MYSQL_QUERY_TIMEOUT || '60', 10);
        this.maxRetries = parseInt(process.env.MYSQL_MAX_RETRIES || '3', 10);
        this.securityMode = this.validateSecurityMode(process.env.MYSQL_SECURITY_MODE || 'readonly');
        this.allowedSchemas = this.parseAllowedSchemas(process.env.MYSQL_ALLOWED_SCHEMAS || '*');
        this.enableQueryLog = process.env.MYSQL_ENABLE_QUERY_LOG === 'true';
        this.maxResultRows = parseInt(process.env.MYSQL_MAX_RESULT_ROWS || '1000', 10);
    }

    /**
     * 验证安全模式
     */
    validateSecurityMode(mode) {
        const validModes = Object.values(SecurityMode);
        if (!validModes.includes(mode.toLowerCase())) {
            throw new Error(`无效的安全模式: ${mode}，支持的模式: ${validModes.join(', ')}`);
        }
        return mode.toLowerCase();
    }

    /**
     * 解析允许的数据库列表
     */
    parseAllowedSchemas(schemaStr) {
        if (schemaStr === '*') {
            return ['*'];
        }
        return schemaStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    /**
     * 验证配置
     */
    validate() {
        if (!this.host || !this.username || !this.password || !this.database) {
            throw new Error('数据库连接参数不完整');
        }
        
        if (this.port < 1 || this.port > 65535) {
            throw new Error('数据库端口必须在1-65535之间');
        }

        if (this.allowedSchemas.length === 0) {
            throw new Error('至少需要指定一个允许访问的数据库');
        }
    }

    /**
     * 获取数据库连接配置
     */
    getConnectionConfig() {
        return {
            host: this.host,
            port: this.port,
            user: this.username,
            password: this.password,
            database: this.database,
            connectTimeout: this.connectTimeout * 1000, // 转换为毫秒
            charset: 'utf8mb4',
            timezone: '+00:00',
            supportBigNumbers: true,
            bigNumberStrings: true,
            multipleStatements: false, // 安全考虑
            flags: ['FOUND_ROWS']
        };
    }

    /**
     * 判断是否为只读模式
     */
    isReadonlyMode() {
        return this.securityMode === SecurityMode.READONLY;
    }

    /**
     * 判断是否允许写入操作
     */
    isWriteAllowed() {
        return [SecurityMode.LIMITED_WRITE, SecurityMode.FULL_ACCESS].includes(this.securityMode);
    }

    /**
     * 判断是否允许危险操作
     */
    isDangerousOperationAllowed() {
        return this.securityMode === SecurityMode.FULL_ACCESS;
    }

    /**
     * 判断是否允许访问所有数据库
     */
    isAllSchemasAllowed() {
        return this.allowedSchemas.includes('*');
    }

    /**
     * 判断是否自动发现数据库
     */
    isAutoDiscoverSchemas() {
        return this.allowedSchemas.includes('auto');
    }

    /**
     * 判断是否需要验证数据库
     */
    shouldValidateSchema() {
        return !this.isAllSchemasAllowed() && !this.isAutoDiscoverSchemas();
    }
}

// 全局配置实例 - 延迟初始化
let configInstance = null;

/**
 * 获取全局配置实例
 */
export function getConfigInstance() {
    if (!configInstance) {
        try {
            configInstance = new MySQLConfig();
        } catch (error) {
            throw new Error(`配置加载失败: ${error.message}. 请检查Cursor MCP配置中的环境变量设置`);
        }
    }
    return configInstance;
}

/**
 * 重置配置实例（主要用于测试）
 */
export function resetConfigInstance() {
    configInstance = null;
}