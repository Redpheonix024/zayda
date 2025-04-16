const express = require("express");
const path = require("path");
const isAuthenticated = require("../middleware/authMiddleware");
const router = express.Router();
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

router.get("/login", (req, res) => {
  // Extract the token from the Authorization header or cookies
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.split(" ")[1]) || req.cookies?.token;

  if (token) {
    // Verify the JWT
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        // If the token is invalid or expired, show the login page
        return res.sendFile(path.join(__dirname, "../public/login.html"));
      }

      // If the token is valid, redirect to the dashboard
      res.redirect("/dashboard");
    });
  } else {
    // No token present, show the login page
    res.sendFile(path.join(__dirname, "../public/login.html"));
  }
});

router.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/register.html"));
});

router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

router.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.sendFile(path.join(__dirname, "../public/logout.html"));
});

router.use(isAuthenticated);
router.get("/profile", isAuthenticated, async (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/profile.html"));
});

router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

router.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/dashboard.html"));
});

router.get("/settings", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/setting.html"));
});

router.get("/sender-page", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/sender.html"));
});

router.get("/delivery-person-page", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/deliver.html"));
});

router.get("/delivery-option-page", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/deliveropt.html"));
});

router.get("/chat/:username", (req, res) => {
  res.sendFile(path.join(__dirname, "../chatbox/chat.html"));
});

router.get("/entries", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/entries.html"));
});

router.get("/deleventeries", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/deleverent.html"));
});

router.get("/update-entry-page", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/updateenteries.html"));
});

router.get("/update-delentry-page", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/update_delevery.html"));
});

router.get("/senderrequestpage", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/senderreq.html"));
});

router.get("/acceptedreqpage", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/acceptedreq.html"));
});

router.get("/accepteddelreqpage", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/acceptdel.html"));
});

router.get("/trackdeleveypage", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/tracksender.html"));
});

router.get("/tracksenderpage", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/trackdelev.html"));
});

router.get("/trackloctionsen", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/locationtacksen.html"));
});

router.get("/inhandpackage", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/ongoingdeliverytab.html"));
});

router.get("/reciver_dash", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/reciverdash.html"));
});

router.get("/completed_deliveries", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/completed.html"));
});

router.get("/transactionssender", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/transactions.html"));
});

module.exports = router;
