const express = require("express");
const multer = require("multer");
const isAuthenticated = require("../middleware/authMiddleware");
const { UserData } = require("../mongoose/schemas");
const { User } = require("../mongoose/schemas");
const AWS = require("aws-sdk");
const router = express.Router();
const fs = require("fs");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ dest: "uploads/" });

router.use(isAuthenticated);

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  Bucket: process.env.AWS_S3_BUCKET_NAME,
});

router.post(
  "/submit-profile",
  isAuthenticated,
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      if (!req.user || !req.user.username) {
        return res
          .status(401)
          .json({ error: "Unauthorized: No session found" });
      }
      const { username } = req.user;
      const { name, email, age, gender, city } = req.body;
      const profilePicture = req.file;

      let existingUser = await UserData.findOne({ username });
      if (existingUser) {
        existingUser.name = name;
        existingUser.email = email;
        existingUser.age = age;
        existingUser.gender = gender;
        existingUser.city = city;

        if (profilePicture) {
          // Delete the old profile picture from S3 if it exists
          if (existingUser.profilePicture && existingUser.profilePicture.path) {
            const oldKey = existingUser.profilePicture.path
              .split("/")
              .slice(-2)
              .join("/");
            const deleteParams = {
              Bucket: process.env.AWS_S3_BUCKET_NAME, // Replace with your S3 bucket name
              Key: oldKey,
            };
            await s3.deleteObject(deleteParams).promise();
          }

          // Upload new profile picture to S3
          const fileContent = fs.readFileSync(profilePicture.path);
          const params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME, // Replace with your S3 bucket name
            Key: `profile-pictures/${username}/${profilePicture.filename}`,
            Body: fileContent,
            ContentType: profilePicture.mimetype,
          };

          const s3Response = await s3.upload(params).promise();
          existingUser.profilePicture.path = s3Response.Location;

          // Delete the local file (cache) after uploading to S3
          fs.unlink(profilePicture.path, (err) => {
            if (err) {
              console.error("Error deleting local file:", err);
            } else {
              console.log("Local file deleted successfully");
            }
          });
        }

        await existingUser.save();
        return res.status(200).json({ success: true });
      } else {
        let profilePicturePath = null;
        if (profilePicture) {
          const fileContent = fs.readFileSync(profilePicture.path);
          const params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME, // Replace with your S3 bucket name
            Key: `profile-pictures/${username}/${profilePicture.filename}`,
            Body: fileContent,
            ContentType: profilePicture.mimetype,
          };

          const s3Response = await s3.upload(params).promise();
          profilePicturePath = s3Response.Location;

          // Delete the local file (cache) after uploading to S3
          fs.unlink(profilePicture.path, (err) => {
            if (err) {
              console.error("Error deleting local file:", err);
            } else {
              console.log("Local file deleted successfully");
            }
          });
        }

        const newUser = new UserData({
          username,
          name,
          email,
          age,
          gender,
          city,
          profilePicture: { path: profilePicturePath },
        });

        await newUser.save();
        return res.status(200).json({ success: true });
      }
    } catch (error) {
      console.error("Error submitting profile:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error. Please try again later.",
        error: error.message,
      });
    }
  }
);

router.get("/get-username", isAuthenticated, (req, res) => {
  if (!req.user || !req.user.username) {
    return res.status(401).json({ error: "Unauthorized: No session found" });
  }

  const { username } = req.user;

  // Send the username as a JSON response
  return res.json({ username });
});

router.get("/get-user-data", isAuthenticated, async (req, res) => {
  try {
    // Retrieve the username from the session
    if (!req.user || !req.user.username) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }
    const { username } = req.user;

    // Find the user in the 'userdatas' collection of the first database
    const userDataDB1 = await UserData.findOne({ username });

    if (userDataDB1) {
      // If user data is found in the first database, send it as a JSON response
      res.json(userDataDB1);
    } else {
      // If user data is not found in the first database, send default user data as a JSON response
      const defaultUserData = {
        username: username,
        name: "your name",
        email: "Your email address",
        age: "your age",
        gender: "",
        city: "your city",
      };

      res.json(defaultUserData);
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    res
      .status(500)
      .json({ message: "Internal server error. Please try again later." });
  }
});

router.get("/getusernames", isAuthenticated, async (req, res) => {
  try {
    if (!req.user || !req.user.username) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }
    const { username } = req.user;
    const users = await User.find(
      { username: { $ne: username } },
      "name username"
    );
    const names = users.map((user) => ({
      id: user._id,
      name: user.username,
    }));
    res.json({ receivers: names });
  } catch (err) {
    res.status(500).json({ error: "An error occurred" });
  }
});

module.exports = router;
