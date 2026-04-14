// ============================================================
//  config.js  —  ONLY FILE YOU NEED TO EDIT BEFORE DEMO
// ============================================================

const CONFIG = {

  // ── 🔑 Paste your key from console.anthropic.com ──────────
  CLAUDE_API_KEY : "YOUR_KEY_HERE",
  CLAUDE_MODEL   : "claude-sonnet-4-6",
  CLAUDE_TOKENS  : 350,

  // ── Map (UW-Madison Memorial Union) ───────────────────────
  MAP_CENTER : [43.0762, -89.4009],
  MAP_ZOOM   : 16,

  // ── Game rules ─────────────────────────────────────────────
  MIN_POINTS   : 3,     // minimum clicks to form a valid loop
  SOLO_MUL     : 1.0,
  SQUAD_MUL    : 2.2,   // squad territory is 2.2x stronger

  // ── Colors ─────────────────────────────────────────────────
  C_SOLO    : "#378ADD",
  C_SQUAD   : "#1D9E75",
  C_DRAW    : "#EF9F27",
  C_OVER    : "#E24B4A",
  FILL_OP   : 0.20,

  // ── UW-Madison landmarks ────────────────────────────────────
  // SCALE → replace with Google Places reverse-geocode of centroid
  LANDMARKS : [
    { name: "Memorial Union",        lat: 43.0762, lng: -89.4009 },
    { name: "Engineering Hall",      lat: 43.0722, lng: -89.4106 },
    { name: "Memorial Library",      lat: 43.0757, lng: -89.4038 },
    { name: "Bascom Hall",           lat: 43.0760, lng: -89.4066 },
    { name: "Camp Randall Stadium",  lat: 43.0696, lng: -89.4122 },
    { name: "Union South",           lat: 43.0714, lng: -89.4074 },
    { name: "Chazen Museum",         lat: 43.0742, lng: -89.4028 },
    { name: "Van Hise Hall",         lat: 43.0770, lng: -89.4088 },
    { name: "Grainger Hall",         lat: 43.0737, lng: -89.4036 },
  ],

};
