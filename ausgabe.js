// Gwunderfink · Ausgabe-Seite
// Produktiv: /a/<edition_id> → Edge Function "edition" liefert JSON (gleiche Struktur wie DEMO).
// Ohne Backend (Demo): DEMO wird gerendert. Keine echten Events, nur Platzhalter zum Styling.
// anonKey ist der öffentliche Publishable Key des Projekts. Er darf im Browser stehen,
// die Daten schützt Row Level Security. Ohne ihn weist Supabase den Aufruf mit 401 ab.
const CONFIG = { functionsUrl: "", anonKey: "" };
const fnHeaders = (extra = {}) => ({ ...(CONFIG.anonKey ? { apikey: CONFIG.anonKey, authorization: `Bearer ${CONFIG.anonKey}` } : {}), ...extra });

const DEMO = {
  edition_id: "e-2026w44-villmergen",
  place: "Villmergen",
  week_label: "Wochenende 25./26. Oktober",
  checked_at: "Donnerstag, 06:30",
  nice_to_know: "Am Sonntag fährt der Zirkuszug bereits um 9 Uhr ab Wohlen. Billette gibt es nur am Schalter.",
  tips: [
    { kind: "event", emoji: "🎨", title: "Kinderatelier in der Bibliothek", day: "sa", time: "Sa 10:00–12:00", venue: "Regionalbibliothek Wohlen", distance_km: 3.2, age: "ab 5 Jahren", price: "gratis", indoor: true, registration: "Anmeldung nötig", desc: "Freies Malen und Drucken mit Naturmaterialien. Platzzahl begrenzt.", url: "#kinderatelier", source: "bibliothek-wohlen.ch", maps: "Regionalbibliothek Wohlen" },
    { kind: "event", emoji: "🚂", title: "Dampfbahn-Fahrtag", day: "so", time: "So 13:00–17:00", venue: "Bahnhof Bremgarten West", distance_km: 7.8, age: "alle Alter", price: "CHF 8 / Kinder CHF 4", indoor: false, registration: "ohne Anmeldung", desc: "Rundfahrten alle 30 Minuten, Festwirtschaft vor Ort.", url: "#dampfbahn", source: "dampfbahn-bremgarten.ch", maps: "Bahnhof Bremgarten West" },
    { kind: "event", emoji: "🌳", title: "Waldspielgruppe, offener Nachmittag", day: "sa", time: "Sa 14:00–16:30", venue: "Waldhütte Villmergen", distance_km: 1.1, age: "3–7 Jahre", price: "gratis", indoor: false, registration: "ohne Anmeldung", desc: "Schnuppern erlaubt: Feuer machen, schnitzen, Hütten bauen. Wetterfeste Kleidung.", url: "#waldspielgruppe", source: "villmergen.ch", maps: "Waldhütte Villmergen" },
    { kind: "event", emoji: "🌧️", title: "Hallenbad-Familientag", day: "so", time: "So 10:00–18:00", venue: "Hallenbad Wohlen", distance_km: 3.5, age: "alle Alter", price: "Familien CHF 20", indoor: true, registration: "ohne Anmeldung", desc: "Spielgeräte im Becken, Kinderanimation ab 14 Uhr.", url: "#hallenbad", source: "wohlen.ch", maps: "Hallenbad Wohlen" },
    { kind: "event", emoji: "🎭", title: "Figurentheater «Der Mond»", day: "sa", time: "Sa 16:00", venue: "Kulturhaus Muri", distance_km: 11.4, age: "ab 4 Jahren", price: "CHF 12", indoor: true, registration: "Vorverkauf", desc: "40 Minuten, Mundart. Danach Blick hinter die Bühne.", url: "#figurentheater", source: "kulturhaus-muri.ch", maps: "Kulturhaus Muri" },
  ],
};

async function load() {
  const id = location.pathname.match(/\/a\/([\w-]+)/)?.[1] || new URLSearchParams(location.search).get("id");
  if (CONFIG.functionsUrl && id) {
    try { const r = await fetch(`${CONFIG.functionsUrl}/edition?id=${encodeURIComponent(id)}`, { headers: fnHeaders() }); if (r.ok) return render(await r.json()); } catch {}
  }
  render(DEMO);
}

function render(ed) {
  document.getElementById("ed-place").textContent = ed.place;
  document.getElementById("ed-week").textContent = " · " + ed.week_label;
  document.getElementById("ed-checked").textContent = ed.checked_at;
  document.getElementById("ed-title").innerHTML = `${ed.tips.length === 1 ? "Eine Idee" : numWord(ed.tips.length) + " Ideen"} fürs Wochenende rund um <em>${esc(ed.place)}</em>`;
  const list = document.getElementById("tips"); list.innerHTML = "";
  const tpl = document.getElementById("tip-tpl");
  if (!ed.tips.length) { list.innerHTML = `<li class="empty">Dieses Wochenende hat der Fink nichts gefunden, was gut genug ist. Lieber nichts als Füllmaterial. Nächste Woche geht es weiter.</li>`; }
  ed.tips.forEach((t) => {
    const n = tpl.content.cloneNode(true);
    const li = n.querySelector(".tip"); li.dataset.day = t.day || "both"; li.dataset.indoor = t.indoor ? "1" : "0"; li.dataset.free = isFree(t.price) ? "1" : "0";
    n.querySelector(".tip-emoji").textContent = t.emoji;
    n.querySelector(".tip-title").textContent = t.title;
    n.querySelector(".tip-line").textContent = [t.time, t.venue, fmtKm(t.distance_km)].filter(Boolean).join(" · ");
    const badges = n.querySelector(".tip-badges");
    // Ein Dauerangebot ist kein Termin. Das muss man sehen, bevor man nach der Uhrzeit sucht.
    if (t.kind === "place") badges.append(badge("immer offen", "soft"));
    if (t.age) badges.append(badge(t.age, "soft"));
    if (isFree(t.price)) badges.append(badge("gratis"));
    if (t.indoor) badges.append(badge("drinnen", "soft"));
    n.querySelector(".tip-desc").textContent = t.desc || "";
    const dl = n.querySelector(".tip-facts");
    [[t.kind === "place" ? "Offen" : "Wann", t.time], ["Wo", t.venue], ["Distanz", fmtKm(t.distance_km)], ["Alter", t.age], ["Preis", t.price], ["Anmeldung", t.registration], ["Drinnen/draussen", t.indoor == null ? "unbekannt" : t.indoor ? "drinnen" : "draussen"]]
      .filter(([, v]) => v) // Lieber eine Zeile weniger als ein leeres Feld: wir zeigen nur, was belegt ist
      .forEach(([k, v]) => { const dt = document.createElement("dt"); dt.textContent = k; const dd = document.createElement("dd"); dd.textContent = v; dl.append(dt, dd); });
    n.querySelector(".tip-link").href = t.url;
    n.querySelector(".tip-route").href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.maps || t.venue)}`;
    const src = n.querySelector(".tip-source a"); src.href = t.url; src.textContent = t.source;
    list.append(n);
  });
  const nice = document.getElementById("nice");
  if (ed.nice_to_know) document.getElementById("nice-text").textContent = ed.nice_to_know; else nice.hidden = true;
  document.title = `${ed.place} · ${ed.week_label} | Gwunderfink`;
  window.__edition = ed;
}

// Filter-Chips
document.querySelector(".ed-filter").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip"); if (!chip) return;
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-on", c === chip));
  const f = chip.dataset.f;
  document.querySelectorAll(".tip").forEach((li) => {
    const d = li.dataset.day; // "both" = Dauerangebot oder mehrtägig, taucht unter Samstag und Sonntag auf
    const show = f === "all" || (f === "sa" && (d === "sa" || d === "both")) || (f === "so" && (d === "so" || d === "both")) || (f === "indoor" && li.dataset.indoor === "1") || (f === "free" && li.dataset.free === "1");
    li.hidden = !show;
  });
});

// Feedback (👍/👎) → Function "feedback"; im Demo nur lokal
document.querySelector(".ed-fb-row").addEventListener("click", async (e) => {
  const b = e.target.closest(".fb"); if (!b) return;
  document.querySelectorAll(".fb").forEach((x) => x.classList.toggle("is-on", x === b));
  const msg = document.querySelector(".ed-feedback .form-msg");
  msg.className = "form-msg ok"; msg.textContent = b.dataset.v === "up" ? "Merci! Das hilft dem Fink." : "Merci. Wir schauen, was besser passt.";
  if (CONFIG.functionsUrl) fetch(`${CONFIG.functionsUrl}/feedback`, { method: "POST", headers: fnHeaders({ "content-type": "application/json" }), body: JSON.stringify({ edition_id: window.__edition?.edition_id, value: b.dataset.v }) }).catch(() => {});
});

// Teilen
document.getElementById("share").addEventListener("click", async () => {
  const data = { title: document.title, text: `Ideen fürs Wochenende rund um ${window.__edition?.place}`, url: location.href };
  if (navigator.share) { try { await navigator.share(data); } catch {} }
  else { await navigator.clipboard?.writeText(location.href); alert("Link kopiert."); }
});

function badge(text, cls = "") { const s = document.createElement("span"); s.className = "badge " + cls; s.textContent = text; return s; }
function fmtKm(km) { return km == null ? "" : km < 1 ? "im Ort" : `${km.toFixed(km < 10 ? 1 : 0).replace(".", ",")} km`; }
// Nur "gratis", wenn der ganze Eintrag gratis ist. "Erwachsene CHF 8, bis 10 Jahre gratis" kostet etwas.
function isFree(p) { return !!p && /^(gratis|kostenlos|eintritt frei|freier eintritt|frei)\b/i.test(String(p).trim()); }
function numWord(n) { return ["", "Eine", "Zwei", "Drei", "Vier", "Fünf"][n] || String(n); }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
load();
