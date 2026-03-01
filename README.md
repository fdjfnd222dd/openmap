# Project Hilo

A real-time disaster and local incident reporting platform built with React, Leaflet, and Supabase.

![Project Hilo](https://img.shields.io/badge/status-active-brightgreen) ![React](https://img.shields.io/badge/React-18-blue) ![Vite](https://img.shields.io/badge/Vite-5-purple) ![Supabase](https://img.shields.io/badge/Supabase-enabled-green)

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

### 2. Set up Supabase

Create a free project at [supabase.com](https://supabase.com), then open `src/supabaseClient.js` and replace the placeholder credentials:

```js
const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = 'your-anon-key'
```

### 3. Run the database migrations

In the Supabase **SQL Editor**, run the following:

```sql
-- Reports table
CREATE TABLE reports (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  type text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  status text
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_select" ON reports FOR SELECT USING (true);
CREATE POLICY "reports_insert" ON reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reports_update" ON reports FOR UPDATE USING (auth.role() = 'authenticated');

-- Profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  trust_score integer DEFAULT 0,
  reports_submitted integer DEFAULT 0,
  reports_verified integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.role() = 'authenticated');

-- Comments table
CREATE TABLE comments (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  report_id bigint REFERENCES reports(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL
);
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Sitreps table (for graph view)
CREATE TABLE sitreps (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  title text NOT NULL,
  content text,
  status text DEFAULT 'draft',
  report_id bigint REFERENCES reports(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE sitreps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sitreps_select" ON sitreps FOR SELECT USING (true);
CREATE POLICY "sitreps_insert" ON sitreps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sitreps_update" ON sitreps FOR UPDATE USING (auth.role() = 'authenticated');

-- Relationships table (for graph view)
CREATE TABLE relationships (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  source_type text NOT NULL,
  source_id text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  label text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "relationships_select" ON relationships FOR SELECT USING (true);
CREATE POLICY "relationships_insert" ON relationships FOR INSERT WITH CHECK (auth.uid() = created_by);
```

Also enable **Realtime** on the `reports` table: Supabase Dashboard → Database → Replication → toggle `reports`.

### 4. Start the dev server

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
