# 更新日志

## [1.0.0] - 2025-01-09

### 新增功能
- 🎉 项目初始版本发布
- ✨ 实现完整的MCP协议支持
- 🔒 三种安全模式支持（只读、限制写入、完全访问）
- 📊 多格式文档生成（Markdown、JSON、SQL）
- 🛡️ SQL安全验证器，防止危险操作
- ⚡ 高性能MySQL连接池支持
- 📋 完整的表结构、索引、约束查询功能
- 🌐 数据库概览文档生成

### 核心工具
- `test_connection` - 数据库连接测试
- `get_security_info` - 安全配置信息查询
- `describe_table` - 表详细结构查询
- `generate_table_doc` - 表文档生成
- `generate_database_overview` - 数据库概览生成
- `execute_query` - SQL语句执行
- `list_schemas` - 可用数据库列表查询

### 技术特性
- Node.js 18+ 支持
- 基于官方 MySQL2 驱动
- MCP SDK 完整集成
- 连接池和超时控制
- 智能错误处理和日志记录

### 安全特性
- 只读模式：仅允许查询操作
- 限制写入模式：禁止危险的删除和修改操作
- 完全访问模式：允许所有数据库操作
- SQL验证器：防止恶意SQL注入
- 权限最小化原则