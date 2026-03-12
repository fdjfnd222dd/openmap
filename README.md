# Project HILO

**321st Civil Affairs Battalion — Common Operating Picture Platform**

A real-time civil affairs operations platform built for CAT team coordination, incident reporting, and command visibility. Designed as a proof-of-concept demonstration for CA battalion leadership.

---

## Overview

Project HILO gives Civil Affairs teams a unified browser-based COP — combining live incident reporting, blue force tracking, inter-team communications, Key Leader Engagement logging, SITREP filing, personnel status reporting, and command analytics in a single interface. No install required. Works on any modern browser.

---

## Features

### Live Common Operating Picture
- Interactive **Leaflet map** (OpenStreetMap + Esri Satellite) with color-coded incident pins by type
- **USGS live seismic feed** — real Hawaii earthquake events auto-plotted, refreshed every 5 minutes, no API key required
- **NWS weather alert** — active watches and warnings for Hawaii Island (HIZ023) shown as a compact map overlay, auto-refreshed every 10 minutes
- **CAT team Blue Force Tracking** — dot + label BFT markers showing team positions and status (ACTIVE / RTB / HOLD / COMMS OUT) with Supabase Realtime updates
- **CA simulation layer** — hardcoded CMOC, FOB, and 4x JBCP positions for Big Island
- **AO sector boundaries** — color-coded polygon overlays per CAT team area of operations
- **Click-to-pin** — click anywhere on the map to pre-fill coordinates in the report form
- **Live incident feed** — new reports appear in real time via Supabase Realtime
- **Marker clustering** with configurable radius
- **Density heatmap** overlay (Level 4+)
- **Weather precipitation overlay** via OpenWeatherMap tile layer (Level 4+)
- **Street / Satellite tile toggle** inside the LAYERS panel
- **Incident type legend** — persistent bottom-left map overlay (FLOOD / FIRE / QUAKE / OTHER)

### Clearance Level System
Five access tiers, each unlocking additional capabilities. Controlled via a badge in the top-right corner.

| Level | Name | Unlocks |
|-------|------|---------|
| 1 | PUBLIC | View verified incidents on map |
| 2 | VOLUNTEER | Submit reports, COMMS, KLE, SITREP, PERSTAT |
| 3 | COORDINATOR | Mark reports Under Review, file SITREPs |
| 4 | RESPONDER | Heatmap, weather overlay |
| 5 | COMMAND | Verify/false reports, FRAGORD broadcast, INTEL analytics |

### Unified Command Sidebar
Single left panel with tab rail. Tabs shown based on clearance level:

| Tab | Level | Description |
|-----|-------|-------------|
| ● FEED | 1+ | Live incident feed with type/status filter bar |
| + REPORT | 2+ | Submit new incident report with map click-to-pin |
| ◈ COMMS | 2+ | Regional and incident-specific real-time chat |
| ≡ LOGS | 2+ | Three sub-tabs: SITREP / KLE / PERSTAT |
| ∑ INTEL | 5 | Command analytics dashboard (charts + stats) |
| ◯ PROFILE | 1+ | Trust score, submission stats, top-10 leaderboard |

### LOGS Tab (SITREP / KLE / PERSTAT)

**SITREP Builder** — Structured situation report creation linked to specific incidents. Supports Draft / Active / Resolved lifecycle. One-click export formats to NATO text format and copies to clipboard.

**Key Leader Engagement (KLE) Log** — Log every civil leader engagement with organization, location, date, outcome (Positive / Neutral / Negative), reliability rating (1–5 stars), and follow-up actions. Export to formatted KLE report.

**PERSTAT (Personnel Status)** — Teams submit real-time headcount with GREEN / AMBER / RED status. Command sees a live roll-up of all teams with total PAX count and missing-report indicators. Updates via Supabase Realtime.

### FRAGORD Broadcast
Level 5 commanders issue Fragmentary Orders to all connected users instantly. Priority levels: ROUTINE / PRIORITY / IMMEDIATE / FLASH. Appears as a full-width alert banner. Users acknowledge with a single button. Acknowledgment persists in localStorage.

### Incident Verification Workflow
Unverified → Under Review → Verified → False. Level 3 marks Under Review. Level 5 delivers final verdict. Trust score adjustments applied to report submitters on verdict (+10 verified, −5 false).

### Trust & Credibility System
Every authenticated user has a trust score. Four badge tiers: neutral → green → blue → gold. Displayed on report cards and in the profile/leaderboard tab.

### Real-time Communications
Channel-based messaging. Regional channels (NORTH / SOUTH / EAST / WEST / CMOC) always available. Per-incident channels auto-created from the report detail view. Messages tagged with sender's clearance level badge.

### Command Analytics (Level 5)
Inline analytics panel: total reports, verified percentage, under-review count, false count, reports by type (bar chart), 7-day trend (line chart), status breakdown (pie chart).

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + Vite 5 |
| Map | Leaflet.js via react-leaflet v4 |
| Clustering | react-leaflet-cluster |
| Forms | React Hook Form |
| Charts | Recharts |
| Backend | Supabase (Postgres + Auth + Realtime) |
| Fonts | Rajdhani, Inter, JetBrains Mono |
| Styling | Plain CSS with CSS custom properties |
| Tile layers | OpenStreetMap (street), Esri World Imagery (satellite) |
| External APIs | USGS Earthquake GeoJSON (free), NWS Alerts API (free), OpenWeatherMap tiles |

---

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd hilo
npm install
```

### 2. Configure Supabase

Add your Supabase project URL and anon key to `src/supabaseClient.js`.

### 3. Run database migrations

Run the following in the Supabase SQL Editor:

```sql
-- profiles
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  trust_score int DEFAULT 0,
  reports_submitted int DEFAULT 0,
  reports_verified int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.role() = 'authenticated');

-- reports
CREATE TABLE reports (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  type text DEFAULT 'other',
  latitude float, longitude float,
  status text
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_select" ON reports FOR SELECT USING (true);
CREATE POLICY "reports_insert" ON reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reports_update" ON reports FOR UPDATE USING (auth.role() = 'authenticated');
ALTER TABLE reports REPLICA IDENTITY FULL;

-- comments
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

-- channels + messages
CREATE TABLE channels (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  type text DEFAULT 'regional',
  incident_id bigint REFERENCES reports(id) ON DELETE SET NULL
);
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channels_select" ON channels FOR SELECT USING (true);
CREATE POLICY "channels_insert" ON channels FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE TABLE messages (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  channel_id bigint REFERENCES channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  content text NOT NULL,
  clearance_level int DEFAULT 1
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select" ON messages FOR SELECT USING (true);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);
ALTER TABLE messages REPLICA IDENTITY FULL;

-- sitreps
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

-- kle_log
CREATE TABLE kle_log (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  leader_name text NOT NULL,
  organization text, location text,
  date_of_engagement timestamptz DEFAULT now(),
  summary text, outcome text DEFAULT 'neutral',
  follow_up text, reliability int DEFAULT 3,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE kle_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kle_select" ON kle_log FOR SELECT USING (true);
CREATE POLICY "kle_insert" ON kle_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kle_update" ON kle_log FOR UPDATE USING (auth.role() = 'authenticated');

-- team_status (BFT)
CREATE TABLE team_status (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  updated_at timestamptz DEFAULT now(),
  team_name text NOT NULL,
  status text DEFAULT 'ACTIVE',
  grid_lat float, grid_lng float,
  notes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE team_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_select" ON team_status FOR SELECT USING (true);
CREATE POLICY "team_insert" ON team_status FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "team_update" ON team_status FOR UPDATE USING (auth.role() = 'authenticated');

-- fragrods
CREATE TABLE fragrods (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  title text NOT NULL, content text NOT NULL,
  priority text DEFAULT 'ROUTINE',
  issued_by_email text, active boolean DEFAULT true,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE fragrods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fragord_select" ON fragrods FOR SELECT USING (true);
CREATE POLICY "fragord_insert" ON fragrods FOR INSERT WITH CHECK (auth.uid() = issued_by);
CREATE POLICY "fragord_update" ON fragrods FOR UPDATE USING (auth.role() = 'authenticated');
ALTER TABLE fragrods REPLICA IDENTITY FULL;

-- perstat
CREATE TABLE perstat (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  team_name text NOT NULL,
  pax_present int DEFAULT 0,
  status text DEFAULT 'GREEN',
  notes text,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE perstat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perstat_select" ON perstat FOR SELECT USING (true);
CREATE POLICY "perstat_insert" ON perstat FOR INSERT WITH CHECK (auth.uid() = submitted_by);
ALTER TABLE perstat REPLICA IDENTITY FULL;

-- verification_history
CREATE TABLE verification_history (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  report_id bigint REFERENCES reports(id) ON DELETE CASCADE,
  user_id uuid, user_email text,
  old_status text, new_status text
);
ALTER TABLE verification_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vh_select" ON verification_history FOR SELECT USING (true);
CREATE POLICY "vh_insert" ON verification_history FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### 4. Seed demo data

```sql
-- CAT team positions (Big Island, verified on-land coordinates)
DELETE FROM team_status;
INSERT INTO team_status (team_name, status, grid_lat, grid_lng, notes, updated_at) VALUES
  ('CAT-A HILO',   'ACTIVE', 19.7200, -155.0860, 'Co-located CMOC at County EOC.',         now() - interval '12 minutes'),
  ('CAT-B PUNA',   'ACTIVE', 19.5180, -154.9550, 'Forward deployed lower Puna.',            now() - interval '38 minutes'),
  ('CAT-C KONA',   'RTB',    19.6390, -155.9960, 'Completing Kona shelter assessment.',     now() - interval '22 minutes'),
  ('CAT-D KAU',    'HOLD',   19.0720, -155.5850, 'Holding JBCP-4. Route clearance pending.',now() - interval '1 hour'),
  ('CAT-E KOHALA', 'ACTIVE', 20.0750, -155.4750, 'Hamakua coast assessment.',               now() - interval '9 minutes');

-- PERSTAT seed
DELETE FROM perstat;
INSERT INTO perstat (team_name, pax_present, status, notes, created_at) VALUES
  ('CAT-A HILO',   4, 'GREEN', 'All PAX accounted. LNO at EOC.',      now() - interval '14 minutes'),
  ('CAT-B PUNA',   3, 'AMBER', '1 PAX detached to Keaau shelter.',    now() - interval '41 minutes'),
  ('CAT-C KONA',   4, 'GREEN', 'RTB FOB HILO est. 1730L.',            now() - interval '25 minutes'),
  ('CAT-D KAU',    2, 'AMBER', 'Reduced strength, route delay.',       now() - interval '65 minutes'),
  ('CAT-E KOHALA', 4, 'GREEN', 'Kohala stable. Community mtg 1500L.', now() - interval '11 minutes');
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Project Structure

```
src/
├── components/
│   ├── AnalyticsDashboard.jsx  # Command analytics (Level 5, inline)
│   ├── AuthPanel.jsx           # Login / sign-up
│   ├── ChatSidebar.jsx         # Real-time comms (inline mode)
│   ├── ClearancePanel.jsx      # Clearance badge + code entry
│   ├── FilterBar.jsx           # Type and status filter toggles
│   ├── FragordPanel.jsx        # FRAGORD broadcast button + banner
│   ├── KLEPanel.jsx            # Key Leader Engagement log
│   ├── MapView.jsx             # Leaflet map, USGS feed, BFT, CA sim, layers
│   ├── PERSTATPanel.jsx        # Personnel status reporting
│   ├── ReportCard.jsx          # Incident card with verdict actions
│   ├── ReportDetail.jsx        # Expanded detail + comments + verification history
│   ├── ReportForm.jsx          # Submit new incident form
│   ├── ReportList.jsx          # Scrollable incident feed
│   ├── Sidebar.jsx             # Left panel — all tab navigation
│   └── SitrepPanel.jsx         # SITREP builder and tracker
├── utils/
│   └── trust.js                # Trust score → CSS class helper
├── App.jsx                     # Root component, global state
├── index.css                   # All styles (CSS variables, tactical dark theme)
├── main.jsx                    # React entry point
└── supabaseClient.js           # Supabase client
```

---

## Clearance Codes

Hardcoded for demo/personal use. Do not use in production.

| Level | Code |
|-------|------|
| 2 — VOLUNTEER | `volunteer2` |
| 3 — COORDINATOR | `coordinator3` |
| 4 — RESPONDER | `responder4` |
| 5 — COMMAND | `command5` |

---

## Demo Flow (5-minute brief)

1. Open at Level 1 — map shows live incidents + bottom-left legend + NWS alert if active
2. Unlock to Level 5 (`command5`) — show clearance tier system
3. Open LAYERS panel — toggle AO Boundaries, CA Positions, Team BFT, Seismic
4. Have a second device submit a report — appears on map in real time
5. Click an incident → verify it via the detail panel
6. Issue a FRAGORD broadcast → all users see the alert banner instantly
7. LOGS tab → SITREP sub-tab → show pre-filed report → export to clipboard
8. LOGS tab → PERSTAT sub-tab → show live team headcount roll-up
9. INTEL tab → command analytics dashboard

---

## License

MIT
