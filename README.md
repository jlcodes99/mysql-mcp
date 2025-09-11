# MySQL MCP

基于 MCP 协议实现的 MySQL 数据库管理工具

## 功能特点

- 🔒 **多重安全模式** - readonly（只读）、limited_write（只读+INSERT/UPDATE）、full_access三种安全级别
- 🚀 **高性能连接** - 基于连接池的高效数据库访问
- 🛠️ **实用工具集** - 专注业务开发的实际需求
- 📊 **数据统计** - 表统计信息、样本数据查看
- 🔍 **智能搜索** - 表名模糊搜索功能
- ⚡ **即时查询** - 安全的SQL执行环境

## 安装配置

### 1. 克隆项目

```bash
git clone https://github.com/jlcodes99/mysql-mcp.git
cd mysql-mcp
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

在MCP配置中直接设置环境变量，或创建 `.env` 文件：

#### 必需配置
```env
MYSQL_HOST=your_mysql_host          # 数据库主机地址
MYSQL_PORT=3306                     # 数据库端口
MYSQL_USERNAME=your_username        # 数据库用户名
MYSQL_PASSWORD=your_password        # 数据库密码
MYSQL_DATABASE=your_database        # 数据库名称
```

#### 可选配置
```env
MYSQL_SECURITY_MODE=readonly        # 安全模式: readonly/limited_write/full_access
MYSQL_ALLOWED_SCHEMAS=*             # 允许访问的数据库: * 或 逗号分隔的数据库名
MYSQL_CONNECT_TIMEOUT=30            # 连接超时时间(秒)
MYSQL_QUERY_TIMEOUT=60              # 查询超时时间(秒)
MYSQL_MAX_RETRIES=3                 # 最大重试次数
MYSQL_ENABLE_QUERY_LOG=false        # 是否启用查询日志
MYSQL_MAX_RESULT_ROWS=1000          # 最大结果行数限制
```

### 4. 配置Cursor MCP

在 `~/.cursor/mcp.json` 中添加配置：

```json
{
  "mcpServers": {
    "mysql-db": {
      "command": "node",
      "args": ["/absolute/path/to/mysql-mcp/index.js"],
      "env": {
        "MYSQL_HOST": "your_mysql_host",
        "MYSQL_PORT": "3306",
        "MYSQL_USERNAME": "your_username", 
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database",
        "MYSQL_SECURITY_MODE": "readonly",
        "MYSQL_ALLOWED_SCHEMAS": "*",
        "MYSQL_CONNECT_TIMEOUT": "30",
        "MYSQL_QUERY_TIMEOUT": "60",
        "MYSQL_MAX_RETRIES": "3",
        "MYSQL_ENABLE_QUERY_LOG": "false",
        "MYSQL_MAX_RESULT_ROWS": "1000"
      }
    }
  }
}
```

## 启动服务

启动MCP服务器：

```bash
npm start
```

## 可用工具

### 基础信息
- `get_security_info` - 查看当前安全模式和配置
- `describe_table` - 查看表的详细结构信息

### 数据查询
- `execute_query` - 执行SQL查询（受安全模式限制）
- `sample_data` - 获取表的样本数据
- `table_stats` - 获取表的统计信息（行数、大小等）

### 搜索功能
- `find_table` - 按关键词搜索表名（支持精准匹配和模糊匹配）

## 配置说明

### 环境变量详解

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `MYSQL_HOST` | ✅ | - | 数据库主机地址 |
| `MYSQL_PORT` | ✅ | - | 数据库端口号 |
| `MYSQL_USERNAME` | ✅ | - | 数据库用户名 |
| `MYSQL_PASSWORD` | ✅ | - | 数据库密码 |
| `MYSQL_DATABASE` | ✅ | - | 数据库名称 |
| `MYSQL_SECURITY_MODE` | ❌ | `readonly` | 安全模式 |
| `MYSQL_ALLOWED_SCHEMAS` | ❌ | `*` | 允许访问的数据库 |
| `MYSQL_CONNECT_TIMEOUT` | ❌ | `30` | 连接超时时间(秒) |
| `MYSQL_QUERY_TIMEOUT` | ❌ | `60` | 查询超时时间(秒) |
| `MYSQL_MAX_RETRIES` | ❌ | `3` | 最大重试次数 |
| `MYSQL_ENABLE_QUERY_LOG` | ❌ | `false` | 是否启用查询日志 |
| `MYSQL_MAX_RESULT_ROWS` | ❌ | `1000` | 最大结果行数限制 |

### 安全模式

#### readonly（只读模式）
- 只允许SELECT、SHOW、DESCRIBE、EXPLAIN、ANALYZE、WITH等查询操作
- 禁止INSERT、UPDATE、DELETE等所有写入和危险操作
- 最大结果行数限制：1000行
- 适合安全的数据查看和分析场景

#### limited_write（限制写入模式）
- **完全支持readonly模式的所有查询操作**（SELECT、SHOW、DESCRIBE、EXPLAIN、ANALYZE、WITH等）
- **额外支持INSERT、UPDATE操作**
- 禁止DELETE、DROP、CREATE、ALTER、TRUNCATE、GRANT、REVOKE等危险操作
- 适合需要进行数据录入和更新，但要避免危险操作的场景

#### full_access（完全访问模式）
- 允许所有SQL操作
- ⚠️ 谨慎使用，建议仅在开发环境使用

## 使用示例

### 查看数据库表列表
```sql
-- 查看当前数据库所有表
SHOW TABLES;
```

### 查看表结构
```
请帮我查看 users 表的结构
```

### 获取样本数据
```
给我看看 orders 表的前5条数据
```

### 搜索表名
```
# 模糊搜索（默认）
找一下包含 "user" 关键词的所有表

# 精准搜索
查找名为 "users" 的表（精准匹配）
```

### 执行查询
```
查询一下 products 表有多少条记录
```

## 表搜索功能详解

`find_table` 工具支持两种搜索模式：

### 模糊搜索（默认模式）
```json
{
  "name": "find_table",
  "arguments": {
    "keyword": "user",
    "exact_match": false
  }
}
```
或者简化为：
```json
{
  "name": "find_table",
  "arguments": {
    "keyword": "user"
  }
}
```
**结果**：会查找所有包含 "user" 的表名，如：`users`、`user_roles`、`admin_users` 等

### 精准搜索
```json
{
  "name": "find_table",
  "arguments": {
    "keyword": "users",
    "exact_match": true
  }
}
```
**结果**：只会查找名称完全匹配 "users" 的表

### 使用场景

- **模糊搜索**：适用于探索性查找，不确定完整表名时
- **精准搜索**：适用于确定知道表名，需要验证表是否存在时

## 安全注意事项

- 🔒 数据库连接信息通过环境变量配置，不会暴露在代码中
- 🛡️ 根据安全模式自动限制SQL操作类型
- 📊 查询结果行数自动限制，防止内存溢出
- 🔍 支持SQL注入防护和参数化查询

## 开发贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 许可证

MIT License

## 联系方式

- 项目主页: https://github.com/jlcodes99/mysql-mcp
- 问题反馈: https://github.com/jlcodes99/mysql-mcp/issues