// Simple offline store using localStorage; exports a file for you to commit
import { computeTotals } from "../engine/scorer.js";

const stateKey = "loom-events-v1";
const qs = s => document.querySelector(s);
const events = JSON.parse(localStorage.getItem(stateKey) || "[]");

const quests = [
  { id:"ritual_apple_seed_001", title:"Ritual: Seed the Orchard", kind:"restore" },
  { id:"s1a1_curiosity",       title:"Curiosity Micro-Quest",    kind:"learn"   },
  { id:"s1a2_tools",           title:"Tools Micro-Quest",        kind:"make"    }
];

function save() { localStorage.setItem(stateKey, JSON.stringify(events)); render(); }
function now() { return new Date().toISOString(); }

function render() {
  const sel = qs("#questSelect");
  sel.innerHTML = quests.map(q => `<option value="${q.id}">${q.title}</option>`).join("");
  const stats = computeTotals(events);
  qs("#stats").textContent = `XP: ${stats.xp} • Level: ${stats.level} • Seeds: ${stats.seeds} • Streak: ${stats.streak}`;
}
qs("#logReflection").onclick = () => {
  const mood = Number(qs("#mood").value);
  const text = (qs("#reflect").value || "").trim();
  events.push({ type:"ReflectionLogged", mood_before:mood, mood_after:mood, text, timestamp: now() });
  qs("#reflect").value = "";
  save();
};
qs("#completeQuest").onclick = () => {
  const id = qs("#questSelect").value;
  events.push({ type:"QuestCompleted", quest_id:id, evidence_refs:[], timestamp: now() });
  save();
};
qs("#exportBundle").onclick = () => {
  const bundle = {
    version: "1.0",
    timestamp: now(),
    events,
    summary: computeTotals(events)
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = qs("#downloadLink");
  a.href = url; a.download = "progress-bundle.json"; a.style.display = "none"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

render();

// PWA cache (optional; won’t break if unavailable)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
