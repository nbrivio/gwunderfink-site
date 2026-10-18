// Gwunderfink · Website 3.0
// CONFIG.functionsUrl setzen → echter Checkout + serverseitige Trial-Berechnung. Leer = Demo.
// anonKey ist der öffentliche Publishable Key des Projekts. Er darf im Browser stehen,
// die Daten schützt Row Level Security. Ohne ihn weist Supabase den Aufruf mit 401 ab.
const CONFIG = { functionsUrl: "", anonKey: "", consentVersion: "v2-2026-10-20", orderingEnabled: false };
const fnHeaders = (extra = {}) => ({ ...(CONFIG.anonKey ? { apikey: CONFIG.anonKey, authorization: `Bearer ${CONFIG.anonKey}` } : {}), ...extra });
document.body.classList.toggle("preorder", !CONFIG.orderingEnabled);

/* ---------- Navigation (mobile) ---------- */
const toggle = document.querySelector(".nav-toggle");
const links = document.getElementById("navlinks");
if (toggle && links) {
  toggle.addEventListener("click", () => { const open = links.classList.toggle("open"); toggle.setAttribute("aria-expanded", String(open)); });
  links.addEventListener("click", (e) => { if (e.target.closest("a")) { links.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); } });
}

/* ---------- Trial-Daten ----------
   Regel (Vorschlag, vor Livegang verbindlich festlegen, siehe 01_Konzept/abo-regeln.md):
   Start = heute (Europe/Zurich). Gratis bis einschliesslich Vortag des gleichen Kalendertags im Folgemonat.
   Erste Abbuchung = gleicher Kalendertag im Folgemonat; existiert er nicht (29. bis 31.), dann der letzte Tag des Folgemonats.
   Diese Client-Rechnung ist nur Vorschau; verbindlich ist /trial-preview vom Server. */
function computeTrial(start = new Date()) {
  const y = start.getFullYear(), m = start.getMonth(), d = start.getDate();
  const lastOfNext = new Date(y, m + 2, 0).getDate();
  const firstCharge = new Date(y, m + 1, Math.min(d, lastOfNext));
  const trialEnd = new Date(firstCharge); trialEnd.setDate(trialEnd.getDate() - 1);
  const reminder = new Date(firstCharge); reminder.setDate(reminder.getDate() - 3);
  return { start, trialEnd, firstCharge, reminder };
}
const fmt = (dt) => new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "long", year: "numeric" }).format(dt);
function renderTrial(t) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) { el.textContent = v; el.classList.remove("pending"); } };
  set("d-start", fmt(t.start)); set("d-trial-end", fmt(t.trialEnd)); set("d-first-charge", fmt(t.firstCharge)); set("d-reminder", fmt(t.reminder) + " per WhatsApp");
  const s = document.getElementById("s-first-charge"); if (s) s.textContent = fmt(t.firstCharge);
  window.__trial = t;
}
(async () => {
  if (!CONFIG.orderingEnabled) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) { el.textContent = v; el.classList.remove("pending"); } };
    set("d-start", "am Tag deiner Anmeldung"); set("d-trial-end", "einen Monat später"); set("d-first-charge", "am Tag nach dem Gratismonat"); set("d-reminder", "3 Tage vorher per WhatsApp");
    return;
  }
  renderTrial(computeTrial());
  if (!CONFIG.functionsUrl) return;
  try {
    const r = await fetch(`${CONFIG.functionsUrl}/trial-preview`, { headers: fnHeaders() });
    if (r.ok) { const d = await r.json(); renderTrial({ start: new Date(d.start), trialEnd: new Date(d.trial_end), firstCharge: new Date(d.first_charge), reminder: new Date(d.reminder) }); }
  } catch {}
})();

/* ---------- Anmeldung ---------- */
const form = document.getElementById("signup");
if (form) {
  const msg = form.querySelector(".form-msg");
  const btn = form.querySelector("button.btn");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.className = "form-msg"; msg.textContent = "";
    form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
    const fd = new FormData(form);
    const phone = normalizePhone(fd.get("phone"));
    const plz = String(fd.get("plz") || "").trim();
    if (!/^[1-9]\d{3}$/.test(plz)) return fail("Bitte eine vierstellige Postleitzahl eingeben.", form.plz);
    if (!phone) return fail("Bitte eine Schweizer Mobilnummer eingeben, z. B. +41 79 123 45 67.", form.phone);
    if (!fd.get("consent")) return fail("Bitte bestätige AGB und Datenschutz, damit wir das Abo einrichten dürfen.", form.consent);

    const payload = {
      phone, plz, first_name: fd.get("first_name") || null,
      consent_version: CONFIG.consentVersion, consent_text: document.getElementById("consent-text").innerText.trim(),
      shown_trial_end: window.__trial?.trialEnd?.toISOString(), shown_first_charge: window.__trial?.firstCharge?.toISOString(),
    };
    if (!CONFIG.functionsUrl) return ok(`Demo-Modus: Jetzt würde Stripe öffnen. Heute CHF 0.00, erste Abbuchung am ${fmt(window.__trial.firstCharge)}.`);
    btn.disabled = true; btn.textContent = "Einen Moment …";
    try {
      const r = await fetch(`${CONFIG.functionsUrl}/stripe-checkout`, { method: "POST", headers: fnHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
      const data = await r.json();
      if (!r.ok || !data.url) throw new Error(data.error || "server");
      location.href = data.url;
    } catch (err) {
      fail(err.message === "blocked" ? "Diese Nummer kann sich nicht anmelden. Schreib uns: support@gwunderfink.ch" : "Das hat nicht geklappt. Versuch es gleich nochmal oder schreib uns an support@gwunderfink.ch.");
      btn.disabled = false; btn.textContent = "Ersten Monat gratis starten";
    }
  });
  function fail(text, el) { msg.className = "form-msg err"; msg.textContent = text; if (el) { el.classList?.add("invalid"); el.focus?.(); } }
  function ok(text) { msg.className = "form-msg ok"; msg.textContent = text; }
}
function normalizePhone(raw) {
  let p = String(raw || "").replace(/[\s\-()/.]/g, "");
  if (p.startsWith("0041")) p = "+" + p.slice(2);
  if (p.startsWith("0")) p = "+41" + p.slice(1);
  return /^\+41(7[5-9])\d{7}$/.test(p) ? p : null; // nur CH-Mobilnummern (WhatsApp)
}

/* ---------- Danke-Seite: Code ---------- */
const codeForm = document.getElementById("verify");
if (codeForm) {
  const sid = new URLSearchParams(location.search).get("sid");
  const msg = codeForm.querySelector(".form-msg");
  codeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = codeForm.code.value.trim();
    if (!/^\d{6}$/.test(code)) { msg.className = "form-msg err"; msg.textContent = "Der Code hat sechs Ziffern."; return; }
    if (!CONFIG.functionsUrl) { msg.className = "form-msg ok"; msg.textContent = "Demo-Modus: Nummer wäre jetzt bestätigt."; return; }
    const r = await fetch(`${CONFIG.functionsUrl}/verify-code`, { method: "POST", headers: fnHeaders({ "content-type": "application/json" }), body: JSON.stringify({ subscriber_id: sid, code }) });
    const d = await r.json();
    msg.className = "form-msg " + (d.ok ? "ok" : "err");
    msg.textContent = d.ok ? "Nummer bestätigt. Am Donnerstag um 8 Uhr kommt deine erste Ausgabe." : (d.error === "expired" ? "Der Code ist abgelaufen. Schreib uns an support@gwunderfink.ch, wir schicken dir einen neuen." : "Der Code stimmt nicht. Schau nochmal in WhatsApp nach.");
  });
}

/* ---------- Ladesequenz ---------- */
(document.fonts?.ready ?? Promise.resolve()).then(() => requestAnimationFrame(() => document.body.classList.add("ready")));
