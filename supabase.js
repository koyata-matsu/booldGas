// supabase.js

const SUPABASE_URL = "https://clvnsywjqivlczprvbgq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5DiypkWI72wW1a1PT4h2pQ_rucP4s9j";

// ✅ v2 CDN では `supabase` がグローバル
window.db = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

console.log("db initialized", window.db);