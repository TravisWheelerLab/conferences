"use strict";

// Renders the conference tables from data/conferences.json, overlays attendee
// lists (data/attendees.json), and hides manually-removed conferences
// (data/hidden.json). A conference is "past" once its end date is before today.
//
// Three in-page actions persist by committing back to the repo via the GitHub
// Contents API, using a token the user stores locally (never in the page):
//   - "+ Add" in the Attending column       -> data/attendees.json
//   - "+ Add a conference" button            -> add-conferences.txt (a queue)
//   - the ✕ on a row                         -> data/hidden.json

const REPO = "TravisWheelerLab/conferences";
const ATTENDEES_PATH = "data/attendees.json";
const HIDDEN_PATH = "data/hidden.json";
const QUEUE_PATH = "add-conferences.txt";
const EDITS_PATH = "edit-requests.txt";
const BRANCH = "main";
const TOKEN_KEY = "conf_gh_token";

// Populated in main(); used to keep the "N upcoming" line current after a remove.
const g = { updated: "", upcomingCount: 0 };

function parseISO(d) {
  // d is "YYYY-MM-DD"; build a local Date at midnight.
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function startOfToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

// Brief bottom-center confirmation that fades out on its own.
function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  // Force reflow so the fade-in transition runs, then schedule removal.
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 400);
  }, 3500);
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

// ---- Remove (hide) --------------------------------------------------------

// De-dup key for past entries (live-file past + archive can overlap).
function pastKey(conf) {
  return (conf.name || "").trim().toLowerCase() + "|" + (conf.start || "");
}

function isHidden(conf, hiddenList) {
  const n = (conf.name || "").trim().toLowerCase();
  const u = (conf.url || "").trim().toLowerCase();
  return hiddenList.some((h) => {
    const hn = (h.name || "").trim().toLowerCase();
    const hu = (h.url || "").trim().toLowerCase();
    return (hn && hn === n) || (hu && hu === u);
  });
}

function refreshUpcomingCount() {
  if (!g.updated) return;
  document.getElementById("updated").textContent =
    "Last updated " + g.updated + " · " + g.upcomingCount + " upcoming";
}

// Builds the trailing actions cell with a ✕ that hides the conference after an
// inline confirm.
function actionsCell(conf, tr) {
  const td = el("td", { className: "actions" });

  const editBtn = el("button", { text: "Edit", className: "edit-btn" });
  editBtn.type = "button";
  editBtn.title = "Request an edit to this entry";
  editBtn.addEventListener("click", () => openEditModal(conf));
  td.appendChild(editBtn);

  const removeBtn = el("button", { text: "✕", className: "remove-btn" });
  removeBtn.type = "button";
  removeBtn.title = "Remove from page";
  td.appendChild(removeBtn);

  const confirmWrap = el("span", { className: "remove-confirm" });
  confirmWrap.hidden = true;
  confirmWrap.appendChild(document.createTextNode("Remove?"));
  const yes = el("button", { text: "Yes", className: "btn-quiet" });
  const no = el("button", { text: "No", className: "btn-quiet" });
  yes.type = no.type = "button";
  confirmWrap.append(yes, no);

  function showConfirm(on) {
    editBtn.hidden = on;
    removeBtn.hidden = on;
    confirmWrap.hidden = !on;
  }

  removeBtn.addEventListener("click", () => showConfirm(true));
  no.addEventListener("click", () => showConfirm(false));
  yes.addEventListener("click", async () => {
    yes.disabled = no.disabled = true;
    try {
      await ensureToken();
      await hideConference(conf);
      tr.remove();
      g.upcomingCount = Math.max(0, g.upcomingCount - 1);
      refreshUpcomingCount();
    } catch (err) {
      console.error(err);
      td.textContent = "";
      td.appendChild(el("span", {
        text: err.message || "Could not remove.",
        className: "row-status err",
      }));
    }
  });

  td.appendChild(confirmWrap);
  return td;
}

// ---- GitHub token + generic commit ----------------------------------------

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

// GET a repo file, transform its raw text, and PUT it back. `transform(raw)`
// returns the new text (or throws to abort with a message). Retries once on a
// 409 (someone committed between our GET and PUT). Handles a missing file (404).
async function commitFile(path, transform, message, attempt = 0) {
  const base = `https://api.github.com/repos/${REPO}/contents/${path}`;
  const getResp = await fetch(base + `?ref=${BRANCH}&t=${Date.now()}`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  let sha;
  let raw = "";
  if (getResp.status === 404) {
    sha = undefined;
  } else if (getResp.status === 401) {
    throw new Error("Token rejected — check it in “GitHub token…”.");
  } else if (!getResp.ok) {
    throw new Error(`Could not read ${path} (${getResp.status}).`);
  } else {
    const meta = await getResp.json();
    sha = meta.sha;
    raw = decodeB64(meta.content);
  }

  const next = transform(raw);

  const body = { message, content: encodeB64(next), branch: BRANCH };
  if (sha) body.sha = sha;

  const putResp = await fetch(base, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (putResp.status === 409 && attempt < 2) {
    return commitFile(path, transform, message, attempt + 1);
  }
  if (putResp.status === 401 || putResp.status === 403) {
    throw new Error("Token lacks write access to the repo.");
  }
  if (!putResp.ok) {
    throw new Error(`Save failed (${putResp.status}).`);
  }
}

function commitAttendee(confName, person) {
  return commitFile(
    ATTENDEES_PATH,
    (raw) => {
      let doc;
      try {
        doc = JSON.parse(raw);
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
      return JSON.stringify(doc, null, 2) + "\n";
    },
    `Add ${person} to ${confName}`
  );
}

function hideConference(conf) {
  return commitFile(
    HIDDEN_PATH,
    (raw) => {
      let doc;
      try {
        doc = JSON.parse(raw);
      } catch {
        doc = {};
      }
      if (!Array.isArray(doc.hidden)) doc.hidden = [];
      if (!isHidden(conf, doc.hidden)) {
        doc.hidden.push({ name: conf.name || "", url: conf.url || "" });
      }
      return JSON.stringify(doc, null, 2) + "\n";
    },
    `Hide conference: ${conf.name}`
  );
}

function queueRequests(lines) {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  if (clean.length === 0) throw new Error("Nothing to add.");
  const message =
    clean.length === 1
      ? `Queue conference request: ${clean[0].slice(0, 72)}`
      : `Queue ${clean.length} conference requests`;
  return commitFile(
    QUEUE_PATH,
    (raw) => {
      let text = raw;
      if (text && !text.endsWith("\n")) text += "\n";
      return text + clean.join("\n") + "\n";
    },
    message
  );
}

// Appends one edit request: "<conference name> — <plain-English change>".
function queueEdit(confName, description) {
  const change = description.replace(/\s*\n\s*/g, "; ").trim();
  if (!change) throw new Error("Describe the change first.");
  const line = `${confName} — ${change}`;
  return commitFile(
    EDITS_PATH,
    (raw) => {
      let text = raw;
      if (text && !text.endsWith("\n")) text += "\n";
      return text + line + "\n";
    },
    `Queue edit for ${confName}`
  );
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
    if (requireSave && !saved) resolve(Promise.reject(new Error("No token entered.")));
    else resolve();
  }
}

// Opens the token modal if no token is stored, and resolves once one exists.
function ensureToken() {
  if (getToken()) return Promise.resolve();
  return openTokenModal({ requireSave: true });
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

// ---- Add-conference modal wiring ------------------------------------------

function wireAddModal() {
  const modal = document.getElementById("add-modal");
  const input = document.getElementById("add-input");
  const status = document.getElementById("add-status");
  const submit = document.getElementById("add-submit");
  const cancel = document.getElementById("add-cancel");

  function open() {
    input.value = "";
    status.textContent = "";
    status.className = "modal-status";
    submit.disabled = false;
    cancel.disabled = false;
    modal.hidden = false;
    input.focus();
  }
  function close() {
    modal.hidden = true;
  }

  document.getElementById("add-conf-btn").addEventListener("click", open);
  cancel.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target.id === "add-modal") close();
  });

  submit.addEventListener("click", async () => {
    const lines = input.value.split("\n").map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) {
      status.textContent = "Enter at least one URL or description.";
      status.className = "modal-status err";
      return;
    }
    submit.disabled = true;
    cancel.disabled = true;
    status.textContent = "Adding to queue…";
    status.className = "modal-status";
    try {
      await ensureToken();
      await queueRequests(lines);
      const n = lines.length;
      input.value = "";
      close();
      showToast(`Queued ${n} — the system will add ${n === 1 ? "it" : "them"} to the page within about an hour.`);
    } catch (err) {
      console.error(err);
      status.textContent = err.message || "Could not queue.";
      status.className = "modal-status err";
    }
    submit.disabled = false;
    cancel.disabled = false;
  });
}

// ---- Edit-request modal wiring --------------------------------------------

let editConf = null;

function openEditModal(conf) {
  editConf = conf;
  document.getElementById("edit-conf-name").textContent = conf.name;
  const input = document.getElementById("edit-input");
  const status = document.getElementById("edit-status");
  input.value = "";
  status.textContent = "";
  status.className = "modal-status";
  document.getElementById("edit-submit").disabled = false;
  document.getElementById("edit-cancel").disabled = false;
  document.getElementById("edit-modal").hidden = false;
  input.focus();
}

function wireEditModal() {
  const modal = document.getElementById("edit-modal");
  const input = document.getElementById("edit-input");
  const status = document.getElementById("edit-status");
  const submit = document.getElementById("edit-submit");
  const cancel = document.getElementById("edit-cancel");

  function close() {
    modal.hidden = true;
  }
  cancel.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target.id === "edit-modal") close();
  });

  submit.addEventListener("click", async () => {
    const desc = input.value.trim();
    if (!desc) {
      status.textContent = "Describe the change first.";
      status.className = "modal-status err";
      return;
    }
    submit.disabled = true;
    cancel.disabled = true;
    status.textContent = "Submitting edit…";
    status.className = "modal-status";
    try {
      await ensureToken();
      await queueEdit(editConf.name, desc);
      input.value = "";
      close();
      showToast("Edit queued — the system will apply it to the page within about an hour.");
    } catch (err) {
      console.error(err);
      status.textContent = err.message || "Could not submit.";
      status.className = "modal-status err";
    }
    submit.disabled = false;
    cancel.disabled = false;
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
    tr.appendChild(actionsCell(conf, tr));
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
  wireAddModal();
  wireEditModal();

  let data;
  try {
    data = await loadJSON("data/conferences.json");
  } catch (err) {
    document.querySelector("main").innerHTML =
      "<p class='empty'>Could not load conference data.</p>";
    console.error(err);
    return;
  }

  // Attendees and the hidden list are optional overlays.
  let attendeeMap = {};
  try {
    const a = await loadJSON("data/attendees.json");
    if (a && a.attendees && typeof a.attendees === "object") attendeeMap = a.attendees;
  } catch (err) {
    console.warn("No attendees data:", err);
  }

  let hiddenList = [];
  try {
    const h = await loadJSON("data/hidden.json");
    if (h && Array.isArray(h.hidden)) hiddenList = h.hidden;
  } catch (err) {
    console.warn("No hidden data:", err);
  }

  // Ended conferences live in the archive (moved there by prune.py). The live
  // file may also hold a few not-yet-pruned past ones; merge and de-dupe.
  let archive = [];
  try {
    const ar = await loadJSON("data/archive.json");
    if (ar && Array.isArray(ar.conferences)) archive = ar.conferences;
  } catch (err) {
    console.warn("No archive data:", err);
  }

  const today = startOfToday();
  const all = (data.conferences || [])
    .slice()
    .filter((c) => !isHidden(c, hiddenList));

  const upcoming = all
    .filter((c) => parseISO(c.end) >= today)
    .sort((a, b) => parseISO(a.start) - parseISO(b.start));

  const pastById = new Map();
  for (const c of all) {
    if (parseISO(c.end) < today) pastById.set(pastKey(c), c);
  }
  for (const c of archive) {
    if (!isHidden(c, hiddenList) && !pastById.has(pastKey(c))) {
      pastById.set(pastKey(c), c);
    }
  }
  const past = [...pastById.values()].sort(
    (a, b) => parseISO(b.start) - parseISO(a.start)
  );

  g.updated = data.updated || "";
  g.upcomingCount = upcoming.length;
  refreshUpcomingCount();

  renderUpcoming(upcoming, today, attendeeMap);
  renderPast(past);
}

main();
