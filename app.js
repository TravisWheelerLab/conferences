"use strict";

// Renders the conference tables from data/conferences.json and overlays the
// attendee lists from data/attendees.json. A conference is "past" once its end
// date is before today (local time).
//
// The "Attending" column lets a lab member add their name in-page. Because the
// site is static, adds are persisted by committing data/attendees.json back to
// the repo via the GitHub Contents API, using a token the user stores locally.

const REPO = "TravisWheelerLab/conferences";
const ATTENDEES_PATH = "data/attendees.json";
const BRANCH = "main";
const TOKEN_KEY = "conf_gh_token";

function parseISO(d) {
  // d is "YYYY-MM-DD"; build a local Date at midnight.
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function startOfToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function el(tag, opts = {}) {
  const e = document.createElement(tag);
  if (opts.text != null) e.textContent = opts.text;
  if (opts.href != null) {
    e.href = opts.href;
    e.target = "_blank";
    e.rel = "noopener";
  }
  if (opts.className) e.className = opts.className;
  return e;
}

function nameCell(conf) {
  const td = el("td");
  if (conf.url) {
    td.appendChild(el("a", { text: conf.name, href: conf.url }));
  } else {
    td.textContent = conf.name;
  }
  return td;
}

// Days until the conference starts; used to flag imminent ones.
function daysUntil(conf, today) {
  return Math.round((parseISO(conf.start) - today) / 86400000);
}

// Renders a deadline cell. When the deadline has passed, the text is struck
// through (with the "(passed)" annotation removed) rather than labeled "passed".
// A deadline counts as passed if the data marks it "passed" or if a parseable
// date in the string is before today.
function deadlineCell(value) {
  const td = el("td");
  const raw = (value || "TBD").trim();
  const lower = raw.toLowerCase();

  if (lower === "tbd" || lower === "n/a" || raw === "") {
    td.textContent = raw || "TBD";
    return td;
  }

  // Drop the "passed" marker, keeping any other note (e.g. "abstracts, passed").
  let text = raw
    .replace(/\s*\(([^)]*\bpassed\b[^)]*)\)/i, (_m, inner) => {
      const rest = inner.replace(/\s*,?\s*passed\s*/i, "").trim();
      return rest ? ` (${rest})` : "";
    })
    .replace(/\s*,?\s*passed\s*$/i, "")
    .trim();
  if (text === "") text = raw; // was a bare "passed" with no date

  const parsed = Date.parse(text);
  const isPast =
    /\bpassed\b/i.test(raw) ||
    (!isNaN(parsed) && parsed < startOfToday().getTime());

  if (isPast) {
    td.appendChild(el("span", { text, className: "passed" }));
  } else {
    td.textContent = text;
  }
  return td;
}

// ---- Attendees ------------------------------------------------------------

// Case-insensitive lookup of a conference's attendee list from the loaded map.
function attendeesFor(map, confName) {
  const want = confName.trim().toLowerCase();
  for (const key of Object.keys(map)) {
    if (key.trim().toLowerCase() === want) return map[key].slice();
  }
  return [];
}

function chip(name) {
  return el("span", { text: name, className: "chip" });
}

// Builds the "Attending" cell: existing names as chips plus a "+ Add" control
// that reveals an inline form and commits the new name on save.
function attendeesCell(conf, attendeeMap) {
  const td = el("td");
  const wrap = el("div", { className: "attendees" });
  td.appendChild(wrap);

  for (const name of attendeesFor(attendeeMap, conf.name)) {
    wrap.appendChild(chip(name));
  }

  const addBtn = el("button", { text: "+ Add", className: "add-btn" });
  addBtn.type = "button";
  wrap.appendChild(addBtn);

  const status = el("div", { className: "row-status" });
  status.hidden = true;
  td.appendChild(status);

  function showStatus(msg, isErr) {
    status.textContent = msg;
    status.classList.toggle("err", !!isErr);
    status.hidden = false;
  }

  addBtn.addEventListener("click", () => {
    addBtn.hidden = true;
    const form = el("div", { className: "add-form" });
    const input = el("input");
    input.type = "text";
    input.placeholder = "Name";
    input.autocomplete = "name";
    const save = el("button", { text: "Save", className: "btn-primary" });
    save.type = "button";
    const cancel = el("button", { text: "Cancel", className: "btn-quiet" });
    cancel.type = "button";
    form.append(input, save, cancel);
    wrap.appendChild(form);
    input.focus();

    function done() {
      form.remove();
      addBtn.hidden = false;
    }
    cancel.addEventListener("click", done);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save.click();
      if (e.key === "Escape") done();
    });

    save.addEventListener("click", async () => {
      const person = input.value.trim();
      if (!person) return;
      save.disabled = true;
      cancel.disabled = true;
      showStatus("Saving…", false);
      try {
        await ensureToken();
        await commitAttendee(conf.name, person);
        wrap.insertBefore(chip(person), addBtn);
        // Keep the in-memory map current for subsequent adds this session.
        const existingKey = Object.keys(attendeeMap).find(
          (k) => k.trim().toLowerCase() === conf.name.trim().toLowerCase()
        );
        const key = existingKey || conf.name;
        attendeeMap[key] = (attendeeMap[key] || []).concat(person);
        showStatus("Saved — live on the page within ~1 min.", false);
        done();
      } catch (err) {
        console.error(err);
        showStatus(err.message || "Could not save.", true);
        save.disabled = false;
        cancel.disabled = false;
      }
    });
  });

  return td;
}

// ---- GitHub token + commit ------------------------------------------------

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function authHeaders() {
  return {
    Authorization: "Bearer " + getToken(),
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// UTF-8 safe base64 helpers (GitHub Contents API uses base64).
function encodeB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function decodeB64(b64) {
  const bin = atob((b64 || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Opens the token modal if no token is stored, and resolves once one exists.
function ensureToken() {
  if (getToken()) return Promise.resolve();
  return openTokenModal({ requireSave: true });
}

// GET the current attendees file, add the person, and PUT it back. Retries once
// on a 409 (someone else committed between our GET and PUT).
async function commitAttendee(confName, person, attempt = 0) {
  const base = `https://api.github.com/repos/${REPO}/contents/${ATTENDEES_PATH}`;
  const getResp = await fetch(base + `?ref=${BRANCH}&t=${Date.now()}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (getResp.status === 401) throw new Error("Token rejected — check it in “GitHub token…”.");
  if (!getResp.ok) throw new Error(`Could not read attendees file (${getResp.status}).`);
  const meta = await getResp.json();

  let doc;
  try {
    doc = JSON.parse(decodeB64(meta.content));
  } catch {
    doc = {};
  }
  if (!doc.attendees || typeof doc.attendees !== "object") doc.attendees = {};

  const want = confName.trim().toLowerCase();
  const key =
    Object.keys(doc.attendees).find((k) => k.trim().toLowerCase() === want) ||
    confName;
  const list = Array.isArray(doc.attendees[key]) ? doc.attendees[key] : [];
  if (list.some((n) => n.trim().toLowerCase() === person.trim().toLowerCase())) {
    throw new Error(`${person} is already listed for this conference.`);
  }
  list.push(person);
  doc.attendees[key] = list;

  const body = {
    message: `Add ${person} to ${key}`,
    content: encodeB64(JSON.stringify(doc, null, 2) + "\n"),
    sha: meta.sha,
    branch: BRANCH,
  };
  const putResp = await fetch(base, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (putResp.status === 409 && attempt < 2) {
    return commitAttendee(confName, person, attempt + 1);
  }
  if (putResp.status === 401 || putResp.status === 403) {
    throw new Error("Token lacks write access to the repo.");
  }
  if (!putResp.ok) {
    throw new Error(`Save failed (${putResp.status}).`);
  }
}

// ---- Token modal wiring ---------------------------------------------------

let tokenResolve = null;

function openTokenModal(opts = {}) {
  const modal = document.getElementById("token-modal");
  const input = document.getElementById("token-input");
  const status = document.getElementById("token-status");
  input.value = getToken();
  status.textContent = getToken() ? "A token is stored in this browser." : "";
  status.className = "modal-status";
  modal.hidden = false;
  input.focus();
  return new Promise((resolve) => {
    tokenResolve = { resolve, requireSave: !!opts.requireSave };
  });
}

function closeTokenModal(saved) {
  document.getElementById("token-modal").hidden = true;
  if (tokenResolve) {
    const { resolve, requireSave } = tokenResolve;
    tokenResolve = null;
    // If a save was required (add flow) but none happened, reject the wait.
    if (requireSave && !saved) resolve(Promise.reject(new Error("No token entered.")));
    else resolve();
  }
}

function wireTokenModal() {
  document.getElementById("token-link").addEventListener("click", (e) => {
    e.preventDefault();
    openTokenModal();
  });
  document.getElementById("token-save").addEventListener("click", () => {
    const v = document.getElementById("token-input").value.trim();
    const status = document.getElementById("token-status");
    if (!v) {
      status.textContent = "Paste a token first.";
      status.className = "modal-status err";
      return;
    }
    localStorage.setItem(TOKEN_KEY, v);
    closeTokenModal(true);
  });
  document.getElementById("token-clear").addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    const status = document.getElementById("token-status");
    status.textContent = "Token cleared.";
    status.className = "modal-status ok";
    document.getElementById("token-input").value = "";
  });
  document.getElementById("token-cancel").addEventListener("click", () =>
    closeTokenModal(false)
  );
  document.getElementById("token-modal").addEventListener("click", (e) => {
    if (e.target.id === "token-modal") closeTokenModal(false);
  });
}

// ---- Rendering ------------------------------------------------------------

function renderUpcoming(list, today, attendeeMap) {
  const tbody = document.querySelector("#upcoming-table tbody");
  const emptyMsg = document.getElementById("empty-msg");
  const table = document.getElementById("upcoming-table");

  if (list.length === 0) {
    table.hidden = true;
    emptyMsg.hidden = false;
    return;
  }

  for (const conf of list) {
    const tr = el("tr");
    tr.appendChild(nameCell(conf));
    tr.appendChild(el("td", { text: conf.location || "" }));

    const dates = el("td", { text: conf.dates_display || "" });
    if (daysUntil(conf, today) <= 30) {
      dates.classList.add("soon");
      dates.title = "Starts within 30 days";
    }
    tr.appendChild(dates);

    tr.appendChild(deadlineCell(conf.paper_deadline));
    tr.appendChild(deadlineCell(conf.poster_deadline));
    tr.appendChild(attendeesCell(conf, attendeeMap));
    tbody.appendChild(tr);
  }
}

function renderPast(list) {
  const tbody = document.querySelector("#past-table tbody");
  document.getElementById("past-count").textContent = String(list.length);
  for (const conf of list) {
    const tr = el("tr");
    tr.appendChild(nameCell(conf));
    tr.appendChild(el("td", { text: conf.location || "" }));
    tr.appendChild(el("td", { text: conf.dates_display || "" }));
    tbody.appendChild(tr);
  }
}

async function loadJSON(path) {
  const resp = await fetch(path, { cache: "no-cache" });
  if (!resp.ok) throw new Error(`fetch ${path}: ${resp.status}`);
  return resp.json();
}

async function main() {
  wireTokenModal();

  let data;
  try {
    data = await loadJSON("data/conferences.json");
  } catch (err) {
    document.querySelector("main").innerHTML =
      "<p class='empty'>Could not load conference data.</p>";
    console.error(err);
    return;
  }

  // Attendees are optional; a missing/empty file just means no names yet.
  let attendeeMap = {};
  try {
    const a = await loadJSON("data/attendees.json");
    if (a && a.attendees && typeof a.attendees === "object") {
      attendeeMap = a.attendees;
    }
  } catch (err) {
    console.warn("No attendees data:", err);
  }

  const today = startOfToday();
  const all = (data.conferences || []).slice();

  const upcoming = all
    .filter((c) => parseISO(c.end) >= today)
    .sort((a, b) => parseISO(a.start) - parseISO(b.start));

  const past = all
    .filter((c) => parseISO(c.end) < today)
    .sort((a, b) => parseISO(b.start) - parseISO(a.start));

  if (data.updated) {
    document.getElementById("updated").textContent =
      "Last updated " + data.updated + " · " + upcoming.length + " upcoming";
  }

  renderUpcoming(upcoming, today, attendeeMap);
  renderPast(past);
}

main();
