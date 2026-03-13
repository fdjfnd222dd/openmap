# Project HILO

**321st Civil Affairs Battalion — Common Operating Picture Platform**

A real-time civil affairs operations platform for CAT team coordination, incident reporting, and command visibility. Browser-based, no install required.

---

## Features

### Live Map
- Leaflet map — Street (OpenStreetMap) or Satellite (Esri) default
- Color-coded incident pins by type with status rings (verified/under review/false)
- Click any map pin to open incident details
- **Click-to-pin** — click the map to auto-fill coordinates in the report form
- **What3Words** — every pinned location shows a `///word.word.word` address; type one to locate a spot
- **USGS live seismic** — Hawaii earthquakes auto-plotted, refreshed every 5 min
- **NWS weather alerts** — active watches/warnings for Hawaii Island (HIZ023)
- **CAT Team Blue Force Tracking** — live dot markers per team with ACTIVE/RTB/HOLD/COMMS OUT status
- **AO sector boundaries** — polygon overlays per CAT team area
- **CA simulation layer** — CMOC, FOB, and 4× JBCP positions for Big Island
- **Density heatmap** + **Weather overlay** (Responder role+)
- Marker clustering, fullscreen mode

### Incident Reporting
- Submit reports with title, type, description, and location (map click or W3W)
- Type-specific structured detail fields (flood depth, fire size, earthquake damage, etc.)
- Realtime feed — new reports appear live for all users
- Export current filtered view as **GeoJSON**, **KML**, or **CSV**

### Role System
Five access tiers, freely selectable from the top-right panel:

| Role | Unlocks |
|------|---------|
| PUBLIC | View verified incidents |
| VOLUNTEER | Submit reports, chat, logs |
| COORDINATOR | Mark reports Under Review, file SITREPs |
| RESPONDER | Heatmap, weather overlay |
| ADMIN | Verify/false reports, FRAGORD broadcast, analytics |

### Communications
- Channel-based real-time chat (Supabase Realtime)
- Regional channels always available
- Per-incident channels created from the report detail view
- Messages tagged with sender's role

### LOGS Tab
- **SITREP** — structured situation reports linked to incidents, Draft/Active/Resolved lifecycle, NATO text export
- **KLE** — Key Leader Engagement log with outcome, reliability rating, and clipboard export
- **PERSTAT** — team headcount with GREEN/AMBER/RED status, live roll-up

### FRAGORD
Admin-only broadcast of Fragmentary Orders at ROUTINE/PRIORITY/IMMEDIATE/FLASH priority. Appears as a full-width banner to all users.

### Trust & Verification
- Unverified → Under Review → Verified / False
- Trust score adjustments on verdict (+10 verified, −5 false)
- Leaderboard in profile tab

### Public Read-Only View
Append `?view=public` to the URL for a shareable, login-free view showing only verified incidents.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + Vite 5 |
| Map | Leaflet.js / react-leaflet v4 |
| Forms | React Hook Form |
| Charts | Recharts |
| Backend | Supabase (Postgres + Auth + Realtime) |
| Styling | Plain CSS with CSS custom properties |
| Tile layers | OpenStreetMap, Esri World Imagery |
| External APIs | USGS Earthquake, NWS Alerts, OpenWeatherMap, What3Words |

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd hilo
npm install
```

### 2. Environment variables

Create a `.env` file at the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_OWM_API_KEY=your_openweathermap_key
VITE_W3W_API_KEY=your_what3words_key
```

- **Supabase**: [supabase.com](https://supabase.com) → Settings → API
- **OpenWeatherMap**: [openweathermap.org/api](https://openweathermap.org/api) (free tier)
- **What3Words**: [developer.what3words.com](https://developer.what3words.com) (free tier)

### 3. Database setup

Run the following in the **Supabase SQL Editor**:

```sql
-- profiles
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text, trust_score int DEFAULT 0,
  reports_submitted int DEFAULT 0, reports_verified int DEFAULT 0,
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
  title text NOT NULL, description text,
  type text DEFAULT 'other', latitude float, longitude float, status text
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
  name text NOT NULL, type text DEFAULT 'region',
  description text, incident_id bigint REFERENCES reports(id) ON DELETE SET NULL
);
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channels_select" ON channels FOR SELECT USING (true);
CREATE POLICY "channels_insert" ON channels FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE TABLE messages (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  channel_id bigint REFERENCES channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text, content text NOT NULL, clearance_level int DEFAULT 1
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select" ON messages FOR SELECT USING (true);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);
ALTER TABLE messages REPLICA IDENTITY FULL;

-- sitreps
CREATE TABLE sitreps (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  title text NOT NULL, content text, status text DEFAULT 'draft',
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
  leader_name text NOT NULL, organization text, location text,
  date_of_engagement date, summary text, outcome text DEFAULT 'neutral',
  follow_up text, reliability int DEFAULT 3,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE kle_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kle_select" ON kle_log FOR SELECT USING (true);
CREATE POLICY "kle_insert" ON kle_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- perstat
CREATE TABLE perstat (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  team_name text NOT NULL, pax_present int, status text DEFAULT 'GREEN',
  notes text, submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE perstat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perstat_select" ON perstat FOR SELECT USING (true);
CREATE POLICY "perstat_insert" ON perstat FOR INSERT WITH CHECK (auth.uid() = submitted_by);
ALTER TABLE perstat REPLICA IDENTITY FULL;

-- fragrods
CREATE TABLE fragrods (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  title text NOT NULL, content text NOT NULL,
  priority text DEFAULT 'ROUTINE', active boolean DEFAULT true,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, issued_by_email text
);
ALTER TABLE fragrods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fragrods_select" ON fragrods FOR SELECT USING (true);
CREATE POLICY "fragrods_insert" ON fragrods FOR INSERT WITH CHECK (auth.uid() = issued_by);
CREATE POLICY "fragrods_update" ON fragrods FOR UPDATE USING (auth.role() = 'authenticated');
ALTER TABLE fragrods REPLICA IDENTITY FULL;

-- verification_history
CREATE TABLE verification_history (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  report_id bigint REFERENCES reports(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_status text, new_status text
);
ALTER TABLE verification_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vh_select" ON verification_history FOR SELECT USING (true);
CREATE POLICY "vh_insert" ON verification_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- relationships + sitreps for graph view
CREATE TABLE relationships (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  source_type text NOT NULL, source_id text NOT NULL,
  target_type text NOT NULL, target_id text NOT NULL,
  label text NOT NULL, created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "relationships_select" ON relationships FOR SELECT USING (true);
CREATE POLICY "relationships_insert" ON relationships FOR INSERT WITH CHECK (auth.uid() = created_by);

-- RPC functions for trust score
CREATE OR REPLACE FUNCTION increment_trust_score(uid uuid, delta int)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE profiles SET trust_score = COALESCE(trust_score, 0) + delta WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION increment_reports_submitted(uid uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE profiles SET reports_submitted = COALESCE(reports_submitted, 0) + 1 WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION increment_reports_verified(uid uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE profiles SET reports_verified = COALESCE(reports_verified, 0) + 1 WHERE id = uid;
$$;
```

Enable **Realtime** on these tables in Supabase → Database → Replication:
`reports`, `messages`, `fragrods`, `perstat`, `channels`

Seed a default regional channel:
```sql
INSERT INTO channels (name, type, description)
VALUES ('hawaii-island', 'region', 'Hawaii Island regional ops');
```

### 4. Seed demo data (optional)

```sql
-- CAT team positions
INSERT INTO team_status (team_name, status, grid_lat, grid_lng, notes) VALUES
  ('CAT-A HILO',   'ACTIVE', 19.7200, -155.0860, 'Co-located CMOC at County EOC.'),
  ('CAT-B PUNA',   'ACTIVE', 19.5180, -154.9550, 'Forward deployed lower Puna.'),
  ('CAT-C KONA',   'RTB',    19.6390, -155.9960, 'Completing Kona shelter assessment.'),
  ('CAT-D KAU',    'HOLD',   19.0720, -155.5850, 'Holding JBCP-4. Route clearance pending.'),
  ('CAT-E KOHALA', 'ACTIVE', 20.0750, -155.4750, 'Hamakua coast assessment.');
```

### 5. Run locally

```bash
npm run dev
# Open http://localhost:5173
```

### 6. Deploy

Deployed on **Vercel** (auto-deploys on push). Set the four environment variables in Vercel → Project Settings → Environment Variables.

To invite users: Supabase → Authentication → Users → Invite user. Public sign-up can remain disabled.

---

## Project Structure

```
src/
├── components/
│   ├── AnalyticsDashboard.jsx   # Admin analytics (charts)
│   ├── AuthPanel.jsx            # Login / sign-up
│   ├── ChatSidebar.jsx          # Real-time comms panel
│   ├── ClearancePanel.jsx       # Role selector (top-right badge)
│   ├── FilterBar.jsx            # Type + status filter toggles
│   ├── FragordPanel.jsx         # FRAGORD broadcast + banner
│   ├── GraphView.jsx            # Relations graph (ReactFlow)
│   ├── KLEPanel.jsx             # Key Leader Engagement log
│   ├── MapView.jsx              # Leaflet map + all overlay layers
│   ├── PERSTATPanel.jsx         # Personnel status reporting
│   ├── ReportCard.jsx           # Incident card with verdict actions
│   ├── ReportDetail.jsx         # Expanded detail + comments
│   ├── ReportForm.jsx           # Submit incident form
│   ├── ReportList.jsx           # Scrollable incident feed
│   ├── Sidebar.jsx              # Left panel — tab navigation
│   └── SitrepPanel.jsx          # SITREP builder
├── utils/
│   ├── escape.js                # HTML/XML escape helper
│   ├── exportReports.js         # GeoJSON / KML / CSV export
│   ├── trust.js                 # Trust score → CSS class
│   └── w3w.js                   # What3Words API helpers
├── App.jsx                      # Root component + global state
├── index.css                    # All styles (CSS variables, dark theme)
├── main.jsx                     # React entry point
└── supabaseClient.js            # Supabase client init
```

---

## Demo Flow

1. Open at Public role — map shows verified incidents + NWS alert if active
2. Switch to Admin role — see full incident feed including unverified
3. Open LAYERS panel — toggle AO Boundaries, CA Positions, BFT, Seismic
4. Second device submits a report — appears on map in real time
5. Click an incident → verify via the detail panel → pin glows cyan
6. Issue a FRAGORD broadcast → alert banner appears for all users
7. LOGS → SITREP → file a report → export to clipboard
8. LOGS → PERSTAT → live team headcount roll-up
9. Click ↓ EXPORT → download GeoJSON to open in QGIS/ArcGIS

---

## License

MIT
