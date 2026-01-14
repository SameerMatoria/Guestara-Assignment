const Item = require("../item/item.model");
const Category = require("../category/category.model");
const Subcategory = require("../subcategory/subcategory.model");

/**
 * Resolve effective tax for an item:
 * - Item doesn't have tax fields (by design)
 * - If subcategory has tax_applicable (true/false) -> use it
 * - else inherit from category
 */
async function resolveTaxForItem(item) {
  // if item belongs directly to category
  if (item.categoryId) {
    const cat = await Category.findById(item.categoryId);
    if (!cat) return { tax_applicable: false, tax_percentage: 0 };
    return {
      tax_applicable: !!cat.tax_applicable,
      tax_percentage: cat.tax_applicable ? cat.tax_percentage : 0,
      source: "CATEGORY",
    };
  }

  // item belongs to subcategory
  const sub = await Subcategory.findById(item.subcategoryId);
  if (!sub) return { tax_applicable: false, tax_percentage: 0 };

  const cat = await Category.findById(sub.categoryId);

  // subcategory overrides if tax_applicable is not null
  if (sub.tax_applicable !== null) {
    return {
      tax_applicable: !!sub.tax_applicable,
      tax_percentage: sub.tax_applicable ? sub.tax_percentage : 0,
      source: "SUBCATEGORY",
    };
  }

  // else inherit from category
  return {
    tax_applicable: !!cat?.tax_applicable,
    tax_percentage: cat?.tax_applicable ? cat.tax_percentage : 0,
    source: "CATEGORY_INHERITED",
  };
}

// ---------- Pricing Strategies ----------

function calcStatic(config) {
  if (typeof config?.price !== "number") {
    throw new Error("STATIC pricing_config.price must be a number");
  }
  return { basePrice: config.price, appliedRule: { type: "STATIC", price: config.price } };
}

function calcComplimentary(config) {
  // ignore whatever is in config, always 0
  return { basePrice: 0, appliedRule: { type: "COMPLIMENTARY", price: 0 } };
}

function calcDiscounted(config) {
  const base = config?.base_price;
  const discountType = config?.discount_type; // "FLAT" | "PERCENT"
  const discountValue = config?.discount_value;

  if (typeof base !== "number") throw new Error("DISCOUNTED pricing_config.base_price must be a number");
  if (!["FLAT", "PERCENT"].includes(discountType)) throw new Error("DISCOUNTED pricing_config.discount_type must be FLAT or PERCENT");
  if (typeof discountValue !== "number" || discountValue < 0) throw new Error("DISCOUNTED pricing_config.discount_value must be a non-negative number");

  let discount = 0;
  if (discountType === "FLAT") discount = discountValue;
  if (discountType === "PERCENT") {
    if (discountValue > 100) throw new Error("Percentage discount cannot exceed 100");
    discount = (base * discountValue) / 100;
  }

  const final = Math.max(0, base - discount);

  return {
    basePrice: base,
    discount: { type: discountType, value: discountValue, amount: discount },
    appliedRule: { type: "DISCOUNTED", base_price: base, discount_type: discountType, discount_value: discountValue },
    discountedPrice: final,
  };
}

function calcTiered(config, ctx) {
  // ctx.durationHours required
  const tiers = config?.tiers;
  if (!Array.isArray(tiers) || tiers.length === 0) throw new Error("TIERED pricing_config.tiers must be a non-empty array");

  const durationHours = Number(ctx?.durationHours);
  if (!durationHours || durationHours <= 0) throw new Error("TIERED requires durationHours > 0");

  // validate tiers: must not overlap and must be increasing by upto
  const sorted = [...tiers].sort((a, b) => a.upto - b.upto);
  for (const t of sorted) {
    if (typeof t.upto !== "number" || t.upto <= 0) throw new Error("Each tier.upto must be a positive number");
    if (typeof t.price !== "number" || t.price < 0) throw new Error("Each tier.price must be a non-negative number");
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].upto <= sorted[i - 1].upto) {
      throw new Error("Tiered pricing tiers must have strictly increasing upto values (no overlap)");
    }
  }

  const tier = sorted.find((t) => durationHours <= t.upto);
  if (!tier) {
    // If beyond last tier, choose last tier (or you can throw). We'll choose last tier for practicality.
    const last = sorted[sorted.length - 1];
    return {
      basePrice: last.price,
      appliedRule: { type: "TIERED", chosen: last, durationHours },
    };
  }

  return {
    basePrice: tier.price,
    appliedRule: { type: "TIERED", chosen: tier, durationHours },
  };
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

function calcDynamic(config, ctx) {
  // ctx.time required (HH:MM) or Date -> we will accept either
  const windows = config?.windows;
  if (!Array.isArray(windows) || windows.length === 0) throw new Error("DYNAMIC pricing_config.windows must be a non-empty array");

  let minutesNow;
  if (ctx?.timeHHMM) minutesNow = toMinutes(ctx.timeHHMM);
  else if (ctx?.at instanceof Date) minutesNow = ctx.at.getHours() * 60 + ctx.at.getMinutes();
  else throw new Error("DYNAMIC requires timeHHMM (e.g. 10:30) or at(Date)");

  // validate windows
  const parsed = windows.map((w) => {
    if (!w.start || !w.end) throw new Error("Dynamic window must include start and end (HH:MM)");
    const start = toMinutes(w.start);
    const end = toMinutes(w.end);
    if (end <= start) throw new Error("Dynamic window end must be after start");
    if (typeof w.price !== "number" || w.price < 0) throw new Error("Dynamic window price must be non-negative");
    return { ...w, startMin: start, endMin: end };
  });

  // overlap check
  const sorted = [...parsed].sort((a, b) => a.startMin - b.startMin);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startMin < sorted[i - 1].endMin) {
      throw new Error("Dynamic pricing windows must not overlap");
    }
  }

  const active = sorted.find((w) => minutesNow >= w.startMin && minutesNow < w.endMin);
  if (!active) {
    const err = new Error("Item not available at this time");
    err.statusCode = 400;
    throw err;
  }

  return {
    basePrice: active.price,
    appliedRule: { type: "DYNAMIC", chosen: { start: active.start, end: active.end, price: active.price }, time: minutesNow },
  };
}

// ---------- Addons ----------

function calcAddonsTotal(item, addonIds = []) {
  if (!addonIds?.length) return { addonsTotal: 0, addonsApplied: [] };
  const addons = Array.isArray(item.addons) ? item.addons : [];

  // We keep addon format flexible:
  // [{ id, name, price, is_mandatory, groupId? }]
  const selected = addons.filter((a) => addonIds.includes(String(a.id)));

  const total = selected.reduce((sum, a) => sum + Number(a.price || 0), 0);

  return { addonsTotal: total, addonsApplied: selected };
}

// ---------- Main calculation ----------

async function getItemPriceBreakdown(itemId, ctx = {}) {
  const item = await Item.findById(itemId);
  if (!item) {
    const err = new Error("Item not found");
    err.statusCode = 404;
    throw err;
  }

  // Pricing
  let pricingRes;

  switch (item.pricing_type) {
    case "STATIC":
      pricingRes = calcStatic(item.pricing_config);
      break;
    case "COMPLIMENTARY":
      pricingRes = calcComplimentary(item.pricing_config);
      break;
    case "DISCOUNTED":
      pricingRes = calcDiscounted(item.pricing_config);
      break;
    case "TIERED":
      pricingRes = calcTiered(item.pricing_config, ctx);
      break;
    case "DYNAMIC":
      pricingRes = calcDynamic(item.pricing_config, ctx);
      break;
    default:
      throw new Error("Invalid pricing_type on item");
  }

  const basePrice = pricingRes.discountedPrice ?? pricingRes.basePrice;

  // Addons
  const { addonsTotal, addonsApplied } = calcAddonsTotal(item, ctx.addonIds);

  const subTotal = basePrice + addonsTotal;

  // Tax
  const tax = await resolveTaxForItem(item);
  const taxAmount = tax.tax_applicable ? (subTotal * tax.tax_percentage) / 100 : 0;

  const grandTotal = subTotal + taxAmount;

  return {
    itemId: String(item._id),
    itemName: item.name,

    pricing_type: item.pricing_type,
    applied_pricing_rule: pricingRes.appliedRule,

    base_price: pricingRes.basePrice,
    discount: pricingRes.discount || null,
    resolved_price_before_addons: basePrice,

    addons: addonsApplied,
    addons_total: addonsTotal,

    tax: {
      applicable: tax.tax_applicable,
      percentage: tax.tax_percentage,
      amount: taxAmount,
      source: tax.source,
    },

    grand_total: grandTotal,
    final_payable: grandTotal,
  };
}

module.exports = {
  getItemPriceBreakdown,
};
