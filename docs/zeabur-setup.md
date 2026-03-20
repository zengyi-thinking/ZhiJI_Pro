# Zeabur 环境变量配置清单

## 立即配置 - Zeabur 部署环境变量

在 Zeabur 项目设置中添加以下环境变量：

### AI 模型配置
```env
CREATION_AI_BASE_URL=https://ai.t8star.cn/v1
CREATION_AI_API_KEY=sk-your-api-key
MODEL_BABY_ORCHESTRATOR=gpt-5-chat-latest
MODEL_EMOTION_AGENT=gpt-5-mini
MODEL_IMAGE_PERCEPTION=gpt-4o
MODEL_AUDIO_TRANSCRIBE=gpt-4o-transcribe
MODEL_AUDIO_TTS=gpt-4o-mini-tts
MODEL_EMBEDDING=text-embedding-3-small
MODEL_MODERATION=text-moderation-latest
MODEL_IMAGE_GENERATION=gpt-image-1-mini
```

### SecondMe OAuth 配置
```env
SECONDME_CLIENT_ID=your-secondme-client-id
SECONDME_CLIENT_SECRET=your-secondme-client-secret
SECONDME_REDIRECT_URI=https://zhiji-pro.zeabur.app/api/auth/callback
SECONDME_API_BASE_URL=https://api.mindverse.com/gate/lab
SECONDME_OAUTH_URL=https://go.second.me/oauth/
SECONDME_TOKEN_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/code
SECONDME_REFRESH_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/refresh
SECONDME_USERINFO_ENDPOINT=https://api.mindverse.com/gate/lab/api/secondme/user/info
SESSION_SECRET=replace-with-a-random-secret
```

### 其他配置
```env
MEMORY_STORAGE_PATH=data/memories.json
PORT=8080
```

---

## 配置步骤

### 方式一：通过 Zeabur 控制台配置（推荐）

1. 登录 Zeabur 控制台
2. 选择你的项目 → 选择服务
3. 点击 "Variables" 或 "环境变量"
4. 逐个添加上述环境变量
5. 保存后重新部署服务

### 方式二：通过 Zeabur CLI 配置

```bash
# 安装 Zeabur CLI（如果还没安装）
npm install -g @zeabur/cli

# 登录
zeabur login

# 设置环境变量
zeabur variables set SECONDME_CLIENT_ID "your-secondme-client-id"
zeabur variables set SECONDME_CLIENT_SECRET "your-secondme-client-secret"
zeabur variables set SECONDME_REDIRECT_URI "https://zhiji-pro.zeabur.app/api/auth/callback"
zeabur variables set SECONDME_API_BASE_URL "https://api.mindverse.com/gate/lab"
zeabur variables set SECONDME_OAUTH_URL "https://go.second.me/oauth/"
zeabur variables set SECONDME_TOKEN_ENDPOINT "https://api.mindverse.com/gate/lab/api/oauth/token/code"
zeabur variables set SECONDME_REFRESH_ENDPOINT "https://api.mindverse.com/gate/lab/api/oauth/token/refresh"
zeabur variables set SECONDME_USERINFO_ENDPOINT "https://api.mindverse.com/gate/lab/api/secondme/user/info"
zeabur variables set SESSION_SECRET "replace-with-a-random-secret"

# AI 配置（替换你的 API Key）
zeabur variables set CREATION_AI_BASE_URL "https://ai.t8star.cn/v1"
zeabur variables set CREATION_AI_API_KEY "sk-your-api-key"

# 模型配置
zeabur variables set MODEL_BABY_ORCHESTRATOR "gpt-5-chat-latest"
zeabur variables set MODEL_EMOTION_AGENT "gpt-5-mini"
zeabur variables set MODEL_IMAGE_PERCEPTION "gpt-4o"
zeabur variables set MODEL_AUDIO_TRANSCRIBE "gpt-4o-transcribe"
zeabur variables set MODEL_AUDIO_TTS "gpt-4o-mini-tts"
zeabur variables set MODEL_EMBEDDING "text-embedding-3-small"
zeabur variables set MODEL_MODERATION "text-moderation-latest"
zeabur variables set MODEL_IMAGE_GENERATION "gpt-image-1-mini"

# 重新部署
zeabur restart
```

---

## 配置完成后的验证

### 1. 健康检查
```bash
curl https://zhiji-pro.zeabur.app/health
```

预期返回：
```json
{
  "ok": true,
  "models": { ... },
  "storage": { ... }
}
```

### 2. OAuth 登录测试
访问 `https://zhiji-pro.zeabur.app`，点击登录后，应该跳转到 `https://go.second.me/oauth/`。

### 3. 检查登录接口
```bash
curl https://zhiji-pro.zeabur.app/api/auth/login
```

预期返回：
```json
{
  "loginUrl": "https://go.second.me/oauth/?...",
  "state": "..."
}
```

---

## 重要提醒

### 安全建议
1. ⚠️ **生产环境** - 将 `SESSION_SECRET` 更改为随机生成的值：
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. ⚠️ **API Key 保护** - 确保 `CREATION_AI_API_KEY` 不泄露

3. ⚠️ **HTTPS** - 如果使用自定义域名，确保更新 `SECONDME_REDIRECT_URI` 为 HTTPS

### 域名配置
如果你使用自定义域名（如 `https://zhiji.yourdomain.com`），需要更新：
```env
SECONDME_REDIRECT_URI=https://zhiji.yourdomain.com/api/auth/callback
```

同时在 Second Me 应用设置中更新回调 URL。

---

## 故障排查

### 登录后显示"未登录"
- 检查 Cookie 是否被浏览器阻止
- 确认 `SECONDME_REDIRECT_URI` 与 Second Me 应用设置一致

### OAuth 回调失败
- 验证 Client ID 和 Client Secret 是否正确
- 检查回调 URL 是否在 Second Me 应用中正确配置

### 环境变量未生效
- 在 Zeabur 控制台重新部署服务
- 检查环境变量名称拼写（区分大小写）

---

## Second Me 应用设置检查

在 `https://develop.second.me/skill` 确认以下配置：

| 配置项 | 值 |
|--------|-----|
| 应用名称 | 知机 |
| 回调 URL | https://zhiji-pro.zeabur.app/api/auth/callback |
| 授权范围 | user.info |

一切就绪后，你的应用就可以正常使用 Second Me 登录了！
