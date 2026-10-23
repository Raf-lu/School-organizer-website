// app.js - everything the user SEES and CLICKS. Data work is done by the functions in storage.js.

const TYPE_LABELS = { lesson: "Lesson", homework: "Homework", test: "Test" };
const $ = (id) => document.getElementById(id); // short helper: $("title") finds the element with id="title"

let currentUser = getUser(); // null on the very first launch
let editingId = null;        // id of the event being edited, or null when adding a new one

// Shows a green or red message under the toolbar. Empty text hides it.
function showMessage(text, isError) {
  const box = $("message");
  box.textContent = text;
  box.className = "message " + (isError ? "error" : "ok");
  box.hidden = !text;
}

// Shows either the name screen (first launch) or the main app.
function showScreen() {
  $("welcome").hidden = currentUser !== null;
  $("app").hidden = currentUser === null;
  if (currentUser) {
    $("user-name").textContent = currentUser.name;
    renderList();
  }
}

// Rebuilds the event list. We use textContent (never innerHTML) so imported text cannot run as code.
function renderList() {
  const list = $("event-list");
  list.replaceChildren(); // empty the list
  const events = getVisibleEvents($("filter").value);
  $("empty").hidden = events.length > 0; // friendly message when there is nothing to show

  for (const ev of events) {
    const li = document.createElement("li");
    li.className = "event";

    const marker = document.createElement("span");       // colored dot for the type
    marker.className = "marker type-" + ev.type;
    marker.title = TYPE_LABELS[ev.type];

    const info = document.createElement("div");
    info.className = "info";
    const title = document.createElement("strong");
    title.textContent = ev.title;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = TYPE_LABELS[ev.type] + ", " + ev.subject + ", " + ev.date + ", by " + ev.createdByName;
    info.append(title, meta);
    li.append(marker, info);

    // Edit and Delete buttons only on your OWN events (storage.js checks the rule again).
    if (currentUser && ev.createdBy === currentUser.id) {
      const edit = document.createElement("button");
      edit.textContent = "Edit";
      edit.addEventListener("click", () => startEdit(ev));
      const del = document.createElement("button");
      del.textContent = "Delete";
      del.className = "danger";
      del.addEventListener("click", () => {
        const result = deleteEvent(ev.id);
        showMessage(result.ok ? "Event deleted." : result.error, !result.ok);
        renderList();
      });
      li.append(edit, del);
    }
    list.append(li);
  }
}

function startEdit(ev) {
  editingId = ev.id;
  $("title").value = ev.title;
  $("subject").value = ev.subject;
  $("type").value = ev.type;
  $("date").value = ev.date;
  $("form-heading").textContent = "Edit event";
  $("save-btn").textContent = "Save changes";
  $("cancel-btn").hidden = false;
  $("title").focus();
}

function resetForm() {
  editingId = null;
  $("event-form").reset();
  $("form-heading").textContent = "Add event";
  $("save-btn").textContent = "Add event";
  $("cancel-btn").hidden = true;
}

// ---------- Button and form handlers ----------
$("name-form").addEventListener("submit", (e) => {
  e.preventDefault(); // stop the page from reloading
  const name = $("name-input").value.trim();
  if (name.length < 1 || name.length > 30) return;
  currentUser = createUser(name);
  showScreen();
});

$("event-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = { title: $("title").value, subject: $("subject").value, type: $("type").value, date: $("date").value };
  const wasEditing = editingId !== null;
  const result = wasEditing ? updateEvent(editingId, data) : addEvent(data);
  if (!result.ok) { showMessage(result.error, true); return; } // validation error -> keep the form as it is
  resetForm();
  showMessage(wasEditing ? "Event updated." : "Event added.", false);
  renderList();
});

$("cancel-btn").addEventListener("click", resetForm);
$("filter").addEventListener("change", renderList);

// Export: build a JSON file in memory and let the browser download it.
$("export-btn").addEventListener("click", () => {
  const blob = new Blob([exportEvents()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "schulplaner-" + new Date().toISOString().slice(0, 10) + ".json";
  link.click();
  URL.revokeObjectURL(url);
});

// Import: the visible button opens the hidden file chooser.
$("import-btn").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const result = importEvents(await file.text());
    showMessage(
      result.ok ? "Import done: " + result.added + " added, " + result.updated + " updated, " + result.ignored + " ignored." : result.error,
      !result.ok
    );
  } catch {
    showMessage("The file could not be read.", true);
  }
  e.target.value = ""; // lets you pick the same file again later
  renderList();
});

// ---------- Start ----------
showScreen();

// Register the service worker so the app works offline and can be installed.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}
