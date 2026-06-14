const { fork } = require('child_process');
const path = require('path');

console.log('Starting Channel Service...');
fork(path.join(__dirname, 'apps/channel/dist/index.js'), [], {
  cwd: path.join(__dirname, 'apps/channel'),
  env: { ...process.env, PORT: 4000 }
});

console.log('Starting CRM Service...');
fork(path.join(__dirname, 'apps/crm/dist/index.js'), [], {
  cwd: path.join(__dirname, 'apps/crm'),
  env: process.env
});
