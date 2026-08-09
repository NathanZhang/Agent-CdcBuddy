const apiKey = process.env.SILICONFLOW_API_KEY || 'missing-siliconflow-api-key';
const baseURL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';

async function singleTest() {
  console.log('Sending request to SiliconFlow...');
  const start = Date.now();
  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen3.6-27B',
        messages: [{ role: 'user', content: '你好，请用一句话介绍你自己' }],
        max_tokens: 30
      })
    });
    console.log('Status:', res.status, 'Time:', Date.now() - start, 'ms');
    const data = await res.json();
    console.log('Content:', data.choices?.[0]?.message?.content);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

singleTest();
