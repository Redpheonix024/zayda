const { Consignment } = require("../mongoose/schemas");
const express = require("express");
const isAuthenticated = require("../middleware/authMiddleware");
const { Delivery } = require("../mongoose/schemas");
const axios = require("axios");

const router = express.Router();

router.use(isAuthenticated);

const openrouteapiKey = process.env.OPEN_ROUTE_API_KEY;

router.get(
  "/get-user-accepted-consignments",
  isAuthenticated,
  async (req, res) => {
    try {
      const { username: userId } = req.user;
      if (!userId) {
        return res
          .status(401)
          .json({ error: "Unauthorized: No session found" });
      }

      const acceptedConsignments = await Consignment.find({
        username: userId,
        acceptedDeliveries: { $exists: true, $ne: [] },
        completed: false,
      }).populate({
        path: "acceptedDeliveries.deliveryRouteId",
        model: "Delivery",
      });

      // console.log("Fetched consignments:", acceptedConsignments);
      res.json({ acceptedConsignments });
    } catch (error) {
      console.error("Error fetching accepted consignments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post("/update-consignment", isAuthenticated, async (req, res) => {
  const { consignmentId, deliveryUserName, acceptedAt, deliveryRouteId } =
    req.body;

  try {
    const parsedDate = new Date(acceptedAt);
    if (isNaN(parsedDate.getTime())) {
      throw new Error("Invalid date received");
    }

    // First, try to update an existing entry
    let updatedConsignment = await Consignment.findOneAndUpdate(
      {
        _id: consignmentId,
        acceptedDeliveries: {
          $elemMatch: {
            username: deliveryUserName,
            deliveryRouteId: deliveryRouteId,
          },
        },
      },
      {
        $set: {
          "acceptedDeliveries.$.acceptedAt": parsedDate,
        },
      },
      { new: true }
    );

    // If no document was updated, it means this is a new entry
    if (!updatedConsignment) {
      updatedConsignment = await Consignment.findByIdAndUpdate(
        consignmentId,
        {
          $push: {
            acceptedDeliveries: {
              username: deliveryUserName,
              acceptedAt: parsedDate,
              deliveryRouteId: deliveryRouteId,
            },
          },
        },
        { new: true }
      );

      if (!updatedConsignment) {
        return res
          .status(404)
          .json({ success: false, message: "Consignment not found" });
      }
    }

    res.json({ success: true, message: "Consignment updated successfully" });
  } catch (error) {
    console.error("Error updating consignment:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
});

router.post("/remove-agreement", isAuthenticated, async (req, res) => {
  const { consignmentId, deliveryUserName, deliveryRouteId } = req.body;

  try {
    const updatedConsignment = await Consignment.findByIdAndUpdate(
      consignmentId,
      {
        $pull: {
          acceptedDeliveries: {
            username: deliveryUserName,
            deliveryRouteId: deliveryRouteId,
          },
        },
      },
      { new: true }
    );

    if (!updatedConsignment) {
      return res
        .status(404)
        .json({ success: false, message: "Consignment not found" });
    }

    res.json({ success: true, message: "Agreement removed successfully" });
  } catch (error) {
    console.error("Error removing agreement:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
});

router.post(
  "/update-consignment-acceptance",
  isAuthenticated,
  async (req, res) => {
    try {
      const { consignmentId, acceptanceTime, deliveryIndex } = req.body;
      const { username: userId } = req.user;
      if (!userId) {
        return res
          .status(401)
          .json({ error: "Unauthorized: No session found" });
      }

      // First, check if any agreement has already been accepted
      const existingConsignment = await Consignment.findOne({
        _id: consignmentId,
        username: userId,
        completed: false,
      });

      if (!existingConsignment) {
        return res.status(404).json({
          success: false,
          message: "Consignment not found",
        });
      }

      const hasAcceptedAgreement = existingConsignment.acceptedDeliveries.some(
        (delivery) => delivery.acceptedbysender
      );

      if (hasAcceptedAgreement) {
        return res.status(400).json({
          success: false,
          message: "Bad request: You can only accept one agreement at a time",
        });
      }

      // If no agreement has been accepted, proceed with the update
      const updatedConsignment = await Consignment.findOneAndUpdate(
        {
          _id: consignmentId,
          username: userId,
          [`acceptedDeliveries.${deliveryIndex}.acceptedbysender`]: false,
        },
        {
          $set: {
            [`acceptedDeliveries.${deliveryIndex}.acceptedbysender`]: true,
            [`acceptedDeliveries.${deliveryIndex}.senderAcceptanceTime`]:
              acceptanceTime,
          },
        },
        { new: true }
      );

      if (updatedConsignment) {
        res.json({
          success: true,
          message: "Consignment updated successfully",
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Consignment not found or already accepted",
        });
      }
    } catch (error) {
      console.error("Error updating consignment acceptance:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

router.post(
  "/remove-consignment-acceptance",
  isAuthenticated,
  async (req, res) => {
    try {
      const { consignmentId, deliveryIndex } = req.body;
      const { username: userId } = req.user;
      if (!userId) {
        return res
          .status(401)
          .json({ error: "Unauthorized: No session found" });
      }

      const updatedConsignment = await Consignment.findOneAndUpdate(
        {
          _id: consignmentId,
          username: userId,
          [`acceptedDeliveries.${deliveryIndex}.acceptedbysender`]: true,
        },
        {
          $set: {
            [`acceptedDeliveries.${deliveryIndex}.acceptedbysender`]: false,
            [`acceptedDeliveries.${deliveryIndex}.senderAcceptanceTime`]: null,
          },
        },
        { new: true }
      );

      if (updatedConsignment) {
        res.json({ success: true, message: "Agreement removed successfully" });
      } else {
        res.status(404).json({
          success: false,
          message: "Consignment not found or not accepted",
        });
      }
    } catch (error) {
      console.error("Error removing consignment acceptance:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

router.get("/get-matched-packages", isAuthenticated, async (req, res) => {
  try {
    const { username: clientUsername } = req.user;
    if (!clientUsername) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }

    // console.log(clientUsername);

    // Fetch all consignments and deliveries
    const consignments = await Consignment.find().lean();
    const deliveries = await Delivery.find({
      username: clientUsername,
      completed: false,
    }).lean();

    // Perform matching logic
    const matchedPackages = [];

    consignments
      .filter((c) => !c.completed)
      .forEach((consignment) => {
        deliveries
          .filter((d) => !d.completed)
          .forEach((delivery) => {
            if (
              consignment.fromcity === delivery.currentLocation &&
              consignment.cityInput === delivery.travelingLocation &&
              consignment.username !== clientUsername &&
              consignment.receiverName !== clientUsername
            ) {
              matchedPackages.push({ consignment, delivery });
              delivery.completed = true;
            }
          });
      });
    // console.log(matchedPackages);

    res.json({ matchedPackages });
  } catch (error) {
    console.error("Error fetching and matching packages:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/calculate-postage", isAuthenticated, async (req, res) => {
  console.log("Entered /calculate-postage route");
  try {
    const {
      weight,
      weightUnit,
      length,
      breadth,
      height,
      cityInput, // Destination city name
      fromCity, // Origin city name
      transport, // "crowdsourced" or "dedicated"
      deliveryType, // "standard", "express", or "realTime"
    } = req.body;

    console.log("Request Body:", req.body);

    // Validate input fields
    if (
      !weight ||
      !weightUnit ||
      !length ||
      !breadth ||
      !height ||
      !cityInput ||
      !fromCity ||
      !transport
    ) {
      console.log("Invalid input fields");
      return res.status(400).json({ error: "All fields are required." });
    }

    // Function to fetch coordinates for a city name
    const getCoordinates = async (city) => {
      console.log(`Fetching coordinates for city: ${city}`);
      try {
        const response = await axios.get(
          "https://nominatim.openstreetmap.org/search",
          {
            params: {
              q: city,
              format: "json",
              limit: 1,
            },
          }
        );

        if (response.data.length === 0) {
          throw new Error(`No coordinates found for city: ${city}`);
        }

        const { lat, lon } = response.data[0];
        console.log(`Coordinates for ${city}: lat=${lat}, lon=${lon}`);
        return { lat, lon };
      } catch (err) {
        throw new Error(`Error fetching coordinates for city: ${city}`);
      }
    };

    // Fetch coordinates for origin and destination cities
    const fromCityCoords = await getCoordinates(fromCity);
    const toCityCoords = await getCoordinates(cityInput);

    console.log("Coordinates fetched for both cities");

    // Fetch distance using OpenRouteService API

    const routeResponse = await axios.post(
      "https://api.openrouteservice.org/v2/directions/driving-car/json",
      {
        coordinates: [
          [fromCityCoords.lon, fromCityCoords.lat],
          [toCityCoords.lon, toCityCoords.lat],
        ],
      },
      {
        headers: {
          Authorization: openrouteapiKey,
          "Content-Type": "application/json",
        },
      }
    );

    const distance = routeResponse.data.routes[0].summary.distance / 1000; // Distance in km
    console.log(`Calculated Distance: ${distance.toFixed(2)} km`);

    // Cost calculations
    const baseCost = 5; // Base fee
    const weightCost = weightUnit === "kg" ? weight * 2 : weight * 1; // Weight-based cost
    const sizeCost = (length * breadth * height) / 5000; // Volumetric cost
    const distanceCost = distance * 0.5; // Per km cost

    console.log("Cost breakdown before multipliers:", {
      baseCost,
      weightCost,
      sizeCost,
      distanceCost,
    });

    // Multiplier for transport type
    const transportMultiplier = transport === "dedicated" ? 1.5 : 1;

    // Multiplier for delivery type
    let deliveryMultiplier = 1;
    switch (deliveryType) {
      case "express":
        deliveryMultiplier = 1.2;
        break;
      case "realTime":
        deliveryMultiplier = 1.5;
        break;
      default:
        deliveryMultiplier = 1; // Standard delivery
    }

    console.log("Multipliers applied:", {
      transportMultiplier,
      deliveryMultiplier,
    });

    // Final cost calculation
    const totalCost =
      (baseCost + weightCost + sizeCost + distanceCost) *
      transportMultiplier *
      deliveryMultiplier;

    console.log("Final calculated cost:", totalCost);

    // Success Response
    res.json({
      cost: totalCost,
      breakdown: {
        baseCost,
        weightCost,
        sizeCost,
        distanceCost,
        transportMultiplier,
        deliveryMultiplier,
      },
      distance: `${distance.toFixed(2)} km`,
    });
  } catch (error) {
    console.error("Error calculating postage:", error.message || error);
    res.status(500).json({
      error: error.message || "An internal server error occurred.",
    });
  }
});

module.exports = router;
