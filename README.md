# 知机 Pro Backend

知机 MVP 后端骨架，围绕以下 6 个模块实现：

- `Perception Service`
- `Emotion Agent Runtime`
- `Baby Orchestrator`
- `Memory Service`
- `Safety Service`
- `Expression Service`

## 运行

```bash
npm install
copy .env.example .env
npm run dev
```

## Zeabur 部署

推荐直接用 Docker 部署到 Zeabur，本仓库已提供 `Dockerfile`。

### 需要的环境变量

```env
CREATION_AI_BASE_URL=https://your-api-base/v1
CREATION_AI_API_KEY=your-api-key
MEMORY_STORAGE_PATH=/data/memories.json
MODEL_BABY_ORCHESTRATOR=gpt-5-chat-latest
MODEL_EMOTION_AGENT=gpt-5-mini
MODEL_IMAGE_PERCEPTION=gpt-4o
MODEL_AUDIO_TRANSCRIBE=gpt-4o-transcribe
MODEL_AUDIO_TTS=gpt-4o-mini-tts
MODEL_EMBEDDING=text-embedding-3-small
MODEL_MODERATION=text-moderation-latest
MODEL_IMAGE_GENERATION=gpt-image-1-mini
```

### 持久化存储

- 记忆默认写入 `MEMORY_STORAGE_PATH`
- 在 Zeabur 中建议挂载一个 Volume 到 `/data`
- 这样重启或重新部署后，`/data/memories.json` 不会丢失

### 健康检查

- 部署完成后先访问 `GET /health`
- 返回 200 且 `storage.memoryFile` 正确即可继续验证聊天功能

## 关键约束

- 只能由服务端访问模型中转站
- 不要把 API key 写进前端或提交到仓库
- 你之前暴露过一枚 key，建议立即轮换

## 接口

- `GET /health`
- `POST /api/chat`
- `POST /api/perception/image-analyze`
- `POST /api/audio/transcribe`
- `POST /api/audio/speak`
- `POST /api/expression/cards`
- `GET /api/memories?userId=...`

## `POST /api/chat`

```json
{
  "userId": "user-1",
  "sessionId": "session-1",
  "text": "今天心情不太好",
  "imageUrls": [
    "https://example.com/photo.jpg"
  ]
}
```

返回结果会包含：

- 安全评估
- 图片感知摘要
- 5 个情绪 agent 的结构化观点
- 机器宝宝总控回复
- 记忆更新

现在 Web MVP 还支持：

- 本地图片上传并作为 data URL 进入图片理解链路
- 浏览器录音并调用 `/api/audio/transcribe`
- 记忆持久化到 `data/memories.json`
