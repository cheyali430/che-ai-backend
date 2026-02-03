import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ✅ 关键修正：添加 CORS 头部（必须在所有响应之前设置）
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); // 生产环境建议改为具体域名
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 处理浏览器的预检请求 (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
