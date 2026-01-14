# Guestara – Menu, Pricing & Booking Backend

A Node.js + Express + MongoDB backend that models a real-world restaurant / services catalog with
categories, items, pricing logic, availability, bookings, and add-ons.

This project focuses on **business logic and system design**, not just CRUD APIs.

---

## 🧱 Architecture Overview

The application follows a **modular, layered architecture**:

- **Routes** → request/response handling
- **Controllers** → input handling & orchestration
- **Services** → core business logic
- **Models** → data schemas & constraints

This separation makes the codebase:
- easier to reason about
- easier to test
- easier to extend

```text
guestara-backend/
└── src/
    ├── app.js           # Express app config
    ├── server.js        # Server bootstrap
    ├── routes.js        # API route registry
    ├── config/
    │   └── db.js        # MongoDB connection
    └── modules/
        ├── category/
        ├── subcategory/
        ├── item/
        ├── pricing/
        └── booking/
```

---

## 🗄️ Database Choice

**MongoDB (via Mongoose)** was chosen because:

- The data model is hierarchical (Category → Subcategory → Item)
- Pricing rules vary by item (dynamic schemas fit well)
- Flexible querying is needed for search and filters
- MongoDB aggregation pipelines are useful for computed fields

The system is scoped to a **single restaurant**, so no `restaurantId` abstraction is used.

---

## ⚙️ Setup & Running

### Requirements
- Node.js **18+**
- MongoDB (local or Atlas)

### Environment
Create `.env` in `guestara-backend/`:

```env
MONGO_URI=mongodb://localhost:27017/guestara
PORT=4000
NODE_ENV=development
```

### Install & Run

```bash
cd guestara-backend
npm install
npm run dev
```

**API base URL:**
`http://localhost:4000/api`

### 📜 Scripts

| Script | Description |
| :--- | :--- |
| `npm run dev` | Start server with nodemon |
| `npm start` | Production start |

---

## 📦 Core Data Model

### Category
- Unique globally (single restaurant)
- Can define tax:
  - `tax_applicable`
  - `tax_percentage`
- Soft delete via `is_active`

### Subcategory
- Belongs to a **category**
- Name unique within its category
- Tax behavior:
  - `tax_applicable = null` → inherit from category
  - `true` / `false` → override category tax

### Item
- Belongs to exactly one: `categoryId` **OR** `subcategoryId`
- Name unique under the same parent
- Supports:
  - multiple pricing strategies
  - optional booking
  - add-ons

---

## 🧠 Tax Inheritance (Critical Design)

Tax is **not** stored on items. Instead, tax is resolved dynamically at runtime:

1. **If item belongs to a subcategory:**
   - If subcategory has `tax_applicable` → use it
   - Else → inherit from category
2. **If item belongs directly to a category:**
   - Use category tax

**Why this approach?**
- Changing category tax automatically affects all dependent items
- No mass updates or duplicated data
- Clear inheritance chain

*This logic is implemented inside the pricing service, not the schema.*

---

## 💰 Pricing Engine

Each item supports exactly **one** pricing type:

### Pricing Types

**1. Static**
Fixed price:
```json
{ "price": 200 }
```

**2. Complimentary**
Always free (price resolves to 0).

**3. Discounted**
Base price with discount:
```json
{
  "base_price": 300,
  "discount_type": "PERCENT",
  "discount_value": 10
}
```
Final price is never negative.

**4. Tiered**
Price depends on usage duration (uses `durationHours` at runtime):
```json
{
  "tiers": [
    { "upto": 1, "price": 300 },
    { "upto": 2, "price": 500 }
  ]
}
```

**5. Dynamic (Time-based)**
Price depends on time window:
```json
{
  "windows": [
    { "start": "08:00", "end": "11:00", "price": 199 }
  ]
}
```
Returns “not available” outside valid windows.

### 🔎 Required Price Endpoint
`GET /items/:id/price`

This endpoint forces business logic correctness. It returns:
- applied pricing rule
- base price
- discount (if any)
- add-ons total
- tax (with source)
- final payable amount

**Query parameters:**
- `durationHours` → tiered pricing
- `time` (HH:MM) or `at` (ISO date) → dynamic pricing
- `addons` → comma-separated addon ids

---

## 📅 Availability & Booking

Items can optionally be bookable.

### Availability
Defined on item:
```json
{
  "days": ["MON", "TUE", "WED"],
  "slots": [
    { "start": "10:00", "end": "11:00" }
  ]
}
```

### Booking Rules
- Slot must exist in availability
- Item must be active
- No overlapping bookings allowed
- Exact-slot double booking prevented via DB index

### APIs
- `GET /items/:itemId/availability?date=YYYY-MM-DD`
- `POST /items/:itemId/book`

---

## 🔍 Search, Filtering & Pagination

`GET /items` supports:
- pagination (`page`, `limit`)
- sorting (`name`, `createdAt`, `price`)
- partial text search (`q`)
- filters:
  - `categoryId`
  - `subcategoryId`
  - `activeOnly`
  - `taxApplicable`
  - `minPrice`, `maxPrice`

**Note:** Price sorting is deterministic for `STATIC`, `COMPLIMENTARY`, and `DISCOUNTED`. Tiered and dynamic prices depend on runtime context and are resolved via the price endpoint.

---

## 🧪 Error Handling & Validation

- Soft deletes via `is_active`
- Defensive validation for ObjectIds
- Clear error messages
- Centralized error middleware

---

## 🧠 Tradeoffs & Simplifications

- **Single-restaurant scope** (no `restaurantId`)
- **Price sorting** excludes dynamic/tiered without context
- **Authentication** not implemented (out of scope)
