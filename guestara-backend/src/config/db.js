const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in .env");

  mongoose.set("strictQuery", true);

  // Helpful logs
  mongoose.connection.on("connected", () => console.log("✅ MongoDB connected"));
  mongoose.connection.on("error", (err) =>
    console.error("❌ MongoDB connection error:", err.message)
  );

  await mongoose.connect(uri, {
    autoIndex: process.env.NODE_ENV !== "production",
    serverSelectionTimeoutMS: 5000, // fail fast in 5s
  });
}

module.exports = { connectDB };
