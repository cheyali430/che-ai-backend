import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ===== 🔥 CORS 配置 - 修复版 ===== 
  const allowedOrigins = [
    'https://snake-cookie-69189738.figma.site',
    'http://localhost:3000',
    'http://localhost:5173',
  ];

  const origin = req.headers.origin || '';
  
  // 如果请求来源在白名单中，或者包含 figma.site
  if (allowedOrigins.includes(origin) || origin.includes('figma.site')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // 其他来源也允许（方便调试）
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24小时缓存

  // 处理浏览器的预检请求 (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  // ===== CORS 配置结束 =====

  // 仅允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { messages } = req.body;
  if (!messages) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API Key not configured' });
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.8,
      }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'DeepSeek request failed', details: err.message });
  }
}
