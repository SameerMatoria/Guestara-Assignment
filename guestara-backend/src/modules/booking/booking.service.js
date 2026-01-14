const mongoose = require("mongoose");
const Booking = require("./booking.model");
const Item = require("../item/item.model");

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

function isOverlap(aStart, aEnd, bStart, bEnd) {
  // overlap if start < otherEnd AND otherStart < end
  return aStart < bEnd && bStart < aEnd;
}

function getDayCode(dateStr) {
  // dateStr: YYYY-MM-DD
  const d = new Date(dateStr + "T00:00:00");
  const map = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return map[d.getDay()];
}

function validateSlotFormat(slot) {
  if (!slot?.start || !slot?.end) throw new Error("Slot must contain start and end");
  const s = toMinutes(slot.start);
  const e = toMinutes(slot.end);
  if (Number.isNaN(s) || Number.isNaN(e)) throw new Error("Slot time must be HH:MM");
  if (e <= s) throw new Error("Slot end must be after start");
  return { s, e };
}

async function getAvailableSlots(itemId, date) {
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    const err = new Error("Invalid itemId");
    err.statusCode = 400;
    throw err;
  }
  if (!date) {
    const err = new Error("date is required (YYYY-MM-DD)");
    err.statusCode = 400;
    throw err;
  }

  const item = await Item.findById(itemId);
  if (!item) {
    const err = new Error("Item not found");
    err.statusCode = 404;
    throw err;
  }

  if (!item.is_bookable) {
    const err = new Error("Item is not bookable");
    err.statusCode = 400;
    throw err;
  }

  const availability = item.availability;
  if (!availability?.days?.length || !availability?.slots?.length) {
    const err = new Error("Item availability is not configured");
    err.statusCode = 400;
    throw err;
  }

  const day = getDayCode(date);
  if (!availability.days.includes(day)) {
    return { itemId: String(item._id), date, day, slots: [] };
  }

  // fetch confirmed bookings for date
  const booked = await Booking.find({
    itemId: item._id,
    date,
    status: "CONFIRMED",
  }).lean();

  const slots = availability.slots.map((slot) => {
    const { s, e } = validateSlotFormat(slot);

    const isBooked = booked.some((b) => {
      const bs = toMinutes(b.startTime);
      const be = toMinutes(b.endTime);
      return isOverlap(s, e, bs, be);
    });

    return {
      start: slot.start,
      end: slot.end,
      available: !isBooked,
    };
  });

  return { itemId: String(item._id), date, day, slots };
}

async function bookSlot({ itemId, date, startTime, endTime, notes }) {
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    const err = new Error("Invalid itemId");
    err.statusCode = 400;
    throw err;
  }
  if (!date || !startTime || !endTime) {
    const err = new Error("date, startTime, endTime are required");
    err.statusCode = 400;
    throw err;
  }

  const item = await Item.findById(itemId);
  if (!item) {
    const err = new Error("Item not found");
    err.statusCode = 404;
    throw err;
  }
  if (!item.is_bookable) {
    const err = new Error("Item is not bookable");
    err.statusCode = 400;
    throw err;
  }

  const availability = item.availability;
  if (!availability?.days?.length || !availability?.slots?.length) {
    const err = new Error("Item availability is not configured");
    err.statusCode = 400;
    throw err;
  }

  // Validate day allowed
  const day = getDayCode(date);
  if (!availability.days.includes(day)) {
    const err = new Error("Item not available on this day");
    err.statusCode = 400;
    throw err;
  }

  // Validate requested slot exists in configured slots
  const requested = { start: startTime, end: endTime };
  validateSlotFormat(requested);

  const existsInConfig = availability.slots.some(
    (s) => s.start === startTime && s.end === endTime
  );
  if (!existsInConfig) {
    const err = new Error("Requested slot is not part of item's availability slots");
    err.statusCode = 400;
    throw err;
  }

  // Overlap check against existing confirmed bookings
  const rs = toMinutes(startTime);
  const re = toMinutes(endTime);

  const conflicts = await Booking.find({
    itemId: item._id,
    date,
    status: "CONFIRMED",
  }).lean();

  const hasConflict = conflicts.some((b) => {
    const bs = toMinutes(b.startTime);
    const be = toMinutes(b.endTime);
    return isOverlap(rs, re, bs, be);
  });

  if (hasConflict) {
    const err = new Error("Slot already booked");
    err.statusCode = 409;
    throw err;
  }

  // Create booking
  try {
    const created = await Booking.create({
      itemId: item._id,
      date,
      startTime,
      endTime,
      notes: notes || "",
      status: "CONFIRMED",
    });
    return created;
  } catch (err) {
    // Unique index protection
    if (err.code === 11000) {
      err.statusCode = 409;
      err.message = "Slot already booked";
    }
    throw err;
  }
}

module.exports = {
  getAvailableSlots,
  bookSlot,
};
