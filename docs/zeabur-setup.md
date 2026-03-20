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

### Second Me OAuth 配置（已获取）
```env
SECONDME_CLIENT_ID=bbe96e19-bcef-449f-8f70-8505705c805d
SECONDME_CLIENT_SECRET=356e3de64dd50b246a17c836c4368070a180482ac794d3e3aae3b727c5d20bf9
SECONDME_REDIRECT_URI=http://zhiji-pro.zeabur.app/api/auth/callback
SECONDME_BASE_URL=https://second.me
SESSION_SECRET=zhiji-pro-session-secret-change-in-production
```

### 其他配置
```env
MEMORY_STORAGE_PATH=data/memories.json
PORT=3000
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
zeabur variables set SECONDME_CLIENT_ID "bbe96e19-bcef-449f-8f70-8505705c805d"
zeabur variables set SECONDME_CLIENT_SECRET "356e3de64dd50b246a17c836c4368070a180482ac794d3e3aae3b727c5d20bf9"
zeabur variables set SECONDME_REDIRECT_URI "http://zhiji-pro.zeabur.app/api/auth/callback"
zeabur variables set SECONDME_BASE_URL "https://second.me"
zeabur variables set SESSION_SECRET "zhiji-pro-session-secret-change-in-production"

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
curl http://zhiji-pro.zeabur.app/health
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
访问 http://zhiji-pro.zeabur.app，点击"登录"按钮，应该跳转到 Second Me 授权页面。

### 3. 检查登录接口
```bash
curl http://zhiji-pro.zeabur.app/api/auth/login
```

预期返回：
```json
{
  "loginUrl": "https://second.me/oauth/authorize?...",
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

在 https://develop.second.me/skill 确认以下配置：

| 配置项 | 值 |
|--------|-----|
| 应用名称 | 知机 Pro |
| 回调 URL | http://zhiji-pro.zeabur.app/api/auth/callback |
| 授权范围 | profile, email |

一切就绪后，你的应用就可以正常使用 Second Me 登录了！
