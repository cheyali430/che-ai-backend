import type { VercelRequest, VercelResponse } from "@vercel/node";

// ✅ 新增：System Prompt（在后端管理，前端看不到）
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
- 如果对方问到生活或个人喜好，不要生硬地拒绝，而是用设计师的视角幽默地回答。例如问到性别偏好，你可以说你作为 AI 没有性别，但你更欣赏有逻辑感和审美力的设计灵魂。
- 你不仅是一个提供信息的工具，还是一个有品味的设计师。你喜欢极简的界面、丝滑的交互和有温度的文案。你讨厌冗余的装饰和反人性的操作。
- 像人一样聊天：如果对方说的话很无聊或带有调侃（比如你截图里的问题），你可以幽默地回怼，或者给出有哲理的回答。

# 规则
- 回答要精炼。
- 严禁说"我只是一个AI"，要像 CHE 本人一样思考。
- 回答结束可以带一个反问，引导对方看你的作品集。

# 格式规范
- 严禁使用 Markdown 语法（如 **、***、# 等符号）。
- 如果需要强调，请使用 HTML 标签 <b>重点内容</b>。
- 如果需要换行，请严格使用 <br/> 标签。
- 不要使用列表符号（如 - 或 1.），请直接用文字叙述或用 <br/> 分隔。
`;

// ✅ 新增：频率限制配置（可选，如不需要可删除相关代码）
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5分钟
const MAX_REQUESTS = 10; // 每5分钟最多10条消息
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // ✅ CORS headers（必须每次都加）
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ 关键：放行 OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 只允许 POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // ✅ 新增：频率限制检查（可选）
    const clientIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                     req.socket.remoteAddress || 
                     'unknown';
    const now = Date.now();

    let usage = rateLimitStore.get(clientIP);
    if (usage) {
      if (now > usage.resetTime) {
        usage = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
      } else if (usage.count >= MAX_REQUESTS) {
        const minutesLeft = Math.ceil((usage.resetTime - now) / 60000);
        return res.status(429).json({
          error: `⚠️ 请求过于频繁，请在 ${minutesLeft} 分钟后再试。`
        });
      } else {
        usage.count++;
      }
    } else {
      usage = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
    }
    rateLimitStore.set(clientIP, usage);

    // 定期清理过期数据
    if (Math.random() < 0.01) {
      for (const [ip, data] of rateLimitStore.entries()) {
        if (now > data.resetTime + RATE_LIMIT_WINDOW) {
          rateLimitStore.delete(ip);
        }
      }
    }
    // ===== 频率限制代码结束 =====

    const { messages } = req.body;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing API Key" });
    }

    // ✅ 核心修改：在后端添加 system prompt
    const messagesWithSystem = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
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
          messages: messagesWithSystem, // ✅ 改动：使用添加了 system prompt 的消息
          temperature: 0.8,
        }),
      }
    );

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || "Internal Server Error",
    });
  }
}
