# Project Hilo

A real-time disaster and local incident reporting platform built with React, Leaflet, and Supabase.

---

## Features

### Reporting & Map
- Interactive **Leaflet map** (OpenStreetMap tiles) with color-coded incident pins
- **Click-to-pin** — click anywhere on the map to pre-fill coordinates in the report form
- **Live feed** — new reports appear in real time via Supabase Realtime subscriptions
- **Pin clustering** for dense areas
- Filter incidents by **type** (flood, fire, earthquake, other) and **status** (unverified, verified, false)

### Ontology Graph View
- Full-screen **React Flow** graph showing relationships between reports, sitreps, users, and zones
- **Force-directed layout** with position persistence across filter changes
- Add manual relationships between any two nodes
- Node detail panel with inline relationship creation
- Toolbar with type toggles, search, and layout reset

### Trust & Credibility System
- Every user has a **trust score** that increases when their reports are verified
- Trust badges with four tiers: neutral → green → blue → gold (with glow)
- **Leaderboard** of top 10 contributors by trust score

### Clearance Level System
Five access levels, each unlocking additional features:

| Level | Name        | Unlocks                                 |
|-------|-------------|-----------------------------------------|
| 1     | PUBLIC      | View map and reports (everyone)         |
| 2     | VOLUNTEER   | Submit incident reports                 |
| 3     | COORDINATOR | Extended report details (user, timestamp) |
| 4     | RESPONDER   | Heatmap density layer on the map        |
| 5     | COMMAND     | Mark reports as verified or false       |

Enter a clearance code in the **LVL 1 PUBLIC** button in the top-right of the nav bar.

### Authentication
- Email/password sign up and log in via Supabase Auth
- User profiles auto-created on first sign-in
- Comments on individual reports (signed-in users only)

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Framework  | React 18 + Vite 5                   |
| Map        | Leaflet.js via react-leaflet v4     |
| Graph      | React Flow (reactflow v11)          |
| Forms      | React Hook Form                     |
| Backend    | Supabase (Postgres + Auth + Realtime) |
| Styling    | Plain CSS with CSS variables        |

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/fdjfnd222dd/openmap.git
cd openmap
npm install
```

### 2. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Project Structure

```
src/
├── components/
│   ├── AuthPanel.jsx       # Login / sign-up form
│   ├── ClearancePanel.jsx  # Clearance level badge + code entry
│   ├── FilterBar.jsx       # Type and status filter toggles
│   ├── GraphView.jsx       # React Flow ontology graph
│   ├── MapView.jsx         # Leaflet map with incident pins
│   ├── ReportCard.jsx      # Single incident card
│   ├── ReportDetail.jsx    # Expanded detail panel + comments
│   ├── ReportForm.jsx      # Submit new incident form
│   ├── ReportList.jsx      # Scrollable incident feed
│   └── Sidebar.jsx         # Left panel with tabs
├── utils/
│   └── trust.js            # Trust score → CSS class helper
├── App.jsx                 # Root component, global state
├── index.css               # All styles (CSS variables, dark theme)
├── main.jsx                # React entry point
└── supabaseClient.js       # Supabase client (add your keys here)
```

---

## Clearance Codes (Development)

These are hardcoded for local/personal use. **Do not use in production.**

| Level | Code           |
|-------|----------------|
| 2     | `volunteer2`   |
| 3     | `coordinator3` |
| 4     | `responder4`   |
| 5     | `command5`     |

---

## License

MIT
