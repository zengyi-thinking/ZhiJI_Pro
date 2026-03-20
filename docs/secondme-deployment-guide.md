# Second Me 集成部署指南

## 概述

知机 已接入 SecondMe OAuth 登录骨架。当前目标是先跑通外部应用授权，再补标准 MCP endpoint。

## 已完成的功能

### 后端集成

1. **OAuth 认证服务** ([`src/services/secondmeAuth.ts`](../src/services/secondmeAuth.ts))
   - PKCE 流程支持
   - 会话管理
   - 按 SecondMe `{ code, data }` 响应结构解析 token 和用户信息

2. **认证 API 端点**
   - `GET /api/auth/login` - 获取登录 URL
   - `GET /api/auth/callback` - OAuth 回调处理
   - `GET /api/auth/me` - 获取当前用户信息
   - `POST /api/auth/logout` - 退出登录

### 前端集成

1. **登录 UI**
   - 登录弹窗 (`dialog` 模态框)
   - 用户信息显示区域
   - 登录/登出按钮

2. **认证流程**
   - 自动检测登录状态
   - OAuth 回调处理
   - 会话持久化 (Cookie)

## 部署步骤

### 1. 在 Second Me 创建应用

1. 访问 https://develop.second.me/skill
2. 创建新应用，填写基本信息：
   ```
   名称: 知机
   描述: “知” 代表知识与知乎的社区基因，“机” 代表由 agents 自动构成的灵魂机器。
   分类: AI 助手
   ```
3. 获取 OAuth 凭证：
   - `Client ID`
   - `Client Secret`
4. 设置回调 URL：
   ```
   http://localhost:8080/api/auth/callback
   https://zhiji-pro.zeabur.app/api/auth/callback
   ```

### 2. 配置环境变量

在 Zeabur 部署配置中添加以下环境变量：

```env
# Second Me OAuth 配置
SECONDME_CLIENT_ID=your-secondme-client-id
SECONDME_CLIENT_SECRET=your-secondme-client-secret
SECONDME_REDIRECT_URI=https://zhiji-pro.zeabur.app/api/auth/callback
SECONDME_API_BASE_URL=https://api.mindverse.com/gate/lab
SECONDME_OAUTH_URL=https://go.second.me/oauth/
SECONDME_TOKEN_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/code
SECONDME_REFRESH_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/refresh
SECONDME_USERINFO_ENDPOINT=https://api.mindverse.com/gate/lab/api/user/info
SESSION_SECRET=your-random-session-secret
```

生成 `SESSION_SECRET`：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. 更新 Zeabur 部署

1. 提交代码到 GitHub：
   ```bash
   git add .
   git commit -m "feat: add Second Me OAuth integration"
   git push
   ```

2. 在 Zeabur 重新部署

3. 配置环境变量（在 Zeabur 控制台）

### 4. 验证部署

1. 访问 https://zhiji-pro.zeabur.app
2. 点击"登录"按钮
3. 应该跳转到 Second Me 授权页面
4. 授权后自动返回并显示用户信息

### 5. 测试 API

```bash
# 健康检查
curl https://zhiji-pro.zeabur.app/health

# 获取登录 URL
curl https://zhiji-pro.zeabur.app/api/auth/login

# 检查用户状态（需要 Cookie）
curl https://zhiji-pro.zeabur.app/api/auth/me
```

## MCP 配置更新

[`mcp.json`](../mcp.json) 已更新，包含：

1. **正确的端点 URL**
   ```json
   "production": "https://zhiji-pro.zeabur.app"
   ```

2. **认证配置**
   ```json
   "auth": {
     "type": "oauth2",
     "provider": "secondme",
     "scopes": ["user.info"]
   }
   ```

3. **Auth 端点**
   ```json
   "auth": {
     "login": "/api/auth/login",
     "callback": "/api/auth/callback",
     "logout": "/api/auth/logout",
     "me": "/api/auth/me"
   }
   ```

## 应用上架清单

### 必需材料

| 材料 | 规格 | 状态 |
|------|------|------|
| 应用图标 | 512x512 PNG | ⚠️ 需准备 |
| 横幅图 | 1200x630 PNG | ⚠️ 需准备 |
| 应用截图 | 至少 3 张 | ⚠️ 需准备 |
| 应用描述 | 已准备 | ✅ |
| MCP 配置 | 已准备 | ✅ |

### 应用上架内容

使用 [`secondme-store.md`](../secondme-store.md) 中的内容填写：

- **应用名称**: 知机 Pro
- **一句话介绍**: 你的情感 AI 聊天伴侣
- **分类**: AI 助手 / 生产力
- **标签**: 聊天, 情感, AI, 多模态, 记忆管理

### 上架流程

1. 访问 https://develop.second.me/store/list
2. 填写应用信息
3. 上传图标和截图
4. 提交审核

## 文件清单

### 新增文件

- [`src/services/secondmeAuth.ts`](../src/services/secondmeAuth.ts) - OAuth 认证服务
- [`mcp.json`](../mcp.json) - MCP 配置文件
- [`secondme-store.md`](../secondme-store.md) - 应用上架材料
- [`docs/secondme-integration-guide.md`](secondme-integration-guide.md) - 集成指南
- `docs/secondme-deployment-guide.md` - 本文档

### 修改文件

- [`src/config.ts`](../src/config.ts) - 添加 OAuth 环境变量
- [`src/app.ts`](../src/app.ts) - 添加认证路由和中间件
- [`public/index.html`](../public/index.html) - 添加登录 UI
- [`public/app.js`](../public/app.js) - 添加认证逻辑
- [`public/styles.css`](../public/styles.css) - 添加认证样式
- [`package.json`](../package.json) - 添加 cookie-parser 依赖
- [`.env.example`](../.env.example) - 添加 OAuth 配置示例

## 故障排查

### 登录回调失败

检查环境变量：
- `SECONDME_REDIRECT_URI` 必须与 Second Me 应用设置一致
- `SECONDME_CLIENT_ID` 和 `SECONDME_CLIENT_SECRET` 必须正确

### Cookie 未保存

检查 CORS 设置：
- 确保 `credentials: true` 在前端请求中
- 后端 CORS 配置包含 `credentials: true`

### 用户信息未显示

检查登录状态：
- 调用 `/api/auth/me` 验证会话
- 检查浏览器 Cookie 是否设置成功

## 后续优化建议

1. **持久化会话** - 使用 Redis 存储会话数据
2. **用户关联** - 将 Second Me 用户 ID 与记忆系统关联
3. **权限控制** - 添加需要登录才能访问的 API
4. **错误处理** - 完善登录失败、超时等场景处理

## 联系支持

如有问题，请：
- 查看日志：Zeabur 控制台日志
- 检查环境变量配置
- 验证 Second Me 应用设置
