<div align="center">

<img src="public/icons/favicon.svg" width="88" alt="Duezy logo" />

# Duezy

**Never miss a due date.**

A bilingual (Persian / English), offline-first reminder app for the dates that matter —
loan installments, insurance renewals, car service, bills, rent, and appointments.

[![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PWA](https://img.shields.io/badge/PWA-installable-5a0fc8?logo=pwa&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)](https://vite.dev)

</div>

## ✨ Features

- **Quick entry** — a reminder needs only a title and a date; everything else is optional
- **Multi-stage alerts** — get notified on the day and/or 1, 3, and 7 days before the due date
- **Recurrence** — daily, weekly, monthly, or yearly with custom intervals, weekday sets, and
  end conditions (a date or an occurrence count). Completing a recurring reminder automatically
  schedules the next occurrence
- **Dual calendar** — full Jalali (Shamsi) *and* Gregorian support, switchable any time.
  Recurring reminders can follow either calendar, so a monthly bill always lands on the same
  Persian day of the month
- **Categories** — built-ins for bills, vehicle, and personal, plus your own with icon and color
- **Calendar view** — month grid with per-day markers and a day sheet, in either calendar system
- **Search & stats** — instant search across titles, notes, and amounts; completion history,
  on-time rate, day streaks, and per-category breakdowns
- **Themes** — six accent colors × light / dark / system, with a no-flash boot
- **True bilingual UI** — Persian (RTL) and English (LTR) switch at runtime, including Persian
  numerals (۱۲۳), fonts, and layout direction
- **Offline-first** — all data lives in your browser (IndexedDB); the app installs as a PWA and
  works fully offline
- **Backups** — one-click export / import as JSON, merged safely by newest change
- **Free & unlimited** — no accounts, no paywalls, no limits

## 🔒 Privacy

Duezy is local-first by design. Reminders, categories, and settings never leave your device —
there is no server and no telemetry. Browser notifications fire only while the app is open
(no push server); the in-app Overdue / Today views are always the source of truth.

## 🚀 Getting started

**Prerequisites:** Node.js ≥ 20 and npm.

```bash
git clone https://github.com/moeinrouhani/Duezy.git
cd Duezy
npm install
npm run dev        # → http://localhost:5173
```

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server with HMR |
| `npm run build` | Typecheck + production build (outputs to `dist/`, generates the service worker) |
| `npm run preview` | Serve the production build locally |
| `npm run test` | Run the Vitest suite (Jalali conversion, recurrence math, alerts, i18n parity) |
| `npm run typecheck` | TypeScript only |

### Installing as an app

Build and serve over HTTPS (or localhost), then use your browser's **Install** option —
Duezy runs standalone, with its own icon and offline cache. On iOS, use *Add to Home Screen*.

## 🧱 Tech stack

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript + Vite 7 |
| Styling | Tailwind CSS 4 (CSS-first config, logical properties for RTL) |
| State | Zustand 5 (persisted settings) |
| Storage | Dexie 4 (IndexedDB) behind repository interfaces |
| Dates | date-fns 4 (Gregorian engine) + jalaali-js (Jalali conversion) |
| i18n | i18next / react-i18next |
| Routing | React Router 7 (hash router — deployable to any static host) |
| PWA | vite-plugin-pwa (Workbox precache, notification deep-links) |

## 🗂 Project structure

```
src/
├─ domain/        # Pure, tested core: types, dates, Jalali math, recurrence, alerts, stats
├─ db/            # Dexie schema + first-run seed
├─ repositories/  # Persistence interfaces + Dexie adapters (sync-ready boundary)
├─ stores/        # Zustand mirrors of the repositories + settings + UI state
├─ i18n/          # i18next setup + en/fa locale files
├─ themes/        # CSS custom-property token system (6 accents × light/dark)
├─ hooks/         # useReminders, useTheme, useLocalDate, notification scheduler, …
├─ components/    # UI primitives, layout shell, dual-calendar date picker
├─ features/      # Screens: home, form, detail, calendar, search, stats, categories, settings
└─ utils/         # Digit localization, backup, sorting, ids
```

### Design notes

- **Dates are stored as Gregorian ISO strings** (`YYYY-MM-DD`, local semantics) and converted
  to Jalali only at the display/picker boundary — one source of truth, no drift
- **Every record carries `createdAt` / `updatedAt` / `deletedAt`** and all mutations flow
  through repository interfaces, so a cloud-sync layer can be added later without touching
  the UI
- **Theming is CSS custom properties** (`data-accent` / `data-mode` on `<html>`) mapped into
  Tailwind via `@theme inline` — accents swap at runtime with zero rebuilds
- **RTL is built in**: layout uses logical properties (`ps-*`, `me-*`, `start-*`) exclusively

## 🧪 Tests

The domain logic is covered by unit tests, including the tricky parts:

- Jalali↔Gregorian round-trips, leap years, and month-length rules
- Recurrence clamping in both calendars (e.g. ۳۱ شهریور → ۳۰ مهر), weekday sets, end conditions
- Alert-slot scheduling and sectioning (overdue / today / upcoming)
- Persian↔Latin digit conversion and en/fa locale key parity

## 🗺 Roadmap

- [ ] Optional cloud sync across devices
- [ ] Web push notifications (server-assisted)
- [ ] Home-screen widgets
- [ ] CSV export

## 🙏 Credits

Built with [React](https://react.dev), [Tailwind CSS](https://tailwindcss.com),
[Dexie.js](https://dexie.org), [date-fns](https://date-fns.org), [jalaali-js](https://github.com/jalaali/jalaali-js),
[i18next](https://www.i18next.com), [lucide](https://lucide.dev),
[Vazirmatn](https://github.com/rastikerdar/vazirmatn) and [Inter](https://rsms.me/inter/) fonts.

---

<div align="center">

**فارسی**

دوزی یک یادآورِ موعد برای اقساط، بیمه، قبض‌ها و قرارهای مهم است — کاملاً آفلاین،
دوزبانه (فارسی/انگلیسی) با تقویم شمسی و میلادی، تم‌های رنگی روشن و تیره.
همه داده‌ها فقط روی دستگاه خودتان ذخیره می‌شود.

</div>
