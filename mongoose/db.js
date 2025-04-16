const mongoose = require("mongoose");

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 1;

//If you are using local machine as host use localhost setting if it is online use online configiration


//ofline configration
const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/userAuthDB", {
      // useNewUrlParser: true,
      // useUnifiedTopology: true
    });
    console.log("MongoDB connected...");
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

//online configration
// const connectDB = async () => {
//   try {
//     await mongoose.connect(
//       "mongodb+srv://redpheonix24052000:bK9Cfe4bxvAJRk9c@cluster0deliveryx.uesb9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0deliveryX",
//       {
//         // useNewUrlParser: true,
//         // useUnifiedTopology: true
//       }
//     );
//     console.log("MongoDB connected...");
//   } catch (err) {
//     console.error(err.message);
//     process.exit(1);
//   }
// };

module.exports = { connectDB };
