// storage.js - ALL data logic lives here (saving, loading, rules). No HTML in this file.

// Everyone in the same class must use the SAME group id. Change it once, then share it with your class.
const GROUP_ID = "class-demo";

const KEY_EVENTS = "schulplaner_events"; // name of the box in localStorage that holds the events
const KEY_USER = "schulplaner_user";     // name of the box that holds this person's identity
const TYPES = ["lesson", "homework", "test"];

// ---------- Identity ----------
function getUser() {
  try { return JSON.parse(localStorage.getItem(KEY_USER)); } // null if nothing saved yet
  catch { return null; }
}

function createUser(name) {
  const user = { id: crypto.randomUUID(), name: name.trim() }; // random id = who you are
  localStorage.setItem(KEY_USER, JSON.stringify(user));
  return user;
}

// ---------- Load and save ----------
function loadEvents() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY_EVENTS));
    return Array.isArray(list) ? list : [];
  } catch { return []; } // broken data -> start with an empty list
}

function saveEvents(list) {
  localStorage.setItem(KEY_EVENTS, JSON.stringify(list));
}

// Events to show: deleted ones hidden, optional type filter, earliest date first.
function getVisibleEvents(type) {
  return loadEvents()
    .filter((e) => !e.deleted && (!type || e.type === type))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

// ---------- Validation ----------
// Returns "" if everything is fine, otherwise a message that tells the user what to fix.
function validateEventData(d) {
  const title = (d.title || "").trim();
  const subject = (d.subject || "").trim();
  if (title.length < 1 || title.length > 80) return "Title must be 1 to 80 characters.";
  if (subject.length < 1 || subject.length > 40) return "Subject must be 1 to 40 characters.";
  if (!TYPES.includes(d.type)) return "Please choose lesson, homework or test.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || "") || isNaN(new Date(d.date))) return "Please choose a valid date.";
  return "";
}

// ---------- Add, update, delete ----------
function addEvent(data) {
  const user = getUser();
  if (!user) return { ok: false, error: "Please enter your name first." };
  const error = validateEventData(data);
  if (error) return { ok: false, error };
  const event = {
    id: crypto.randomUUID(),
    title: data.title.trim(), subject: data.subject.trim(), type: data.type, date: data.date,
    createdBy: user.id, createdByName: user.name, groupId: GROUP_ID,
    updatedAt: Date.now(), deleted: false,
  };
  const list = loadEvents();
  list.push(event);
  saveEvents(list);
  return { ok: true };
}

// Ownership rule is checked HERE too, not only by hiding buttons.
function updateEvent(id, changes) {
  const user = getUser();
  const list = loadEvents();
  const event = list.find((e) => e.id === id);
  if (!user || !event) return { ok: false, error: "Event not found." };
  if (event.createdBy !== user.id) return { ok: false, error: "Only the creator can change this event." };
  const merged = { ...event, ...changes };
  const error = validateEventData(merged);
  if (error) return { ok: false, error };
  event.title = merged.title.trim();
  event.subject = merged.subject.trim();
  event.type = merged.type;
  event.date = merged.date;
  event.updatedAt = Date.now(); // newer timestamp = this version wins when others import it
  saveEvents(list);
  return { ok: true };
}

// "Delete" never removes the event. It only sets deleted = true, so the deletion spreads on export.
function deleteEvent(id) {
  const user = getUser();
  const list = loadEvents();
  const event = list.find((e) => e.id === id);
  if (!user || !event) return { ok: false, error: "Event not found." };
  if (event.createdBy !== user.id) return { ok: false, error: "Only the creator can delete this event." };
  event.deleted = true;
  event.updatedAt = Date.now();
  saveEvents(list);
  return { ok: true };
}

// ---------- Export and import ----------
function exportEvents() {
  return JSON.stringify({ app: "schulplaner", version: 1, groupId: GROUP_ID, events: loadEvents() }, null, 2);
}

// Checks that an imported event has every field with the right kind of value.
function isValidIncomingEvent(e) {
  return e && typeof e === "object"
    && typeof e.id === "string" && typeof e.title === "string" && typeof e.subject === "string"
    && TYPES.includes(e.type) && typeof e.date === "string" && !validateEventData(e)
    && typeof e.createdBy === "string" && typeof e.createdByName === "string"
    && typeof e.groupId === "string" && typeof e.updatedAt === "number" && typeof e.deleted === "boolean";
}

function importEvents(text) {
  let data;
  try { data = JSON.parse(text); }
  catch { return { ok: false, error: "This file is not valid JSON. Please choose a file exported from Schulplaner." }; }
  if (!data || data.app !== "schulplaner" || !Array.isArray(data.events)) {
    return { ok: false, error: "This file is not a Schulplaner export." };
  }

  const list = loadEvents();
  let added = 0, updated = 0, ignored = 0;
  for (const inc of data.events) {
    if (!isValidIncomingEvent(inc) || inc.groupId !== GROUP_ID) { ignored++; continue; } // wrong group -> ignore
    const known = list.findIndex((e) => e.id === inc.id);
    // Copy only the fields we know, so unknown extra data from a file is dropped.
    const clean = {
      id: inc.id, title: inc.title, subject: inc.subject, type: inc.type, date: inc.date,
      createdBy: inc.createdBy, createdByName: inc.createdByName, groupId: inc.groupId,
      updatedAt: inc.updatedAt, deleted: inc.deleted,
    };
    if (known === -1) { list.push(clean); added++; }                       // unknown id -> add
    else if (list[known].createdBy === clean.createdBy && clean.updatedAt > list[known].updatedAt) {
      list[known] = clean; updated++;                                       // same creator + newer -> accept
    } else { ignored++; }                                                   // anything else -> ignore
  }
  saveEvents(list);
  return { ok: true, added, updated, ignored };
}
