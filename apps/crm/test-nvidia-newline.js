const axios = require('axios');
require('dotenv').config();

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const MODEL = 'qwen/qwen3.5-122b-a10b';

async function test() {
  try {
    const tokenWithNewline = process.env.NVIDIA_API_KEY + '\n';
    console.log("Using API Key:", tokenWithNewline);
    const response = await axios.post(
      `${NVIDIA_BASE_URL}/chat/completions`,
      {
        model: MODEL,
        messages: [{ role: 'user', content: `Hello` }],
        max_tokens: 50
      },
      {
        headers: {
          Authorization: `Bearer ${tokenWithNewline}`,
          'Content-Type': 'application/json'
        }
      }
    )
    console.log("SUCCESS");
  } catch (err) {
    console.log('ERROR:', err.response?.status, err.response?.statusText);
  }
}
test();
