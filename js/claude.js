// ============================================================
//  js/claude.js — All Claude API calls in one place.
//  SCALE → change ENDPOINT to "/api/generate-territory"
//          once you add a Node/Flask backend
// ============================================================

const Claude = (() => {

  // SCALE → const ENDPOINT = "/api/generate-territory";
  const ENDPOINT = "https://api.anthropic.com/v1/messages";

  async function generateTerritory({ area, squad, spot, str, overtook, prevName }) {

    const who  = squad
      ? "A squad of 2 students who shared a session code and walked together"
      : "A solo student";

    const tone = squad
      ? "energetic, warm, collective — celebrate teamwork"
      : "atmospheric, slightly mysterious — celebrate solo adventure";

    const overtookLine = overtook
      ? `- overtook_previous: yes\n- previous_territory_name: "${prevName}"`
      : `- overtook_previous: no`;

    const prompt =
`${who} completed a walking loop on the UW-Madison campus and claimed a territory.

Inputs:
- area_m2: ${area}
- strength_score: ${str}
- nearest_landmark: ${spot || "open campus area"}
- squad_mode: ${squad}
${overtookLine}

Reply ONLY with valid JSON — no markdown fences, no explanation:
{
  "name": "3-5 word territory name",
  "lore": "One vivid sentence about this place.",
  "energy": "2-3 word energy type e.g. Collective Sync Energy",
  "battle": "${overtook ? "One dramatic sentence announcing the takeover." : ""}",
  "reward": "Award title for the ${squad ? "squad" : "player"}"
}

Tone: ${tone}. Every field under 12 words.`;

    // SCALE → if you add a backend, replace the fetch below with:
    // const res = await fetch("/api/generate-territory", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ area, squad, spot, str, overtook, prevName })
    // });
    // return res.json();

    const res = await fetch(ENDPOINT, {
      method  : "POST",
      headers : {
        "Content-Type"       : "application/json",
        "x-api-key"          : CONFIG.CLAUDE_API_KEY,
        "anthropic-version"  : "2023-06-01",
        // Required for direct browser-to-API calls
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model      : CONFIG.CLAUDE_MODEL,
        max_tokens : CONFIG.CLAUDE_TOKENS,
        system     : "You are a game world AI for TerraLoop. Always respond with valid JSON only. No backticks. No extra text.",
        messages   : [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Claude API returned ${res.status}`);
    }

    const data  = await res.json();
    const raw   = data.content[0].text.replace(/```json|```/g, "").trim();
    return JSON.parse(raw);
  }

  // ── Decay message (bonus feature, Phase 6) ───────────────
  // SCALE → call from a scheduled Firebase Cloud Function
  async function generateDecayMessage(territory) {
    const hours = Math.round((Date.now() - territory.ts) / 3600000);
    const res = await fetch(ENDPOINT, {
      method  : "POST",
      headers : {
        "Content-Type"       : "application/json",
        "x-api-key"          : CONFIG.CLAUDE_API_KEY,
        "anthropic-version"  : "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model      : CONFIG.CLAUDE_MODEL,
        max_tokens : 60,
        messages   : [{
          role    : "user",
          content : `Territory "${territory.lore.name}" on UW-Madison has been unclaimed for ${hours} hours. Write one urgent push notification under 15 words urging the owner to return. Plain text only.`,
        }],
      }),
    });
    const d = await res.json();
    return d.content[0].text.trim();
  }

  return { generateTerritory, generateDecayMessage };

})();
