const multer = require('multer');
const path = require('path');
const mime = require('mime-types');

const storageConfig = (destinationPath) => multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, destinationPath);
  },
  filename: (req, file, cb) => {
    const ext = mime.extension(file.mimetype);
    cb(null, `${Date.now()}.${ext}`);
  }
});

module.exports = storageConfig;
