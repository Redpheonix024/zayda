const mongoose = require("mongoose");

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 1;
const mongoURI = process.env.MONGODB_URI;


//If you are using local machine as host use localhost setting if it is online use online configiration

// //ofline configration
// const connectDB = async () => {
//   try {
//     await mongoose.connect("mongodb://localhost:27017/userAuthDB", {
//       // useNewUrlParser: true,
//       // useUnifiedTopology: true
//     });
//     console.log("MongoDB connected...");
//   } catch (err) {
//     console.error(err.message);
//     process.exit(1);
//   }
// };

// //online configration
const connectDB = async () => {
  try {
    await mongoose.connect(
      mongoURI,
      {
        // useNewUrlParser: true,
        // useUnifiedTopology: true,
      }
    );
    console.log("MongoDB connected...");
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

module.exports = { connectDB };

