const router = require("express").Router();
const controller = require("./pricing.controller");

// Required endpoint
router.get("/items/:id/price", controller.getItemPrice);

module.exports = router;
