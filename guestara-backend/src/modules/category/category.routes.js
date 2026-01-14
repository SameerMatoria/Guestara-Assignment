const router = require("express").Router();
const controller = require("./category.controller");

// CRUD + soft delete
router.post("/", controller.create);
router.get("/", controller.list);
router.get("/:id", controller.getById);
router.patch("/:id", controller.update);
router.delete("/:id", controller.deactivate); // soft delete

module.exports = router;
