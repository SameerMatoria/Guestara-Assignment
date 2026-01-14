const router = require("express").Router();

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.use("/categories", require("./modules/category/category.routes"));

router.use("/subcategories", require("./modules/subcategory/subcategory.routes"));

router.use("/items", require("./modules/item/item.routes"));

router.use("/", require("./modules/pricing/pricing.routes"));


module.exports = router;
