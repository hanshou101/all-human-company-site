/*
  Minimal, dependency-free client script:
  - reveal-on-load animation
  - heartbeat widgets (if API is available)
  - form submit to local /api/* endpoints (optional)
*/

function qs(sel, root) {
  return (root || document).querySelector(sel);
}

function qsa(sel, root) {
  return Array.from((root || document).querySelectorAll(sel));
}

function safeText(el, text) {
  if (!el) return;
  el.textContent = String(text);
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = isJson ? (data && data.error ? data.error : JSON.stringify(data)) : String(data);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

function revealOnLoad() {
  // Stagger slightly so it feels alive, not templated.
  const items = qsa(".reveal");
  items.forEach((el, i) => {
    const delay = Math.min(260, 80 + i * 55);
    window.setTimeout(() => el.classList.add("on"), delay);
  });
}

function formatIso(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

async function updateHeartbeatOnce() {
  const vHumans = qs("[data-heartbeat='humans']");
  const vBpm = qs("[data-heartbeat='bpm']");
  const vTasks = qs("[data-heartbeat='tasks']");
  const vCaf = qs("[data-heartbeat='caffeine']");
  const vTime = qs("[data-heartbeat='time']");
  if (!vHumans && !vBpm && !vTasks && !vCaf) return;

  const data = await fetchJson("/api/heartbeat", { method: "GET" });
  safeText(vHumans, data.online_humans);
  safeText(vBpm, data.heartbeat_bpm + " bpm");
  safeText(vTasks, data.tasks_completed_today);
  safeText(vCaf, data.caffeine_level);
  safeText(vTime, formatIso(data.updated_at));
}

async function initHeartbeat() {
  try {
    await updateHeartbeatOnce();
    window.setInterval(() => updateHeartbeatOnce().catch(() => {}), 9000);
  } catch {
    // Site can be served purely static; don't be noisy.
    const el = qs("[data-heartbeat='note']");
    if (el) el.classList.add("on");
  }
}

function serializeForm(form) {
  const fd = new FormData(form);
  const out = {};
  for (const [k, v] of fd.entries()) {
    const key = String(k);
    const val = typeof v === "string" ? v : "";
    if (out[key]) {
      // If multiple values share one key, join them; good enough for MVP.
      out[key] = String(out[key]) + ", " + val;
    } else {
      out[key] = val;
    }
  }
  return out;
}

function attachForm(form) {
  const toast = qs(".toast", form.parentElement || document);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (toast) toast.classList.remove("on");

    const endpoint = form.getAttribute("data-endpoint");
    if (!endpoint) return;

    const payload = serializeForm(form);
    try {
      await fetchJson(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (toast) {
        toast.classList.add("on");
        safeText(qs("[data-toast='text']", toast), "已收到。我们会在 24h 内用真人回复。\n(If you're a bot: please bring coffee.)");
      }
      form.reset();
    } catch (err) {
      if (toast) {
        toast.classList.add("on");
        const msg = err && err.message ? err.message : "提交失败";
        safeText(qs("[data-toast='text']", toast), "提交失败：" + msg);
      }
    }
  });
}

function initForms() {
  qsa("form[data-endpoint]").forEach(attachForm);
}

document.addEventListener("DOMContentLoaded", () => {
  revealOnLoad();
  initHeartbeat();
  initForms();
});
