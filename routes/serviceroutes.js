const express = require("express");
const isAuthenticated = require("../middleware/authMiddleware");
const { Consignment } = require("../mongoose/schemas");
const { Delivery } = require("../mongoose/schemas");
const { DeliveryLocation } = require("../mongoose/schemas");
const crypto = require("crypto");
const moment = require("moment");
const mongoose = require("mongoose");

const router = express.Router();

router.use(isAuthenticated);

router.get("/get-accepted-consignment", async (req, res) => {
  try {
    const { username: clientUsername } = req.user;
    if (!clientUsername) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }

    console.log(clientUsername);

    const consignment = await Consignment.findOne({
      acceptedDeliveries: {
        $elemMatch: {
          username: clientUsername,
          acceptedbysender: true,
        },
      },
    }).sort({ "acceptedDeliveries.senderAcceptanceTime": -1 });

    if (!consignment) {
      return res
        .status(404)
        .json({ message: "No accepted consignment found for this user" });
    }

    const acceptedDelivery = consignment.acceptedDeliveries.find(
      (delivery) =>
        delivery.username === clientUsername && delivery.acceptedbysender
    );

    const response = {
      ...consignment.toObject(),
      acceptedDelivery: acceptedDelivery,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching accepted consignment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/get-accepted-consignmentrec", async (req, res) => {
  try {
    const { username: clientUsername } = req.user;
    if (!clientUsername) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }
    console.log(clientUsername);

    const consignment = await Consignment.findOne({
      receiverName: clientUsername,
      acceptedDeliveries: {
        $elemMatch: {
          acceptedbysender: true,
        },
      },
    }).sort({ "acceptedDeliveries.senderAcceptanceTime": -1 });

    if (!consignment) {
      return res
        .status(404)
        .json({ message: "No accepted consignment found for this user" });
    }

    const acceptedDelivery = consignment.acceptedDeliveries.find(
      (delivery) => delivery.acceptedbysender
    );

    const response = {
      ...consignment.toObject(),
      acceptedDelivery: acceptedDelivery,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching accepted consignment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/get-accepted-consignmentsen", async (req, res) => {
  try {
    const { username: clientUsername } = req.user;
    if (!clientUsername) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }

    const deliveryLocation = await DeliveryLocation.findOne({
      senderUsername: clientUsername,
    }).sort({ _id: -1 });

    if (!deliveryLocation) {
      return res
        .status(404)
        .json({ message: "No accepted consignment found for this user" });
    }

    const consignment = await Consignment.findById(
      deliveryLocation.consignmentId
    );
    const delivery = await Delivery.findById(deliveryLocation.deliveryId);

    if (!consignment || !delivery) {
      return res
        .status(404)
        .json({ message: "Consignment or delivery details not found" });
    }

    const response = {
      ...consignment.toObject(),
      delivery: delivery.toObject(),
      deliveryLocation: {
        location: deliveryLocation.location,
        receivingTimeMin: deliveryLocation.receivingTimeMin,
        receivingTimeMax: deliveryLocation.receivingTimeMax,
      },
      clientUsername: deliveryLocation.senderUsername,
      deliveryUsername: deliveryLocation.deliveryUsername,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching accepted consignment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/get-delivery-route/:id", async (req, res) => {
  try {
    const id = req.params.id.replace(/^:/, "");
    const deliveryRoute = await Delivery.findById(id);

    if (!deliveryRoute) {
      console.log("No delivery found for ID:", req.params.id);
      return res.status(404).json({ message: "Delivery route not found" });
    }

    res.json(deliveryRoute);
  } catch (error) {
    console.error("Error fetching delivery route:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/get-delivery-routerec/:id", async (req, res) => {
  try {
    console.log("Requested delivery ID:", req.params.id);
    const id = req.params.id.replace(/^:/, "");
    const deliveryRoute = await Delivery.findById(id);

    if (!deliveryRoute) {
      console.log("No delivery found for ID:", req.params.id);
      return res.status(404).json({ message: "Delivery route not found" });
    }

    res.json(deliveryRoute);
  } catch (error) {
    console.error("Error fetching delivery route:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/confirm-delivery-location", async (req, res) => {
  try {
    const {
      deliveryId,
      consignmentId,
      senderUsername,
      deliveryUsername,
      location,
      receivingTimeMin,
      receivingTimeMax,
    } = req.body;


    let parsedLocation;
    if (typeof location === "string") {
      try {
        parsedLocation = parseLocationString(location);
      } catch (error) {
        return res.status(400).json({ message: "Invalid location format" });
      }
    } else if (typeof location === "object" && location.lat && location.lng) {
      parsedLocation = location;
    } else {
      return res.status(400).json({ message: "Invalid location data" });
    }

    const existingDeliveryLocation = await DeliveryLocation.findOne({
      deliveryId,
      consignmentId,
    });

    if (existingDeliveryLocation) {
      return res
        .status(400)
        .json({ message: "Delivery location already exists" });
    }

    const consignment = await Consignment.findById(consignmentId);
    const receiverName = consignment.receiverName;

    const newDeliveryLocation = new DeliveryLocation({
      deliveryId,
      consignmentId,
      senderUsername,
      deliveryUsername,
      location: parsedLocation,
      receivingTimeMin,
      receivingTimeMax,
      receiverName,
    });

    await newDeliveryLocation.save();

    res
      .status(200)
      .json({ message: "Delivery location confirmed successfully!" });
  } catch (error) {
    console.error("Error confirming delivery location:", error);
    res
      .status(500)
      .json({ message: "Error confirming delivery location", error });
  }
});

router.post("/confirm-delivery-locationsender", async (req, res) => {
  try {
    const { deliveryId, consignmentId } = req.body;

    const deliveryLocation = await DeliveryLocation.findOne({
      deliveryId: deliveryId,
      consignmentId: consignmentId,
    });

    if (!deliveryLocation) {
      return res.status(404).json({ message: "Delivery location not found" });
    }

    deliveryLocation.locationConfirmedBySeller = true;
    deliveryLocation.currentSection = 2;

    await deliveryLocation.save();

    res.status(200).json({
      message: "Delivery location confirmed by seller",
      deliveryLocation,
    });
  } catch (error) {
    console.error("Error confirming delivery location:", error);
    res.status(500).json({ message: "Server error" });
  }
});

function parseLocationString(locationString) {
  const latMatch = locationString.match(/Latitude:\s*([0-9.-]+)/);
  const lngMatch = locationString.match(/Longitude:\s*([0-9.-]+)/);

  if (latMatch && lngMatch) {
    return {
      lat: parseFloat(latMatch[1]),
      lng: parseFloat(lngMatch[1]),
    };
  }

  throw new Error("Invalid location format");
}

const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

router.post("/generate-otp", async (req, res) => {
  const { deliveryUsername } = req.body;
  console.log(
    `Request to generate OTP for deliveryUsername: ${deliveryUsername}`
  );

  try {
    const deliveryLocation = await DeliveryLocation.findOne({
      deliveryUsername,
      currentSection: 2,
    });

    if (!deliveryLocation) {
      console.log("No delivery location found");
      return res.status(404).json({ message: "No delivery location found" });
    }

    const currentTime = new Date();
    if (deliveryLocation.otp && currentTime < deliveryLocation.otpExpiry) {
      console.log("Existing valid OTP found");
      return res.json({
        message: "Existing OTP found",
        otp: deliveryLocation.otp,
      });
    }

    let otp = generateOtp();
    const otpExpiry = moment().add(3, "hours").toDate();

    deliveryLocation.otp = otp;
    deliveryLocation.otpExpiry = otpExpiry;
    await deliveryLocation.save();
    console.log(`New OTP generated: ${otp}`);

    res.json({ message: "OTP generated", otp: otp });
  } catch (error) {
    console.error("Error generating OTP: ", error);
    res.status(500).json({ message: "Error generating OTP", error });
  }
});

router.get("/get-otp", async (req, res) => {
  const { deliveryUsername } = req.query;
  console.log(`Request to get OTP for deliveryUsername: ${deliveryUsername}`);

  try {
    const deliveryLocation = await DeliveryLocation.findOne({
      deliveryUsername,
      currentSection: 2,
    }).sort({ _id: -1 });

    if (!deliveryLocation) {
      console.log("No delivery location found");
      return res.status(404).json({ message: "No delivery location found" });
    }

    const currentTime = new Date();

    if (deliveryLocation.otp && currentTime < deliveryLocation.otpExpiry) {
      console.log(`OTP fetched: ${deliveryLocation.otp}`);
      return res.json({
        otp: deliveryLocation.otp,
        otpExpiry: deliveryLocation.otpExpiry,
      });
    } else {
      console.log("OTP expired or not found, generating new OTP");

      try {
        const response = ("/generate-otp", deliveryUsername);
        console.log(`New OTP generated: ${response.data.otp}`);
        return res.json({
          otp: response.data.otp,
          otpExpiry: response.data.otpExpiry,
        });
      } catch (error) {
        console.error("Error generating new OTP: ", error);
        return res
          .status(500)
          .json({ message: "Error generating new OTP", error });
      }
    }
  } catch (error) {
    console.error("Error fetching OTP: ", error);
    res.status(500).json({ message: "Error fetching OTP", error });
  }
});

router.post("/verify-otp", async (req, res) => {
  const { otp, senderUsername } = req.body;
  console.log(
    `Request to verify OTP: ${otp} for senderUsername: ${senderUsername}`
  );

  try {
    const deliveryLocation = await DeliveryLocation.findOne({
      otp,
      senderUsername,
      currentSection: 2,
    });

    if (!deliveryLocation) {
      console.log("Invalid OTP or sender username");
      return res.status(400).json({
        success: false,
        message: "Invalid OTP or sender username. Please try again.",
      });
    }

    const currentTime = new Date();
    if (currentTime > deliveryLocation.otpExpiry) {
      console.log("OTP has expired");
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    deliveryLocation.currentSection = 2.5;
    deliveryLocation.locationConfirmedBySeller = true;
    deliveryLocation.otpverifed = true;
    await deliveryLocation.save();

    console.log("OTP verified successfully, moved to section 2");
    res.json({
      success: true,
      message: "OTP verified successfully. Parcel can be given.",
      currentSection: deliveryLocation.currentSection,
    });
  } catch (error) {
    console.error("Error verifying OTP: ", error);
    res.status(500).json({
      success: false,
      message: "Error verifying OTP",
      error: error.message,
    });
  }
});

router.get("/get-current-section/:deliveryLocationId", async (req, res) => {
  console.log("Request received:", req.params);

  try {
    const deliveryLocationId = req.params.deliveryLocationId;
    console.log("deliveryLocationId:", deliveryLocationId);

    if (!deliveryLocationId) {
      return res
        .status(400)

        .json({ success: false, message: "deliveryLocationId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(deliveryLocationId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid deliveryLocationId format" });
    }

    const deliveryLocation = await DeliveryLocation.findOne({
      deliveryId: deliveryLocationId,
    });

    if (!deliveryLocation) {
      return res
        .status(404)
        .json({ success: false, message: "Delivery location not found" });
    }

    res.json({
      success: true,
      currentSection: deliveryLocation.currentSection,
    });
  } catch (error) {
    console.error("Error fetching current section:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching current section" });
  }
});

router.get("/get-otp_rec", async (req, res) => {
  const { receiverName } = req.query;
  console.log(`Request to get OTP for reciverUsername: ${receiverName}`);

  try {
    const deliveryLocation = await DeliveryLocation.findOne({
      receiverName,
      currentSection: 2.5,
    }).sort({ _id: -1 });

    if (!deliveryLocation) {
      console.log("No delivery location found");
      return res.status(404).json({ message: "No delivery location found" });
    }

    const currentTime = new Date();

    if (deliveryLocation.otp && currentTime < deliveryLocation.otp_recExpiry) {
      console.log(`OTP fetched: ${deliveryLocation.otp_rec}`);
      return res.json({
        otp: deliveryLocation.otp_rec,
        otpExpiry: deliveryLocation.otp_recExpiry,
      });
    } else {
      console.log("OTP expired or not found, generating new OTP");

      try {
        const response = ("/generate-otp_rec", deliveryUsername);
        console.log(`New OTP generated: ${response.data.otp}`);
        return res.json({
          otp_rec: response.data.otp,
          otp_recExpiry: response.data.otpExpiry,
        });
      } catch (error) {
        console.error("Error generating new OTP: ", error);
        return res
          .status(500)
          .json({ message: "Error generating new OTP", error });
      }
    }
  } catch (error) {
    console.error("Error fetching OTP: ", error);
    res.status(500).json({ message: "Error fetching OTP", error });
  }
});

router.post("/generate-otp_rec", async (req, res) => {
  const { deliveryUsername } = req.body;
  console.log(
    `Request to generate OTP for deliveryUsername: ${deliveryUsername}`
  );

  try {
    const deliveryLocation = await DeliveryLocation.findOne({
      deliveryUsername,
      currentSection: 2.5,
    });

    if (!deliveryLocation) {
      console.log("No delivery location found");
      return res.status(404).json({ message: "No delivery location found" });
    }

    const currentTime = new Date();
    if (
      deliveryLocation.otp_rec &&
      currentTime < deliveryLocation.otp_recExpiry
    ) {
      console.log("Existing valid OTP found");
      return res.json({
        message: "Existing OTP found",
        otp: deliveryLocation.otp_rec,
      });
    }

    let otp = generateOtp();
    const otpExpiry = moment().add(3, "hours").toDate();

    deliveryLocation.otp_rec = otp;
    deliveryLocation.otp_recExpiry = otpExpiry;
    await deliveryLocation.save();
    console.log(`New OTP generated: ${otp}`);
    res.json({ message: "OTP generated", otp: otp });
  } catch (error) {
    console.error("Error generating OTP: ", error);
    res.status(500).json({ message: "Error generating OTP", error });
  }
});

router.post("/verify-otp_rec", async (req, res) => {
  const { otp_rec, deliveryUsername } = req.body;
  console.log(
    `Request to verify OTP: ${otp_rec} for deliveryUsername: ${deliveryUsername}`
  );

  try {
    const deliveryLocation = await DeliveryLocation.findOne({
      otp_rec,
      deliveryUsername,
    });

    if (!deliveryLocation) {
      console.log("Invalid OTP or sender username");
      return res.status(400).json({
        success: false,
        message: "Invalid OTP or sender username. Please try again.",
      });
    }

    const currentTime = new Date();
    if (currentTime > deliveryLocation.otp_recExpiry) {
      console.log("OTP has expired");
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    deliveryLocation.currentSection = 3;
    deliveryLocation.otpverifed_rec = true;

    await deliveryLocation.save();
    const consignmentId = deliveryLocation.consignmentId;
    const deliveryId = deliveryLocation.deliveryId;

    const consignment = await Consignment.findById(consignmentId);
    if (!consignment) {
      console.log("Consignment not found with id: ", consignmentId);
      return res.status(404).json({
        success: false,
        message: "Consignment not found with id: " + consignmentId,
      });
    }

    const delivery = await Delivery.findById(deliveryId);
    if (!delivery) {
      console.log("Delivery not found with id: ", deliveryId);
      return res.status(404).json({
        success: false,
        message: "Delivery not found with id: " + deliveryId,
      });
    }

    consignment.completed = true;
    delivery.completed = true;

    await consignment.save();
    await delivery.save();

    console.log("OTP verified successfully, moved to section 3");
    res.json({
      success: true,
      message: "OTP verified successfully. Parcel can be given.",
      currentSection: deliveryLocation.currentSection,
    });
  } catch (error) {
    console.error("Error verifying OTP: ", error);
    res.status(500).json({
      success: false,
      message: "Error verifying OTP",
      error: error.message,
    });
  }
});

router.get("/verify-otp-verified", async (req, res) => {
  const { username: deliveryUsername } = req.user;
  if (!deliveryUsername) {
    return res.status(401).json({ error: "Unauthorized: No session found" });
  }

  console.log("being called", deliveryUsername);

  try {
    // Find the delivery location by deliveryUsername and currentSection = 2
    const deliveryLocation = await DeliveryLocation.findOne({
      deliveryUsername: deliveryUsername,
      currentSection: [2.5],
    });

    if (!deliveryLocation) {
      return res.status(404).json({
        verified: false,
        message: "Delivery location not found or current section is not 2.5",
      });
    }

    // Check if otpverifed is true
    const isOtpVerified = deliveryLocation.otpverifed;

    return res.json({ verified: isOtpVerified });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ verified: false, message: "Server error" });
  }
});

router.get("/verify-otp-verified_rec", async (req, res) => {
  if (!req.user || !req.user.username) {
    return res.status(401).json({ error: "Unauthorized: No session found" });
  }
  const { receiver } = req.user;
  // console.log("being called", receiver);

  try {
    // Find the delivery location by deliveryUsername and currentSection = 2
    const deliveryLocations = await DeliveryLocation.find({
      receiverName: receiver,
      currentSection: [3],
    });

    const consignmentIds = deliveryLocations.map((deliveryLocation) =>
      String(deliveryLocation.consignmentId)
    );

    const consignments = await Consignment.find({
      _id: { $in: consignmentIds },
      completed: false,
    }).select("_id");

    const consignmentIdsNotCompleted = consignments.map((consignment) =>
      String(consignment._id)
    );

    const deliveryLocation = await DeliveryLocation.findOne({
      receiverName: receiver,
      currentSection: [3],
      consignmentId: { $in: consignmentIdsNotCompleted },
    });

    if (!deliveryLocation) {
      return res.status(404).json({
        verified: false,
        message: "Delivery location not found or current section is not 3",
      });
    }

    // Check if otpverifed is true
    const isOtpVerified = deliveryLocation.otpverifed_rec;

    return res.json({ verified: isOtpVerified });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ verified: false, message: "Server error" });
  }
});

module.exports = router;
