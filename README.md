# MySQL MCP

基于 MCP 协议实现的 MySQL 数据库管理工具

## 功能特点

- 🔒 **多重安全模式** - 支持readonly、limited_write、full_access三种安全级别
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

复制配置示例文件并填写您的数据库信息：

```bash
cp env.example .env
```

编辑 `.env` 文件，填写您的数据库连接信息：

```env
MYSQL_HOST=your_mysql_host
MYSQL_PORT=3306
MYSQL_USERNAME=your_username
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=your_database
MYSQL_SECURITY_MODE=readonly
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
        "MYSQL_SECURITY_MODE": "readonly"
      }
    }
  }
}
```

## 本地测试

为了便于开发和调试，项目提供了本地测试脚本：

### 完整测试
```bash
npm run test
# 或
node test-local.js
```

### 单项测试
```bash
npm run test:sample     # 测试样本数据查询
npm run test:find       # 测试表名搜索
npm run test:stats      # 测试表统计信息
npm run test:connection # 测试数据库连接
```

### 手动单项测试
```bash
node test-local.js connection
node test-local.js sample
node test-local.js find
```

## 可用工具

### 基础信息
- `get_security_info` - 查看当前安全模式和配置
- `list_tables` - 获取数据库中所有表的列表
- `describe_table` - 查看表的详细结构信息

### 数据查询
- `execute_query` - 执行SQL查询（受安全模式限制）
- `sample_data` - 获取表的样本数据
- `table_stats` - 获取表的统计信息（行数、大小等）

### 搜索功能
- `find_table` - 按关键词模糊搜索表名

## 安全模式

### readonly（只读模式）
- 只允许SELECT、SHOW等查询操作
- 禁止INSERT、UPDATE、DELETE等写入操作
- 最大结果行数限制：1000行

### limited_write（限制写入模式）
- 允许INSERT、UPDATE操作
- 禁止DELETE、DROP等危险操作
- 适合数据录入场景

### full_access（完全访问模式）
- 允许所有SQL操作
- ⚠️ 谨慎使用，建议仅在开发环境使用

## 使用示例

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
找一下包含 "user" 关键词的所有表
```

### 执行查询
```
查询一下 products 表有多少条记录
```

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