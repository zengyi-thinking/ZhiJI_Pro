// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  interface Window {
    __ZHJI_DEBUG__?: {
      renderCyberTown: (agents: any[], dominantAgent: string | null, currentStep: any) => void;
    };
  }
}

const html = readFileSync(resolve("public/index.html"), "utf8");

function installDom() {
  document.documentElement.innerHTML = html;

  const viewport = document.getElementById("sceneViewport");
  const world = document.getElementById("sceneWorld");
  if (!viewport || !world) {
    throw new Error("scene viewport missing");
  }

  Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 360 });
  Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 420 });
  Object.defineProperty(world, "offsetWidth", { configurable: true, value: 1120 });
  Object.defineProperty(world, "offsetHeight", { configurable: true, value: 820 });
  viewport.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 360,
    height: 420,
    top: 0,
    left: 0,
    right: 360,
    bottom: 420,
    toJSON: () => ({})
  });
  world.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 1120,
    height: 820,
    top: 0,
    left: 0,
    right: 1120,
    bottom: 820,
    toJSON: () => ({})
  });
}

describe("console scene", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    installDom();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ memories: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );
  });

  it("moves active characters toward the workbench and returns them after compose", async () => {
    await import("../public/app.js");

    const debug = window.__ZHJI_DEBUG__;
    expect(debug).toBeTruthy();
    if (!debug) {
      throw new Error("debug hooks missing");
    }

    const agents = [
      {
        agent: "joy",
        visibility_snippet: "让我来点亮一下气氛。",
        weight: 0.61,
        emotion_view: "先给一点亮色",
        care_goal: "先提振一点气氛",
        stance: "温柔鼓励",
        energy: 1,
        mood: "bright"
      },
      {
        agent: "sadness",
        visibility_snippet: "先把情绪接住。",
        weight: 0.48,
        emotion_view: "低落被看见",
        care_goal: "先共情",
        stance: "慢一点",
        energy: 1,
        mood: "supportive"
      },
      {
        agent: "anger",
        visibility_snippet: "我来守住边界。",
        weight: 0.35,
        emotion_view: "边界要清楚",
        care_goal: "守住边界",
        stance: "别再靠近",
        energy: 1,
        mood: "heated"
      },
      {
        agent: "fear",
        visibility_snippet: "先扫一遍风险。",
        weight: 0.29,
        emotion_view: "先看风险",
        care_goal: "降低意外",
        stance: "谨慎一点",
        energy: 1,
        mood: "alert"
      },
      {
        agent: "disgust",
        visibility_snippet: "先过滤杂音。",
        weight: 0.26,
        emotion_view: "这句别扭",
        care_goal: "净化表达",
        stance: "删掉噪音",
        energy: 1,
        mood: "calm"
      }
    ];

    debug.renderCyberTown(agents, null, {
      id: "speak-joy",
      actor: "joy",
      mode: "speak",
      phase: "hope",
      durationMs: 50,
      summary: "joy moves"
    });

    const joyNode = document.querySelector('.pixel-agent-stage[data-agent="joy"]');
    const joyLink = document.querySelector(".pixel-link.link-joy");
    const spriteLayer = document.querySelector(".scene-sprite-layer");

    expect(joyNode?.className).toContain("is-active");
    expect(joyNode?.className).toContain("is-away");
    expect(joyNode?.getAttribute("style")).toContain("--x:408px");
    expect(joyNode?.getAttribute("style")).toContain("--y:484px");
    expect(joyLink?.className).toContain("is-active");
    expect(spriteLayer?.className).toContain("is-active");
    expect(spriteLayer?.className).toContain("theme-joy");

    debug.renderCyberTown(agents, "sadness", {
      id: "compose-sadness",
      actor: "baby",
      mode: "compose",
      phase: "compose",
      durationMs: 50,
      summary: "compose"
    });

    const sadnessNode = document.querySelector('.pixel-agent-stage[data-agent="sadness"]');
    const sadnessLink = document.querySelector(".pixel-link.link-sadness");

    expect(sadnessNode?.className).toContain("is-dominant");
    expect(sadnessNode?.getAttribute("style")).toContain("--x:494px");
    expect(sadnessLink?.className).toContain("is-compose");
    expect(spriteLayer?.className).toContain("is-compose");
    expect(spriteLayer?.className).toContain("theme-sadness");

    debug.renderCyberTown(agents, "sadness", null);

    const returnedSadness = document.querySelector('.pixel-agent-stage[data-agent="sadness"]');
    expect(returnedSadness?.className).toContain("is-home");
    expect(returnedSadness?.getAttribute("style")).toContain("--x:330px");
    expect(returnedSadness?.getAttribute("style")).toContain("--y:608px");
  });
});
