const express = require("express");
const multer = require("multer");
const storageConfig = require("../utils/storage");
const path = require("path");
const isAuthenticated = require("../middleware/authMiddleware");

const router = express.Router();

router.use(isAuthenticated);

const uploadAudio = multer({
  storage: storageConfig("chats/upload/voicenotes"),
});
const uploadImage = multer({ storage: storageConfig("chats/upload/images") });

router.post("/upload/audio", uploadAudio.single("audio"), (req, res) => {
  res.json({ filename: req.file.filename });
});

router.post("/upload/image", uploadImage.single("image"), (req, res) => {
  res.json({ filename: req.file.filename });
});

router.use(
  "/chats/upload/images",
  express.static(path.join(__dirname, "../chats/upload/images"))
);
router.use(
  "/chats/upload/voicenotes",
  express.static(path.join(__dirname, "../chats/upload/voicenotes"))
);

module.exports = router;
