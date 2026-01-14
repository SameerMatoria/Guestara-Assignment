const service = require("./booking.service");

async function getAvailability(req, res, next) {
  try {
    const { date } = req.query;
    const data = await service.getAvailableSlots(req.params.itemId, date);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function book(req, res, next) {
  try {
    const { date, startTime, endTime, notes } = req.body;
    const created = await service.bookSlot({
      itemId: req.params.itemId,
      date,
      startTime,
      endTime,
      notes,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAvailability, book };
