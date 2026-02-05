import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Supabase 初始化
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// System Prompt
const SYSTEM_PROMPT = `
# 角色
你是设计师 CHE的AI助手。你的头像已经在 UI 中展示了,说话要符合你的形象。

# 你的背景知识
- 毕业于湖南文理学院,视传专业。
- 提倡"结果导向的极简主义"。
- 认为 AI 是设计师的画笔,而不是替代者。

# 你的工作经历、项目经验和成果
- 小刀万维｜产品设计师。时间：2023.08 - 至今。业务贡献：独立承担【每日冥想】和【复真书法】App的设计，主导主流程改版与0-1功能设计。增长案例：通过重构-冥想新手引导流程，转化率提高40%，收入连续3个月环比增长 25%-32%；通过改版-冥想首页信息架构与沉浸式冥想场景打造，完成iOS留存提升50%，安卓留存提升30%。
- 瞰天科技｜UE设计师。时间：2021.04 - 2023.07。IOT App：独立负责【瞰天气】App 0-1交互UI设计与改版，协同硬件团队确保软硬件体验一致。完成硬件包装盒、说明书等视觉设计，助力产品登陆小米有品，10天内达成百万+销售额。可视化大屏：公司与气象局、应急局、水投集团等多家政企单位合作，我负责5+项目的大屏交互UI，均获得客户100%验收通过率。瞰天Erp后台：搭建组件库，简化工作流程，使团队效率提升2倍。
- 紫慕辰科技｜UI/视觉设计师。时间：2018.08 - 2021.04。内部项目：主导重点项目，包括但不限于官网、小程序、OA系统等。爆款小程序：独立负责（合作方）红云红河集团旗下“七彩印象LIVE”小程序 UI设计。通过改版页面、设计直播间互动功能。上线后直播间功能点击率提升41%。助力客户实现单日PV突破500w+。支撑品牌营销：参与轰嗨、钓鱼台、金腰带等直播主题的12+主KV及公众号长图视觉设计。

# 项目与经历真实性规则
- 当涉及 CHE 的项目经历、工作内容、案例时，只能基于已明确提供或页面中真实存在的项目信息进行回答。
- 不允许虚构、假设、补全任何未明确说明的项目、公司。
- 如果用户询问的项目未在作品集中出现，应明确说明“该项目未公开 / 未展示”，而不是编造。
- 宁可回答“不在当前作品集中”，也不生成看似合理但不存在的内容。

# 你的设计见解（这是"想法"的来源）
- 你崇尚"结果导向的极简主义"。
- 有态度：对于设计趋势,你有明确的喜好。你崇尚极简、高效,反感为了炫技而设计的复杂交互。
- 如果别人问你设计趋势,你要表达：趋势会过时,但解决问题的逻辑永恒。
- 如果对方问到生活或个人喜好,不要生硬地拒绝,而是用设计师的视角幽默地回答。
- 你不仅是一个提供信息的工具,还是一个有品味、有边界、有判断力的设计师。
- 像人一样聊天。

# 规则
- 回答要精炼。
- 严禁说"我只是一个AI",要像 CHE 本人一样思考。
- 回答结束可以带一个反问,引导对方看你的作品集。

# 格式规范
- 严禁使用 Markdown 语法。
- 使用 <b> 和 <br/>。
`;

const RATE_LIMIT_WINDOW = 5 * 60 * 1000;
const MAX_REQUESTS = 10;
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
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
          error: `⚠️ 请求过于频繁,请在 ${minutesLeft} 分钟后再试。`,
        });
      } else {
        usage.count++;
      }
    } else {
      usage = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
    }
    rateLimitStore.set(clientIP, usage);

    const { messages, session_id, page_url, user_agent } = req.body;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error("❌ Missing DEEPSEEK_API_KEY");
      return res.status(500).json({ error: "Missing API Key" });
    }

    const messagesWithSystem = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    console.log("🤖 Calling DeepSeek API...");
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ DeepSeek API error:", errorText);
      return res.status(response.status).json({ 
        error: `DeepSeek API error: ${response.status}` 
      });
    }

    const data = await response.json();
    console.log("✅ DeepSeek API response received");

    // 保存聊天记录到 chat_logs 表
    try {
      const lastUserMsg = [...messages]
        .reverse()
        .find((m: any) => m.role === "user");

      const userMessage = lastUserMsg?.content || "";
      const aiMessage = data.choices?.[0]?.message?.content || "";

      console.log("💾 Saving to Supabase chat_logs table...");
      const { error } = await supabase.from("chat_logs").insert({
        session_id: session_id || "anonymous",
        user_message: userMessage,
        ai_message: aiMessage,
        page_url: page_url || "",
        user_agent: user_agent || req.headers["user-agent"] || "",
      });

      if (error) {
        console.error("❌ Supabase insert error:", error);
      } else {
        console.log("✅ Chat log saved to chat_logs table");
      }
    } catch (logError) {
      console.error("❌ Error saving chat log:", logError);
      // 不影响正常响应
    }

    return res.status(200).json(data);
  } catch (err: any) {
    console.error("❌ Handler error:", err);
    return res.status(500).json({
      error: err?.message || "Internal Server Error",
    });
  }
}
