// 1. 确保使用 Node.js 运行时
export const runtime = 'nodejs';

export default async function handler(req: any, res: any) {
  // 增加对 OPTIONS 请求的处理（这是解决 CORS 跨域的关键预检请求）
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { messages } = req.body;
  if (!messages) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  // 检查 API Key 是否真的读取到了
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API Key not configured in Vercel' });
  }

  try {
    const response = await fetch(
      'https://api.deepseek.com/v1/chat/completions',
      {
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
      }
    );

    const data = await response.json();
    
    // 如果 DeepSeek 返回了错误信息，也转发给前端，方便调试
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err: any) {
    console.error('Backend Error:', err);
    return res.status(500).json({ error: err.message || 'DeepSeek request failed' });
  }
}
