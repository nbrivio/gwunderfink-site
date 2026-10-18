// Gwunderfink · Mein Abo (ohne Passwort: Nummer, Code via WhatsApp, Session-Token)
// anonKey ist der öffentliche Publishable Key des Projekts, siehe app.js.
const CONFIG = { functionsUrl: "", anonKey: "" };
const $ = (s, r = document) => r.querySelector(s);
let token = sessionStorage.getItem("gf_token");
let phone = "";

function show(id) { document.querySelectorAll(".k-step").forEach((s) => (s.hidden = s.id !== id)); window.scrollTo({ top: 0 }); }
function msg(form, text, ok) { const m = $(".form-msg", form); m.className = "form-msg " + (ok ? "ok" : "err"); m.textContent = text; }
async function api(path, body) {
  if (!CONFIG.functionsUrl) return demo(path, body);
  const r = await fetch(`${CONFIG.functionsUrl}/konto${path}`, { method: "POST", headers: { "content-type": "application/json", ...(CONFIG.anonKey ? { apikey: CONFIG.anonKey } : {}), ...(token ? { authorization: `Bearer ${token}` } : { ...(CONFIG.anonKey ? { authorization: `Bearer ${CONFIG.anonKey}` } : {}) }) }, body: JSON.stringify(body ?? {}) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "server");
  return d;
}
function normalizePhone(raw) { let p = String(raw || "").replace(/[\s\-()/.]/g, ""); if (p.startsWith("0041")) p = "+" + p.slice(2); if (p.startsWith("0")) p = "+41" + p.slice(1); return /^\+41\d{9}$/.test(p) ? p : null; }

$("#f-phone").addEventListener("submit", async (e) => {
  e.preventDefault(); const f = e.target; phone = normalizePhone(f.phone.value);
  if (!phone) return msg(f, "Bitte eine Schweizer Nummer eingeben, z. B. +41 79 123 45 67.");
  try { await api("/request-code", { phone }); show("step-code"); $("#f-code input").focus(); }
  catch (err) { msg(f, err.message === "unknown" ? "Diese Nummer kennt der Fink nicht. Vielleicht mit einer anderen angemeldet?" : "Das hat nicht geklappt. Versuch es gleich nochmal."); }
});

$("#f-code").addEventListener("submit", async (e) => {
  e.preventDefault(); const f = e.target; const code = f.code.value.trim();
  if (!/^\d{6}$/.test(code)) return msg(f, "Der Code hat sechs Ziffern.");
  try { const d = await api("/verify", { phone, code }); token = d.token; sessionStorage.setItem("gf_token", token); renderAccount(d.account); show("step-account"); }
  catch (err) { msg(f, err.message === "expired" ? "Der Code ist abgelaufen. Fordere einen neuen an." : "Der Code stimmt nicht."); }
});

$("#f-place").addEventListener("submit", async (e) => {
  e.preventDefault(); const f = e.target;
  const plz = f.plz.value.trim(); if (!/^[1-9]\d{3}$/.test(plz)) return msg(f, "Bitte eine vierstellige Postleitzahl eingeben.");
  try { const d = await api("/update", { plz }); renderAccount(d.account); msg(f, "Gespeichert. Die nächste Ausgabe kommt für " + d.account.place + ".", true); }
  catch { msg(f, "Speichern hat nicht geklappt."); }
});

$("#b-portal").addEventListener("click", async () => {
  try { const d = await api("/portal"); if (d.url) location.href = d.url; else alert("Demo-Modus: Hier öffnet das Stripe-Portal."); } catch { alert("Portal gerade nicht erreichbar."); }
});

$("#b-cancel").addEventListener("click", async (e) => {
  const card = e.target.closest(".k-card");
  if (!confirm("Abo auf das Ende der laufenden Periode kündigen?")) return;
  try { const d = await api("/cancel"); renderAccount(d.account); msg(card, "Gekündigt. Bis " + d.account.billing + " kommen die Ausgaben noch.", true); }
  catch { msg(card, "Kündigen hat nicht geklappt. Schreib uns an support@gwunderfink.ch."); }
});

function renderAccount(a) {
  $("#k-name").textContent = a.first_name || "du";
  $("#k-place").textContent = a.place;
  $("#k-next").textContent = a.next_edition;
  $("#f-place input[name=plz]").value = a.plz || "";
  $("#k-status").textContent = { trial: "Gratismonat", active: "Aktiv", past_due: "Zahlung offen", cancelled: "Gekündigt" }[a.status] || a.status;
  $("#k-plan").textContent = "CHF 2.50 im Monat";
  $("#k-billing").textContent = a.billing || "noch offen";
  $("#b-cancel").disabled = a.status === "cancelled";
}

// Demo ohne Backend
const DEMO_ACC = { first_name: "Lea", plz: "5612", place: "5612 Villmergen", status: "active", plan: "monthly", billing: "20. November 2026", next_edition: "Donnerstag, 08:00" };
async function demo(path, body) {
  await new Promise((r) => setTimeout(r, 300));
  if (path === "/request-code") return {};
  if (path === "/verify") return body.code === "123456" ? { token: "demo", account: DEMO_ACC } : Promise.reject(new Error("wrong"));
  if (path === "/update") { DEMO_ACC.plz = body.plz; DEMO_ACC.place = body.plz; return { account: DEMO_ACC }; }
  if (path === "/portal") return {};
  if (path === "/cancel") { DEMO_ACC.status = "cancelled"; return { account: DEMO_ACC }; }
  if (path === "/me") return { account: DEMO_ACC };
}

// Bestehende Session?
if (token) api("/me").then((d) => { renderAccount(d.account); show("step-account"); }).catch(() => { sessionStorage.removeItem("gf_token"); token = null; });
