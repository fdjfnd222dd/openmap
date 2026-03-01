import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
//
// To connect this app to YOUR Supabase project:
//
//   1. Go to https://app.supabase.com and sign in (or create a free account).
//   2. Create a new project (or select an existing one).
//   3. In the left sidebar, go to:  Settings → API
//   4. Copy your "Project URL" → paste it as the value of SUPABASE_URL below.
//   5. Copy your "anon / public" key → paste it as SUPABASE_ANON_KEY below.
//
// You also need to create a "reports" table in Supabase with these columns:
//   - id          : int8, primary key, auto-generated
//   - created_at  : timestamptz, default now()
//   - user_id     : uuid (references auth.users.id)
//   - title       : text
//   - description : text
//   - type        : text  (values: flood | fire | earthquake | other)
//   - latitude    : float8
//   - longitude   : float8
//
// And in the Supabase "Authentication" settings, make sure email sign-up is enabled.
//
// SECURITY NOTE:
//   The "anon" key is safe to use in frontend code — Supabase's Row Level Security
//   (RLS) policies control what data each user can actually read or write.
//   Consider enabling RLS on your "reports" table and setting policies like:
//     - Anyone can SELECT (read) reports
//     - Only authenticated users can INSERT their own reports
//
// ─────────────────────────────────────────────────────────────────────────────

//                       ↓ Replace with your Project URL
const SUPABASE_URL      = 'https://twlsdigbkuwwczgnusbo.supabase.co'
//                       ↓ Replace with your anon/public key
const SUPABASE_ANON_KEY = 'sb_publishable_QyIV1mNvux86nGYu0Yj9eQ_i8cffisk'

// createClient sets up the connection to Supabase.
// We export `supabase` so every component can import and use it.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
