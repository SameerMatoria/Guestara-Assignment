const mongoose = require("mongoose");

const SubcategorySchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    image: { type: String, trim: true },
    description: { type: String, trim: true },

    // null means "inherit from category"
    tax_applicable: {
      type: Boolean,
      default: null,
    },

    // null means "inherit"
    tax_percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Unique under same category (single restaurant => no restaurantId needed)
SubcategorySchema.index({ categoryId: 1, name: 1 }, { unique: true });

// Validation rules:
// - tax_applicable === true  => tax_percentage must be present
// - tax_applicable === false => tax_percentage must be null
// - tax_applicable === null  => inherit => tax_percentage must be null
SubcategorySchema.pre("validate", function () {
  if (this.tax_applicable === true) {
    if (this.tax_percentage === null || this.tax_percentage === undefined) {
      throw new Error("tax_percentage is required when tax_applicable is true");
    }
  } else {
    // false or null => no percentage stored here
    this.tax_percentage = null;
  }
});

module.exports = mongoose.model("Subcategory", SubcategorySchema);
