const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET ;

const isAuthenticated = (req, res, next) => {
  // Extract the token from the Authorization header or cookies
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.split(" ")[1]) || req.cookies?.token;

  if (!token) {
    // No token provided, stop further processing and redirect
    return res.redirect("/login");
  }

  // Verify the JWT
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // Invalid or expired token, stop further processing and redirect
      return res.redirect("/login");
    }

    // Token is valid, attach user info to the request and proceed
    req.user = user;
    next();
  });
};

module.exports = isAuthenticated;
