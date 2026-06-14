const axios = require('axios');

async function test() {
  try {
    const response = await axios.post(
      `https://integrate.api.nvidia.com/v1/chat/completions`,
      {
        model: 'qwen/qwen3.5-122b-a10b',
        messages: [{ role: 'user', content: 'hello' }]
      },
      {
        headers: {
          Authorization: `Bearer `, // Empty token
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
