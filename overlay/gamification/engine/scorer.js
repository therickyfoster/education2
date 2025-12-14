// Deterministic scorer used by the UI
const curve = lvl => Math.round(50 * Math.pow(lvl, 1.45));
export function computeTotals(events) {
  let xp = 0, seeds = 0, reflections = 0, days = new Set();
  for (const e of events) {
    if (e.type === "ReflectionLogged") { xp += 10; reflections++; }
    if (e.type === "QuestCompleted")   { xp += 25; }
    if (e.type === "RitualVerified")   { xp += Math.round(25 * 1.5); seeds += 1; }
    days.add((new Date(e.timestamp)).toDateString());
  }
  // Reflection can satisfy up to 40% of a level: we just award flat XP above.
  const level = levelFromXP(xp);
  return { xp, level, seeds, streak: days.size };
}
function levelFromXP(xp) {
  let lvl = 1, need = curve(1), pool = xp;
  while (pool >= need && lvl < 50) { pool -= need; lvl++; need = curve(lvl); }
  return lvl;
}
