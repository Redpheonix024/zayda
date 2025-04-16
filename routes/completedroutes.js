const express = require("express");
const router = express.Router();
const { Consignment } = require("../mongoose/schemas");
const { Delivery } = require("../mongoose/schemas");
const { DeliveryLocation } = require("../mongoose/schemas");
const isAuthenticated = require("../middleware/authMiddleware");

router.use(isAuthenticated);
// Helper function to fetch consignment details
async function getConsignmentDetails(consignmentId) {
  const consignment = await Consignment.findById(consignmentId).select(
    "username receiverName StartDate ArrivalDate"
  );
  return consignment
    ? {
        sender: consignment.username,
        receiver: consignment.receiverName,
        startDate: consignment.StartDate,
        arrivalDate: consignment.ArrivalDate,
      }
    : null;
}

// Helper function to fetch delivery details
async function getDeliveryDetails(deliveryId) {
  const delivery = await Delivery.findById(deliveryId).select(
    "username meansOfTravel"
  );
  return delivery
    ? {
        deliveryUsername: delivery.username,
        meansOfTravel: delivery.meansOfTravel,
      }
    : null;
}

// Completed as Senders
router.get("/completed-senders", async (req, res) => {
  try {
    if (!req.user || !req.user.username) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }
    const { username } = req.user;

    const senders = await DeliveryLocation.find({
      currentSection: 3,
      senderUsername: username,
    }).sort({ _id: -1 });

    const senderDetails = await Promise.all(
      senders.map(async (sender) => {
        const consignmentDetails = await getConsignmentDetails(
          sender.consignmentId
        );
        const deliveryDetails = await getDeliveryDetails(sender.deliveryId);
        return {
          ...consignmentDetails,
          ...deliveryDetails,
        };
      })
    );

    res.json(senderDetails);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sender data" });
  }
});

// Completed as Receivers
router.get("/completed-receivers", async (req, res) => {
  try {
    if (!req.user || !req.user.username) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }
    const { username } = req.user;

    const receivers = await DeliveryLocation.find({
      currentSection: 3,
      receiverName: username,
    }).sort({ _id: -1 });

    const receiverDetails = await Promise.all(
      receivers.map(async (receiver) => {
        const consignmentDetails = await getConsignmentDetails(
          receiver.consignmentId
        );
        const deliveryDetails = await getDeliveryDetails(receiver.deliveryId);
        return {
          ...consignmentDetails,
          ...deliveryDetails,
        };
      })
    );

    res.json(receiverDetails);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch receiver data" });
  }
});

// Completed as Delivery Agents
router.get("/completed-delivery-agent", async (req, res) => {
  try {
    if (!req.user || !req.user.username) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }
    const { username } = req.user;

    const deliveryAgents = await DeliveryLocation.find({
      currentSection: 3,
      deliveryUsername: username,
    }).sort({ _id: -1 });

    const deliveryAgentDetails = await Promise.all(
      deliveryAgents.map(async (deliveryAgent) => {
        const consignmentDetails = await getConsignmentDetails(
          deliveryAgent.consignmentId
        );
        const deliveryDetails = await getDeliveryDetails(
          deliveryAgent.deliveryId
        );
        return {
          ...consignmentDetails,
          ...deliveryDetails,
        };
      })
    );

    res.json(deliveryAgentDetails);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch delivery agent data" });
  }
});

const checkReceiverDashboardAccess = async (username) => {
  try {
    // Query the database to check if the user is listed as receiverName and currentSection is not 3
    const receiverRecord = await DeliveryLocation.findOne({
      receiverName: username,
      currentSection: { $ne: 3 },
    });

    // Return true if a matching record is found, otherwise false
    return !!receiverRecord;
  } catch (error) {
    console.error("Error querying DeliveryLocation:", error);
    throw new Error(
      "Internal server error while checking receiver dashboard access"
    );
  }
};

const checkInhandAccess = async (username) => {
  try {
    // Query the database to check if the user is listed as deliveryUsername and currentSection is neither 1 nor 3
    const deliveryRecord = await DeliveryLocation.findOne({
      deliveryUsername: username,
      currentSection: { $nin: [1, 2, 3] },
    });

    // Return true if a matching record is found, otherwise false
    return !!deliveryRecord;
  } catch (error) {
    console.error("Error querying DeliveryLocation:", error);
    throw new Error("Internal server error while checking inhand access");
  }
};

// Function to get accepted sender requests

const getAcceptedSenderRequests = async (username) => {
  try {
    // Find all deliveries by the user
    const deliveries = await Delivery.find({ username });

    // Extract the _id of these deliveries
    const deliveryIds = deliveries.map((delivery) => delivery._id);

    // Find consignments where any acceptedDelivery matches the delivery ID and acceptedbysender is true
    const consignments = await Consignment.find({
      completed: false,
      acceptedDeliveries: {
        $elemMatch: {
          deliveryRouteId: { $in: deliveryIds },
          acceptedbysender: true,
        },
      },
    });

    // If no consignments are found, return an empty array
    if (consignments.length === 0) return null;
    // console.log(consignments);

    // Check if any of the found consignments have a matching entry in DeliveryLocation
    for (let consignment of consignments) {
      const matchingLocation = await DeliveryLocation.findOne({
        consignmentId: consignment._id,
      });
      // console.log(matchingLocation);

      // If a matching location is found, return null
      if (matchingLocation) {
        return null;
      }
    }

    // Return the consignments if no matches are found in DeliveryLocation
    return consignments;
  } catch (error) {
    console.error("Error fetching accepted sender requests:", error);
    throw new Error(
      "Internal server error while checking accepted sender requests"
    );
  }
};
async function getaccepteddeliverRequests(username) {
  try {
    // Find delivery requests that match the criteria
    const acceptedDeliverRequests = await DeliveryLocation.find({
      senderUsername: username,
      location: { $exists: true, $ne: null },
      receivingTimeMin: { $exists: true, $ne: null },
      receivingTimeMax: { $exists: true, $ne: null },
      currentSection: 1,
    });

    // Return the result
    return acceptedDeliverRequests.length > 0 ? acceptedDeliverRequests : null;
  } catch (error) {
    console.error("Error fetching accepted delivery requests:", error);
    throw error;
  }
}


async function gettracktravellerRequests(username) {
  try {
    // Find delivery requests that match the criteria
    const tracktravellerRequests = await DeliveryLocation.find({
      senderUsername: username,
      location: { $exists: true, $ne: null },
      receivingTimeMin: { $exists: true, $ne: null },
      receivingTimeMax: { $exists: true, $ne: null },
      locationConfirmedBySeller: true,
      currentSection: 2,
    });

    // Return the result
    return tracktravellerRequests.length > 0 ? tracktravellerRequests : null;
  } catch (error) {
    console.error("Error fetching accepted delivery requests:", error);
    throw error;
  }
}

async function gettracksenderRequests(username) {
  try {
    // Find delivery requests that match the criteria
    const tracksenderRequests = await DeliveryLocation.find({
      deliveryUsername: username,
      location: { $exists: true, $ne: null },
      receivingTimeMin: { $exists: true, $ne: null },
      receivingTimeMax: { $exists: true, $ne: null },
      locationConfirmedBySeller: true,
      currentSection: 2,
    });

    // Return the result
    return tracksenderRequests.length > 0 ? tracksenderRequests : null;
  } catch (error) {
    console.error("Error fetching accepted delivery requests:", error);
    throw error;
  }
}

async function getlocationtracksender(username) {
  try {
    // Find delivery requests that match the criteria
    const locationtracksender = await DeliveryLocation.find({
      senderUsername: username,
      location: { $exists: true, $ne: null },
      receivingTimeMin: { $exists: true, $ne: null },
      receivingTimeMax: { $exists: true, $ne: null },
      locationConfirmedBySeller: true,
      currentSection: 2.5,
    });

    // Return the result
    return locationtracksender.length > 0 ? locationtracksender : null;
  } catch (error) {
    console.error("Error fetching accepted delivery requests:", error);
    throw error;
  }
}

async function transactionsender(username) {
  try {
    // Find delivery requests that match the criteria
    const tracktravellerRequests = await DeliveryLocation.find({
      senderUsername: username,
      location: { $exists: true, $ne: null },
      receivingTimeMin: { $exists: true, $ne: null },
      receivingTimeMax: { $exists: true, $ne: null },
      locationConfirmedBySeller: true,
      currentSection: 2,
    });

    // Return the result
    return tracktravellerRequests.length > 0 ? tracktravellerRequests : null;
  } catch (error) {
    console.error("Error fetching accepted delivery requests:", error);
    throw error;
  }
}

async function gettransactionsender(username) {
  try {
    // Find delivery requests that match the criteria
    const transactionsender = await DeliveryLocation.find({
      senderUsername: username,
      location: { $exists: true, $ne: null },
      receivingTimeMin: { $exists: true, $ne: null },
      receivingTimeMax: { $exists: true, $ne: null },
      locationConfirmedBySeller: true,
      currentSection: 2,
    });

    // Return the result
    return transactionsender.length > 0 ? transactionsender : null;
  } catch (error) {
    console.error("Error fetching accepted delivery requests:", error);
    throw error;
  }
}
// If there are consignments matching the criteria, return them

// The /delivery-options route
router.get("/delivery-options", isAuthenticated, async (req, res) => {
  if (!req.user || !req.user.username) {
    return res.status(401).json({ error: "Unauthorized: No session found" });
  }
  const { username } = req.user;

  console.log("Requested modals for ", username);

  // Define the base delivery options
  let deliveryOptions = [
    "sender",
    "deliveryPerson",
    "deliveryrequests",
    "senderrequests",
  ];

  try {
    // Check if the user should have access to "reciverdashboard"
    const hasReceiverDashboardAccess = await checkReceiverDashboardAccess(
      username
    );
    if (hasReceiverDashboardAccess) {
      deliveryOptions.push("reciverdashboard");
    }

    // Check if the user should have access to "inhand"
    const hasInhandAccess = await checkInhandAccess(username);
    if (hasInhandAccess) {
      deliveryOptions.push("inhand");
    }

    const acceptedSenderRequests = await getAcceptedSenderRequests(username);
    if (acceptedSenderRequests) {
      deliveryOptions.push("acceptedsenderrequests");
    }

    const accepteddeliverRequests = await getaccepteddeliverRequests(username);

    if (accepteddeliverRequests) {
      deliveryOptions.push("accepteddelrequests");
    }

    const tracktravellerRequests = await gettracktravellerRequests(username);
    if (tracktravellerRequests) {
      deliveryOptions.push("tracktrveler");
    }

    const tracksenderRequests = await gettracksenderRequests(username);
    if (tracksenderRequests) {
      deliveryOptions.push("tracksender");
    }

    const locationtracksender = await getlocationtracksender(username);
    if (locationtracksender) {
      deliveryOptions.push("locationsentraccking");
    }

    const transactionsender = await gettransactionsender(username);
    if (transactionsender) {
      deliveryOptions.push("transactionssender");
    }

    // console.log(deliveryOptions);

    // Return the final delivery options
    res.json(deliveryOptions);
  } catch (error) {
    console.error("Error fetching delivery options:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
