const fs = require('fs');

module.exports = {
  PORT: process.env.PORT || 3000,
  privateKey: fs.readFileSync('serverfiles/server.key', 'utf8'),
  certificate: fs.readFileSync('serverfiles/server.cert', 'utf8'),
  sessionSecret: 'your-secret-key'
};
