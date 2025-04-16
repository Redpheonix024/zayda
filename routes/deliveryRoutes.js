const express = require("express");
const isAuthenticated = require("../middleware/authMiddleware");
const { Delivery } = require("../mongoose/schemas");

const router = express.Router();

router.use(isAuthenticated);
router.post("/submitDeliveryDetails", async (req, res) => {
  try {
    const {
      currentLocation,
      travelingLocation,
      meansOfTravel,
      startDate,
      startTime,
      arrivalDate,
      arrivalTime,
    } = req.body;
    if (currentLocation === travelingLocation) {
      console.error(
        "Current location and traveling location cannot be the same."
      );
      return;
    }
    if (!req.user || !req.user.username) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }
    const { username } = req.user;
    const newDelivery = new Delivery({
      username,
      currentLocation,
      travelingLocation,
      meansOfTravel,
      startDate,
      startTime,
      arrivalDate,
      arrivalTime,
    });
    await newDelivery.save();
    res
      .status(200)
      .json({ message: "Delivery details successfully submitted." });
  } catch (error) {
    console.error("Error submitting delivery details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/get-delentries", async (req, res) => {
  try {
    if (!req.user || !req.user.username) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }
    const { username } = req.user;
    console.log(username);

    // Fetch the entries for the current user
    const entries = await Delivery.find({ username, completed: false }).sort({ submitTime: -1 });
    // console.log(entries);

    res.status(200).json({ success: true, entries });
  } catch (error) {
    console.error("Error fetching entries:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Internal server error. Please try again later.",
        error: error.message,
      });
  }
});

router.post("/update-delentry/:submissionDateTime", async (req, res) => {
  const entrysubmittime = req.params.submissionDateTime;
  const updatedEntryData = req.body;
  // console.log('Received entrysubmittime:', entrysubmittime,updatedEntryData);

  try {
    // Find the entry to update
    const entryToUpdate = await Delivery.findOne({
      submissionDateTime: entrysubmittime,
    });

    if (!entryToUpdate) {
      return res.status(404).json({ error: "Entry not found" });
    }

    // Update the entry data
    entryToUpdate.currentLocation = updatedEntryData.currentLocation;
    entryToUpdate.travelingLocation = updatedEntryData.travelingLocation;
    entryToUpdate.meansOfTravel = updatedEntryData.meansOfTravel;
    entryToUpdate.startDate = updatedEntryData.startDate;
    entryToUpdate.startTime = updatedEntryData.startTime;
    entryToUpdate.arrivalDate = updatedEntryData.arrivalDate;
    entryToUpdate.arrivalTime = updatedEntryData.arrivalTime;

    // Handle consignment photo update

    // Save the updated entry data
    await entryToUpdate.save();

    res.json({ success: true, message: "Entry updated successfully" });
  } catch (error) {
    console.error("Error updating entry:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/get-delev-count", isAuthenticated, async (req, res) => {
  try {
    if (!req.user || !req.user.username) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }
    const { username } = req.user;
    const entryCount = await Delivery.countDocuments({ username, completed: false });
    res.status(200).json({ success: true, entryCount });
  } catch (error) {
    console.error("Error fetching entry count:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Internal server error. Please try again later.",
        error: error.message,
      });
  }
});

router.get("/get-delentry/:entrysubmittime", async (req, res) => {
  const { entrysubmittime } = req.params;
  const decodedSubmitTime = decodeURIComponent(entrysubmittime);
  // console.log('Received entrysubmittime:', decodedSubmitTime);

  try {
    const entry = await Delivery.findOne({
      submissionDateTime: new Date(decodedSubmitTime),
    });

    if (!entry) {
      console.log("Entry not found for query:", {
        submissionDateTime: new Date(decodedSubmitTime),
      });
      return res
        .status(404)
        .json({ success: false, message: "Entry not found." });
    }

    // console.log('Found entry:', entry);
    res.json({ success: true, entry });
  } catch (error) {
    console.error("Error fetching entry details:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Internal server error. Please try again later.",
      });
  }
});

router.delete("/delete-delentry/:submissionDateTime", async (req, res) => {
  const { submissionDateTime } = req.params;

  try {
    // Find the entry by submission time
    const entry = await Delivery.findOne({ submissionDateTime });

    if (!entry) {
      return res
        .status(404)
        .json({ success: false, message: "Entry not found." });
    }

    const deletedEntry = await Delivery.findOneAndDelete({
      submissionDateTime,
    });

    res.json({ success: true, deletedEntry });
  } catch (error) {
    console.error("Error deleting entry:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Internal server error. Please try again later.",
      });
  }
});

const autoDeleteDelivery = async () => {
  const currentTime = new Date();
  const outdatedDeliveries = await Delivery.find({
    startDate: { $lte: currentTime.toISOString().split("T")[0] },
    startTime: { $lte: currentTime.toTimeString().split(" ")[0] },
  });
  await Delivery.deleteMany({ _id: { $in: outdatedDeliveries.map(delivery => delivery._id) } });
};
setInterval(autoDeleteDelivery, 1000 * 60); // Run every minute


module.exports = router;
