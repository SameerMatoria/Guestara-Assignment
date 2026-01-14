const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true, // single restaurant => unique globally
    },

    image: { type: String, trim: true },
    description: { type: String, trim: true },

    tax_applicable: {
      type: Boolean,
      default: false,
    },

    tax_percentage: {
      type: Number,
      min: 0,
      max: 100,
    },

    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Conditional validation: tax_percentage required if tax_applicable is true
CategorySchema.pre("validate", function () {
  if (this.tax_applicable === true) {
    if (this.tax_percentage === undefined || this.tax_percentage === null) {
      throw new Error("tax_percentage is required when tax_applicable is true");
    }
  } else {
    this.tax_percentage = undefined;
  }
});

module.exports = mongoose.model("Category", CategorySchema);
