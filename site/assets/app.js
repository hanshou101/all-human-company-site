/*
  Grandmaster Interaction Layer
  - Biological Mouse Trail
  - Reveal Animations
  - Heartbeat Data
*/

const state = {
  mouseX: 0,
  mouseY: 0,
  trailX: 0,
  trailY: 0
};

function createCursor() {
  const cursor = document.createElement('div');
  cursor.className = 'bio-cursor';
  Object.assign(cursor.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '20px',
    height: '20px',
    border: '1px solid var(--blood)',
    borderRadius: '50%',
    pointerEvents: 'none',
    zIndex: '9999',
    transform: 'translate(-50%, -50%)',
    transition: 'width 0.3s, height 0.3s, background 0.3s',
    mixBlendMode: 'difference'
  });
  
  const dot = document.createElement('div');
  Object.assign(dot.style, {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '4px',
    height: '4px',
    background: 'var(--blood)',
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)'
  });
  
  cursor.appendChild(dot);
  document.body.appendChild(cursor);
  return cursor;
}

function initCursor() {
  const cursor = createCursor();
  
  document.addEventListener('mousemove', (e) => {
    state.mouseX = e.clientX;
    state.mouseY = e.clientY;
  });

  // Smooth trail loop
  function loop() {
    state.trailX += (state.mouseX - state.trailX) * 0.15;
    state.trailY += (state.mouseY - state.trailY) * 0.15;
    
    cursor.style.transform = `translate(${state.trailX}px, ${state.trailY}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  }
  loop();

  // Hover states
  const clickables = document.querySelectorAll('a, button, input, textarea');
  clickables.forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.style.width = '50px';
      cursor.style.height = '50px';
      cursor.style.background = 'rgba(255, 51, 51, 0.1)';
    });
    el.addEventListener('mouseleave', () => {
      cursor.style.width = '20px';
      cursor.style.height = '20px';
      cursor.style.background = 'transparent';
    });
  });
}

function revealOnLoad() {
  const items = document.querySelectorAll(".reveal");
  items.forEach((el, i) => {
    const delay = 100 + i * 100;
    setTimeout(() => el.classList.add("on"), delay);
  });
}

// Minimal helpers from original script
function qs(sel, root) { return (root || document).querySelector(sel); }
function safeText(el, text) { if (el) el.textContent = String(text); }
async function fetchJson(url, opt) {
  const res = await fetch(url, opt);
  return res.ok ? (res.headers.get("content-type").includes("json") ? res.json() : res.text()) : Promise.reject(res.statusText);
}

// Heartbeat
async function initHeartbeat() {
  try {
    const data = await fetchJson("/api/heartbeat");
    safeText(qs("[data-heartbeat='humans']"), data.online_humans);
    safeText(qs("[data-heartbeat='bpm']"), data.heartbeat_bpm + " bpm");
    safeText(qs("[data-heartbeat='caffeine']"), data.caffeine_level);
  } catch (e) {
    console.log("Static mode");
  }
}

// Forms
function initForms() {
  document.querySelectorAll("form[data-endpoint]").forEach(form => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button");
      const originalText = btn.textContent;
      btn.textContent = "TRANSMITTING...";
      
      try {
        const data = Object.fromEntries(new FormData(form));
        await fetchJson(form.dataset.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data)
        });
        alert("Received. Biological processing initialized.");
        form.reset();
      } catch (err) {
        alert("Transmission failed.");
      } finally {
        btn.textContent = originalText;
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  revealOnLoad();
  initHeartbeat();
  initForms();
  if (matchMedia('(pointer:fine)').matches) initCursor();
});
