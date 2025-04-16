const express = require("express");
require("dotenv").config();
const bodyParser = require("body-parser");
const http = require("http");
const { connectDB } = require("./mongoose/dbonline");
const initializeSocket = require("./utils/sockets");
const cookieParser = require("cookie-parser");

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));
app.use(cookieParser());

// Routes setup
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

// Create HTTP server
const httpServer = http.createServer(app);

// Initialize socket.io
initializeSocket(httpServer);

const PORT = 3000;
// httpServer.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
