# SecondMe 联调与提交流程

## 当前结论

- 当前仓库已经具备 `SecondMe OAuth` 的服务端回调骨架。
- 我已将本地配置改为对齐 `develop.second.me/skill.md` 中的 OAuth 规则：
  - 授权页使用 `https://go.second.me/oauth/`
  - 换 token 使用 `https://api.mindverse.com/gate/lab/api/oauth/token/code`
  - token 请求体使用 `application/x-www-form-urlencoded`
  - 解析 SecondMe 响应时使用 `{ code, data }`
- 当前仓库还 `没有真正的 MCP endpoint`。所以：
  - 你可以先完成 `外部 OAuth App` 联调和应用信息提交
  - 如果要提交给 OpenClaw/Skill 工具调用，还需要再补一个 MCP 服务面

## 1. 先在 SecondMe Develop 创建 External App

访问：`https://develop.second.me/skill`

建议先创建一个外部应用，字段按下面填：

```text
App Name: 知机 Pro
App Description: 一个多 agent 情感陪伴助手，提供聊天、图像理解、语音播报和记忆管理能力。
Redirect URIs:
- http://localhost:3000/api/auth/callback
- https://zhiji-pro.zeabur.app/api/auth/callback
Allowed Scopes:
- user.info
```

拿到 `Client ID` 和 `Client Secret` 后，填进本地 `.env` 和 Zeabur 变量。

## 2. 环境变量

以 [.env.example](/d:/DevProject/ZhiJI_Pro/.env.example) 为准，SecondMe 相关变量应为：

```env
SECONDME_CLIENT_ID=...
SECONDME_CLIENT_SECRET=...
SECONDME_REDIRECT_URI=https://zhiji-pro.zeabur.app/api/auth/callback
SECONDME_API_BASE_URL=https://api.mindverse.com/gate/lab
SECONDME_OAUTH_URL=https://go.second.me/oauth/
SECONDME_TOKEN_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/code
SECONDME_REFRESH_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/refresh
SECONDME_USERINFO_ENDPOINT=https://api.mindverse.com/gate/lab/api/user/info
```

## 3. Zeabur 部署后联调

部署完成后，先验证这三个接口：

```bash
curl https://zhiji-pro.zeabur.app/health
curl https://zhiji-pro.zeabur.app/api/auth/login
curl https://zhiji-pro.zeabur.app/api/auth/me
```

预期：

- `/health` 返回 `ok: true`
- `/api/auth/login` 返回 `loginUrl`，而且前缀应当是 `https://go.second.me/oauth/`
- 未登录时 `/api/auth/me` 返回 `401`

然后浏览器打开：

```text
https://zhiji-pro.zeabur.app/api/auth/login
```

或者在前端点击登录按钮，检查是否能完成：

1. 跳转到 SecondMe 授权页
2. 授权后回到 `/api/auth/callback`
3. 被重定向到 `/` 且带 `auth=success`
4. 再请求 `/api/auth/me` 能看到用户信息

## 4. mcp.json 当前可提交的信息

当前 [mcp.json](/d:/DevProject/ZhiJI_Pro/mcp.json) 我已经修正为：

- `production` 使用 `https://zhiji-pro.zeabur.app`
- `auth.scopes` 使用 `user.info`
- `authorizationUrl` 使用 `https://go.second.me/oauth/`
- `tokenUrl` 使用 `https://api.mindverse.com/gate/lab/api/oauth/token/code`

这份文件现在更适合作为平台资料和工具能力说明。

## 5. 当前缺口

如果你的目标是：

- `SecondMe 外部应用登录 + 应用资料提交`
  现在可以继续做
- `SecondMe integration / OpenClaw 工具调用`
  现在还差一个真正的 MCP endpoint

当前仓库里只有这些 HTTP 工具接口：

- `/api/chat`
- `/api/chat/stream`
- `/api/perception/image-analyze`
- `/api/memories`
- `/api/expression/cards`
- `/api/audio/speak`

它们还不是标准 MCP transport。

## 6. 提交信息建议

平台提交时建议准备：

- 应用名称：`知机 Pro`
- 一句话介绍：`会在操作室里由多个情绪 agent 讨论后再回应你的机器宝宝`
- 详细介绍：突出 `多 agent 情绪协商`、`图片理解`、`语音播报`、`记忆成长`
- 官网或项目链接：你的 GitHub 仓库或 Zeabur 部署地址
- 隐私政策：至少一页静态说明，解释图片、语音、记忆如何存储和删除
- 截图：至少 3 张
  - 主聊天区
  - 右侧像素操作室
  - 成长/记忆展示

## 7. 下一步

最稳妥的顺序是：

1. 完成 Zeabur 部署
2. 用有效的 SecondMe `Client ID / Secret` 跑通 OAuth
3. 在平台提交外部应用资料
4. 如果你还要进入 Skill/Integration 审核，我再给你补一个最小 MCP 服务面
