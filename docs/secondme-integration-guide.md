# Second Me MCP 集成指南

## 1. 在 Second Me 开发平台创建 Skill

访问：https://develop.second.me/skill

### 填写基本信息

```
名称: 知机 Pro
描述: 情感 AI 聊天伴侣，具备多模态感知、情绪理解和记忆管理能力
分类: AI 助手
版本: 0.1.0
```

### 配置 MCP 服务器

```json
{
  "endpoint": "https://your-deployment-url.zeabur.app",
  "transport": "http",
  "capabilities": {
    "tools": true
  }
}
```

### 上传 MCP 配置

上传项目根目录的 `mcp.json` 文件到平台。

---

## 2. 部署应用到 Zeabur

1. 连接 GitHub 仓库到 Zeabur
2. 选择 `ZhiJI_Pro` 仓库
3. 使用 Dockerfile 部署
4. 配置环境变量：

```env
CREATION_AI_BASE_URL=https://ai.t8star.cn/v1
CREATION_AI_API_KEY=sk-your-key
MODEL_BABY_ORCHESTRATOR=gpt-5-chat-latest
MODEL_EMOTION_AGENT=gpt-5-mini
# ... 其他配置见 .env.example
```

5. 部署完成后获取服务 URL

---

## 3. 提交应用上架

访问：https://develop.second.me/store/list

### 准备材料

| 材料 | 说明 |
|------|------|
| 应用图标 | 512x512 PNG，圆角 |
| 横幅图 | 1200x630 PNG |
| 应用截图 | 至少 3 张，展示核心功能 |
| 应用描述 | 使用 `secondme-store.md` 内容 |
| 隐私政策 | 可选，建议提供 |

### 填写应用信息

```
应用名称: 知机 Pro
一句话介绍: 你的情感 AI 聊天伴侣
详细描述: 见 secondme-store.md
分类: 生产力 / AI 助手
标签: 聊天, 情感, AI, 多模态
官网: https://your-github-repo
```

---

## 4. 测试 MCP 集成

部署完成后，测试端点：

```bash
# 健康检查
curl https://your-url.zeabur.app/health

# 聊天测试
curl -X POST https://your-url.zeabur.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","sessionId":"test","text":"你好"}'
```

---

## 5. 常见问题

### Q: MCP 集成后如何调用？
A: 在 Second Me 客户端添加知机 Pro 后，可以通过 MCP 协议调用所有定义的工具。

### Q: 如何更新应用？
A: 更新代码后推送到 GitHub，Zeabur 会自动重新部署。然后在 Second Me 平台更新版本信息。

### Q: 费用如何计算？
A: 知机 Pro 本身免费，但需要你提供 AI API 的计费账号。

---

## 联系方式

如有问题，请通过以下方式联系：
- GitHub Issues: https://github.com/your-repo/issues
