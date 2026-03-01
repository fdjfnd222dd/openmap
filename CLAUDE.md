# Project Hilo — Claude Instructions

## What This Project Is
A personal disaster and local incident reporting platform (not public-facing).
Users can view a map of incidents and submit new reports after logging in.

## Tech Stack
- **React 18 + Vite 5** — frontend framework and dev server
- **Leaflet.js + react-leaflet** — interactive map (OpenStreetMap tiles)
- **React Hook Form** — form state and validation
- **Supabase** — hosted Postgres database + email/password authentication

## Running the Project
```bash
npm run dev      # start dev server at http://localhost:5173
npm run build    # production build
```

## Project Structure
```
src/
├── main.jsx                  # React entry point
├── App.jsx                   # Root component: auth state, reports state, layout
├── supabaseClient.js         # Supabase client (real credentials already set)
├── index.css                 # All styles — uses CSS variables, dark industrial theme
└── components/
    ├── Sidebar.jsx           # Left 30% panel (header + list + form or auth)
    ├── ReportList.jsx        # Scrollable list of incidents
    ├── ReportCard.jsx        # Single report card with colored type badge
    ├── ReportForm.jsx        # Submission form (logged-in users only)
    ├── AuthPanel.jsx         # Login / signup toggle panel
    └── MapView.jsx           # Leaflet map with custom SVG pins per incident type
```

## Supabase Setup
- Project URL and anon key are already configured in `src/supabaseClient.js`
- Database has a `reports` table with columns:
  `id, created_at, user_id, title, description, type, latitude, longitude`
- Email/password auth is enabled
- Free tier — project may pause after 7 days of inactivity; restore from the Supabase dashboard

## Design System
- **Theme:** Dark industrial / emergency ops aesthetic
- **Fonts:** Barlow Condensed (headings/labels), Barlow (body), Share Tech Mono (coords/mono)
- **Accent color:** Amber `#f59e0b`
- **Incident type colors:** Flood=blue `#3b82f6`, Fire=red `#ef4444`, Earthquake=orange `#f97316`, Other=gray `#94a3b8`
- All design tokens are CSS variables at the top of `src/index.css`

## Key Patterns
- Auth state lives in `App.jsx` via `supabase.auth.onAuthStateChange`
- Reports are loaded once on mount in `App.jsx` and passed down as props
- New reports are added optimistically via `handleNewReport` callback (no refetch needed)
- Leaflet marker icons use custom SVG via `L.divIcon` — this avoids a known Vite bundler issue with Leaflet's default PNG markers
- Map tiles are desaturated via CSS `filter` on `.leaflet-tile` to match the dark UI
