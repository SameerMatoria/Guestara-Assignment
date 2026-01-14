const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
      index: true,
    },

    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },

    startTime: {
      type: String, // HH:MM
      required: true,
    },

    endTime: {
      type: String, // HH:MM
      required: true,
    },

    status: {
      type: String,
      enum: ["CONFIRMED", "CANCELLED"],
      default: "CONFIRMED",
      index: true,
    },

    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// Hard prevention of exact-slot double booking:
BookingSchema.index(
  { itemId: 1, date: 1, startTime: 1, endTime: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "CONFIRMED" } }
);

module.exports = mongoose.model("Booking", BookingSchema);
