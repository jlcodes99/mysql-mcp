/**
 * MySQL数据库MCP服务器
 * 提供安全的MySQL数据库访问和管理功能
 * 
 * Copyright (c) 2025 lijie
 * Licensed under the MIT License.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import { getDbInstance } from './database.js';

// 配置日志 - 输出到stderr避免污染stdio通道
const logger = winston.createLogger({
    level: 'error', // 只记录错误，减少输出
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

// 创建MCP服务器实例
const server = new Server(
    {
        name: 'mysql-mcp-node',
        version: '1.0.0',
    },
    {
        capabilities: {
            resources: {},
            tools: {},
        },
    }
);

// 全局实例
let db = null;

/**
 * 列出可用的资源
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [
            {
                uri: 'mysql://database/tables',
                name: '数据库表列表',
                description: '当前数据库中所有表的列表',
                mimeType: 'application/json'
            }
        ]
    };
});

/**
 * 读取指定资源的内容
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    
    if (!db) {
        db = getDbInstance();
    }

    try {
        if (uri === 'mysql://database/tables') {
            const tables = await db.getAllTables();
            const content = JSON.stringify(tables, null, 2);
            return {
                contents: [
                    {
                        uri: uri,
                        mimeType: 'application/json',
                        text: content
                    }
                ]
            };
        } else {
            throw new Error(`未知的资源URI: ${uri}`);
        }
    } catch (error) {
        logger.error(`读取资源失败 ${uri}: ${error.message}`);
        throw error;
    }
});

/**
 * 列出可用的工具
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'get_security_info',
                description: '获取当前安全配置信息',
                inputSchema: {
                    type: 'object',
                    properties: {
                        random_string: {
                            type: 'string',
                            description: 'Dummy parameter for no-parameter tools'
                        }
                    },
                    required: ['random_string']
                }
            },
            {
                name: 'list_tables',
                description: '获取数据库中所有表的列表',
                inputSchema: {
                    type: 'object',
                    properties: {
                        database: {
                            type: 'string',
                            description: '数据库名称',
                            default: 'public'
                        }
                    },
                    required: []
                }
            },
            {
                name: 'describe_table',
                description: '获取指定表的详细结构信息',
                inputSchema: {
                    type: 'object',
                    properties: {
                        table_name: {
                            type: 'string',
                            description: '表名'
                        },
                        database: {
                            type: 'string',
                            description: '数据库名称',
                            default: 'public'
                        }
                    },
                    required: ['table_name']
                }
            },
            {
                name: 'table_stats',
                description: '获取表的统计信息（行数、大小、索引等）',
                inputSchema: {
                    type: 'object',
                    properties: {
                        table_name: {
                            type: 'string',
                            description: '表名'
                        }
                    },
                    required: ['table_name']
                }
            },
            {
                name: 'sample_data',
                description: '快速查看表的样本数据',
                inputSchema: {
                    type: 'object',
                    properties: {
                        table_name: {
                            type: 'string',
                            description: '表名'
                        },
                        limit: {
                            type: 'integer',
                            description: '返回记录数，默认5条',
                            default: 5
                        }
                    },
                    required: ['table_name']
                }
            },
            {
                name: 'find_table',
                description: '按名称模糊搜索表',
                inputSchema: {
                    type: 'object',
                    properties: {
                        keyword: {
                            type: 'string',
                            description: '搜索关键词'
                        }
                    },
                    required: ['keyword']
                }
            },
            {
                name: 'execute_query',
                description: '执行SQL语句（根据安全模式限制操作类型）',
                inputSchema: {
                    type: 'object',
                    properties: {
                        sql: {
                            type: 'string',
                            description: 'SQL语句'
                        }
                    },
                    required: ['sql']
                }
            }
        ]
    };
});

/**
 * 调用指定的工具
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    // 延迟初始化 - 在第一次调用时才初始化数据库连接
    if (!db) {
        try {
            db = getDbInstance();
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `数据库连接初始化失败: ${error.message}\n\n请检查MCP配置中的环境变量设置：\n- MYSQL_HOST\n- MYSQL_PORT\n- MYSQL_USERNAME\n- MYSQL_PASSWORD\n- MYSQL_DATABASE`
                    }
                ]
            };
        }
    }

    try {
        switch (name) {
            case 'get_security_info': {
                const securityInfo = db.getSecurityInfo();
                return {
                    content: [
                        {
                            type: 'text',
                            text: `MySQL数据库安全配置:\n${JSON.stringify(securityInfo, null, 2)}`
                        }
                    ]
                };
            }

            case 'list_tables': {
                const database = args.database;
                const tables = await db.getAllTables(database);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `数据库表列表 (${tables.length} 个表):\n${JSON.stringify(tables, null, 2)}`
                        }
                    ]
                };
            }

            case 'describe_table': {
                const tableName = args.table_name;
                const database = args.database;

                // 获取表结构
                const columns = await db.getTableStructure(tableName, database);
                const indexes = await db.getTableIndexes(tableName, database);
                const constraints = await db.getTableConstraints(tableName, database);

                const result = {
                    table_name: tableName,
                    database: database || db.config.database,
                    columns: columns,
                    indexes: indexes,
                    constraints: constraints
                };

                return {
                    content: [
                        {
                            type: 'text',
                            text: `表 '${tableName}' 的结构信息:\n${JSON.stringify(result, null, 2)}`
                        }
                    ]
                };
            }

            case 'table_stats': {
                const tableName = args.table_name;
                const stats = await db.getTableStats(tableName);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `表 '${tableName}' 统计信息:\n${JSON.stringify(stats, null, 2)}`
                        }
                    ]
                };
            }

            case 'sample_data': {
                const tableName = args.table_name;
                const limit = args.limit || 5;
                const sampleData = await db.getSampleData(tableName, limit);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `表 '${tableName}' 样本数据 (${limit}条):\n${JSON.stringify(sampleData, null, 2)}`
                        }
                    ]
                };
            }

            case 'find_table': {
                const keyword = args.keyword;
                const tables = await db.findTables(keyword);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `搜索 '${keyword}' 的结果:\n${JSON.stringify(tables, null, 2)}`
                        }
                    ]
                };
            }

            case 'execute_query': {
                const sql = args.sql;

                // 执行查询
                const results = await db.executeQuery(sql);

                // 格式化结果
                let resultText;
                if (results && results.length > 0) {
                    try {
                        // 直接序列化结果，避免双重JSON处理
                        resultText = `查询执行成功，返回 ${results.length} 条记录:\n${JSON.stringify(results, null, 2)}`;
                    } catch (jsonError) {
                        // 如果JSON序列化失败，返回简化信息
                        resultText = `查询执行成功，返回 ${results.length} 条记录\n注意：结果包含无法序列化的数据，请检查数据类型`;
                    }
                } else {
                    resultText = '查询执行成功，无返回结果';
                }

                return {
                    content: [
                        {
                            type: 'text',
                            text: resultText
                        }
                    ]
                };
            }


            default:
                throw new Error(`未知的工具: ${name}`);
        }
    } catch (error) {
        const errorMsg = `工具 '${name}' 执行失败: ${error.message}`;
        logger.error(errorMsg);
        logger.error('错误详情:', error.stack);
        return {
            content: [
                {
                    type: 'text',
                    text: errorMsg
                }
            ]
        };
    }
});

/**
 * 主函数 - 启动MCP服务器
 */
async function main() {
    // 启动stdio服务器（即使初始化失败也要启动，让错误通过MCP协议返回）
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    // 延迟初始化数据库连接（在第一次调用工具时进行）
    // 这样可以避免启动时的错误输出到stdio，导致JSON解析错误
}

// 处理进程退出信号
process.on('SIGINT', async () => {
    if (db) {
        await db.close();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    if (db) {
        await db.close();
    }
    process.exit(0);
});

// 启动服务器
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        // 使用stderr输出错误，避免污染stdio通道
        console.error(`MCP服务器启动失败: ${error.message}`);
        process.exit(1);
    });
}