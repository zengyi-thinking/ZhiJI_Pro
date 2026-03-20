// 测试 AI Gateway 流式输出支持
const BASE_URL = process.env.CREATION_AI_BASE_URL || "https://ai.t8star.cn/v1";
const API_KEY = process.env.CREATION_AI_API_KEY || "";

async function testStreamSupport() {
  console.log("正在测试 AI Gateway 流式输出支持...\n");
  console.log(`端点: ${BASE_URL}`);
  console.log(`模型: gpt-5-mini\n`);

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [{ role: "user", content: "你好，请简短回复" }],
        stream: true
      })
    });

    console.log(`响应状态: ${response.status}`);
    console.log(`Content-Type: ${response.headers.get("Content-Type")}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log("❌ 请求失败:");
      console.log(errorText);
      return false;
    }

    console.log("📡 接收流式响应:\n");
    console.log("---".repeat(20));

    const reader = response.body?.getReader();
    if (!reader) {
      console.log("❌ 无法获取响应流");
      return false;
    }

    const decoder = new TextDecoder();
    let chunkCount = 0;
    let hasValidSSE = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      chunkCount++;

      // 检测 SSE 格式
      if (chunk.includes("data: ")) {
        hasValidSSE = true;
        const lines = chunk.split("\n").filter(l => l.trim());
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              console.log(`\n[data: [DONE] - 流结束]`);
            } else {
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  process.stdout.write(content);
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      } else {
        // 不是 SSE 格式，直接输出
        process.stdout.write(chunk);
      }
    }

    console.log("\n");
    console.log("---".repeat(20));
    console.log(`\n✅ 测试完成!`);
    console.log(`   - 接收到 ${chunkCount} 个数据块`);
    console.log(`   - SSE 格式: ${hasValidSSE ? "✅ 是" : "❌ 否"}`);
    console.log(`   - 流式支持: ${hasValidSSE ? "✅ 支持" : "⚠️ 可能不支持"}`);

    return hasValidSSE;

  } catch (error) {
    console.log("❌ 测试失败:");
    console.log(error instanceof Error ? error.message : String(error));
    return false;
  }
}

// 运行测试
testStreamSupport().then(supported => {
  console.log(`\n结论: AI Gateway ${supported ? "支持" : "可能不支持"}流式输出`);
  process.exit(supported ? 0 : 1);
});
