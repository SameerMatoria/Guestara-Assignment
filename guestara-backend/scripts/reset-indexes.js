require("dotenv").config();
const mongoose = require("mongoose");

const Category = require("../src/modules/category/category.model");
const Subcategory = require("../src/modules/subcategory/subcategory.model");
const Item = require("../src/modules/item/item.model");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");

  // Drop indexes safely (ignore errors)
  for (const model of [Category, Subcategory, Item]) {
    try {
      await model.collection.dropIndexes();
      console.log(`Dropped indexes for ${model.modelName}`);
    } catch (e) {
      console.log(`Skip dropIndexes for ${model.modelName}:`, e.message);
    }
  }

  // Rebuild indexes from schemas
  await Category.syncIndexes();
  await Subcategory.syncIndexes();
  await Item.syncIndexes();

  console.log("✅ Indexes synced to new schema");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
