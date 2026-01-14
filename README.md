# Guestara-Assignment

Node/Express + MongoDB backend for menu catalog, pricing, and bookings.

## Project layout

```
guestara-backend/
  src/
    app.js
    server.js
    routes.js
    config/db.js
    modules/
      category/
      subcategory/
      item/
      pricing/
      booking/
```

## Requirements

- Node.js 18+
- MongoDB

## Setup

1) Create `.env` in `guestara-backend/`:

```
MONGO_URI=mongodb://localhost:27017/guestara
PORT=4000
NODE_ENV=development
```

2) Install and run:

```
cd guestara-backend
npm install
npm run dev
```

The API runs at `http://localhost:4000/api`.

## Scripts

- `npm run dev` - start with nodemon
- `npm start` - start server
- `npm run reset:indexes` - drop and rebuild category/subcategory/item indexes

## API

Base path: `/api`

### Health

- `GET /health`

### Categories

- `POST /categories`
- `GET /categories` (query: `page`, `limit`, `sortBy`, `sortOrder`, `activeOnly`)
- `GET /categories/:id`
- `PATCH /categories/:id`
- `DELETE /categories/:id` (soft delete)

### Subcategories

- `POST /subcategories`
- `GET /subcategories` (query: `page`, `limit`, `sortBy`, `sortOrder`, `activeOnly`, `categoryId`)
- `GET /subcategories/:id`
- `PATCH /subcategories/:id`
- `DELETE /subcategories/:id` (soft delete)

### Items

- `POST /items`
- `GET /items`
  - query: `page`, `limit`, `sortBy`, `sortOrder`, `activeOnly`,
    `categoryId`, `subcategoryId`, `q` (text search),
    `minPrice`, `maxPrice`, `taxApplicable`
- `GET /items/:id`
- `PATCH /items/:id`
- `DELETE /items/:id` (soft delete)

### Pricing

- `GET /items/:id/price`
  - query: `durationHours` (tiered pricing)
  - query: `time` (HH:MM) or `at` (ISO Date) for dynamic pricing
  - query: `addons` (comma-separated addon ids)

### Booking

- `GET /items/:itemId/availability?date=YYYY-MM-DD`
- `POST /items/:itemId/book`
  - body: `{ "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM", "notes": "" }`

## Data model highlights

- `Category`: optional tax config (`tax_applicable`, `tax_percentage`).
- `Subcategory`: can override tax, or inherit from parent category.
- `Item`:
  - belongs to exactly one parent: `categoryId` OR `subcategoryId`.
  - `pricing_type`: `STATIC`, `TIERED`, `COMPLIMENTARY`, `DISCOUNTED`, `DYNAMIC`.
  - `pricing_config`: pricing rules (shape depends on `pricing_type`).
  - `is_bookable` + `availability` define booking slots.

## Pricing behavior

- Static: `pricing_config.price`
- Complimentary: always `0`
- Discounted: `base_price` with `discount_type` (`FLAT` or `PERCENT`)
- Tiered: `tiers: [{ upto, price }]`, uses `durationHours`
- Dynamic: `windows: [{ start, end, price }]`, uses `time` or `at`

## Booking behavior

- Uses configured availability slots per item.
- Prevents overlapping confirmed bookings.
- Returns availability with `available: true/false` per slot.
