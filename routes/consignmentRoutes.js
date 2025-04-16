const express = require("express");
const multer = require("multer");
const path = require("path");
const isAuthenticated = require("../middleware/authMiddleware");
const { User } = require("../mongoose/schemas");
const { Consignment } = require("../mongoose/schemas");
const upload = multer({ dest: "uploads/" });
const fs = require("fs");
const AWS = require("aws-sdk");

const router = express.Router();
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

async function checkAWSConnection() {
  try {
    const result = await s3.listBuckets().promise();
    console.log("Connected to AWS successfully!");
    // console.log("Available S3 Buckets:", result.Buckets);
  } catch (error) {
    console.error("Failed to connect to AWS:", error.message);
  }
}

checkAWSConnection();

router.use(isAuthenticated);

router.post(
  "/submit-consignment",
  upload.single("consignmentPhoto"),
  async (req, res) => {
    try {
      const requiredFields = [
        "fromcity",
        "weight",
        "weightUnit",
        "length",
        "breadth",
        "height",
        "cityInput",
        "Transport",
        "StartDate",
        "StartTime",
        "ArrivalDate",
        "ArrivalTime",
        "receiverName",
        "deliveryInstructions",
        "postage",
      ];
      console.log(req.body);

      if (!requiredFields.every((field) => req.body[field])) {
        return res
          .status(400)
          .json({ success: false, message: "All fields are required." });
      }

      const {
        fromcity,
        weight,
        weightUnit,
        length,
        breadth,
        height,
        cityInput,
        Transport,
        StartDate,
        StartTime,
        ArrivalDate,
        ArrivalTime,
        receiverName,
        deliveryInstructions,
        postage,
      } = req.body;

      if (!req.user || !req.user.username) {
        return res
          .status(401)
          .json({ error: "Unauthorized: No session found" });
      }
      const { username } = req.user;

      // Look up the receiver's name based on the provided ID
      const receiver = await User.findById(receiverName);
      if (!receiver) {
        return res
          .status(404)
          .json({ success: false, message: "Receiver not found." });
      }

      let consignmentPhotoPath = null;

      // Handle consignment photo upload to S3
      if (req.file) {
        const fileContent = fs.readFileSync(req.file.path);
        const fileName = `consignment-photos/${Date.now()}_${
          req.file.originalname
        }`;
        const params = {
          Bucket: process.env.AWS_S3_BUCKET_NAME, // replace with your S3 bucket name
          Key: fileName,
          Body: fileContent,
          ContentType: req.file.mimetype,
        };

        const s3Response = await s3.upload(params).promise();
        consignmentPhotoPath = s3Response.Location; // S3 URL of the uploaded photo

        fs.unlink(req.file.path, (err) => {
          if (err) {
            console.error("Error deleting local file:", err);
          } else {
            console.log("Local file deleted successfully");
          }
        });
      }

      const consignment = new Consignment({
        username,
        fromcity,
        weight,
        weightUnit,
        length,
        breadth,
        height,
        cityInput,
        Transport,
        StartDate,
        StartTime,
        ArrivalDate,
        ArrivalTime,
        receiverName: receiver.username,
        deliveryInstructions,
        consignmentPhotoPath,
        postage,
      });

      await consignment.save();
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error submitting consignment:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error. Please try again later.",
        error: error.message,
      });
    }
  }
);

router.get("/get-entries", isAuthenticated, async (req, res) => {
  try {
    if (!req.user || !req.user.username) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }
    const { username } = req.user;

    // Fetch the entries for the current user
    const entries = await Consignment.find({
      username,
      completed: false,
    }).sort({
      submitTime: -1,
    });

    res.status(200).json({ success: true, entries });
  } catch (error) {
    console.error("Error fetching entries:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
      error: error.message,
    });
  }
});

router.get("/get-entry-count", isAuthenticated, async (req, res) => {
  try {
    if (!req.user || !req.user.username) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }
    const { username } = req.user;

    // Fetch the count of entries for the current user
    const entryCount = await Consignment.countDocuments({
      username,
      completed: false,
    });

    res.status(200).json({ success: true, entryCount });
  } catch (error) {
    console.error("Error fetching entry count:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
      error: error.message,
    });
  }
});

router.post(
  "/update-entry/:entrysubmittime",
  upload.single("consignmentPhoto"),
  async (req, res) => {
    const entrysubmittime = req.params.entrysubmittime;
    const updatedEntryData = req.body;

    try {
      // Find the entry to update
      const entryToUpdate = await Consignment.findOne({
        submitTime: entrysubmittime,
      });

      if (!entryToUpdate) {
        return res.status(404).json({ error: "Entry not found" });
      }

      // Update the entry data
      entryToUpdate.location = updatedEntryData.location;
      entryToUpdate.address = updatedEntryData.address;
      entryToUpdate.weight = updatedEntryData.weight;
      entryToUpdate.weightUnit = updatedEntryData.weightUnit;
      entryToUpdate.length = updatedEntryData.length;
      entryToUpdate.breadth = updatedEntryData.breadth;
      entryToUpdate.height = updatedEntryData.height;
      entryToUpdate.cityInput = updatedEntryData.cityInput;
      entryToUpdate.Transport = updatedEntryData.Transport;
      entryToUpdate.city = updatedEntryData.city;

      // Handle consignment photo update
      if (req.file) {
        // Delete the old photo from S3 (if it exists)
        if (entryToUpdate.consignmentPhotoPath) {
          const oldPhotoKey = entryToUpdate.consignmentPhotoPath
            .split("/")
            .pop();
          const deleteParams = {
            Bucket: process.env.AWS_S3_BUCKET_NAME, // Replace with your bucket name
            Key: `consignment-photos/${oldPhotoKey}`,
          };

          await s3.deleteObject(deleteParams).promise();
        }

        // Upload the new photo to S3
        const fileContent = fs.readFileSync(req.file.path);
        const params = {
          Bucket: process.env.AWS_S3_BUCKET_NAME, // Replace with your bucket name
          Key: `consignment-photos/${Date.now()}_${req.file.originalname}`,
          Body: fileContent,
          ContentType: req.file.mimetype,
        };

        const s3Response = await s3.upload(params).promise();
        entryToUpdate.consignmentPhotoPath = s3Response.Location;

        // Delete the local file and the cache file
        const filePath = req.file.path;
        // const cacheFilePath = `${filePath}.cache`;
        try {
          await fs.promises.unlink(filePath);
          // await fs.promises.unlink(cacheFilePath);
        } catch (error) {
          console.error("Error deleting local file:", error);
        }
      }

      // Save the updated entry data
      await entryToUpdate.save();

      res.json({ success: true, message: "Entry updated successfully" });
    } catch (error) {
      console.error("Error updating entry:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get("/get-entry/:entrysubmittime", async (req, res) => {
  const { entrysubmittime } = req.params;
  const decodedSubmitTime = decodeURIComponent(entrysubmittime);
  // console.log('Received entrysubmittime:', decodedSubmitTime);

  try {
    const entry = await Consignment.findOne({
      submitTime: new Date(decodedSubmitTime),
    });

    if (!entry) {
      console.log("Entry not found for query:", {
        submitTime: new Date(decodedSubmitTime),
      });
      return res
        .status(404)
        .json({ success: false, message: "Entry not found." });
    }

    // console.log('Found entry:', entry);
    res.json({ success: true, entry });
  } catch (error) {
    console.error("Error fetching entry details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
});

router.delete("/delete-entry/:submitTime", async (req, res) => {
  const { submitTime } = req.params;

  try {
    // Find the entry by submission time
    const entry = await Consignment.findOne({ submitTime });

    if (!entry) {
      return res
        .status(404)
        .json({ success: false, message: "Entry not found." });
    }

    // Delete the consignment photo from S3 if it exists
    if (entry.consignmentPhotoPath) {
      const photoKey = entry.consignmentPhotoPath.split("/").pop(); // Extract the file name from the URL

      const deleteParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME, // Replace with your bucket name
        Key: `consignment-photos/${photoKey}`,
      };

      await s3.deleteObject(deleteParams).promise();
    }

    // Delete the entry from the database
    const deletedEntry = await Consignment.findOneAndDelete({ submitTime });

    res.json({ success: true, deletedEntry });
  } catch (error) {
    console.error("Error deleting entry:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
});

// Automatically delete consignments in which the start date and time has passed the current time
setInterval(async () => {
  const currentTime = new Date();
  const outdatedEntries = await Consignment.find({
    $and: [
      { StartDate: { $lte: currentTime } },
      { StartTime: { $lte: currentTime } },
    ],
  });

  const deletedEntryCount = await Promise.all(
    outdatedEntries.map(async (entry) => {
      // Delete the consignment photo from S3 if it exists
      if (entry.consignmentPhotoPath) {
        const photoKey = entry.consignmentPhotoPath.split("/").pop(); // Extract the file name from the URL

        const deleteParams = {
          Bucket: process.env.AWS_S3_BUCKET_NAME, // Replace with your bucket name
          Key: `consignment-photos/${photoKey}`,
        };

        await s3.deleteObject(deleteParams).promise();
      }

      // Delete the entry from the database
      return await Consignment.findOneAndDelete({ _id: entry._id });
    })
  );

  console.log(`Deleted ${deletedEntryCount.length} outdated consignments`);
}, 1000 * 60 * 60); // Run every 1 hours

module.exports = router;
