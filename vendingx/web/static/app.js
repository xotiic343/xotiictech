/* ═══════════════════════════════════════════════════════
   Vending X — Frontend controller
   Polls /api/stock every 15s, handles selection via
   keypad or click, drives the VEND animation.
   ═══════════════════════════════════════════════════════ */

"use strict";

const API = "";
const POLL_MS = 15000;

let stockData = {};
let selectedSlot = null;
let selectedType = null;
let keyBuffer = "";
let vendInProgress = false;
let currentUser = null;

const SLOT_IDS = ["A1","A2","A3","A4","B1","B2","B3","B4","C1","C2","C3","C4"];

/* ── Init ──────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  await checkAuth();
  await fetchStock();
  setInterval(fetchStock, POLL_MS);

  document.getElementById("btn-vend").addEventListener("click", doVend);
  document.getElementById("btn-copy").addEventListener("click", copyPayload);

  document.querySelectorAll(".key").forEach(k =>
    k.addEventListener("click", () => handleKey(k.dataset.key))
  );

  document.addEventListener("keydown", handleKeyboard);
  setupDragDrop();
  setupUploadForm();
});

/* ── Auth ──────────────────────────────────────────── */

async function checkAuth() {
  const params = new URLSearchParams(location.search);
  const token = params.get("token");
  if (token) {
    document.cookie = `vx_session=${token}; path=/; secure; samesite=lax; max-age=86400`;
    history.replaceState({}, "", location.pathname);
  }

  try {
    const res = await fetch(`${API}/auth/me`, { credentials: "include" });
    if (!res.ok) throw new Error("Not authed");
    currentUser = await res.json();
    showMachine();
  } catch {
    document.getElementById("auth-gate").style.display = "flex";
    document.getElementById("machine-wrap").style.display = "none";
  }
}

function showMachine() {
  document.getElementById("auth-gate").style.display = "none";
  document.getElementById("machine-wrap").style.display = "flex";

  if (currentUser) {
    const discrim = currentUser.avatar
      ? `https://cdn.discordapp.com/avatars/${currentUser.user_id}/${currentUser.avatar}.png?size=64`
      : `https://cdn.discordapp.com/embed/avatars/0.png`;
    document.getElementById("user-avatar").src = discrim;
    document.getElementById("user-name").textContent = currentUser.username;

    if (currentUser.has_access) {
      document.getElementById("user-badge").style.display = "inline";
    }
    if (currentUser.is_owner) {
      document.getElementById("btn-admin").style.display = "inline-flex";
    }
  }
}

async function logout() {
  await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
  location.reload();
}

/* ── Stock polling ─────────────────────────────────── */

async function fetchStock() {
  try {
    const res = await fetch(`${API}/api/stock`);
    stockData = await res.json();
    renderSlots();
  } catch (e) {
    console.error("Stock fetch failed:", e);
  }
}

function renderSlots() {
  const grid = document.getElementById("slot-grid");
  grid.innerHTML = "";

  const types = Object.entries(stockData);

  SLOT_IDS.forEach((slotId, i) => {
    const el = document.createElement("div");
    el.className = "slot";
    el.setAttribute("role", "gridcell");
    el.setAttribute("tabindex", "0");
    el.dataset.slotId = slotId;

    if (i < types.length) {
      const [typeKey, info] = types[i];
      el.dataset.type = typeKey;

      const soldOut = info.count === 0;
      if (soldOut) el.classList.add("sold-out");
      if (selectedSlot === slotId) el.classList.add("selected");

      el.innerHTML = `
        <span class="slot__id">${slotId}</span>
        <span class="slot__icon">${info.emoji}</span>
        <span class="slot__name">${info.name}</span>
        <span class="slot__count">${info.count} left</span>
        <span class="slot__led ${soldOut ? 'slot__led--off' : 'slot__led--on'}"></span>
        ${info.premium ? '<span class="slot__premium">PREMIUM</span>' : ''}
      `;

      el.addEventListener("click", () => selectSlot(slotId, typeKey, info));
      el.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectSlot(slotId, typeKey, info); }
      });
    } else {
      el.classList.add("sold-out");
      el.innerHTML = `
        <span class="slot__id">${slotId}</span>
        <span class="slot__icon">📦</span>
        <span class="slot__name">Empty</span>
        <span class="slot__count">—</span>
        <span class="slot__led slot__led--off"></span>
      `;
    }

    grid.appendChild(el);
  });
}

/* ── Selection ─────────────────────────────────────── */

function selectSlot(slotId, typeKey, info) {
  selectedSlot = slotId;
  selectedType = typeKey;
  setLCD(`${slotId}: ${info.name}`);

  document.querySelectorAll(".slot").forEach(s => s.classList.remove("selected"));
  const el = document.querySelector(`[data-slot-id="${slotId}"]`);
  if (el) el.classList.add("selected");
}

function setLCD(text) {
  document.getElementById("lcd").textContent = text.toUpperCase();
}

/* ── Keypad ────────────────────────────────────────── */

function handleKey(k) {
  if (k === "CLR") {
    keyBuffer = "";
    selectedSlot = null;
    selectedType = null;
    setLCD("SELECT A SLOT");
    document.querySelectorAll(".slot").forEach(s => s.classList.remove("selected"));
    return;
  }

  keyBuffer += k;

  if (keyBuffer.length >= 2) {
    const slotId = keyBuffer.substring(0, 2).toUpperCase();
    keyBuffer = "";

    const idx = SLOT_IDS.indexOf(slotId);
    if (idx === -1) {
      setLCD("INVALID SLOT");
      return;
    }

    const types = Object.entries(stockData);
    if (idx < types.length) {
      const [typeKey, info] = types[idx];
      selectSlot(slotId, typeKey, info);
    } else {
      setLCD("EMPTY SLOT");
    }
  }
}

function handleKeyboard(e) {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
  if (document.querySelector("dialog[open]")) return;

  const k = e.key.toUpperCase();
  if (["A", "B", "C", "1", "2", "3", "4"].includes(k)) {
    handleKey(k);
  } else if (k === "ESCAPE" || k === "DELETE") {
    handleKey("CLR");
  } else if (k === "ENTER" && selectedType) {
    doVend();
  }
}

/* ── Vending ───────────────────────────────────────── */

async function doVend() {
  if (vendInProgress || !selectedType) return;
  vendInProgress = true;

  const btn = document.getElementById("btn-vend");
  const machine = document.querySelector(".machine");
  const tray = document.getElementById("tray");
  const flap = document.getElementById("tray-flap");
  const trayItem = document.getElementById("tray-item");

  btn.classList.add("pressed");
  setLCD("VENDING...");
  trayItem.style.display = "none";
  flap.classList.remove("open");

  await sleep(300);
  machine.classList.add("shaking");
  await sleep(500);
  machine.classList.remove("shaking");
  btn.classList.remove("pressed");

  try {
    const res = await fetch(`${API}/api/vend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ stock_type: selectedType }),
    });

    const data = await res.json();

    if (!res.ok) {
      setLCD(data.error || "ERROR");
      vendInProgress = false;
      return;
    }

    setLCD(`DISPENSED: ${data.name}`);

    flap.classList.add("open");
    await sleep(300);

    document.getElementById("item-payload").textContent = data.item;
    document.querySelector(".item-card__header").textContent = `🎁 ${data.name}`;
    trayItem.style.display = "block";

    await fetchStock();
  } catch (e) {
    setLCD("NETWORK ERROR");
    console.error("Vend failed:", e);
  }

  vendInProgress = false;
}

function copyPayload() {
  const text = document.getElementById("item-payload").textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("btn-copy");
    btn.textContent = "✅ Copied!";
    setTimeout(() => (btn.textContent = "📋 Copy"), 2000);
  });
}

/* ── Admin ─────────────────────────────────────────── */

function showAdmin() {
  const dialog = document.getElementById("admin-dialog");
  const select = document.getElementById("upload-type");
  select.innerHTML = "";
  for (const [key, info] of Object.entries(stockData)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = info.name;
    select.appendChild(opt);
  }
  dialog.showModal();
}

function setupDragDrop() {
  const zone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("upload-file");
  if (!zone || !fileInput) return;

  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("dragover"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("dragover");
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      zone.querySelector("span").textContent = e.dataTransfer.files[0].name;
    }
  });
}

function setupUploadForm() {
  const form = document.getElementById("upload-form");
  if (!form) return;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const type = document.getElementById("upload-type").value;
    const file = document.getElementById("upload-file").files[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("stock_type", type);
    fd.append("file", file);

    try {
      const res = await fetch(`${API}/api/admin/upload`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      document.getElementById("upload-result").textContent = res.ok
        ? `✅ Added ${data.added} entries (total: ${data.total})`
        : `❌ ${data.error}`;
      await fetchStock();
    } catch {
      document.getElementById("upload-result").textContent = "❌ Upload failed";
    }
  });
}

/* ── Helpers ───────────────────────────────────────── */

function sleep(ms) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  return new Promise(r => setTimeout(r, ms));
}
