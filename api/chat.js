export default async function handler(req: any, res: any) {
  // ===== 1. 设置 CORS 头部（放在最前面）=====
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // ===== 2. 处理 OPTIONS 预检请求 =====
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // ===== 3. 只允许 POST =====
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // ===== 4. 验证请求 =====
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Invalid messages format' });
      return;
    }

    // ===== 5. 获取 API Key =====
    const apiKey = process.env.DEEPSEEK_API_KEY;
    
    if (!apiKey) {
      console.error('❌ DEEPSEEK_API_KEY not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    console.log('🚀 Calling DeepSeek API...');

    // ===== 6. 调用 DeepSeek API =====
    const response = await fetch('https://api.deepseek.com/chat/completions', {
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
      }),
    });

    console.log('📊 DeepSeek response status:', response.status);

    // ===== 7. 处理 DeepSeek 响应 =====
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ DeepSeek error:', errorText);
      res.status(500).json({ 
        error: 'DeepSeek API failed',
        details: errorText 
      });
      return;
    }

    const data = await response.json();
    console.log('✅ Success');

    // ===== 8. 返回结果 =====
    res.status(200).json(data);

  } catch (error: any) {
    console.error('❌ Server error:', error.message);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
