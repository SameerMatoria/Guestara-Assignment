const pricingService = require("./pricing.service");

async function getItemPrice(req, res, next) {
  try {
    const { at, time, durationHours, addons } = req.query;

    const ctx = {
      // duration for tiered
      durationHours: durationHours ? Number(durationHours) : undefined,

      // time for dynamic
      at: at ? new Date(at) : undefined,
      timeHHMM: time || undefined,

      // addons: comma separated ids
      addonIds: addons ? String(addons).split(",").map((s) => s.trim()) : [],
    };

    const data = await pricingService.getItemPriceBreakdown(req.params.id, ctx);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { getItemPrice };
