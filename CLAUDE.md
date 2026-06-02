# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Windy Hotel Cửa Lò — a bilingual (Vietnamese/English) hotel booking website built with Node.js, Express, EJS, and MongoDB Atlas.

## Commands

- **Dev server:** `npm run dev` (uses nodemon for auto-reload)
- **Production start:** `npm start`
- **No test suite or linter is configured.**

## Environment

Requires a `.env` file with: `PORT`, `EMAIL_USER`, `EMAIL_PASS` (Gmail app password), `MONGO_URI` (MongoDB Atlas connection string), `ADMIN_PASSWORD`, `SESSION_SECRET`, `BOOKINGCOM_API_KEY`, `FB_VERIFY_TOKEN`, `FB_PAGE_ACCESS_TOKEN`, `FB_APP_SECRET`.

## Architecture

Single-file Express server (`server.js`) handling all routes and business logic — no router modules. EJS templates with a partials-based layout.

### Backend (`server.js`)

- **Public routes:** `GET /` (homepage), `POST /api/booking` (guest booking submission), `GET /api/rooms/availability?check_in=dd/mm/yyyy&check_out=dd/mm/yyyy` (date-based room availability — cross-references Room inventory with overlapping Confirmed/CheckedIn bookings)
- **Booking.com webhook:** `POST /api/webhook/booking-com` — receives bookings via `X-API-Key` header auth. Auto-sets `status: 'Confirmed'`, `source: 'Booking.com'`
- **Facebook webhook:** `GET /api/webhook/facebook` (verification handshake) + `POST /api/webhook/facebook` (lead events). Two-step flow: Facebook sends `leadgen_id`, server calls Graph API to fetch lead data. Verified via HMAC-SHA256 (`X-Hub-Signature-256`). Sets `status: 'Pending'`, `source: 'Facebook'`. Missing fields (room type, dates) get defaults with notes for staff
- **Admin routes:** `GET/POST /admin/login`, `GET /admin/bookings`, `GET /admin/rooms` (all protected by `requireAdmin`), `GET /admin/logout`
- **Admin Booking API:** `GET /api/admin/bookings`, `PATCH /api/admin/bookings/:id/status`
- **Admin Room API:** `GET /api/admin/rooms`, `POST /api/admin/rooms` (upsert by roomName), `PATCH /api/admin/rooms/:id/status` (move rooms between statuses), `DELETE /api/admin/rooms/:id`
- Booking status lifecycle: `Pending → Confirmed | Cancelled | CheckedIn | CheckedOut`
- Room type mapping: `ROOM_TYPE_MAP` in `server.js` maps external room names (from Booking.com and Facebook) to internal enum values — extend this object when new room name variants appear
- Email notifications via nodemailer (Gmail SMTP) on new bookings from all sources (website, Booking.com, Facebook) with source-branded templates
- Raw body captured via `express.json({ verify })` for Facebook HMAC signature verification
- News data is hardcoded in `server.js` (not in the database)
- Admin password and session secret are loaded from `.env` with hardcoded fallbacks

### Data Layer (`models/`)

**Booking model** — `pre('save')` hook validates check-in < check-out. Room types enum: `Standard`, `Deluxe`, `Family`, `Suite`. Fields `source` (enum: `Website`, `Booking.com`, `Facebook`) and `externalBookingId` (sparse unique) track booking origin and enable duplicate detection for webhook deliveries.

**Room model** — one document per room type (not per physical room). Tracks inventory counts: `totalRooms`, `available`, `occupied`, `maintenance`, `cleaning`. `pre('save')` hook enforces invariant: `available + occupied + maintenance + cleaning === totalRooms`. Status transfer via PATCH moves counts between fields. Auto-seeded with 4 default room types on first admin visit.

### Frontend

- `views/index.ejs` — composed from partials in `views/partials/` (header, hero, booking, about, rooms, amenities, news, contact, footer)
- `views/admin-login.ejs`, `views/admin-bookings.ejs` — admin pages with source column showing Website/Booking.com/Facebook badges; nav links between bookings and rooms
- `views/admin-rooms.ejs` — room inventory management: summary cards, add/update form, status transfer table
- `public/js/main.js` — language switcher (`data-vi`/`data-en` attributes), image slider, news filtering, booking form AJAX submission with VN phone validation
- `public/js/main-admin.js` — booking status update via PATCH API
- `public/js/main-admin-rooms.js` — room CRUD and status transfer operations
- `public/css/style.css` — all styles for the public-facing site

### Bilingual System

Client-side language toggle using `data-vi` and `data-en` HTML attributes. The `switchLanguage()` function in `main.js` swaps text content based on the selected language. Default language is Vietnamese.

## Key Conventions

- Vietnamese comments throughout the codebase
- Phone validation is two-layered: the Mongoose schema accepts international formats (`^\+?[\d\s\-()]{7,20}$`), while the website booking route enforces strict VN mobile regex (`^(0|\+84)(3|5|7|8|9)\d{8}$`). Booking.com webhook bypasses the strict check since guests may have international numbers
- Booking form field names differ between frontend (`checkin`/`checkout`/`roomType`) and Mongoose schema (`checkIn`/`checkOut`/`roomName`) — mapped manually in the POST handler
- All admin routes (both rendered pages and API endpoints) are protected by `requireAdmin` session middleware
