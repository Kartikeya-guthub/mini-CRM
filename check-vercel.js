const https = require('https');
https.get('https://mini-crm-frontend-bice.vercel.app/', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const match = data.match(/src="(\/assets\/index-[^\"]+\.js)"/);
    if (match) {
      https.get('https://mini-crm-frontend-bice.vercel.app' + match[1], (r) => {
        let js = '';
        r.on('data', c => js += c);
        r.on('end', () => {
          const apiUrls = js.match(/https?:\/\/[^\/"]+\/api/g) || [];
          console.log('Compiled API URLs in JS:', [...new Set(apiUrls)]);
          console.log('Contains localhost?', js.includes('localhost'));
        });
      });
    } else {
      console.log('No JS matched');
    }
  });
});
