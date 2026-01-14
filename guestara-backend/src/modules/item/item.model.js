const mongoose = require("mongoose");

const AvailabilitySlotSchema = new mongoose.Schema(
  {
    start: { type: String, required: true }, // "HH:MM"
    end: { type: String, required: true },   // "HH:MM"
  },
  { _id: false }
);

const AvailabilitySchema = new mongoose.Schema(
  {
    days: {
      type: [String],
      default: [],
      enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    },
    slots: {
      type: [AvailabilitySlotSchema],
      default: [],
    },
  },
  { _id: false }
);


const ItemSchema = new mongoose.Schema(
  {
    // Parent rule: exactly one must be set
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      default: null,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: { type: String, trim: true },
    image: { type: String, trim: true },

    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },

    pricing_type: {
      type: String,
      enum: ["STATIC", "TIERED", "COMPLIMENTARY", "DISCOUNTED", "DYNAMIC"],
      required: true,
    },
    pricing_config: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // Optional: booking + addons
    is_bookable: { type: Boolean, default: false },
    availability: { type: AvailabilitySchema, default: null },

    // simple flexible structure:
    // [{ id, name, price, is_mandatory, groupId? }]
    addons: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

// Parent constraint: either categoryId OR subcategoryId (not both, not none)
ItemSchema.pre("validate", function () {
  const hasCategory = !!this.categoryId;
  const hasSubcategory = !!this.subcategoryId;

  if (hasCategory === hasSubcategory) {
    throw new Error("Item must belong to exactly one: categoryId OR subcategoryId");
  }
});

// Unique name under same parent
ItemSchema.index(
  { categoryId: 1, name: 1 },
  { unique: true, partialFilterExpression: { categoryId: { $type: "objectId" } } }
);

ItemSchema.index(
  { subcategoryId: 1, name: 1 },
  { unique: true, partialFilterExpression: { subcategoryId: { $type: "objectId" } } }
);

// Text search
ItemSchema.index({ name: "text", description: "text" });

module.exports = mongoose.model("Item", ItemSchema);
