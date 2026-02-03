import type { VercelRequest, VercelResponse } from '@vercel/node';

// 允许的前端域名列表
const ALLOWED_ORIGINS = [
  'https://snake-cookie-69189738.figma.site',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ===== 1️⃣ 动态 CORS 配置 =====
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // 如果不在白名单中，允许所有来源（生产环境建议移除）
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  // ===== 2️⃣ 处理 OPTIONS 预检请求 =====
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS 预检请求成功');
    return res.status(200).end();
  }

  // ===== 3️⃣ 只允许 POST 请求 =====
  if (req.method !== 'POST') {
    console.error('❌ 错误：不支持的请求方法', req.method);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ===== 4️⃣ 验证请求体 =====
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    console.error('❌ 错误：缺少 messages 参数');
    return res.status(400).json({ error: 'Missing or invalid messages parameter' });
  }

  // ===== 5️⃣ 验证 API Key =====
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('❌ 错误：未配置 DEEPSEEK_API_KEY 环境变量');
    return res.status(500).json({ error: 'API Key not configured in Vercel environment' });
  }

  console.log('🚀 开始调用 DeepSeek API...');
  console.log('📝 消息数量:', messages.length);

  // ===== 6️⃣ 调用 DeepSeek API =====
  try {
    const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.8,
        max_tokens: 2000,
        stream: false,
      }),
    });

    // ===== 7️⃣ 检查 DeepSeek 响应状态 =====
    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error('❌ DeepSeek API 错误:', deepseekResponse.status, errorText);
      return res.status(deepseekResponse.status).json({ 
        error: 'DeepSeek API request failed',
        status: deepseekResponse.status,
        details: errorText
      });
    }

    const data = await deepseekResponse.json();
    console.log('✅ DeepSeek API 调用成功');
    
    return res.status(200).json(data);

  } catch (err: any) {
    console.error('❌ 服务器错误:', err.message);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: err.message 
    });
  }
}
