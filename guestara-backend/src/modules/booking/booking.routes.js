const router = require("express").Router();
const controller = require("./booking.controller");

router.get("/items/:itemId/availability", controller.getAvailability);
router.post("/items/:itemId/book", controller.book);

module.exports = router;
