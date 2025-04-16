const express = require("express");
const { User } = require("../mongoose/schemas");
const routes = express.Router();
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

const firebaseAdmin = require("firebase-admin");
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert({
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  }),
});

const bcrypt = require("bcryptjs");

routes.post("/register", async (req, res) => {
  const { username, password, phone, email } = req.body;
  try {
    // Check for invalid input
    if (!username || !password || !phone || !email) {
      throw new Error("All fields are required");
    }

    // Check if password is strong enough
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    // Check if email is valid
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email address");
    }

    // Check if phone number is valid
    // const phoneRegex = /^\d{10}$/;
    // if (!phoneRegex.test(phone)) {
    //   throw new Error("Invalid phone number");
    // } remove this comment in production

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      res
        .status(400)
        .json({ error: "Username already exists. Choose a different one." });
    } else {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = new User({
        username,
        password: hashedPassword,
        phone,
        email,
      });
      await newUser.save();

      res.json({ success: true, message: "User registered successfully" });
    }
  } catch (error) {
    console.error(error);

    if (error.message === "All fields are required") {
      res.status(400).json({ error: "All fields are required" });
    } else if (
      error.message === "Password must be at least 8 characters long"
    ) {
      res
        .status(400)
        .json({ error: "Password must be at least 8 characters long" });
    } else if (error.message === "Invalid email address") {
      res.status(400).json({ error: "Invalid email address" });
    } else if (error.message === "Invalid phone number") {
      res.status(400).json({ error: "Invalid phone number" });
    } else {
      res
        .status(500)
        .json({ error: "An error occurred. Please try again later." });
    }
  }
});

routes.post("/loginp", async (req, res) => {
  const { username, password } = req.body;
  try {
    // console.log("Received login request with username:", username);
    const user = await User.findOne({ username });

    if (user) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (isPasswordValid) {
        const token = jwt.sign({ username, userId: user._id }, JWT_SECRET, {
          expiresIn: "1h",
        });

        res.cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: 3600000,
        });

        return res.status(200).json({
          success: true,
          redirect: "/dashboard",
          message: "Login successful"
        });
      }
    }
    return res.status(401).json({
      success: false,
      message: "Invalid credentials"
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

routes.post("/loginotp", async (req, res) => {
  const { otp } = req.body;

  try {
    // Verify OTP using Firebase Admin SDK
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(otp);
    const phone = decodedToken.phone_number;
    console.log(phone);

    // Find the user by phone number
    const user = await User.findOne({ phone });

    if (user) {
      // Generate a JWT with the username and userId
      const token = jwt.sign(
        { username: user.username, userId: user._id },
        JWT_SECRET,
        {
          expiresIn: "1h",
        }
      );

      // Set the JWT as an HTTP-only cookie
      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        maxAge: 3600000,
      });
      res.redirect("/dashboard");
    } else {
      // Return a 404 status and message if no user is found
      res.status(404).json({
        success: false,
        message: "No user found with that phone number",
      });
    }
  } catch (error) {
    console.error("Error during OTP verification or login:", error);
    res.redirect("/login");
  }
});

routes.post("/logingmail", async (req, res) => {
  const { username, email } = req.body;

  console.log("Received login request with username:", username);
  console.log("Received login request with email:", email);

  try {
    // Find the user by username
    const user = await User.findOne({ username: username, email: email });

    if (user) {
      console.log("User found and password matches");

      // Generate a JWT with the username and userId
      const jwtToken = jwt.sign(
        { username: user.username, userId: user._id },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      // Set the JWT as an HTTP-only cookie
      res.cookie("token", jwtToken, {
        httpOnly: true,
        secure: true,
        maxAge: 3600000,
      });
      res.json({ success: true, redirect: "/dashboard" });
    } else {
      console.log("User not found or password does not match");
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

routes.post("/check-user", async (req, res) => {
  const { email } = req.body;

  try {
    console.log("Checking if user is registered:", email);
    const user = await User.findOne({ email: email });
    if (user) {
      console.log("User is registered:", user.email);
      res.json({ isRegistered: true });
    } else {
      console.log("User is not registered:", email);
      res.json({ isRegistered: false });
    }
  } catch (error) {
    console.error("Error checking user registration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = routes;
