const { MongoClient } = require("mongodb");

const uri =
  "mongodb+srv://redpheonix24052000:bK9Cfe4bxvAJRk9c@cluster0deliveryx.uesb9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0deliveryX";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  tls: true,
  tlsAllowInvalidCertificates: true, // Set this to true only if you're testing in a development environment
});

async function connect() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

connect();
