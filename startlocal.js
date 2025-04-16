const express = require("express");
require("dotenv").config();
const bodyParser = require("body-parser");
const { PORT } = require("./config");
const { connectDB } = require("./mongoose/dbonline");
const initializeSocket = require("./utils/sockets");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();

connectDB();

// Add CORS configuration before other middleware
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With']
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));
app.use(cookieParser());

const authRoutes = require("./routes/authRoutes");
const pageRoutes = require("./routes/pageRoutes");
const profileRoutes = require("./routes/profileRoutes");
const consignmentRoutes = require("./routes/consignmentRoutes");
const deliveryRoutes = require("./routes/deliveryRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const socketRoutes = require("./routes/socketRoutes");
const matchingRoutes = require("./routes/matchingroutes");
const serviceroutes = require("./routes/serviceroutes");
const completedroutes = require("./routes/completedroutes");

app.use(authRoutes);
app.use(pageRoutes);
app.use(profileRoutes);
app.use(consignmentRoutes);
app.use(deliveryRoutes);
app.use(uploadRoutes);
app.use(socketRoutes);
app.use(matchingRoutes);
app.use(serviceroutes);
app.use(completedroutes);

// app.use(
//   cors({
//     origin: "http://localhost:3001",
//     credentials: true,
//     methods: ["GET", "POST"],
//     allowedHeaders: ["Content-Type", "Accept"],
//   })
// );

// Initialize socket with HTTP server instead of HTTPS
const server = app.listen(PORT, "localhost", () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

initializeSocket(server);
