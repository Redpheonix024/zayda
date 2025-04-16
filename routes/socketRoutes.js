const express = require('express');
const path = require('path');
const isAuthenticated = require("../middleware/authMiddleware");

const router = express.Router();
router.use(isAuthenticated);

router.get('/socket.io/socket.io.js', (req, res) => {
  res.setHeader('Content-Type', 'text/javascript');
  res.sendFile(path.join(__dirname, '../node_modules/socket.io/client-dist/socket.io.js'));
});

module.exports = router;
