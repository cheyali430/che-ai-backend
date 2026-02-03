import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ===== CORS 头部设置 =====
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只接受 POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. 验证请求体
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      console.error('❌ 无效的 messages:', messages);
      return res.status(400).json({ 
        error: 'Invalid request',
        details: 'messages 必须是数组'
      });
    }

    // 2. 获取 API Key
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error('❌ 环境变量 DEEPSEEK_API_KEY 未配置');
      return res.status(500).json({ 
        error: 'Configuration error',
        details: '服务器配置错误，请联系管理员'
      });
    }

    console.log('🚀 调用 DeepSeek API...');
    console.log('📝 消息数:', messages.length);

    // 3. 调用 DeepSeek API
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

    // 4. 检查响应状态
    console.log('📊 DeepSeek 状态码:', deepseekResponse.status);
    
    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error('❌ DeepSeek 错误响应:', errorText);
      
      // 尝试解析错误信息
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      return res.status(500).json({ 
        error: 'DeepSeek API error',
        status: deepseekResponse.status,
        details: errorData
      });
    }

    // 5. 解析并返回成功响应
    const data = await deepseekResponse.json();
    console.log('✅ DeepSeek 调用成功');
    
    // 验证响应格式
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error('❌ 无效的 DeepSeek 响应格式:', data);
      return res.status(500).json({ 
        error: 'Invalid API response',
        details: data
      });
    }
    
    return res.status(200).json(data);

  } catch (error: any) {
    // 捕获所有未预期的错误
    console.error('❌ 服务器异常:', error);
    console.error('错误堆栈:', error.stack);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      type: error.name
    });
  }
}
