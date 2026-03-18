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

const state = {
  userId: "demo-user",
  sessionId: `demo-${Math.random().toString(36).slice(2, 10)}`,
  imageUrls: [],
  audioTranscript: "",
  mediaRecorder: null,
  recordedChunks: [],
  agentGrowth: {
    joy: { level: 1, xp: 0 },
    sadness: { level: 1, xp: 0 },
    anger: { level: 1, xp: 0 },
    fear: { level: 1, xp: 0 },
    disgust: { level: 1, xp: 0 }
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
const sceneRoster = document.getElementById("sceneRoster");

renderAgentCards([]);
renderSceneRoster([], null);
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

  appendMessage("你", text || state.audioTranscript || "发送了一张图片", "user");
  chatInput.value = "";
  chatStatus.textContent = "知机正在调动五个情绪开会……";
  sendButton.disabled = true;
  recordButton.disabled = true;

  try {
    const response = await fetch("/api/chat", {
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

    const payload = await response.json();
    appendMessage("知机", payload.message.reply, "baby");
    renderConsole(payload);
    renderGrowth(payload);
    renderMemory(payload.memory);
    resetAttachments();
    chatStatus.textContent = "知机已经完成这一轮内部讨论。";
  } catch (error) {
    chatStatus.textContent = error instanceof Error ? error.message : "请求失败";
  } finally {
    sendButton.disabled = false;
    recordButton.disabled = false;
  }
});

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

function renderConsole(payload) {
  dominantAgentNode.textContent = AGENT_LABELS[payload.console.dominantAgent] ?? payload.console.dominantAgent;
  consensusSummaryNode.textContent = payload.console.consensusSummary;
  babyMoodNode.textContent = `本轮更偏${AGENT_LABELS[payload.console.dominantAgent] ?? payload.console.dominantAgent}系守护`;
  updateAgentGrowth(payload.agents, payload.growth);
  renderAgentCards(payload.agents, payload.console.dominantAgent);
  renderSceneRoster(payload.agents, payload.console.dominantAgent);
  renderTaskTimeline(payload.console.tasks);
  providerBadge.textContent = payload.meta.providerStatus === "live" ? "实时模型" : "本地降级";
  providerBadge.className = `tag ${payload.meta.providerStatus === "live" ? "" : "pill-muted"}`;
  if (payload.meta.warnings?.length) {
    chatStatus.textContent = payload.meta.warnings[0];
  }
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
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.category)}</strong> · ${escapeHtml(item.text)}</li>`
    )
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

function renderTaskTimeline(tasks) {
  if (!tasks?.length) {
    taskTimeline.innerHTML = "";
    return;
  }

  taskTimeline.innerHTML = tasks
    .map(
      (task, index) => `
        <article class="task-item ${task.status === "fallback" ? "is-fallback" : ""}" data-task-index="${index}">
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

  [...taskTimeline.querySelectorAll(".task-item")].forEach((node, index) => {
    setTimeout(() => node.classList.add("is-visible"), 130 * index);
  });
}

function renderSceneRoster(agents, dominantAgent) {
  const speakingAgents = new Set((agents ?? []).map((agent) => agent.agent));
  const orderedAgents = agents?.length
    ? agents
    : Object.keys(AGENT_LABELS).map((agent) => ({
        agent,
        visibility_snippet: "还没有接到任务，正在等待主控台分配。",
        weight: 0,
        emotion_view: "",
        care_goal: ""
      }));

  sceneRoster.innerHTML = orderedAgents
    .map((agent, index) => {
      const growth = state.agentGrowth[agent.agent] ?? { level: 1, xp: 0 };
      const weight = Math.round((agent.weight ?? 0) * 100);
      const dominantClass = agent.agent === dominantAgent ? "is-dominant" : "";
      const speakingClass = speakingAgents.has(agent.agent) ? "is-speaking" : "";
      return `
        <div class="scene-agent ${dominantClass} ${speakingClass}" style="--agent-color:${AGENT_COLORS[agent.agent]}; --delay:${index * 0.18}s">
          <div class="scene-bubble">${escapeHtml(agent.visibility_snippet)}</div>
          <div class="scene-character">
            <div class="character-head">
              <div class="character-face">
                <div class="character-mouth"></div>
              </div>
            </div>
            <div class="character-body"></div>
            <div class="character-arm left"></div>
            <div class="character-arm right"></div>
            <div class="character-leg left"></div>
            <div class="character-leg right"></div>
          </div>
          <div class="scene-nameplate">
            <strong>${AGENT_LABELS[agent.agent]}</strong>
            <span>${weight}% 影响力</span>
            <div class="scene-level">Lv.${growth.level} · 成长 ${growth.xp}%</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function resetAttachments() {
  state.imageUrls = [];
  state.audioTranscript = "";
  renderAttachments();
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("读取图片失败"));
    reader.readAsDataURL(file);
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

function renderAgentCards(agents, dominantAgent) {
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
      const growth = state.agentGrowth[agent.agent] ?? { level: 1, xp: 0 };
      return `
        <article class="agent-card ${dominantClass}" style="--agent-color:${AGENT_COLORS[agent.agent]}">
          <div class="agent-head">
            <div class="agent-title">
              <span class="agent-dot"></span>
              <strong>${AGENT_LABELS[agent.agent]}</strong>
            </div>
            <span class="tag">${agent.agent === dominantAgent ? "主导中" : `Lv.${growth.level}`}</span>
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

function updateAgentGrowth(agents, growth) {
  const growthBoost = Math.max(4, Math.round((growth?.interactionCount ?? 1) / 2));
  agents.forEach((agent) => {
    const current = state.agentGrowth[agent.agent] ?? { level: 1, xp: 0 };
    const xpGain = Math.max(3, Math.round(agent.weight * 16) + growthBoost);
    let nextXp = current.xp + xpGain;
    let nextLevel = current.level;

    while (nextXp >= 100) {
      nextXp -= 100;
      nextLevel += 1;
    }

    state.agentGrowth[agent.agent] = {
      level: nextLevel,
      xp: nextXp
    };
  });
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
