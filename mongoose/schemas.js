const mongoose = require("mongoose");

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
});

const User = mongoose.model("User", userSchema);

// User Data Schema
const userDataSchema = new mongoose.Schema({
  name: String,
  email: String,
  age: Number,
  gender: String,
  city: String,
  username: String,
  profilePicture: {
    path: String, // Store the file path
  },
});

const UserData = mongoose.model("UserData", userDataSchema);

// Consignment Schema
const consignmentSchema = new mongoose.Schema({
  username: { type: String, required: true },
  fromcity: { type: String, required: true },
  weight: { type: Number, required: true },
  weightUnit: { type: String, required: true },
  length: { type: Number, required: true },
  breadth: { type: Number, required: true },
  height: { type: Number, required: true },
  cityInput: { type: String, required: true },
  Transport: { type: String, required: true },
  StartDate: { type: String, required: true },
  StartTime: { type: String, required: true },
  ArrivalDate: { type: String, required: true },
  ArrivalTime: { type: String, required: true },
  consignmentPhotoPath: { type: String }, // Store the path to the consignment photo
  receiverName: { type: String, required: true },
  deliveryInstructions: { type: String, required: true },
  postage: {
    type: Number,
    required: true,
    set: (v) => parseFloat(v.toFixed(2)),
  },
  deliverycost: {
    type: Number,
    default: function () {
      return parseFloat((this.postage * 0.9).toFixed(2));
    },
  },
  submitTime: { type: Date, default: Date.now },
  completed: {
    type: Boolean,
    default: false,
  },
  acceptedDeliveries: [
    {
      username: { type: String, required: true },
      acceptedAt: { type: Date, required: true },
      deliveryRouteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DeliveryRoute",
        required: true,
      },
      acceptedbysender: { type: Boolean, default: false },
      senderAcceptanceTime: { type: Date },
    },
  ],
});

const Consignment = mongoose.model("Consignment", consignmentSchema);

// Delivery Schema
const deliverySchema = new mongoose.Schema({
  username: String,
  currentLocation: String,
  travelingLocation: String,
  meansOfTravel: String,
  startDate: String,
  startTime: String,
  arrivalDate: String,
  arrivalTime: String,
  submissionDateTime: { type: Date, default: Date.now },
  completed: {
    type: Boolean,
    default: false,
  },
});
const Delivery = mongoose.model("Delivery", deliverySchema);

const DeliveryLocationSchema = new mongoose.Schema({
  deliveryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Delivery",
    required: true,
  },
  consignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Consignment",
    required: true,
  },
  deliveryUsername: {
    type: String,
    required: true,
  },
  senderUsername: {
    type: String,
    required: true,
  },
  location: {
    type: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    required: true,
  },
  receivingTimeMin: {
    type: String,
    required: true,
  },
  receivingTimeMax: {
    type: String,
    required: true,
  },
  receiverName: {
    type: String,
    required: true,
  },
  locationConfirmedBySeller: {
    type: Boolean,
    default: false,
  },
  otp: {
    type: String,
    required: false,
  },
  otpExpiry: {
    type: Date,
    required: false,
  },
  otpverifed: {
    type: Boolean,
    default: false,
  },
  otp_rec: {
    type: String,
    required: false,
  },
  otp_recExpiry: {
    type: Date,
    required: false,
  },
  otpverifed_rec: {
    type: Boolean,
    default: false,
  },
  currentSection: {
    type: Number,
    default: 1,
    min: 1,
    max: 3,
  },
});
const DeliveryLocation = mongoose.model(
  "DeliveryLocation",
  DeliveryLocationSchema
);

module.exports = {
  User,
  UserData,
  Consignment,
  Delivery,
  DeliveryLocation,
};
