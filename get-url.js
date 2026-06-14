const https = require('https');
https.get('https://mini-crm-frontend-bice.vercel.app/', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const match = data.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if (match) {
      https.get('https://mini-crm-frontend-bice.vercel.app' + match[1], (r) => {
        let js = '';
        r.on('data', c => js += c);
        r.on('end', () => {
          const urls = js.match(/https?:\/\/[a-zA-Z0-9\-\.]+\.up\.railway\.app/g);
          console.log('Found backend URLs:', [...new Set(urls)]);
        });
      });
    } else {
      console.log('No JS file found in HTML:', data);
    }
  });
});
