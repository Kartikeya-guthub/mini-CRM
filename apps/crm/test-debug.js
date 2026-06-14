const axios = require('axios');
async function test() {
  try {
    const res = await axios.get('https://mini-crm-production-9981.up.railway.app/api/debug-env', { timeout: 10000 });
    console.log("DEBUG:", res.data);
  } catch (err) {
    console.log("ERROR:", err.response ? err.response.status : err.message);
  }
}
test();
