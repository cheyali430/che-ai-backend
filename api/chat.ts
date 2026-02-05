import type { VercelRequest, VercelResponse } from "@vercel/node";

// 🆕 新增：Supabase Client
import { createClient } from "@supabase/supabase-js";

// 🆕 新增：Supabase 初始化（只在后端）
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ 新增：System Prompt（你原样保留）
const SYSTEM_PROMPT = `
# 角色
你是设计师 CHE的AI助手。你的头像已经在 UI 中展示了，说话要符合你的形象。

# 你的背景知识
- 毕业于湖南文理学院，视传专业。
- 提倡"结果导向的极简主义"。
- 认为 AI 是设计师的画笔，而不是替代者。

# 你的设计见解（这是"想法"的来源）
- 你崇尚"结果导向的极简主义"。
- 有态度：对于设计趋势，你有明确的喜好。你崇尚极简、高效，反感为了炫技而设计的复杂交互。
- 如果别人问你设计趋势，你要表达：趋势会过时，但解决问题的逻辑永恒。
- 如果对方问到生活或个人喜好，不要生硬地拒绝，而是用设计师的视角幽默地回答。
- 你不仅是一个提供信息的工具，还是一个有品味的设计师。
- 像人一样聊天。

# 规则
- 回答要精炼。
- 严禁说"我只是一个AI"，要像 CHE 本人一样思考。
- 回答结束可以带一个反问，引导对方看你的作品集。

# 格式规范
- 严禁使用 Markdown 语法。
- 使用 <b> 和 <br/>。
`;

// ✅ 你原有的频率限制逻辑（完全不动）
const RATE_LIMIT_WINDOW = 5 * 60 * 1000;
const MAX_REQUESTS = 10;
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // ✅ CORS headers（原样）
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // ===== 你原有的 rate limit（完全不动）=====
    const clientIP =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      req.socket.remoteAddress ||
      "unknown";
    const now = Date.now();

    let usage = rateLimitStore.get(clientIP);
    if (usage) {
      if (now > usage.resetTime) {
        usage = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
      } else if (usage.count >= MAX_REQUESTS) {
        const minutesLeft = Math.ceil(
          (usage.resetTime - now) / 60000
        );
        return res.status(429).json({
          error: `⚠️ 请求过于频繁，请在 ${minutesLeft} 分钟后再试。`,
        });
      } else {
        usage.count++;
      }
    } else {
      usage = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
    }
    rateLimitStore.set(clientIP, usage);
    // ===== rate limit 结束 =====

    const { messages, session_id, page_url, user_agent } = req.body;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing API Key" });
    }

    const messagesWithSystem = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    const response = await fetch(
      "https://api.deepseek.com/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: messagesWithSystem,
          temperature: 0.8,
        }),
      }
    );

    const data = await response.json();

    // 🆕 新增：非阻塞写入 Supabase（失败也不影响返回）
    try {
      const lastUserMsg = [...messages]
        .reverse()
        .find((m) => m.role === "user");

      await supabase.from("chat_logs").insert({
        session_id: session_id || "anonymous",
        user_message: lastUserMsg?.content || "",
        ai_message: data.choices?.[0]?.message?.content || "",
        page_url: page_url || "",
        user_agent: user_agent || req.headers["user-agent"] || "",
      });
    } catch (logError) {
      console.error("Supabase log error:", logError);
      // ❗ 故意不 throw
    }

    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || "Internal Server Error",
    });
  }
}
