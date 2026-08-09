const apiKey = process.env.SILICONFLOW_API_KEY || 'missing-siliconflow-api-key';
const baseURL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';

async function checkModels() {
  try {
    const res = await fetch(`${baseURL}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await res.json();
    console.log('Available models count:', data.data?.length);
    const qwenModels = data.data?.filter(m => m.id.toLowerCase().includes('qwen') || m.id.toLowerCase().includes('deepseek')).map(m => m.id);
    console.log('Sample Qwen/DeepSeek models:', qwenModels?.slice(0, 15));
  } catch (err) {
    console.error('Error fetching models:', err);
  }
}

checkModels();
