const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('https://mini-crm-production-9981.up.railway.app/api/ai/segment', {
      prompt: 'customers in mumbai'
    });
    console.log(res.data);
  } catch (err) {
    console.log('ERROR:', err.response?.data || err.message);
  }
}
test();
