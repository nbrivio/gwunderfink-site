// Gwunderfink · Website 3.1 (Testphase: Gratis-Newsletter, kein Abo)
// CONFIG.functionsUrl setzen → echte Anmeldung. Leer = Demo.
// anonKey ist der öffentliche Publishable Key des Projekts. Er darf im Browser stehen,
// die Daten schützt Row Level Security. Ohne ihn weist Supabase den Aufruf mit 401 ab.
// Vorschau-Schalter: Anmeldeformular nur mit ?preview in der URL aktiv. Normale Besucher
// sehen "Bald verfügbar", bis WhatsApp live ist. Go-live: orderingEnabled auf true setzen.
const PREVIEW = new URLSearchParams(location.search).has("preview");
const CONFIG = { functionsUrl: "https://amfsmbjarmkavhzsbrdd.supabase.co/functions/v1", anonKey: "sb_publishable_GqIq-RfYFPHlBs31uHXLkQ_cIu2qTQi", consentVersion: "newsletter-v1-2026-10-24", orderingEnabled: PREVIEW };
const fnHeaders = (extra = {}) => ({ ...(CONFIG.anonKey ? { apikey: CONFIG.anonKey, authorization: `Bearer ${CONFIG.anonKey}` } : {}), ...extra });
document.body.classList.toggle("preorder", !CONFIG.orderingEnabled);

/* ---------- Navigation (mobile) ---------- */
const toggle = document.querySelector(".nav-toggle");
const links = document.getElementById("navlinks");
if (toggle && links) {
  toggle.addEventListener("click", () => { const open = links.classList.toggle("open"); toggle.setAttribute("aria-expanded", String(open)); });
  links.addEventListener("click", (e) => { if (e.target.closest("a")) { links.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); } });
}

/* ---------- Anmeldung (Gratis-Newsletter) ----------
   In der Testphase läuft die Anmeldung kostenlos: Nummer und Ort eintragen, Haken setzen,
   danach bestätigt ein sechsstelliger Code per WhatsApp, dass die Nummer wirklich dir gehört
   (Double-Opt-in). Kein Zahlungsmittel, kein Abo. */
const form = document.getElementById("signup");
if (form) {
  const msg = form.querySelector(".form-msg");
  const btn = form.querySelector("button.btn");
  const CTA = "Gratis anmelden";
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.className = "form-msg"; msg.textContent = "";
    form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
    const fd = new FormData(form);
    const phone = normalizePhone(fd.get("phone"));
    const plz = String(fd.get("plz") || "").trim();
    if (!/^[1-9]\d{3}$/.test(plz)) return fail("Bitte eine vierstellige Postleitzahl eingeben.", form.plz);
    if (!phone) return fail("Bitte eine Schweizer Mobilnummer eingeben, z. B. +41 79 123 45 67.", form.phone);
    if (!fd.get("consent")) return fail("Bitte bestätige AGB und Datenschutz, damit wir dich eintragen dürfen.", form.consent);

    const firstName = fd.get("first_name") || null;
    const payload = {
      phone, plz, first_name: firstName,
      consent_version: CONFIG.consentVersion, consent_text: document.getElementById("consent-text").innerText.trim(),
    };
    if (!CONFIG.functionsUrl) return ok("Demo-Modus: Jetzt würde der Fink dir einen Bestätigungscode per WhatsApp schicken.");
    btn.disabled = true; btn.textContent = "Einen Moment …";

    // Region prüfen: gwunderfink startet im Aargau. Andere Regionen kommen auf die Interessensliste,
    // damit niemand sich für einen Newsletter einträgt, für den wir noch keine Tipps haben.
    try {
      const cr = await fetch(`${CONFIG.functionsUrl}/plz-check?plz=${encodeURIComponent(plz)}`, { headers: fnHeaders() });
      const c = await cr.json();
      if (!c.serviceable) { btn.disabled = false; btn.textContent = CTA; return offerWaitlist(plz, phone, firstName, c); }
    } catch { /* Netz unsicher: weiter, der Server sperrt Nicht-Aargau ohnehin */ }

    try {
      const r = await fetch(`${CONFIG.functionsUrl}/stripe-checkout`, { method: "POST", headers: fnHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
      const data = await r.json();
      if (r.ok && data.free && data.sid) { location.href = `danke.html?sid=${encodeURIComponent(data.sid)}&free=1`; return; }
      if (r.ok && data.url) { location.href = data.url; return; } // Bezahl-Abo, falls später wieder aktiv
      throw new Error(data.error || "server");
    } catch (err) {
      btn.disabled = false; btn.textContent = CTA;
      if (err.message === "region") return offerWaitlist(plz, phone, firstName, null);
      if (err.message === "exists") return ok("Diese Nummer ist schon angemeldet. Der Fink meldet sich am Donnerstag.");
      fail(err.message === "blocked" ? "Diese Nummer kann sich nicht anmelden. Schreib uns: support@gwunderfink.ch" : "Das hat nicht geklappt. Versuch es gleich nochmal oder schreib uns an support@gwunderfink.ch.");
    }
  });
  function fail(text, el) { msg.className = "form-msg err"; msg.textContent = text; if (el) { el.classList?.add("invalid"); el.focus?.(); } }
  function ok(text) { msg.className = "form-msg ok"; msg.textContent = text; }

  // Interessensliste: freundliche Weiche für Orte ausserhalb des bedienten Gebiets.
  function offerWaitlist(plz, phone, firstName, info) {
    const place = info && info.found && info.name ? `${info.name}${info.canton ? " (" + info.canton + ")" : ""}` : `PLZ ${plz}`;
    msg.className = "form-msg"; msg.textContent = "";
    let box = document.getElementById("interest-box");
    if (!box) { box = document.createElement("div"); box.id = "interest-box"; box.className = "interest-box"; form.appendChild(box); }
    box.hidden = false;
    box.innerHTML =
      '<h3>Der Fink ist noch nicht bei dir.</h3>' +
      '<p>gwunderfink startet im Kanton Aargau. ' + (info && info.found ? place + ' ist noch nicht dabei.' : 'Diese Region kennt der Fink noch nicht.') +
      ' Trag dich ein, und wir melden uns, sobald wir deine Gegend aufschalten. So entscheidest du mit, welche Region als Nächstes kommt.</p>' +
      '<button type="button" class="btn btn-primary btn-lg" id="interest-btn">Benachrichtige mich</button>' +
      '<p class="form-msg" id="interest-msg" role="status" aria-live="polite"></p>';
    box.scrollIntoView({ behavior: "smooth", block: "center" });
    const ibtn = box.querySelector("#interest-btn");
    const imsg = box.querySelector("#interest-msg");
    ibtn.addEventListener("click", async () => {
      ibtn.disabled = true; ibtn.textContent = "Einen Moment …";
      try {
        const r = await fetch(`${CONFIG.functionsUrl}/waitlist-join`, { method: "POST", headers: fnHeaders({ "content-type": "application/json" }), body: JSON.stringify({ phone, plz, first_name: firstName }) });
        const d = await r.json();
        if (!r.ok || !d.ok) throw new Error(d.error || "server");
        box.innerHTML = '<h3>Du stehst auf der Liste' + (d.name ? " für " + d.name : "") + '.</h3><p>Der Fink meldet sich, sobald deine Region aufgeschaltet ist. Versprochen, kein Spam.</p>';
      } catch {
        imsg.className = "form-msg err"; imsg.textContent = "Das hat nicht geklappt. Schreib uns an hallo@gwunderfink.ch.";
        ibtn.disabled = false; ibtn.textContent = "Benachrichtige mich";
      }
    });
  }
}
function normalizePhone(raw) {
  let p = String(raw || "").replace(/[\s\-()/.]/g, "");
  if (p.startsWith("0041")) p = "+" + p.slice(2);
  if (p.startsWith("0")) p = "+41" + p.slice(1);
  return /^\+41(7[5-9])\d{7}$/.test(p) ? p : null; // nur CH-Mobilnummern (WhatsApp)
}

/* ---------- Danke-Seite: Code ----------
   Bei der Gratis-Anmeldung (free=1) löst die Seite den Code-Versand selbst aus, da hier
   kein Bezahl-Schritt dazwischenliegt. Danach bestätigt der eingegebene Code die Nummer. */
const codeForm = document.getElementById("verify");
if (codeForm) {
  const sid = new URLSearchParams(location.search).get("sid");
  const isFree = new URLSearchParams(location.search).get("free") === "1";
  const msg = codeForm.querySelector(".form-msg");
  if (sid && isFree && CONFIG.functionsUrl) {
    fetch(`${CONFIG.functionsUrl}/verify-send`, { method: "POST", headers: fnHeaders({ "content-type": "application/json" }), body: JSON.stringify({ subscriber_id: sid }) }).catch(() => {});
  }
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

/* ---------- Scroll-Animationen ----------
   Dezent: Inhalte steigen beim Hereinscrollen leicht auf und blenden ein.
   Respektiert reduzierte Bewegung und greift nur unterhalb des Heros, damit
   nichts flackert. Ohne IntersectionObserver bleibt alles sichtbar. */
(() => {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;
  const sel = "[data-reveal], .section .section-head, .section figure, .price-card, .signup, .soon-card, .faq details";
  const els = Array.from(document.querySelectorAll(sel));
  if (!els.length) return;
  els.forEach((el) => el.classList.add("reveal"));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  els.forEach((el) => io.observe(el));
})();
