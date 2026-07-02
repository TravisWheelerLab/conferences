"use strict";

// Renders the conference tables from data/conferences.json.
// A conference is "past" once its end date is before today (local time).

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

function renderUpcoming(list, today) {
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

async function main() {
  let data;
  try {
    const resp = await fetch("data/conferences.json", { cache: "no-cache" });
    data = await resp.json();
  } catch (err) {
    document.querySelector("main").innerHTML =
      "<p class='empty'>Could not load conference data.</p>";
    console.error(err);
    return;
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

  renderUpcoming(upcoming, today);
  renderPast(past);
}

main();
