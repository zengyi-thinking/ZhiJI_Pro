// ==================== 登录认证模块 ====================
const authState = {
  user: null,
  isAuthenticated: false
};

const loginModal = document.getElementById("loginModal");
const loginButton = document.getElementById("loginButton");
const secondmeLoginButton = document.getElementById("secondmeLoginButton");
const closeLoginModal = document.getElementById("closeLoginModal");
const userProfile = document.getElementById("userProfile");
const userAvatar = document.getElementById("userAvatar");
const userName = document.getElementById("userName");
const logoutButton = document.getElementById("logoutButton");

// 检查 URL 参数中是否有登录成功的回调
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("auth") === "success") {
  // 登录成功，清除 URL 参数
  window.history.replaceState({}, document.title, window.location.pathname);
  checkAuthStatus();
}

// 初始化：检查登录状态
checkAuthStatus();

// 打开登录弹窗
loginButton?.addEventListener("click", () => {
  openLoginModal();
});

// 关闭登录弹窗
closeLoginModal?.addEventListener("click", () => {
  loginModal.close();
});

// 点击弹窗外部关闭
loginModal?.addEventListener("click", (event) => {
  if (event.target === loginModal) {
    loginModal.close();
  }
});

function openLoginModal() {
  loginModal?.showModal();
}

function requireLoginForInteraction(reason = "登录后才能开始和知机对话。") {
  if (authState.isAuthenticated) {
    return false;
  }

  chatStatus.textContent = reason;
  openLoginModal();
  return true;
}

// Second Me 登录按钮点击
secondmeLoginButton?.addEventListener("click", async () => {
  try {
    const redirectUri = `${window.location.origin}/api/auth/callback`;
    const response = await fetch(`/api/auth/login?redirect_uri=${encodeURIComponent(redirectUri)}`);
    if (!response.ok) throw new Error("获取登录链接失败");

    const data = await response.json();
    window.location.href = data.loginUrl;
  } catch (error) {
    console.error("登录失败:", error);
    alert("登录失败，请稍后重试");
  }
});

// 退出登录
logoutButton?.addEventListener("click", async () => {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
    authState.user = null;
    authState.isAuthenticated = false;
    updateAuthUI();
    // 使用 demo 用户继续会话
    state.userId = "demo-user";
    alert("已退出登录");
  } catch (error) {
    console.error("登出失败:", error);
  }
});

// 检查认证状态
async function checkAuthStatus() {
  try {
    const response = await fetch("/api/auth/me");
    if (response.ok) {
      const data = await response.json();
      authState.user = data.user;
      authState.isAuthenticated = true;
      // 更新 userId 为登录用户的 ID
      if (data.user?.userId) {
        state.userId = data.user.userId;
      }
      updateAuthUI();
      return;
    }
  } catch {
    // Ignore fetch failures and fall through to guest state.
  }

  authState.user = null;
  authState.isAuthenticated = false;
  state.userId = "demo-user";
  updateAuthUI();
}

// 更新认证 UI
function updateAuthUI() {
  if (authState.isAuthenticated && authState.user) {
    loginButton?.classList.add("hidden");
    userProfile?.classList.remove("hidden");
    if (userAvatar) {
      userAvatar.src = authState.user.avatar || "/default-avatar.png";
      userAvatar.alt = authState.user.displayName || authState.user.username;
    }
    if (userName) {
      userName.textContent = authState.user.displayName || authState.user.username;
    }
  } else {
    loginButton?.classList.remove("hidden");
    userProfile?.classList.add("hidden");
  }
}

// ==================== 应用主逻辑 ====================

const AGENT_LABELS = {
  joy: "喜",
  sadness: "哀",
  anger: "怒",
  fear: "惧",
  disgust: "厌"
};

const AGENT_COLORS = {
  joy: "var(--joy)",
  sadness: "var(--sadness)",
  anger: "var(--anger)",
  fear: "var(--fear)",
  disgust: "var(--disgust)"
};

const PIXEL_STAGE_LAYOUT = {
  joy: { x: 244, y: 540, station: "欢欣台", desk: "调光屏", prop: "灯条", trait: "暖色领结" },
  sadness: { x: 330, y: 608, station: "共情台", desk: "安抚终端", prop: "热饮", trait: "蓝色围巾" },
  anger: { x: 792, y: 608, station: "边界台", desk: "警戒屏", prop: "红灯", trait: "厚眉短夹克" },
  fear: { x: 878, y: 542, station: "预警台", desk: "扫描仪", prop: "雷达", trait: "竖天线耳机" },
  disgust: { x: 706, y: 540, station: "过滤台", desk: "清洁屏", prop: "滤芯", trait: "斜刘海口罩" }
};

const WORKBENCH_CORE = { x: 544, y: 558 };
const INTERACTION_SPOTS = {
  active: {
    joy: { x: 408, y: 484 },
    sadness: { x: 448, y: 534 },
    anger: { x: 642, y: 534 },
    fear: { x: 680, y: 484 },
    disgust: { x: 612, y: 474 }
  },
  interrupt: {
    joy: { x: 376, y: 454 },
    sadness: { x: 430, y: 516 },
    anger: { x: 670, y: 516 },
    fear: { x: 710, y: 452 },
    disgust: { x: 626, y: 444 }
  },
  dominant: {
    joy: { x: 470, y: 486 },
    sadness: { x: 494, y: 518 },
    anger: { x: 594, y: 518 },
    fear: { x: 620, y: 486 },
    disgust: { x: 570, y: 474 }
  }
};

const PHASE_TITLES = {
  "input-arrival": "输入到达",
  "risk-scan": "风险扫描",
  filter: "社交过滤",
  boundary: "边界判断",
  empathy: "共情接住",
  hope: "希望整合",
  interrupt: "插话与争论",
  dominance: "抢控制台",
  compose: "主脑汇总"
};

const state = {
  userId: "demo-user",
  sessionId: `demo-${Math.random().toString(36).slice(2, 10)}`,
  imageUrls: [],
  audioTranscript: "",
  mediaRecorder: null,
  recordedChunks: [],
  sequenceRunId: 0,
  latestPayload: null,
  sceneCamera: {
    x: -120,
    y: -80,
    scale: 0.92
  },
  sceneDrag: {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  },
  sceneAutoFocusSuspendedUntil: 0,
  agentGrowth: {
    joy: { level: 1, xp: 0, temperamentShift: "更会点亮气氛" },
    sadness: { level: 1, xp: 0, temperamentShift: "更会安静接住情绪" },
    anger: { level: 1, xp: 0, temperamentShift: "更会保护边界" },
    fear: { level: 1, xp: 0, temperamentShift: "更会预判风险" },
    disgust: { level: 1, xp: 0, temperamentShift: "更会过滤别扭表达" }
  }
};

const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("sendButton");
const chatStatus = document.getElementById("chatStatus");
const chatMessages = document.getElementById("chatMessages");
const agentGrid = document.getElementById("agentGrid");
const dominantAgentNode = document.getElementById("dominantAgent");
const consensusSummaryNode = document.getElementById("consensusSummary");
const growthStageNode = document.getElementById("growthStage");
const understandingScoreNode = document.getElementById("understandingScore");
const intimacyScoreNode = document.getElementById("intimacyScore");
const interactionCountNode = document.getElementById("interactionCount");
const growthNoteNode = document.getElementById("growthNote");
const memoryListNode = document.getElementById("memoryList");
const babyMoodNode = document.getElementById("babyMood");
const imageInput = document.getElementById("imageInput");
const imagePreviewList = document.getElementById("imagePreviewList");
const attachmentPanel = document.getElementById("attachmentPanel");
const audioTranscriptBox = document.getElementById("audioTranscriptBox");
const recordButton = document.getElementById("recordButton");
const taskTimeline = document.getElementById("taskTimeline");
const providerBadge = document.getElementById("providerBadge");
const scenePhaseLabel = document.getElementById("scenePhaseLabel");
const sceneViewport = document.getElementById("sceneViewport");
const sceneWorld = document.getElementById("sceneWorld");
const sceneSpriteLayer = document.querySelector(".scene-sprite-layer");
const sceneLinks = document.getElementById("sceneLinks");
const sceneBuildings = document.getElementById("sceneBuildings");
const zoomOutButton = document.getElementById("zoomOutButton");
const zoomResetButton = document.getElementById("zoomResetButton");
const zoomInButton = document.getElementById("zoomInButton");

renderAgentCards([]);
renderCyberTown(createIdleAgents(), null, null);
setupSceneViewport();
resetSceneView(true);
void loadPersistedMemories();

imageInput.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files ?? []);
  const encoded = await Promise.all(files.map(fileToDataUrl));
  state.imageUrls.push(...encoded);
  renderAttachments();
  chatStatus.textContent = `已添加 ${state.imageUrls.length} 张图片，发送后会进入知机的视觉理解链路。`;
  imageInput.value = "";
});

recordButton.addEventListener("click", async () => {
  if (state.mediaRecorder && state.mediaRecorder.state === "recording") {
    state.mediaRecorder.stop();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    chatStatus.textContent = "当前浏览器不支持录音。";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    state.recordedChunks = [];
    state.mediaRecorder = mediaRecorder;
    recordButton.textContent = "停止录音";
    chatStatus.textContent = "录音中，点击按钮结束并转写。";

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        state.recordedChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener("stop", async () => {
      recordButton.textContent = "语音输入";
      chatStatus.textContent = "正在转写语音……";
      stream.getTracks().forEach((track) => track.stop());

      try {
        const blob = new Blob(state.recordedChunks, { type: mediaRecorder.mimeType || "audio/webm" });
        const formData = new FormData();
        formData.append("file", blob, "voice.webm");

        const response = await fetch("/api/audio/transcribe", {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          throw new Error(`语音转写失败：${response.status}`);
        }

        const payload = await response.json();
        state.audioTranscript = payload.transcript ?? "";
        renderAttachments();
        chatStatus.textContent = "语音已转写，发送后会连同文字一起交给知机。";
      } catch (error) {
        chatStatus.textContent = error instanceof Error ? error.message : "语音转写失败";
      }
    });

    mediaRecorder.start();
  } catch (error) {
    chatStatus.textContent = error instanceof Error ? error.message : "无法开始录音";
  }
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text && !state.audioTranscript && state.imageUrls.length === 0) return;
  if (requireLoginForInteraction("请先登录 SecondMe，再让操作室里的小人开始讨论。")) return;

  appendMessage("你", text || state.audioTranscript || "发送了一张图片", "user");
  chatInput.value = "";
  chatStatus.textContent = "知机正在调动五个情绪排队上前讨论……";
  sendButton.disabled = true;
  recordButton.disabled = true;
  state.sequenceRunId += 1;
  const runId = state.sequenceRunId;

  try {
    // 使用流式 API
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: state.userId,
        sessionId: state.sessionId,
        text,
        imageUrls: state.imageUrls,
        audioTranscript: state.audioTranscript
      })
    });

    if (!response.ok) {
      throw new Error(`请求失败：${response.status}`);
    }

    // 初始化流式状态
    const streamState = {
      agents: [],
      messageBuffer: "",
      dominantAgent: null,
      consensusSummary: "",
      memories: { relevantMemories: [], newMemories: [] },
      growth: null,
      complete: false
    };

    // 处理 SSE 流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      if (runId !== state.sequenceRunId) {
        reader.cancel();
        return;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        const [eventLine, ...dataLines] = line.split("\n");
        const eventType = eventLine.replace("event: ", "").trim();
        const dataJson = dataLines.join("\n").replace("data: ", "").trim();

        try {
          const data = JSON.parse(dataJson);
          handleStreamEvent(eventType, data, streamState, runId);
        } catch (e) {
          console.error("Failed to parse SSE data:", e);
        }
      }
    }

    // 流结束后的最终处理
    if (runId === state.sequenceRunId && streamState.complete) {
      state.latestPayload = {
        message: { reply: streamState.messageBuffer },
        agents: streamState.agents,
        console: {
          dominantAgent: streamState.dominantAgent,
          consensusSummary: streamState.consensusSummary,
          tasks: [],
          sequence: []
        },
        memory: streamState.memories,
        growth: streamState.growth,
        meta: { providerStatus: "live", degraded: false }
      };
      resetAttachments();
      chatStatus.textContent = "知机已经完成这一轮内部讨论。";
    }

  } catch (error) {
    chatStatus.textContent = error instanceof Error ? error.message : "请求失败";
  } finally {
    if (runId === state.sequenceRunId) {
      sendButton.disabled = false;
      recordButton.disabled = false;
    }
  }
});

// 处理流式事件
function handleStreamEvent(eventType, data, streamState, runId) {
  switch (eventType) {
    case "safety":
      chatStatus.textContent = "安全检查完成，正在进行视觉理解...";
      break;

    case "visualContext":
      chatStatus.textContent = data?.has_sensitive_content
        ? "检测到敏感内容，正在谨慎处理..."
        : "视觉理解完成，正在检索相关记忆...";
      break;

    case "memory":
      streamState.memories.relevantMemories = data.relevant_memories || [];
      chatStatus.textContent = `检索到 ${data.count} 条相关记忆，情绪小人正在准备...`;
      break;

    case "agentReady":
      // 核心需求：逐个添加小人卡片
      streamState.agents.push(data);
      renderAgentCards(streamState.agents, streamState.dominantAgent, data.agent);
      renderCyberTown(streamState.agents, streamState.dominantAgent, {
        actor: data.agent,
        mode: "announce",
        detail: `${data.agent} 已准备就绪`
      });

      // 触发小人出现的动画
      triggerAgentAppearAnimation(data.agent);
      chatStatus.textContent = `${AGENT_LABELS[data.agent] || data.agent} 已准备就绪，等待其他情绪...`;
      break;

    case "dominantAgent":
      streamState.dominantAgent = data.agent;
      streamState.consensusSummary = data.consensus_summary;

      // 更新主导情绪 UI
      dominantAgentNode.textContent = AGENT_LABELS[data.agent] || data.agent;
      babyMoodNode.textContent = `本轮更偏${AGENT_LABELS[data.agent] || data.agent}系守护`;

      // 刷新所有小人卡片状态
      renderAgentCards(streamState.agents, data.agent, null);
      renderCyberTown(streamState.agents, data.agent, null);

      if (data.consensus_summary) {
        consensusSummaryNode.textContent = data.consensus_summary;
      }
      chatStatus.textContent = `${AGENT_LABELS[data.agent] || data.agent} 取得主导权，正在整理回复...`;
      break;

    case "messageChunk":
      // 核心需求：流式显示消息
      if (data.is_complete) {
        // 完整消息
        if (!streamState.messageBuffer && data.chunk) {
          streamState.messageBuffer = data.chunk;
          appendMessage("知机", data.chunk, "baby");
        }
      } else {
        // 流式片段，逐步累积
        streamState.messageBuffer += data.chunk;
        updateStreamingMessage(data.chunk);
      }
      break;

    case "memoryStore":
      streamState.memories.newMemories = data.new_memories || [];
      renderMemory(streamState.memories);
      chatStatus.textContent = `存储了 ${data.count} 条新记忆，正在更新成长状态...`;
      break;

    case "growth":
      streamState.growth = data;
      updateAgentGrowthFromPayload(data);
      renderGrowth({ growth: data });
      break;

    case "complete":
      streamState.complete = true;
      if (data.warnings && data.warnings.length > 0) {
        chatStatus.textContent = data.warnings[0];
      }

      // 更新提供商状态
      providerBadge.textContent = data.provider_status === "live" ? "实时模型" : "本地降级";
      providerBadge.className = `tag ${data.provider_status === "live" ? "" : "pill-muted"}`;
      break;

    case "error":
      chatStatus.textContent = `错误：${data.message}`;
      if (data.fallback) {
        chatStatus.textContent += " (已启用降级模式)";
      }
      break;
  }
}

// 辅助函数：流式消息更新
function updateStreamingMessage(chunk) {
  let lastMessage = chatMessages.lastElementChild;

  if (!lastMessage || !lastMessage.classList.contains("streaming")) {
    // 创建新的流式消息容器
    lastMessage = document.createElement("article");
    lastMessage.className = "message message-baby streaming";
    lastMessage.innerHTML = `
      <div class="message-role">知机</div>
      <div class="message-bubble"></div>
    `;
    chatMessages.appendChild(lastMessage);
  }

  // 追加新的文本片段
  const bubble = lastMessage.querySelector(".message-bubble");
  bubble.textContent += chunk;
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 辅助函数：触发小人出现动画
function triggerAgentAppearAnimation(agent) {
  const agentCard = document.querySelector(`[data-agent="${agent}"]`);
  if (agentCard) {
    agentCard.classList.add("agent-appear");
    setTimeout(() => {
      agentCard.classList.remove("agent-appear");
    }, 600);
  }
}

async function playConsoleSequence(payload, runId) {
  updateAgentGrowthFromPayload(payload.growth);
  providerBadge.textContent = payload.meta.providerStatus === "live" ? "实时模型" : "本地降级";
  providerBadge.className = `tag ${payload.meta.providerStatus === "live" ? "" : "pill-muted"}`;
  dominantAgentNode.textContent = "讨论中";
  consensusSummaryNode.textContent = "情绪正在排队上前讨论，主脑尚未汇总。";
  babyMoodNode.textContent = "操作室正在分配发言顺序";
  renderTaskTimeline(payload.console.tasks, null);
  renderAgentCards(payload.agents, null, null);
  renderCyberTown(payload.agents, null, null);
  resetSceneView();

  for (const step of payload.console.sequence) {
    if (runId !== state.sequenceRunId) {
      return;
    }

    const dominantAgent =
      step.mode === "take-console" || step.mode === "compose"
        ? payload.console.dominantAgent
        : null;


    renderTaskTimeline(payload.console.tasks, step.id);
    renderAgentCards(payload.agents, dominantAgent, step.actor);
    renderCyberTown(payload.agents, payload.console.dominantAgent, step);
    autoFocusScene(step, payload.console.dominantAgent);

    if (step.mode === "take-console") {
      dominantAgentNode.textContent = AGENT_LABELS[payload.console.dominantAgent];
      babyMoodNode.textContent = `本轮更偏${AGENT_LABELS[payload.console.dominantAgent]}系守护`;
    }

    if (step.mode === "compose") {
      consensusSummaryNode.textContent = payload.console.consensusSummary;
      growthNoteNode.textContent = payload.message.growthNote;
      chatStatus.textContent = payload.meta.warnings?.[0] ?? "主脑正在把讨论结果整理成回答。";
    }

    await delay(step.durationMs);
  }

  if (runId !== state.sequenceRunId) {
    return;
  }

  renderAgentCards(payload.agents, payload.console.dominantAgent, payload.console.dominantAgent);
  renderCyberTown(payload.agents, payload.console.dominantAgent, null);
  resetSceneView();
  renderTaskTimeline(payload.console.tasks, null);
}

function appendMessage(role, content, type) {
  const message = document.createElement("article");
  message.className = `message message-${type}`;
  message.innerHTML = `
    <div class="message-role">${escapeHtml(role)}</div>
    <div class="message-bubble">${escapeHtml(content)}</div>
  `;
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderGrowth(payload) {
  growthStageNode.textContent = payload.growth.stage;
  understandingScoreNode.textContent = `${payload.growth.understandingScore}%`;
  intimacyScoreNode.textContent = `${payload.growth.intimacyScore}%`;
  interactionCountNode.textContent = `${payload.growth.interactionCount}`;
  growthNoteNode.textContent = payload.message.growthNote;
}

function renderMemory(memory) {
  if (memory.newMemories.length === 0 && memory.relevantMemories.length === 0) {
    memoryListNode.innerHTML = `<li class="memory-empty">这一轮还没有沉淀新的记忆。</li>`;
    return;
  }

  const entries = [...memory.newMemories, ...memory.relevantMemories.slice(0, 2)];
  memoryListNode.innerHTML = entries
    .map((item) => `<li><strong>${escapeHtml(item.category)}</strong> · ${escapeHtml(item.text)}</li>`)
    .join("");
}

function renderAttachments() {
  const hasImages = state.imageUrls.length > 0;
  const hasTranscript = Boolean(state.audioTranscript);
  attachmentPanel.classList.toggle("hidden", !hasImages && !hasTranscript);

  imagePreviewList.innerHTML = state.imageUrls
    .map(
      (url, index) => `
        <div class="image-preview-item">
          <img src="${url}" alt="待发送图片 ${index + 1}" />
          <button type="button" class="image-preview-remove" data-remove-image="${index}">×</button>
        </div>
      `
    )
    .join("");

  audioTranscriptBox.textContent = hasTranscript ? `语音转写：${state.audioTranscript}` : "";

  imagePreviewList.querySelectorAll("[data-remove-image]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.getAttribute("data-remove-image"));
      state.imageUrls.splice(index, 1);
      renderAttachments();
    });
  });
}

function renderTaskTimeline(tasks, activeTaskId) {
  if (!tasks?.length) {
    taskTimeline.innerHTML = "";
    return;
  }

  taskTimeline.innerHTML = tasks
    .slice()
    .sort((left, right) => left.priority - right.priority)
    .map(
      (task) => `
        <article class="task-item ${task.status === "fallback" ? "is-fallback" : ""} ${
          task.id === activeTaskId ? "is-visible" : ""
        }">
          <div class="task-icon">${renderOwnerGlyph(task.owner)}</div>
          <div>
            <div class="task-title-row">
              <strong>${escapeHtml(task.title)}</strong>
              <span class="task-owner">${escapeHtml(renderOwnerLabel(task.owner))}</span>
            </div>
            <p class="task-detail">${escapeHtml(task.detail)}</p>
          </div>
        </article>
      `
    )
    .join("");

  if (!activeTaskId) {
    [...taskTimeline.querySelectorAll(".task-item")].forEach((node, index) => {
      setTimeout(() => node.classList.add("is-visible"), 90 * index);
    });
  }
}

function renderCyberTown(agents, dominantAgent, currentStep) {
  scenePhaseLabel.textContent = currentStep ? `${PHASE_TITLES[currentStep.phase] ?? "操作室联动中"} · 像素场景搭建中` : "像素场景搭建中";
  syncMainWorkbenchState(currentStep, dominantAgent);
  const stageAgents = agents?.length ? agents : createIdleAgents();
  sceneBuildings.innerHTML = renderPixelStage(stageAgents, dominantAgent, currentStep);
  sceneLinks.innerHTML = renderPixelLinks(stageAgents, dominantAgent, currentStep);
}

function syncMainWorkbenchState(currentStep, dominantAgent) {
  if (!sceneSpriteLayer) {
    return;
  }

  sceneSpriteLayer.classList.remove("is-idle", "is-active", "is-compose", "is-dominant", "theme-joy", "theme-sadness", "theme-anger", "theme-fear", "theme-disgust");

  if (!currentStep) {
    sceneSpriteLayer.classList.add(dominantAgent ? "is-dominant" : "is-idle");
    if (dominantAgent) {
      sceneSpriteLayer.classList.add(`theme-${dominantAgent}`);
    }
    return;
  }

  if (currentStep.mode === "compose") {
    sceneSpriteLayer.classList.add("is-compose");
    if (dominantAgent) {
      sceneSpriteLayer.classList.add(`theme-${dominantAgent}`);
    }
    return;
  }

  if (currentStep.mode === "take-console") {
    sceneSpriteLayer.classList.add("is-dominant");
    if (dominantAgent) {
      sceneSpriteLayer.classList.add(`theme-${dominantAgent}`);
    }
    return;
  }

  sceneSpriteLayer.classList.add("is-active");
  if (currentStep.actor && currentStep.actor in AGENT_LABELS) {
    sceneSpriteLayer.classList.add(`theme-${currentStep.actor}`);
  }
}

function renderPixelStage(agents, dominantAgent, currentStep) {
  return agents
    .map((agent) => {
      const layout = PIXEL_STAGE_LAYOUT[agent.agent];
      const nodeState = resolvePixelAgentState(agent.agent, dominantAgent, currentStep);
      const position = resolvePixelAgentPosition(agent.agent, dominantAgent, currentStep);
      const isAway = position.x !== layout.x || position.y !== layout.y;
      const facing = position.x < WORKBENCH_CORE.x ? "right" : "left";
      const weight = Math.round((agent.weight ?? 0) * 100);
      return `
        <div class="pixel-agent-stage stage-${agent.agent} is-${nodeState} ${isAway ? "is-away" : "is-home"} facing-${facing}" data-agent="${agent.agent}" data-state="${nodeState}" style="--x:${position.x}px; --y:${position.y}px; --agent-color:${AGENT_COLORS[agent.agent]}; --home-x:${layout.x}px; --home-y:${layout.y}px;">
          <div class="pixel-station stage-${agent.agent}">
            <div class="pixel-station-top"></div>
            <div class="pixel-station-monitor"></div>
            <div class="pixel-station-desk"></div>
            <div class="pixel-station-prop"></div>
            <div class="pixel-station-accent"></div>
          </div>
          <div class="pixel-agent-signal signal-${nodeState}"></div>
          <div class="pixel-agent-body mood-${agent.mood ?? "calm"} agent-${agent.agent}">
            <span class="pixel-agent-shadow"></span>
            <span class="pixel-agent-head"></span>
            <span class="pixel-agent-hair"></span>
            <span class="pixel-agent-accessory"></span>
            <span class="pixel-agent-eye eye-left"></span>
            <span class="pixel-agent-eye eye-right"></span>
            <span class="pixel-agent-torso"></span>
            <span class="pixel-agent-arm arm-left"></span>
            <span class="pixel-agent-arm arm-right"></span>
            <span class="pixel-agent-leg leg-left"></span>
            <span class="pixel-agent-leg leg-right"></span>
          </div>
          <div class="pixel-agent-label">
            <strong>${AGENT_LABELS[agent.agent]} · ${layout.station}</strong>
            <span>${escapeHtml(agent.care_goal || layout.desk)} · ${layout.prop}</span>
            <span>${layout.trait}</span>
            <span>影响力 ${weight}%</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function resolvePixelAgentPosition(agent, dominantAgent, currentStep) {
  const home = PIXEL_STAGE_LAYOUT[agent];
  if (!currentStep) {
    return home;
  }

  if (currentStep.mode === "compose") {
    if (agent === dominantAgent) {
      return INTERACTION_SPOTS.dominant[agent] ?? home;
    }
    return home;
  }

  if (currentStep.mode === "take-console" && agent === dominantAgent) {
    return INTERACTION_SPOTS.dominant[agent] ?? home;
  }

  if (currentStep.mode === "interrupt" && currentStep.actor === agent) {
    return INTERACTION_SPOTS.interrupt[agent] ?? home;
  }

  if ((currentStep.mode === "speak" || currentStep.mode === "announce") && currentStep.actor === agent) {
    return INTERACTION_SPOTS.active[agent] ?? home;
  }

  return home;
}

function resolvePixelAgentState(agent, dominantAgent, currentStep) {
  if (currentStep?.mode === "compose") {
    return agent === dominantAgent ? "dominant" : "idle";
  }
  if (currentStep?.mode === "take-console" && agent === dominantAgent) {
    return "dominant";
  }
  if (currentStep?.actor === agent) {
    if (currentStep.mode === "interrupt") {
      return "interrupting";
    }
    return "active";
  }
  if (!currentStep && agent === dominantAgent) {
    return "dominant";
  }
  return "idle";
}

function renderPixelLinks(agents, dominantAgent, currentStep) {
  return agents
    .map((agent) => {
      const layout = PIXEL_STAGE_LAYOUT[agent.agent];
      const dx = layout.x - WORKBENCH_CORE.x;
      const dy = layout.y - WORKBENCH_CORE.y;
      const length = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const state = resolvePixelLinkState(agent.agent, dominantAgent, currentStep);
      return `
        <div class="pixel-link link-${agent.agent} is-${state}" style="--link-x:${WORKBENCH_CORE.x}px; --link-y:${WORKBENCH_CORE.y}px; --link-length:${length}px; --link-angle:${angle}rad; --agent-color:${AGENT_COLORS[agent.agent]};">
          <span class="pixel-link-beam"></span>
          <span class="pixel-link-pulse"></span>
        </div>
      `;
    })
    .join("");
}

function resolvePixelLinkState(agent, dominantAgent, currentStep) {
  if (currentStep?.mode === "compose") {
    return agent === dominantAgent ? "compose" : "idle";
  }
  if (currentStep?.mode === "take-console") {
    return agent === dominantAgent ? "dominant" : "idle";
  }
  if (currentStep?.mode === "interrupt" && currentStep.actor === agent) {
    return "interrupting";
  }
  if (currentStep?.actor === agent) {
    return "active";
  }
  if (!currentStep && agent === dominantAgent) {
    return "dominant";
  }
  return "idle";
}

function setupSceneViewport() {
  if (!sceneViewport || !sceneWorld) {
    return;
  }

  const suspendAutoFocus = () => {
    state.sceneAutoFocusSuspendedUntil = Date.now() + 2600;
  };

  sceneViewport.addEventListener("pointerdown", (event) => {
    state.sceneDrag.active = true;
    state.sceneDrag.pointerId = event.pointerId;
    state.sceneDrag.startX = event.clientX;
    state.sceneDrag.startY = event.clientY;
    state.sceneDrag.originX = state.sceneCamera.x;
    state.sceneDrag.originY = state.sceneCamera.y;
    sceneViewport.classList.add("is-dragging");
    sceneViewport.setPointerCapture(event.pointerId);
    suspendAutoFocus();
  });

  sceneViewport.addEventListener("pointermove", (event) => {
    if (!state.sceneDrag.active || event.pointerId !== state.sceneDrag.pointerId) {
      return;
    }

    const nextX = state.sceneDrag.originX + event.clientX - state.sceneDrag.startX;
    const nextY = state.sceneDrag.originY + event.clientY - state.sceneDrag.startY;
    setSceneCamera({ x: nextX, y: nextY }, { clamp: true });
  });

  const releaseDrag = (event) => {
    if (!state.sceneDrag.active || event.pointerId !== state.sceneDrag.pointerId) {
      return;
    }

    state.sceneDrag.active = false;
    state.sceneDrag.pointerId = null;
    sceneViewport.classList.remove("is-dragging");
    sceneViewport.releasePointerCapture(event.pointerId);
  };

  sceneViewport.addEventListener("pointerup", releaseDrag);
  sceneViewport.addEventListener("pointercancel", releaseDrag);
  sceneViewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    suspendAutoFocus();
    const nextScale = state.sceneCamera.scale * (event.deltaY > 0 ? 0.92 : 1.08);
    zoomScene(nextScale, event.offsetX, event.offsetY);
  }, { passive: false });

  sceneViewport.addEventListener("dblclick", () => {
    suspendAutoFocus();
    resetSceneView();
  });

  zoomOutButton.addEventListener("click", () => {
    suspendAutoFocus();
    zoomScene(state.sceneCamera.scale - 0.08);
  });

  zoomInButton.addEventListener("click", () => {
    suspendAutoFocus();
    zoomScene(state.sceneCamera.scale + 0.08);
  });

  zoomResetButton.addEventListener("click", () => {
    suspendAutoFocus();
    resetSceneView();
  });

  window.addEventListener("resize", () => {
    setSceneCamera({}, { clamp: true });
  });

  applySceneCamera();
}

function autoFocusScene(step, dominantAgent) {
  void step;
  void dominantAgent;
  if (Date.now() < state.sceneAutoFocusSuspendedUntil) {
    return;
  }
  resetSceneView();
}

function zoomScene(nextScale, anchorX, anchorY) {
  const viewportRect = sceneViewport.getBoundingClientRect();
  const worldX = (typeof anchorX === "number" ? anchorX : viewportRect.width / 2) - state.sceneCamera.x;
  const worldY = (typeof anchorY === "number" ? anchorY : viewportRect.height / 2) - state.sceneCamera.y;
  const normalizedScale = clamp(nextScale, 0.56, 1.3);
  const scaleRatio = normalizedScale / state.sceneCamera.scale;
  const nextX = (typeof anchorX === "number" ? anchorX : viewportRect.width / 2) - worldX * scaleRatio;
  const nextY = (typeof anchorY === "number" ? anchorY : viewportRect.height / 2) - worldY * scaleRatio;

  setSceneCamera({ x: nextX, y: nextY, scale: normalizedScale }, { clamp: true });
}

function resetSceneView(immediate = false) {
  const viewportWidth = sceneViewport.clientWidth || 1;
  const viewportHeight = sceneViewport.clientHeight || 1;
  const scale = 0.92;
  const nextX = (viewportWidth - sceneWorld.offsetWidth * scale) / 2;
  const nextY = (viewportHeight - sceneWorld.offsetHeight * scale) / 2;
  setSceneCamera({ x: nextX, y: nextY, scale }, { clamp: true, immediate });
}

function setSceneCamera(nextState, options = {}) {
  state.sceneCamera = {
    ...state.sceneCamera,
    ...nextState
  };

  if (options.clamp) {
    state.sceneCamera = clampSceneCamera(state.sceneCamera);
  }

  applySceneCamera(options.immediate);
}

function clampSceneCamera(camera) {
  const viewportWidth = sceneViewport.clientWidth || 1;
  const viewportHeight = sceneViewport.clientHeight || 1;
  const worldWidth = sceneWorld.offsetWidth * camera.scale;
  const worldHeight = sceneWorld.offsetHeight * camera.scale;

  const minX = Math.min(0, viewportWidth - worldWidth);
  const minY = Math.min(0, viewportHeight - worldHeight);
  const maxX = Math.max(0, viewportWidth - worldWidth);
  const maxY = Math.max(0, viewportHeight - worldHeight);

  return {
    ...camera,
    x: clamp(camera.x, minX, maxX),
    y: clamp(camera.y, minY, maxY)
  };
}

function applySceneCamera(immediate = false) {
  sceneWorld.style.transition = immediate || state.sceneDrag.active ? "none" : "transform 340ms ease";
  sceneWorld.style.transform = `translate(${state.sceneCamera.x}px, ${state.sceneCamera.y}px) scale(${state.sceneCamera.scale})`;
}

function renderAgentCards(agents, dominantAgent, activeAgent) {
  if (!agents.length) {
    agentGrid.innerHTML = Object.entries(AGENT_LABELS)
      .map(
        ([agent, label]) => `
          <article class="agent-card" style="--agent-color:${AGENT_COLORS[agent]}">
            <div class="agent-head">
              <div class="agent-title">
                <span class="agent-dot"></span>
                <strong>${label}</strong>
              </div>
              <span class="tag">待命</span>
            </div>
            <p class="muted">还没有收到本轮讨论内容。</p>
            <div class="agent-weight">
              <div class="weight-track"><div class="weight-fill" style="width:0%"></div></div>
              <div class="weight-label">影响力 0%</div>
            </div>
          </article>
        `
      )
      .join("");
    return;
  }

  agentGrid.innerHTML = agents
    .map((agent) => {
      const weight = Math.round(agent.weight * 100);
      const dominantClass = agent.agent === dominantAgent ? "is-dominant" : "";
      const activeText =
        agent.agent === activeAgent
          ? "发言中"
          : agent.agent === dominantAgent
            ? "主导中"
            : `Lv.${state.agentGrowth[agent.agent]?.level ?? 1}`;
      const growth = state.agentGrowth[agent.agent] ?? { level: 1, xp: 0 };
      return `
        <article class="agent-card ${dominantClass}" style="--agent-color:${AGENT_COLORS[agent.agent]}" data-agent="${agent.agent}">
          <div class="agent-head">
            <div class="agent-title">
              <span class="agent-dot"></span>
              <strong>${AGENT_LABELS[agent.agent]}</strong>
            </div>
            <span class="tag">${activeText}</span>
          </div>
          <p>${escapeHtml(agent.visibility_snippet)}</p>
          <div class="agent-weight">
            <div class="weight-track">
              <div class="weight-fill" style="width:${weight}%"></div>
            </div>
            <div class="weight-label">影响力 ${weight}% · ${escapeHtml(agent.care_goal)} · 成长 ${growth.xp}%</div>
          </div>
        </article>
      `;
    })
    .join("");
}

function createIdleAgents() {
  return Object.keys(AGENT_LABELS).map((agent) => ({
    agent,
    visibility_snippet: "操作室待命中。",
    weight: 0,
    emotion_view: "",
    care_goal: "",
    stance: "待命",
    energy: 1,
    mood: "calm"
  }));
}

function updateAgentGrowthFromPayload(growth) {
  if (growth?.agentGrowth) {
    state.agentGrowth = growth.agentGrowth;
  }
}

function resetAttachments() {
  state.imageUrls = [];
  state.audioTranscript = "";
  renderAttachments();
}

async function fileToDataUrl(file) {
  const rawDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });

  if (!file.type.startsWith("image/")) {
    return rawDataUrl;
  }

  return compressImageDataUrl(rawDataUrl);
}

async function compressImageDataUrl(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxDimension = 1440;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const targetWidth = Math.max(1, Math.round(image.width * scale));
      const targetHeight = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        resolve(dataUrl);
        return;
      }

      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

async function loadPersistedMemories() {
  try {
    const response = await fetch(`/api/memories?userId=${encodeURIComponent(state.userId)}`);
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    renderMemory({
      newMemories: [],
      relevantMemories: payload.memories ?? []
    });
  } catch {
    // Ignore cold-start failures.
  }
}

function renderOwnerGlyph(owner) {
  const map = {
    system: "舱",
    memory: "忆",
    baby: "机",
    joy: "喜",
    sadness: "哀",
    anger: "怒",
    fear: "惧",
    disgust: "厌"
  };
  return map[owner] ?? "机";
}

function renderOwnerLabel(owner) {
  const map = {
    system: "输入舱",
    memory: "记忆柜",
    baby: "主脑",
    joy: "喜工位",
    sadness: "哀工位",
    anger: "怒工位",
    fear: "惧工位",
    disgust: "厌工位"
  };
  return map[owner] ?? owner;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

if (typeof window !== "undefined") {
  window.__ZHJI_DEBUG__ = {
    renderCyberTown,
    renderPixelStage,
    renderPixelLinks,
    resolvePixelAgentPosition,
    resolvePixelAgentState,
    resolvePixelLinkState,
    syncMainWorkbenchState,
    createIdleAgents,
    state
  };
}

export {
  createIdleAgents,
  renderCyberTown,
  renderPixelLinks,
  renderPixelStage,
  resolvePixelAgentPosition,
  resolvePixelAgentState,
  resolvePixelLinkState,
  syncMainWorkbenchState,
  state
};
