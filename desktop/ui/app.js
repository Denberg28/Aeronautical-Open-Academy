"use strict";
const desktopApi = Object.fromEntries(
  ["login", "request", "logout", "openLink", "inspectLink", "exportReport", "subjectQr", "sync", "uploadMaterial", "uploadImage", "pickImage", "readImage"].map((method) => [method, async (...args) => {
    const result = await window.academy[method](...args);
    if (!result.ok) {
      const error = new Error(result.error);
      error.status = result.status;
      throw error;
    }
    return result.value;
  }]),
);
const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function generatePassphrase() {
  const words = ["Aero", "Lift", "Wing", "Glide", "Mach", "Airfoil", "Vector", "Thrust", "Climb", "Rotor", "Chord", "Vortex", "Camber", "Pitch", "Yaw", "Orbit"];
  const buf = new Uint32Array(4);
  crypto.getRandomValues(buf);
  const pick = (i) => words[buf[i] % words.length];
  const digits = String(1000 + (buf[3] % 9000));
  return `${pick(0)}-${pick(1)}-${pick(2)}-${digits}!`;
}
const icons = {
  book: "M4 3h13a2 2 0 0 1 2 2v16H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3 M3 17h16 M7 7h8",
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  check: "M5 12l4 4L19 6",
  tasks: "M9 6h12 M9 12h12 M9 18h12 M3 6h1 M3 12h1 M3 18h1",
  chart: "M4 20V4 M4 20h17 M9 16v-5 M14 16V6 M19 16v-8",
  users:
    "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M19 8v6 M16 11h6",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
  plus: "M12 5v14 M5 12h14",
  edit: "M15 5l4 4 M3 21l5-1L21 7a2 2 0 0 0-4-4L4 16z",
  chevron: "M8 5l7 7-7 7",
  grip: "M9 5h.01 M15 5h.01 M9 12h.01 M15 12h.01 M9 19h.01 M15 19h.01",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  search: "M21 21l-5-5 M18 10a8 8 0 1 0-16 0 8 8 0 0 0 16 0",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  external: "M14 3h7v7 M21 3L10 14 M10 3H3v18h18v-7",
  bell: "M18 8a6 6 0 0 0-12 0v8l-2 2h16l-2-2z M10 21h4",
  help: "M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17h.01 M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0",
  logout: "M9 4H3v16h6 M9 12h12 M17 8l4 4-4 4",
  sync: "M21 12a9 9 0 0 1-15.4 6.4 M3 12a9 9 0 0 1 15.4-6.4 M21 5v5h-5 M3 19v-5h5",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  folderPlus: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M12 10v6 M9 13h6",
  play: "M6 4l14 8-14 8z",
  image: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M8.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M21 16l-5-5-4 4-2-2-5 5",
  minimize: "M6 12h12",
  settings:
    "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2 M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0",
};
const icon = (key) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[key] || icons.book}"/></svg>`;
const button = (text, action, extra = "", cls = "") =>
  `<button type="button" class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
const state = {
  account: null,
  version: "",
  collapsedMaterials: new Set(),
  collapsedEntries: new Set(),
  collapsedFolders: new Set(),
  readyQuizzes: new Set(),
  mode: "local",
  subjects: [],
  folders: [],
  folderForm: null,
  announcements: [],
  active: null,
  activeLearnerId: null,
  items: [],
  summary: null,
  capabilities: {},
  view: "subject",
  search: "",
  compose: null,
  dirty: false,
  busy: false,
  allItems: [],
  rosterOffset: 0,
  accountOffset: 0,
};
let resumeWorkspace = null;
let toastTimer,
  loadSequence = 0;
function toast(message, kind = "") {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").className = "show " + kind;
  if (kind !== "busy")
    toastTimer = setTimeout(() => ($("#toast").className = ""), 6000);
}
function showLogin() {
  $("#app").hidden = true;
  const pass = $("#login-form")?.elements.password;
  const toggle = $("#toggle-password");
  if (pass) pass.type = "password";
  if (toggle) {
    toggle.textContent = "Show";
    toggle.setAttribute("aria-pressed", "false");
  }
  if (!$("#signin").open) $("#signin").showModal();
}
async function act(fn) {
  if (state.busy) return;
  state.busy = true;
  document.body.classList.add("working");
  $("#app").inert = true;
  toast("Working…", "busy");
  try {
    await fn();
    if ($("#toast").classList.contains("busy")) $("#toast").className = "";
  } catch (error) {
    toast(error.message, "error");
    if ($("#compose-error")) $("#compose-error").textContent = error.message;
    if (error.status === 401) {
      if (state.account && state.dirty) resumeWorkspace = { id: state.account.id, role: state.account.role, mode: state.mode, origin: state.origin };
      state.account = null;
      window.academyPresenter?.close();
      window.academyEditor?.clearImageCache();
      await window.academyReader.close();
      // Recovery — Lock a dirty form behind sign-in; discard other private views.
      // Resume below rechecks subject access before revealing the retained editor.
      if (!resumeWorkspace) {state.items=[];state.subjects=[];state.active=null;state.collapsedEntries.clear();$("#app").replaceChildren();}
      showLogin();
    }
  } finally {
    state.busy = false;
    document.body.classList.remove("working");
    $("#app").inert = false;
  }
}
document.addEventListener("academy-reader-error",event=>{
  void act(async()=>{const error=new Error(event.detail.message);error.status=event.detail.status;throw error;});
});
document.addEventListener("academy-schedule-error",event=>{
  void act(async()=>{const error=new Error(event.detail.message);error.status=event.detail.status;throw error;});
});
function confirmAction(title, text, yes = "Continue") {
  $("#confirm-title").textContent = title;
  $("#confirm-text").textContent = text;
  $("#confirm-yes").textContent = yes;
  return new Promise((resolve) => {
    const dialog = $("#confirm");
    const end = (value) => {
      dialog.close();
      $("#confirm-yes").onclick = null;
      $("#confirm-no").onclick = null;
      dialog.oncancel = null;
      resolve(value);
    };
    $("#confirm-yes").onclick = () => end(true);
    $("#confirm-no").onclick = () => end(false);
    dialog.oncancel = (e) => {
      e.preventDefault();
      end(false);
    };
    dialog.showModal();
  });
}
async function leaveDraft() {
  if (!state.dirty) return true;
  const leave = await confirmAction(
    "Leave this draft?",
    "Your unsaved text will be discarded.",
    "Discard draft",
  );
  if (leave) {
    state.dirty = false;
    state.compose = null;
  }
  return leave;
}
const api = (path, options) => desktopApi.request(path, options);
const post = (path, body, key) =>
  api(path, { method: "POST", body, ...(key ? { key } : {}) });
const manage = () => state.account?.role !== "student";
const owned = (item) =>
  state.account.role === "admin" || item.owner_id === state.account.id;
const canEditSubject = (subject = state.active) =>
  Boolean(subject ? (subject.can_edit ?? manage()) : manage());
const canDeleteSubject = (subject = state.active) =>
  Boolean(subject && (subject.can_delete ?? (manage() && owned(subject))));
const canEditItem = (item) =>
  Boolean(item && (item.can_edit ?? (canEditSubject() && owned(item))));
const navLabel = () =>
  ({
    subject: "My subjects",
    subjects: "My subjects",
    tasks: "Tasks",
    results: "My results",
    learners: "Students & progress",
    eligibility: "Enrollment",
    access: "Subject access",
    accounts: "Accounts",
    announcements: "Announcements",
    settings: "Settings",
    help: "Help",
    discover: "Find a subject",
    learner: "Student work",
  })[state.view] || "My subjects";
function nav(label, action, glyph, active = false, extra = "") {
  return `<button class="nav-btn ${active ? "active" : ""}" data-action="${action}" ${extra}>${icon(glyph)}${label}</button>`;
}
const canManageFolders = () =>
  state.account?.role === "admin" && Boolean(state.capabilities.subject_folders);
const folderChildren = (parentId = null) =>
  state.folders.filter((f) => (f.parent_id || null) === parentId);
const folderSubjects = (folderId = null) =>
  state.subjects.filter((s) => (s.folder_id || null) === folderId);
function folderDescendantsLocal(rootId) {
  const out = new Set();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    for (const f of state.folders) {
      if ((f.parent_id || null) === id && !out.has(f.id)) {
        out.add(f.id);
        stack.push(f.id);
      }
    }
  }
  return out;
}
function folderCount(folderId) {
  let total = folderSubjects(folderId).length;
  for (const child of folderChildren(folderId)) total += folderCount(child.id);
  return total;
}
function folderPathName(folderId) {
  if (!folderId) return "";
  const byId = new Map(state.folders.map((f) => [f.id, f]));
  const names = [];
  let cur = folderId,
    guard = 0;
  while (cur && byId.has(cur) && guard++ < 10) {
    names.unshift(byId.get(cur).name);
    cur = byId.get(cur).parent_id;
  }
  return names.join(" / ");
}
function renderSubjectNavBtn(s, adminFolders) {
  const selected = state.active?.id === s.id && state.view === "subject";
  const dragAttrs = adminFolders
    ? `draggable="true" data-drag-subject="${escape(s.id)}" title="${escape(s.title)} — drag into a folder"`
    : `title="${escape(s.title)}"`;
  return `<button class="nav-btn subject-nav ${selected ? "selected" : ""}" data-action="subject" data-id="${escape(s.id)}" ${dragAttrs}><span>${escape(s.title)}</span></button>`;
}
function renderFolderForm() {
  const f = state.folderForm;
  if (!f || !canManageFolders()) return "";
  const isRename = f.mode === "rename";
  const parentOptions = !isRename
    ? `<label class="small muted">Parent folder<select name="parent_id"><option value="">Top level</option>${state.folders
        .map(
          (folder) =>
            `<option value="${escape(folder.id)}" ${(f.parentId || "") === folder.id ? "selected" : ""}>${escape(folderPathName(folder.id))}</option>`,
        )
        .join("")}</select></label>`
    : "";
  return `<form id="folder-form" class="nav-folder-form" data-mode="${escape(f.mode)}" data-id="${escape(f.id || "")}"><label class="small muted">${isRename ? "Rename folder" : "New folder"}<input name="name" maxlength="80" required placeholder="e.g. Core Subjects" value="${escape(f.name || "")}"></label>${parentOptions}<div class="nav-folder-form-actions">${button("Cancel", "cancel-folder", "", "quiet")}<button class="primary" type="submit">${isRename ? "Save" : "Create"}</button></div></form>`;
}
function renderFolderNode(folder, depth, adminFolders) {
  const open = !state.collapsedFolders.has(folder.id);
  const children = folderChildren(folder.id);
  const subjects = folderSubjects(folder.id);
  const count = folderCount(folder.id);
  const dragAttrs = adminFolders
    ? `draggable="true" data-drag-folder="${escape(folder.id)}" tabindex="0"`
    : "";
  return `<div class="nav-folder" data-folder-node="${escape(folder.id)}" data-parent-id="${escape(folder.parent_id || "")}" data-depth="${depth}"><div class="nav-folder-row" data-folder-drop="${escape(folder.id)}" ${dragAttrs}><button type="button" class="nav-folder-toggle ${open ? "open" : ""}" data-action="toggle-folder" data-id="${escape(folder.id)}" aria-expanded="${open}" aria-label="${open ? "Collapse" : "Expand"} ${escape(folder.name)}">${icon("chevron")}</button><span class="nav-folder-icon">${icon("folder")}</span><span class="nav-folder-name" title="${escape(folder.name)}">${escape(folder.name)}</span><span class="nav-folder-count">${count}</span>${
    adminFolders
      ? `<span class="nav-folder-actions"><button type="button" class="nav-mini-btn" data-action="rename-folder" data-id="${escape(folder.id)}" title="Rename folder" aria-label="Rename ${escape(folder.name)}">${icon("edit")}</button><button type="button" class="nav-mini-btn danger" data-action="delete-folder" data-id="${escape(folder.id)}" title="Delete folder" aria-label="Delete ${escape(folder.name)}">×</button></span>`
      : ""
  }</div><div class="nav-folder-children" ${open ? "" : "hidden"}>${children.map((c) => renderFolderNode(c, depth + 1, adminFolders)).join("")}${subjects.map((s) => renderSubjectNavBtn(s, adminFolders)).join("")}${adminFolders && !children.length && !subjects.length ? `<div class="nav-folder-empty" data-folder-drop="${escape(folder.id)}">Drop subject or folder here</div>` : ""}</div></div>`;
}
function renderSubjectNav() {
  const adminFolders = canManageFolders();
  const rootFolders = folderChildren(null);
  const visibleFolderIds = new Set(state.folders.map((f) => f.id));
  const rootSubjects = state.subjects.filter(
    (s) => !s.folder_id || !visibleFolderIds.has(s.folder_id),
  );
  const addBar = adminFolders
    ? `<div class="nav-folder-toolbar">${button(icon("folderPlus") + "New folder", "new-folder", 'aria-label="Create folder"', "quiet nav-folder-add")}</div>${renderFolderForm()}`
    : "";
  const tree = rootFolders.map((f) => renderFolderNode(f, 0, adminFolders)).join("");
  const rootList = `<div class="nav-root-zone" data-folder-drop="root">${rootSubjects.map((s) => renderSubjectNavBtn(s, adminFolders)).join("")}${adminFolders && state.folders.length ? '<div class="nav-root-hint" data-folder-drop="root">Drop here for top level</div>' : ""}</div>`;
  return addBar + tree + rootList;
}
function syncSubjectNav() {
  const host = $("#subject-nav");
  if (host) host.innerHTML = renderSubjectNav();
}
function shell() {
  const a = state.account;
  const pendingPassword = Boolean(a.must_change_password);
  const roleLabel = a.role === "student" ? "Student · Reader" : a.role;
  $("#app").innerHTML =
    `<aside class="sidebar"><div class="brand"><span class="brand-mark">A</span><span>AERONAUTICAL<br>ACADEMY REPOSITORY</span></div>${
      pendingPassword
        ? `<details open><summary>SECURITY</summary>${nav("Settings", "settings", "settings", true)}</details>`
        : `<details open><summary>WORKSPACE</summary>${nav("My subjects", "subjects", "book", ["subject", "subjects"].includes(state.view), canManageFolders() ? 'data-folder-drop="root"' : "")}<div id="subject-nav">${renderSubjectNav()}</div>${nav("Tasks", "tasks", "tasks", state.view === "tasks")}${!manage() ? nav("My results", "results", "chart", state.view === "results") + nav("Find a subject", "discover", "search", state.view === "discover") : ""}</details>${manage() ? `<details open><summary>TEACHING</summary>${nav("Students & progress", "learners", "users", ["learners", "learner"].includes(state.view))}${nav("Enrollment", "eligibility", "check", state.view === "eligibility")}</details>` : ""}${a.role === "admin" ? `<details open><summary>ADMINISTRATION</summary>${nav("Subject access", "access", "check", state.view === "access")}${nav("Accounts", "accounts", "users", state.view === "accounts")}${nav("Announcements", "announcements", "bell", state.view === "announcements")}</details>` : ""}<details ${["settings", "help"].includes(state.view) ? "open" : ""}><summary>MORE</summary>${nav("Settings", "settings", "settings", state.view === "settings")}${nav("Help", "help", "help", state.view === "help")}</details>`
    }<div class="sidebar-foot"><p class="workspace-label"><span class="dot"></span>${state.mode === "local" ? "LOCAL TEST WORKSPACE" : "ORGANIZATION WORKSPACE"}</p><p class="small muted">Aeronautical Academy Repository · ${escape(state.version)}</p></div></aside><header class="topbar"><div class="breadcrumbs">Repository <span aria-hidden="true"> / </span><strong>${escape(navLabel())}</strong></div><div class="row"><span class="top-date">${new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span><div class="account"><span class="avatar">${escape(
      a.name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join(""),
    )}</span><div><div class="account-name">${escape(a.name)}</div><div class="account-role">${escape(roleLabel)}</div></div></div>${pendingPassword ? "" : button(icon("sync") + "Sync", "sync", 'title="Refresh shared materials, results and progress"', "quiet")}${button(icon("logout"), "logout", 'title="Sign out" aria-label="Sign out"', "quiet")}</div></header><div class="center-pane"><div id="subject-context" class="subject-context" hidden></div><main class="center" id="center" aria-label="Learning workspace"></main></div><aside class="rightbar" id="rightbar" aria-label="Announcements and tasks"></aside>`;
  if (!pendingPassword && a.role !== "admin")
    $(".sidebar details").insertAdjacentHTML(
      "beforeend",
      nav("Announcements", "announcements", "bell", state.view === "announcements"),
    );
  $("#app").hidden = false;
  renderRight();
}
async function refreshData() {
  const me=await api("/v1/me");
  state.account=me.account;state.capabilities=me.capabilities||{};
  const [subjects, announcements] = await Promise.all([
    api("/v1/subjects"),
    api("/v1/announcements"),
  ]);
  state.subjects = subjects.subjects;
  state.folders = Array.isArray(subjects.folders) ? subjects.folders : [];
  state.announcements = announcements.announcements;
}
async function loadSubject(id) {
  const sequence = ++loadSequence;
  const data = await api(`/v1/subjects/${id}`);
  if (sequence !== loadSequence) return;
  state.active = data.subject;
  state.items = data.items;
  state.treeSupported = data.tree_version >= 1;
  state.quizSupported = data.quiz_version >= 1;
  state.maxQuestions=state.quizSupported?(state.capabilities.max_quiz_questions||50):state.capabilities.choice_forms?20:1;
  state.formsSupported = data.choice_forms === true || state.capabilities.choice_forms === true;
  state.summary = data.summary || null;
  state.compose = null;
  state.dirty = false;
}
async function start() {
  state.collapsedMaterials.clear();
  state.collapsedEntries.clear();
  state.collapsedFolders.clear();
  state.folderForm = null;
  state.readyQuizzes.clear();
  await refreshData();
  state.items = [];
  state.summary = null;
  state.active = null;
  state.activeLearnerId = null;
  state.rosterOffset = 0;
  state.accountOffset = 0;
  state.discoverOffset = 0;
  state.view = "subject";
  state.search = "";
  state.compose = null;
  if (state.subjects.length) await loadSubject(state.subjects[0].id);
  else state.active = null;
  shell();
  renderSubject();
}
function utility() {
  const allMin = state.items.length > 0 && state.items.every((item) => state.collapsedEntries.has(item.id));
  return `<div class="utility"><span class="eyebrow">${manage() ? "TEACHING SPACE" : "LEARNING SPACE"}</span><div class="search-wrap">${icon("search")}<input id="search" type="search" aria-label="Search subject entries" placeholder="Search in this subject" value="${escape(state.search)}"></div>${state.items.length ? button(allMin ? "Expand all" : "Minimize all", "toggle-all-entries", `title="${allMin ? "Expand all subject entries" : "Minimize all subject entries"}"`, "quiet") : ""}${button("Refresh", "refresh", 'title="Reload this subject"', "quiet")}</div>`;
}
function header(title, subtitle, actions = "") {
  return `<div class="row between"><div><div class="eyebrow">YOUR WORKSPACE</div><h1>${escape(title)}</h1><p class="muted small">${escape(subtitle)}</p></div>${actions}</div>`;
}
function empty(title, description) {
  return `<div class="empty">${icon("book")}<h3>${escape(title)}</h3><p>${escape(description)}</p></div>`;
}
// UI — real paragraphs and hanging lists; escape every author-supplied character.
function readingText(value) {
  return String(value||"").split(/\r?\n/).filter(line=>line.trim()).map(line=>{
    const marker=line.match(/^(Q?\d+[.)]|[A-H][.)]|[-•])\s+(.*)$/);
    if(marker)return `<p class="reading-list"><span>${escape(marker[1])}</span><span>${escape(marker[2])}</span></p>`;
    const prefix=line.match(/^(Outcome O\d+|Worked(?: classroom)? example|Synthetic dataset|Practice):/i);
    const content=prefix?`<strong>${escape(prefix[0])}</strong>${escape(line.slice(prefix[0].length))}`:escape(line);
    return `<p>${content}</p>`;
  }).join("");
}
function datesCaption(item) {const text=window.academySchedule.caption(item);return text?`<p class="small deadline">${escape(text)}</p>`:"";}
function bodyParts(item) {
  const material = item.material || { text: item.body, links: [] };
  const spacing = ["compact", "normal", "relaxed", "loose"].includes(item.paragraph_spacing) ? item.paragraph_spacing : "normal";
  const richMarkup = item.body_html ? window.academyEditor?.renderSafeHtml(item.body_html, item.id) : "";
  const copyMarkup = richMarkup
    ? `<div class="reading-copy rich-copy" data-spacing="${escape(spacing)}">${richMarkup}</div>`
    : material.text
      ? `<div class="reading-copy" data-spacing="${escape(spacing)}">${readingText(material.text)}</div>`
      : "";
  return `${item.has_file ? button(icon("book") + "Read PDF", "read-pdf", `data-id="${escape(item.id)}"`, "pdf-trigger") : ""}${copyMarkup}<div class="material-links">${material.links.map(({url, label, host}) => button(`${icon("link")}<span><strong>${escape(label)}</strong><small>${escape(host)}</small></span>${icon("external")}`, "open-link", `data-id="${escape(item.id)}" data-url="${escape(url)}" title="Open ${escape(label)}: ${escape(url)}"`, "link resource-link")).join("")}</div>`;
}
const MAX_ENTRY_DEPTH = 4;
const siblingsOf = (item) => state.items.filter((other) => (other.parent_id || null) === (item.parent_id || null));
const childrenOf = (id) => state.items.filter((item) => item.parent_id === id);
const rootsOf = () => state.items.filter((item) => !item.parent_id);
const ancestorsOf = (item) => {
  const parents = [];
  for (let parent = state.items.find((entry) => entry.id === item?.parent_id); parent; parent = state.items.find((entry) => entry.id === parent.parent_id)) parents.push(parent);
  return parents;
};
const descendantsOf = (id) => childrenOf(id).flatMap((item) => [item, ...descendantsOf(item.id)]);
const entryDepth = (id) => {
  let depth = 0, cur = id;
  const seen = new Set();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const node = state.items.find((entry) => entry.id === cur);
    if (!node) break;
    depth++;
    cur = node.parent_id || null;
  }
  return depth;
};
const entrySubtreeHeight = (id) => {
  let max = 0;
  const stack = [[id, 0]];
  while (stack.length) {
    const [cur, d] = stack.pop();
    if (d > max) max = d;
    for (const child of childrenOf(cur)) stack.push([child.id, d + 1]);
  }
  return max;
};
const canNestEntryInside = (sourceId, targetMaterialId) => {
  const source = state.items.find((entry) => entry.id === sourceId);
  const target = state.items.find((entry) => entry.id === targetMaterialId);
  if (!source || !target || target.kind !== "material") return false;
  if (source.id === target.id) return false;
  if (descendantsOf(source.id).some((d) => d.id === target.id)) return false;
  return entryDepth(target.id) + 1 + entrySubtreeHeight(source.id) <= MAX_ENTRY_DEPTH;
};
const isVisibleEntry = (item) => [item, ...ancestorsOf(item)].every((entry) => entry.published && entry.publication_state !== "scheduled");
function flattenTree(roots, groups = new Map()) {
  return roots.flatMap((item) => [item.id, ...flattenTree(groups.get(item.id) || childrenOf(item.id), groups)]);
}
function applySubjectSearch() {
  const query = state.search.toLowerCase();
  const matches = (item) => (item.title + " " + item.body).toLowerCase().includes(query);
  let count = 0;
  for (const group of document.querySelectorAll("[data-group]")) {
    const item = state.items.find((entry) => entry.id === group.dataset.group);
    const visible = [item, ...ancestorsOf(item), ...descendantsOf(item.id)].some(matches);
    group.hidden = !visible;
    if (visible) count++;
  }
  syncMaterialSections();
  if ($("#search-empty")) $("#search-empty").hidden = count > 0 || !query;
}
// Collapse only changes the view, leaving student responses and editors intact.
function syncMaterialSections() {
  for (const bodyEl of document.querySelectorAll("[data-entry-body]")) {
    const id = bodyEl.dataset.entryBody;
    const card = document.querySelector(`[data-item="${id}"]`);
    const toggle = document.querySelector(`[data-action="toggle-entry"][data-id="${id}"]`);
    const editing = Boolean(document.querySelector(`[data-edit-slot="${id}"] #composer`));
    const expanded = !state.collapsedEntries.has(id) || Boolean(state.search) || editing;
    bodyEl.hidden = !expanded;
    card?.classList.toggle("is-minimized", !expanded);
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.setAttribute("aria-label", `${expanded ? "Minimize" : "Expand"} entry`);
      toggle.disabled = Boolean(state.search) || editing;
      toggle.title = editing ? "Finish or cancel editing before minimizing" : state.search ? "Clear search to minimize" : expanded ? "Minimize entry" : "Expand entry";
      toggle.textContent = expanded ? "Minimize" : "Expand";
    }
  }
  for (const region of document.querySelectorAll("[data-children]")) {
    const id = region.dataset.children;
    const toggle = document.querySelector(`[data-action="toggle-material"][data-id="${id}"]`);
    const editing = Boolean(region.querySelector("#composer")) || Boolean(document.querySelector(`[data-edit-slot="${id}"] #composer`));
    const expanded = !state.collapsedMaterials.has(id) || Boolean(state.search) || editing;
    region.hidden = !expanded;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-label", `${expanded ? "Minimize" : "Expand"} activities and quizzes`);
    toggle.disabled = Boolean(state.search) || editing;
    toggle.title = editing ? "Finish or cancel editing before minimizing" : state.search ? "Clear search to minimize" : expanded ? "Minimize section" : "Expand section";
  }
  const allBtn = document.querySelector('[data-action="toggle-all-entries"]');
  if (allBtn && state.items.length) {
    const allMin = state.items.every((item) => state.collapsedEntries.has(item.id));
    allBtn.textContent = allMin ? "Expand all" : "Minimize all";
    allBtn.title = allMin ? "Expand all subject entries" : "Minimize all subject entries";
  }
}
function treeMarkup(items = rootsOf(), prefix = "") {
  return items.map((item, index) => {
    const number = prefix ? `${prefix}.${index+1}` : String(index+1).padStart(2,"0");
    return `<section class="subject-group ${item.kind === "material" ? "material-group" : "assessment-group"}" data-group="${escape(item.id)}">${itemCard(item,index,number)}${item.kind === "material" ? `<div class="tree-children" id="children-${escape(item.id)}" data-children="${escape(item.id)}" role="region" aria-label="Contents for ${escape(item.title)}">${treeMarkup(childrenOf(item.id),number)}${canEditSubject() && state.treeSupported ? `<div class="composer-slot" data-add-parent="${escape(item.id)}"></div>` : ""}</div>` : ""}</section>`;
  }).join("");
}
function itemCard(item, index, number) {
  const editable = canEditItem(item);
  const selectable=item.kind==="quiz"||Array.isArray(item.questions);
  const kind =
    item.assessment_type === "examination"
      ? (selectable?"Examination":"Written examination")
      : item.kind === "quiz"
        ? "Quiz"
        : item.kind === "activity"
          ? (selectable?"Activity":"Written activity")
          : "Material";
  let student = "";
  if (!manage()) {
    if (item.kind === "material")
      student = `<div class="material-tools">${button(`${icon(item.completed ? "check" : "book")}${item.completed ? "Read · mark unread" : "Mark as read"}`, "complete", `data-id="${escape(item.id)}"`, item.completed ? "quiet" : "")}<span class="compose-hint">Self-reported reading</span></div>`;
    if (selectable) {
      const questions = item.questions || [{prompt:item.body,options:item.options}];
      const attempt=item.form_result?{score:item.form_result.correct,max_score:item.form_result.total}:item.attempt;
      const total = attempt?.max_score || questions.length;
      student = attempt
        ? `<div class="result"><strong>Done · ${attempt.score} / ${total} correct · ${Math.round(attempt.score*10000/total)/100}%</strong><span class="small">Assessment submitted</span></div><details class="quiz-review"><summary>Review</summary>${questions.map((q,i)=>`<div class="quiz-question"><h4>${i+1}. ${escape(q.prompt)}</h4>${q.options.map((o,j)=>`<p class="small">${item.form_result?.answers?.[i]===j?"Selected · ":""}${escape(o)}</p>`).join("")}</div>`).join("")}</details>`
        : `<div class="quiz-intro" ${state.readyQuizzes.has(item.id)?"hidden":""}><span class="tag">${total} ${total===1?"question":"questions"}</span><p class="small muted">One submission. One point for each correct answer.</p>${button(item.kind==="quiz"?"Take quiz":item.assessment_type==="examination"?"Take examination":"Take activity", "start-quiz", `data-id="${escape(item.id)}"`, "primary")}</div><details class="quiz-attempt" data-quiz="${escape(item.id)}" ${state.readyQuizzes.has(item.id)?"open":""} ${!state.readyQuizzes.has(item.id)?"hidden":""}><summary>Questions · minimize / expand</summary><form data-form="${item.kind==="quiz"&&(!item.questions||state.quizSupported)?"quiz":"answers"}" data-id="${escape(item.id)}" data-revision="${item.revision}">${questions.map((q,i)=>`<fieldset class="quiz-question"><legend>${i+1}. ${escape(q.prompt)}</legend>${q.options.map((option,j)=>`<label class="choice"><input type="radio" name="answer-${i}" value="${j}" required>${escape(option)}</label>`).join("")}</fieldset>`).join("")}<div class="form-actions"><button class="primary" type="submit">Submit answers</button></div></form></details>`;
    }
    if (item.kind === "activity"&&!selectable)
      student = item.submission
        ? `<div class="result">${item.submission.score == null ? "Submitted · awaiting assessment" : `Score ${item.submission.score} / 100`}${item.submission.feedback ? `<div class="reading-copy">${readingText(item.submission.feedback)}</div>` : ""}<details><summary>Your response</summary><div class="reading-copy">${readingText(item.submission.output)}</div></details></div>`
        : `<form data-form="submission" data-id="${escape(item.id)}"><label>Your response<textarea name="output" maxlength="12000" required rows="3" placeholder="Write your response here…"></textarea></label><div class="form-actions"><button class="primary" type="submit">Submit work</button></div></form>`;
  }
  const playable = manage() && item.kind !== "material";
  return `<article class="material" data-parent="${escape(item.parent_id || "")}" data-item="${escape(item.id)}"><div class="entry-rail"><div class="number">${escape(number)}</div>${editable ? button(icon("grip"), "reorder-handle", `draggable="true" data-drag="${escape(item.id)}" data-id="${escape(item.id)}" aria-label="Reorder or move ${escape(item.title)}" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight" title="Drag to reorder or nest across levels · keyboard: Alt+↑/↓/←/→"`, "quiet drag-handle") : ""}</div><div class="material-content"><div class="entry-topbar"><div class="material-type">${escape(kind)} ${manage() && item.parent_id && !isVisibleEntry(item) && item.published ? '<span class="tag gold">Hidden with material</span>' : ""} ${manage() ? `<span class="tag ${item.publication_state === "scheduled" ? "blue" : item.published ? "green" : "gold"}">${item.publication_state==="scheduled"?"Scheduled":item.published ? "Published" : "Draft"}</span>` : item.completed ? '<span class="tag green">Complete</span>' : ""}</div>${editable || playable ? `<div class="entry-actions" role="group" aria-label="Entry actions">${playable ? button(icon("play") + "Play", "play-item", `data-id="${escape(item.id)}" title="Play full screen for class"`, "quiet play-btn") : ""}${editable && item.kind==="material"&&item.material_mode==="file"&&state.capabilities.material_upload?button(item.has_file?"Replace PDF":"Upload PDF","upload-pdf",`data-id="${escape(item.id)}"`,"quiet"):""}${editable && state.capabilities.scheduling==="dates-v1"?button("Schedule", "schedule", `data-id="${escape(item.id)}"`, "quiet"):""}${editable ? button(icon("edit") + "Edit", "edit", `data-id="${escape(item.id)}"`, "quiet") : ""}${editable ? button(item.published ? "Unpublish" : "Publish", "publish", `data-id="${escape(item.id)}"`, "quiet") : ""}${editable ? button("Delete", "delete", `data-id="${escape(item.id)}"`, "quiet danger") : ""}</div>` : ""}</div><div class="entry-heading"><h3>${escape(item.title)}</h3><div class="entry-heading-tools">${item.kind === "material" ? button(`${icon("chevron")}<span>${childrenOf(item.id).length}</span>`, "toggle-material", `data-id="${escape(item.id)}" aria-controls="children-${escape(item.id)}" aria-expanded="true" aria-label="Minimize activities and quizzes"`, "quiet material-toggle") : ""}${button("Minimize", "toggle-entry", `data-id="${escape(item.id)}" aria-expanded="true" aria-controls="entry-body-${escape(item.id)}"`, "quiet entry-min-btn")}</div></div><div class="entry-body" id="entry-body-${escape(item.id)}" data-entry-body="${escape(item.id)}">${datesCaption(item)}${!manage()&&item.kind==="material"?`<details class="reading-entry"><summary>Read</summary>${bodyParts(item)}${student}</details>`:`${!manage()&&selectable?"":bodyParts(item)}${student}`}${manage() && selectable ? quizPreview(item) : ""}</div></div></article>${editable ? `<div class="entry-editor" data-edit-slot="${escape(item.id)}"></div>` : ""}`;
}
function renderSubject() {
  const center = $("#center");
  const context = $("#subject-context");
  if (!state.active) {
    context.hidden = true;
    context.innerHTML = "";
    center.innerHTML =
      header(
        "My subjects",
        "Your teaching and learning start here.",
        manage() ? button("+ New subject", "new-subject", "", "primary") : "",
      ) +
      empty(
        "No subjects yet",
        manage()
          ? "Create your first subject or ask an administrator for subject access."
          : "Choose Find a subject to enroll.",
      );
    renderRight();
    return;
  }
  const s = state.active;
  const editableSubject = canEditSubject(s);
  const readOnlyInstructor = manage() && !editableSubject;
  const materials = state.items.filter((i) => i.kind === "material").length;
  const assessments = state.items.filter((i) => i.kind !== "material" && i.assessment_type !== "examination").length;
  const examinations = state.items.filter((i) => i.assessment_type === "examination").length;
  context.hidden = false;
  context.innerHTML = `<section class="subject-hero"><div class="row between"><h1>${escape(s.title)}</h1>${editableSubject ? button(icon("edit") + "Edit", "edit-subject", 'aria-label="Edit subject"', "quiet") : readOnlyInstructor ? '<span class="tag blue">Read-only access</span>' : ""}</div>${!manage() ? `<div class="subject-progress"><progress max="100" value="${state.summary?.completion_percent || 0}" aria-label="Subject completion"></progress><span>${state.summary?.completion_percent || 0}% complete</span></div>` : `<span class="subject-meta">${materials} materials · ${assessments} activities & quizzes · ${examinations} examinations${readOnlyInstructor ? " · View only (editing and downloads disabled)" : ""}</span>`}</section>`;
  center.innerHTML =
    utility() +
    `<details class="subject-details"><summary>About this subject</summary><div class="reading-copy">${readingText(s.description)}</div></details><div class="section-heading"><h2>${manage() ? "Subject content" : "Your learning materials"}</h2><span>${editableSubject ? "Create. Arrange across levels. Share." : readOnlyInstructor ? "Read-only instructor view." : "One step at a time."}</span></div><div id="entries">${state.items.length ? treeMarkup() : empty("A fresh start", editableSubject ? "Add a material or an examination to begin." : readOnlyInstructor ? "No entries have been added to this subject yet." : "Your instructor has not published any content yet.")}</div><div id="search-empty" hidden>${empty("No matching entries", "Try another search.")}</div>${editableSubject ? `<div class="composer-slot root-add-slot" data-add-parent=""></div>${!state.treeSupported ? '<p class="small muted">Update your organization backend to enable activities and quizzes inside materials.</p>' : ""}` : ""}`;
  if (editableSubject) renderComposer();
  applySubjectSearch();
  window.academyEditor?.hydrateImages(center, desktopApi.readImage, { subjectId: s.id });
  renderRight();
}
function linkField(url = "") {
  return `<div class="link-field"><label>Material link<input name="link" type="url" value="${escape(url)}" maxlength="2048" placeholder="Paste a sharing link · https://…" required></label>${button("Remove", "remove-link", 'aria-label="Remove attached link"', "quiet")}<p class="link-feedback small muted" aria-live="polite"></p></div>`;
}
async function inspectLinkField(input) {
  const value = input.value;
  const feedback = input.closest(".link-field").querySelector(".link-feedback");
  if (!value.trim()) { feedback.textContent = ""; return; }
  try {
    const link = await desktopApi.inspectLink(value.trim());
    if (input.isConnected && input.value === value) {
      feedback.textContent = `${link.label} · ${link.host} · opens in browser`;
      feedback.classList.remove("error");
    }
  } catch (error) {
    if (input.isConnected && input.value === value) {
      feedback.textContent = error.message;
      feedback.classList.add("error");
    }
  }
}
function renderComposer() {
  const position = capturePosition();
  document.querySelectorAll(".entry-editor").forEach((slot) => { slot.innerHTML = ""; });
  document.querySelectorAll("[data-add-parent]").forEach((slot) => {
    const parent = slot.dataset.addParent;
    slot.innerHTML = button(icon("plus") + (parent ? " Add activity or quiz" : " Add material or examination"), "add", `data-parent="${escape(parent)}" aria-label="${parent ? "Add activity or quiz to this material" : "Add material or examination to this subject"}"`, "add-line");
  });
  if (!state.compose) { syncMaterialSections(); restorePosition(position); return; }
  const item = state.compose.item;
  const parentId = item?.parent_id || state.compose.parentId || "";
  const parent = state.items.find((entry) => entry.id === parentId);
  const slot = item ? document.querySelector(`[data-edit-slot="${item.id}"]`) : document.querySelector(`[data-add-parent="${parentId}"]`);
  if (!slot) return;
  const kind = item ? (item.assessment_type === "examination" ? "examination" : item.kind) : state.compose.kind || (parentId ? "activity" : "material");
  const choices = parentId ? [["activity", "Activity"], ["quiz", "Quiz"]] : [["material", "Material / links"], ["examination", "Examination"]];
  const validParents = item && state.treeSupported
    ? state.items.filter((entry) => entry.kind === "material" && canNestEntryInside(item.id, entry.id) && (owned(entry) || entry.id === item.parent_id))
    : [];
  const parentChoices = item && state.treeSupported ? `<label>Level / parent material<select name="parent_id" aria-label="Parent material"><option value="" ${!item.parent_id ? "selected" : ""}>Top level (subject root)</option>${validParents.map((entry) => { const d = entryDepth(entry.id) - 1; return `<option value="${escape(entry.id)}" ${entry.id === item.parent_id ? "selected" : ""}>${escape((d > 0 ? "↳ ".repeat(d) : "") + entry.title)}</option>`; }).join("")}</select></label>` : "";
  let initialTitle = item?.title || "";
  let text = item?.body || "";
  const links = [];
  if (item) {
    const lines = text.split("\n");
    if (kind === "material") {
      while (/^https?:\/\/\S+$/.test(lines.at(-1))) links.unshift(lines.pop());
    }
    if (lines[0]?.trim() === item.title.trim()) lines.shift();
    text = lines.join("\n").trim();
  }
  const spacing = state.compose.paragraphSpacing || item?.paragraph_spacing || "normal";
  const initialRichHtml = item?.body_html
    ? window.academyEditor.sanitizeHtmlFragment(item.body_html, { keepEditorControls: true })
    : text
      ? window.academyEditor.plainTextToHtml(text)
      : "";
  if (item) {
    state.compose.initialTitle = initialTitle;
    state.compose.initialText = text;
    state.compose.initialRichHtml = item.body_html || null;
    state.compose.initialSpacing = item.paragraph_spacing || "normal";
    state.compose.initialLinks = [...links];
  }
  const imageCapable = state.capabilities.entry_images === "v1";
  slot.innerHTML = `<form id="composer" class="composer"><div class="type-row"><div><h3 class="compose-title">${item ? "Edit entry" : parent ? "Add to this material" : "Add to your subject"}</h3><span class="compose-hint">${parent ? escape(parent.title) : "Materials and examinations start at top level. Drag any entry across levels anytime."}</span></div>${item ? `<span class="tag">${escape(kind)}</span>` : `<select name="kind" id="entry-kind" aria-label="Entry type">${choices.map(([value,label]) => `<option value="${value}" ${value === kind ? "selected" : ""}>${label}</option>`).join("")}</select>`}</div>${parentChoices}<label>Title<input name="title" maxlength="160" value="${escape(initialTitle)}" placeholder="e.g. Lesson 01 — The principles of flight"></label><div class="editor-field"><div class="editor-label-row"><span>Content <span class="muted">· paste formatted text or screenshot snips (Ctrl+V)</span></span><label class="spacing-control">Spacing<select name="paragraph_spacing" id="paragraph-spacing" aria-label="Paragraph spacing"><option value="compact" ${spacing === "compact" ? "selected" : ""}>Compact</option><option value="normal" ${spacing === "normal" ? "selected" : ""}>Normal</option><option value="relaxed" ${spacing === "relaxed" ? "selected" : ""}>Relaxed</option><option value="loose" ${spacing === "loose" ? "selected" : ""}>Loose</option></select></label></div><div class="editor-toolbar" role="toolbar" aria-label="Content formatting"><select data-editor-block aria-label="Paragraph style"><option value="p">Normal</option><option value="h2">Heading</option><option value="h3">Subheading</option><option value="blockquote">Quote</option></select><button type="button" class="quiet tool-btn" data-action="editor-cmd" data-cmd="bold" title="Bold (Ctrl+B)" aria-label="Bold"><strong>B</strong></button><button type="button" class="quiet tool-btn" data-action="editor-cmd" data-cmd="italic" title="Italic (Ctrl+I)" aria-label="Italic"><em>I</em></button><button type="button" class="quiet tool-btn" data-action="editor-cmd" data-cmd="underline" title="Underline (Ctrl+U)" aria-label="Underline"><u>U</u></button><span class="tool-sep" aria-hidden="true"></span><button type="button" class="quiet tool-btn" data-action="editor-cmd" data-cmd="insertUnorderedList" title="Bulleted list" aria-label="Bulleted list">• List</button><button type="button" class="quiet tool-btn" data-action="editor-cmd" data-cmd="insertOrderedList" title="Numbered list" aria-label="Numbered list">1. List</button><span class="tool-sep" aria-hidden="true"></span><button type="button" class="quiet tool-btn" data-action="editor-cmd" data-cmd="outdent" title="Decrease indent (Shift+Tab)" aria-label="Decrease indent">← Indent</button><button type="button" class="quiet tool-btn" data-action="editor-cmd" data-cmd="indent" title="Increase indent (Tab)" aria-label="Increase indent">Indent →</button>${imageCapable ? `<span class="tool-sep" aria-hidden="true"></span>${button(icon("image") + "Image", "insert-image", 'title="Insert image file or paste snip with Ctrl+V"', "quiet tool-btn")}` : ""}</div><div id="rich-editor" class="rich-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Entry content" data-spacing="${escape(spacing)}" data-placeholder="Write instructions, paste formatted notes from Word/Docs, or press Ctrl+V to paste a screenshot snip…">${initialRichHtml}</div><p class="compose-hint">Tab / Shift+Tab indents paragraphs · pasted formatting is adopted and sanitized automatically.</p></div>${kind === "material" ? `${!item&&state.capabilities.material_upload?'<label>Format<select name="format"><option value="text">Text, images and links</option><option value="file">PDF upload · save draft first</option></select></label>':""}<div class="attach-row">${button(icon("link") + " Attach link", "attach", "", "quiet")}<span class="compose-hint">Drive, Docs, Sheets, Slides, YouTube or web references</span></div><div id="link-fields">${links.map(linkField).join("")}</div><p class="compose-hint">Links open in your browser. Give students access at the original host.</p>` : ""}${!item&&["activity","examination"].includes(kind)&&state.formsSupported?`<label>Response type<select id="response-mode"><option value="written" ${state.compose.responseMode!=="choice"?"selected":""}>Written response</option><option value="choice" ${state.compose.responseMode==="choice"?"selected":""}>Selection form · automatic result</option></select></label>`:""}${!item&&(kind === "quiz"||(["activity","examination"].includes(kind)&&state.compose.responseMode==="choice")) ? '<div id="quiz-builder"></div>' : ""}<div class="form-actions"><label class="choice"><input type="checkbox" name="published" ${item?.published === false ? "" : "checked"}>Publish to students</label><span class="push"></span>${button("Cancel", "cancel-compose", "", "quiet")}<button type="submit" class="primary">${icon("check")} Done</button></div><p id="compose-error" class="error small" role="alert"></p></form>`;
  const editorEl = $("#rich-editor");
  if (editorEl && window.academyEditor) {
    window.academyEditor.wireEditor(editorEl, {
      getSubjectId: () => state.active?.id,
      uploadImage: (subjectId, base64) => desktopApi.uploadImage(subjectId, base64),
      onChange: () => { state.dirty = true; },
      onError: (err) => {
        toast(err.message || "Could not paste image.", "error");
        if ($("#compose-error")) $("#compose-error").textContent = err.message || "Could not paste image.";
      },
    });
    window.academyEditor.hydrateImages(editorEl, desktopApi.readImage, { subjectId: state.active?.id || "" });
  }
  slot.querySelectorAll("input[name=link]").forEach(inspectLinkField);
  renderQuizBuilder();
  syncMaterialSections();
  restorePosition(position);
}
function blankQuestion() { return {prompt:"",options:["",""],correct_index:null,open:true}; }
function captureQuizDraft() {
  if (!$("#quiz-builder") || !state.compose) return;
  state.compose.questions = [...document.querySelectorAll("[data-question-editor]")].map((card) => ({
    prompt:card.querySelector("[data-question-prompt]").value,
    options:[...card.querySelectorAll("[data-question-option]")].map(el=>el.value),
    correct_index:card.querySelector('input[type=radio]:checked') ? Number(card.querySelector('input[type=radio]:checked').value) : null,
    open:card.open,
  }));
}
function renderQuizBuilder() {
  const host = $("#quiz-builder");
  if (!host) return;
  state.compose.questions ||= [blankQuestion()];
  const questions = state.compose.questions;
  host.innerHTML = `<div class="quiz-count-row"><label>Number of questions<input id="quiz-count" type="number" min="1" max="${state.compose?.kind!=="quiz"&&state.compose?.responseMode==="choice"?20:state.maxQuestions||1}" value="${questions.length}" aria-label="Number of quiz questions"></label>${button("Apply", "quiz-count", "", "quiet")}</div>${!state.quizSupported&&!state.formsSupported?'<p class="small muted">Update your organization server to create multiple-question quizzes.</p>':""}<p class="small muted">Click the circle beside the correct answer. One point per question. Editing choices clears that question’s key.</p>${questions.map((q,i)=>`<details class="question-editor" data-question-editor="${i}" ${q.open===false?"":"open"}><summary>Question ${i+1}</summary><label>Question text<textarea data-question-prompt rows="2" maxlength="1000">${escape(q.prompt)}</textarea></label><fieldset class="answer-picker"><legend>Choices · select the correct answer</legend>${q.options.map((option,j)=>`<div class="quiz-option-row"><input type="radio" name="key-${i}" value="${j}" aria-label="Question ${i+1} correct answer ${j+1}" ${q.correct_index===j?"checked":""}><input data-question-option="${j}" maxlength="300" value="${escape(option)}" aria-label="Question ${i+1} option ${j+1}" placeholder="Option ${j+1}">${q.options.length>2?button("×", "remove-quiz-choice", `data-question="${i}" data-option="${j}" aria-label="Remove question ${i+1} option ${j+1}"`, "quiet"):""}</div>`).join("")}${q.options.length<6?button("+ Add option", "add-quiz-choice", `data-question="${i}"`, "quiet"):""}</fieldset></details>`).join("")}`;
}
function quizPreview(item) {
  const questions = item.questions || [{prompt:item.body,options:item.options,correct_index:item.correct_index}];
  const label = item.kind === "quiz" ? "quiz" : item.assessment_type === "examination" ? "examination" : "activity";
  const note = canEditItem(item)
    ? `Create a new ${label} to change questions or answer keys.`
    : "Read-only preview. Answer keys and editing require editor or administrator access.";
  return `<details class="quiz-review"><summary>${questions.length} ${questions.length===1?"question":"questions"} · preview</summary>${questions.map((q,i)=>`<div class="quiz-question"><h4>${i+1}. ${escape(q.prompt)}</h4>${q.options.map((o,j)=>`<p class="small">${j===q.correct_index?"✓ ":""}${escape(o)}</p>`).join("")}</div>`).join("")}<p class="small muted">${note}</p></details>`;
}
function renderRight() {
  if (state.account?.must_change_password) {
    $("#rightbar").innerHTML =
      `<section class="progress-box"><div class="eyebrow">ACCOUNT SECURITY</div><p>New and reset accounts must set a private 15–128 character passphrase before opening subjects.</p></section>`;
    return;
  }
  const notices = state.announcements.slice(0, 3);
  const editableSubject = canEditSubject();
  const tasks = state.items.filter((i) =>
    manage() ? (editableSubject && !i.published) : !i.completed && i.kind !== "material",
  );
  $("#rightbar").innerHTML =
    `<section><div class="section-heading"><h2>Announcements</h2>${state.account.role === "admin" ? button(icon("plus"), "announcements", 'aria-label="Manage announcements"', "quiet") : icon("bell")}</div>${notices.length ? notices.map((n) => `<article class="notice"><div class="small">${new Date(n.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div><h3>${escape(n.title)}</h3><div class="reading-copy">${readingText(n.body)}</div></article>`).join("") : '<p class="small-info">You’re up to date. Announcements will appear here.</p>'}${state.announcements.length > 3 ? button("View all", "announcements", "", "quiet") : ""}</section><div class="separator"></div><section><div class="section-heading"><h2>${manage() ? "Teaching tasks" : "Your tasks"}</h2><span class="tag">${tasks.length}</span></div><p class="small-info">${state.active ? escape(state.active.title) : "Choose a subject"}</p>${
      tasks
        .slice(0, 5)
        .map(
          (t) =>
            `<button class="task-row" data-action="task-item" data-id="${escape(t.id)}"><span class="task-icon">${icon(manage() ? "edit" : "tasks")}</span><span><strong>${escape(t.title)}</strong><small>${manage() ? "Draft · finish and publish" : t.kind === "quiz" ? "Quiz · not submitted" : t.questions ? "Selection form · not submitted" : "Written work · not submitted"}</small></span></button>`,
        )
        .join("") ||
      `<p class="small-info">${manage() && state.active && !editableSubject ? "Read-only access on this subject." : "No pending tasks in this subject."}</p>`
    }${manage() && state.active ? `<button class="task-row" data-action="learners"><span class="task-icon">${icon("users")}</span><span><strong>Review student progress</strong><small>${editableSubject ? "Read, submitted and graded work" : "Read-only progress view"}</small></span></button>` : ""}</section><div class="separator"></div><section class="progress-box"><div class="eyebrow">${manage() ? "AT A GLANCE" : "YOUR PROGRESS"}</div><div class="row between"><span class="big">${manage() ? state.items.filter(isVisibleEntry).length : (state.summary?.completion_percent || 0) + "%"}</span><span class="tag">${manage() ? "published entries" : "completed"}</span></div>${!manage() ? `<div class="progress-track"><progress max="100" value="${state.summary?.completion_percent || 0}" aria-label="Subject completion"></progress></div>` : ""}<p>${manage() ? "Knowledge grows, one lesson at a time." : "Reading is self-reported; completion is separate from grades."}</p></section>`;
}
async function navigate(view, id) {
  if (state.account?.must_change_password && view !== "settings") return;
  if (!(await leaveDraft())) return;
  state.compose = null;
  state.search = "";
  state.view = view;
  if (view === "subject")
    {
      const selected = id || state.active?.id || state.subjects[0]?.id;
      if (selected) await loadSubject(selected);
    }
  shell();
  if (view === "subject") return renderSubject();
  const center = $("#center");
  if (view === "subjects")
    center.innerHTML =
      header(
        "My subjects",
        manage()
          ? "A clear home for everything you teach."
          : "Make room for something new.",
        manage() ? button("+ New subject", "new-subject", "", "primary") : "",
      ) +
      `<div class="course-grid">${state.subjects.map((s) => { const fp = folderPathName(s.folder_id); return `<button class="course-card" data-action="subject" data-id="${escape(s.id)}"><div class="row"><span class="tag ${s.access_level === "read_only" ? "blue" : ""}">${!manage() ? "READER · ENROLLED" : s.access_level === "read_only" ? "READ ONLY" : s.access_level === "editor" ? "EDITOR" : "SUBJECT"}</span>${fp ? `<span class="tag">${escape(fp)}</span>` : ""}</div><h3>${escape(s.title)}</h3><p>${escape(s.description)}</p>${!manage() ? `<progress value="${s.summary.completion_percent}" max="100"></progress><span class="small muted">${s.summary.completion_percent}% complete</span>` : icon("arrow")}</button>`; }).join("")}</div>` +
      (state.subjects.length
        ? ""
        : empty("No subjects yet", "Create or enroll in a subject to begin."));
  if (view === "tasks" || view === "results") await renderAllWork(view);
  if (view === "learners") await renderLearners();
  if (view === "learner") {
    if (state.active && state.activeLearnerId) await renderLearner(state.activeLearnerId);
    else {
      state.view = "learners";
      shell();
      await renderLearners();
    }
  }
  if (view === "eligibility") await renderEligibility();
  if (view === "access") await renderAccess();
  if (view === "accounts") await renderAccounts();
  if (view === "announcements") renderAnnouncements();
  if (view === "discover") await renderDiscover();
  if (view === "settings") renderSettings();
  if (view === "help") renderHelp();
}
function chooseSubject() {
  return `<label>Subject<select id="context-subject">${state.subjects.map((s) => `<option value="${escape(s.id)}" ${state.active?.id === s.id ? "selected" : ""}>${escape(s.title)}</option>`).join("")}</select></label>`;
}
async function renderAllWork(view) {
  state.allItems = [];
  // Sequential bounded reads avoid overwhelming a school backend.
  for (const subject of state.subjects) {
    const d = await api(`/v1/subjects/${subject.id}`);
    state.allItems.push(...d.items.map((item) => ({ ...item, subject })));
  }
  const items =
    view === "tasks"
      ? state.allItems.filter((i) => (manage() ? !i.published && canEditSubject(i.subject) : !i.completed))
      : state.allItems.filter((i) => i.completed);
  $("#center").innerHTML =
    header(
      view === "tasks" ? "Tasks" : "My results",
      view === "tasks"
        ? "Everything waiting for your attention, across your subjects."
        : "Reading, submissions and scores, kept separate.",
    ) +
    items
      .map(
        (item) =>
          `<article class="material"><div class="material-content"><span class="small muted">${escape(item.subject.title)}</span><h3>${escape(item.title)}</h3>${datesCaption(item)}<p>${item.kind === "material" ? "Reading · self-reported" : item.form_result ? `Result: ${item.form_result.correct} / ${item.form_result.total} correct · ${item.form_result.score}%` : item.attempt ? `Quiz score: ${item.attempt.score} / ${item.attempt.max_score || item.question_count || 1}` : item.submission?.score != null ? `Written score: ${item.submission.score} / 100` : item.submission ? "Submitted · awaiting assessment" : manage() ? "Draft · unpublished" : "Not submitted"}</p>${button("Open subject " + icon("arrow"), "subject", `data-id="${escape(item.subject.id)}"`, "quiet")}</div></article>`,
      )
      .join("") +
    (items.length
      ? ""
      : empty(
          "All clear",
          view === "tasks"
            ? "There are no pending tasks."
            : "Completed items will appear here.",
        ));
}
async function renderLearners() {
  if (!state.active) {
    $("#center").innerHTML = empty(
      "Choose a subject first",
      "Create a subject to see student progress.",
    );
    return;
  }
  const d = await api(
    `/v1/subjects/${state.active.id}/learners?offset=${state.rosterOffset}`,
  );
  const editableSubject = canEditSubject();
  $("#center").innerHTML =
    header(
      "Students & progress",
      editableSubject
        ? "A clear view of participation and assessment."
        : "Read-only view of participation and assessment. Grading and exports require editor access.",
    ) +
    chooseSubject() +
    `<div class="section-heading"><span>${d.total} enrolled students · showing ${d.learners.length}</span>${editableSubject ? button("Export Excel", "export", "", "quiet") : '<span class="tag blue">Read-only access</span>'}</div><div class="table-scroll"><table class="data-table"><thead><tr><th>Student</th><th>Read</th><th>Submitted</th><th>Graded</th><th></th></tr></thead><tbody>${d.learners.map((l) => `<tr><td>${escape(l.student.name)}<div class="small muted">${escape(l.student.student_number || l.student.email)}</div></td><td>${l.summary.read}/${l.summary.materials}</td><td>${l.summary.submitted}/${l.summary.required}</td><td>${l.summary.graded}</td><td>${button("View work", "learner", `data-id="${escape(l.student.id)}"`, "quiet")}</td></tr>`).join("")}</tbody></table></div>${!d.learners.length ? empty("No students enrolled yet", "Open Enrollment to set who can join.") : ""}<div class="form-actions">${button("Previous", "roster-page", `data-offset="${Math.max(0, state.rosterOffset - 100)}" ${state.rosterOffset ? "" : "disabled"}`)}${button("Next students", "roster-page", `data-offset="${d.next_offset || 0}" ${d.next_offset == null ? "disabled" : ""}`)}</div>`;
}
async function renderLearner(id) {
  const data = await api(`/v1/subjects/${state.active.id}/learners/${id}`);
  const editableSubject = canEditSubject();
  state.activeLearnerId = id;
  state.view = "learner";
  shell();
  $("#center").innerHTML =
    header(
      data.student.name,
      "Student work · " + state.active.title,
      button("Back to students", "learners", "", "quiet"),
    ) +
    data.items
      .map(
        (item) =>
          `<article class="material" data-item="${escape(item.id)}"><div class="material-content"><h3>${escape(item.title)}</h3><span class="tag" data-work-status>${escape(item.status)}</span>${datesCaption(item)}${item.submission_id ? `<details class="work-instructions"><summary>Instructions</summary><div class="reading-copy">${readingText(item.body)}</div></details><p class="small muted">Submitted ${escape(new Date(item.submitted_at).toLocaleString())}</p>` : ""}${item.output ? `<div class="reading-copy">${readingText(item.output)}</div>` : ""}${item.answer ? `<div class="reading-copy">${readingText(item.answer)}</div>` : ""}${item.submission_id && item.response_mode !== "choice" && editableSubject ? `<form data-form="grade" data-dirty="false" data-id="${escape(item.submission_id)}" data-student="${escape(id)}" data-graded="${item.graded_at || ""}"><div class="form-grid"><label>Score / 100<input type="number" min="0" max="100" step="any" name="score" value="${item.score ?? ""}" required></label><label>Feedback<input name="feedback" maxlength="1000" value="${escape(item.feedback)}"></label></div><div class="form-actions"><button class="primary">Save grade</button><span class="small grade-status" role="status" aria-live="polite">${item.graded_at ? "Saved · " + escape(new Date(item.graded_at).toLocaleString()) : "Awaiting grade"}</span></div></form>` : item.score != null ? `<p>Score: ${item.score} / ${item.max_score}${item.feedback ? " · " + escape(item.feedback) : ""}</p>` : ""}</div></article>`,
      )
      .join("");
}
async function renderEligibility() {
  if (!state.active) {
    $("#center").innerHTML = empty(
      "Choose a subject first",
      "Create a subject to manage enrollment.",
    );
    return;
  }
  const d = await api(`/v1/subjects/${state.active.id}/eligibility`);
  const editableSubject = canEditSubject();
  $("#center").innerHTML =
    header(
      "Enrollment",
      editableSubject
        ? "Choose who can join this subject."
        : "Read-only enrollment policy. Only editors or administrators can change eligibility.",
    ) +
    chooseSubject() +
    `<form id="eligibility" class="inline-form" data-revision="${d.revision}"><h3>Eligible students</h3><p class="small muted">Students find the subject and join using their administrator-assigned ID. Existing administrator enrollments remain overrides.</p><label class="choice"><input name="all" type="checkbox" ${d.all_students ? "checked" : ""} ${editableSubject ? "" : "disabled"}>All students</label><label>Or allow these student IDs · one per line<textarea name="numbers" rows="5" ${editableSubject ? "" : "readonly"} placeholder="2026-001\n2026-002">${escape(d.student_numbers.join("\n"))}</textarea></label><p class="small muted">No IDs and All students unchecked closes self-enrollment. Changing eligibility can remove self-enrolled students’ access.</p>${editableSubject ? '<div class="form-actions"><button class="primary">Save eligibility</button></div>' : ""}</form><div class="inline-form"><h3>Subject code</h3><p class="small muted">Eligible students can paste this code in Find a subject.</p><input readonly aria-label="Subject code" value="${escape(state.active.id)}">${editableSubject ? `<div class="form-actions">${button("Generate QR code", "generate-qr", "", "primary")}</div><div id="subject-qr" class="subject-qr" hidden></div>` : ""}<p class="small muted">${state.mode === "local" ? "Local test only: this PC’s subjects do not sync to phones. Mobile enrollment requires both apps to use the same organization server." : "Students scan this code in Academy while connected to this same organization server. Sign-in and eligibility are still required."}</p></div>`;
}
// Admin — Per-subject instructor access control (read-only vs editor, active vs suspended).
async function renderAccess() {
  if (state.account.role !== "admin") return;
  if (!state.active && state.subjects.length) await loadSubject(state.subjects[0].id);
  if (!state.active) {
    $("#center").innerHTML =
      header("Subject access", "Control instructor access per subject.") +
      empty("No subjects yet", "Create a subject before assigning instructor access.");
    return;
  }
  if (!state.capabilities.instructor_subject_access) {
    $("#center").innerHTML =
      header("Subject access", "Control instructor access per subject.") +
      `<div class="banner"><strong>Server update required</strong>Update the connected organization server to manage per-subject instructor access.</div>`;
    return;
  }
  const data = await api(`/v1/admin/subjects/${state.active.id}/instructors`);
  $("#center").innerHTML =
    header(
      "Subject access",
      "Assign, suspend or activate instructors per subject as Read only or Editor.",
    ) +
    chooseSubject() +
    `<div class="inline-form"><h3>Instructor permissions · ${escape(data.subject.title)}</h3><p class="small muted">Students default to reader access on enrolled subjects with no download capability. Read-only instructors can view materials and progress without editing, grading, or downloading. Suspended instructors immediately lose subject access.</p><div class="table-scroll"><table class="data-table"><thead><tr><th>Instructor</th><th>Access</th><th>Controls</th></tr></thead><tbody>${
      data.instructors.length
        ? data.instructors
            .map((row) => {
              const badge = !row.assigned
                ? '<span class="tag">No access</span>'
                : row.status === "suspended"
                  ? `<span class="tag red">Suspended · ${row.access_level === "editor" ? "Editor" : "Read only"}</span>`
                  : row.access_level === "editor"
                    ? '<span class="tag green">Active · Editor</span>'
                    : '<span class="tag blue">Active · Read only</span>';
              const selected = row.access_level || "read_only";
              return `<tr data-instructor-row="${escape(row.instructor_id)}"><td>${escape(row.name)} ${row.is_owner ? '<span class="tag">Owner</span>' : ""} ${row.account_status === "suspended" ? '<span class="tag red">Account suspended</span>' : ""}<div class="small muted">${escape(row.email)}</div></td><td>${badge}</td><td><div class="access-controls"><select data-access-level="${escape(row.instructor_id)}" aria-label="Access level for ${escape(row.name)}"><option value="read_only" ${selected === "read_only" ? "selected" : ""}>Read only</option><option value="editor" ${selected === "editor" ? "selected" : ""}>Editor</option></select>${
                !row.assigned
                  ? button("Grant access", "grant-instructor", `data-id="${escape(row.instructor_id)}"`, "primary")
                  : row.status === "active"
                    ? button("Save level", "save-instructor-level", `data-id="${escape(row.instructor_id)}"`, "") +
                      button("Suspend", "suspend-instructor", `data-id="${escape(row.instructor_id)}"`, "quiet danger")
                    : button("Activate", "activate-instructor", `data-id="${escape(row.instructor_id)}"`, "primary")
              }</div></td></tr>`;
            })
            .join("")
        : `<tr><td colspan="3">${empty("No instructor accounts yet", "Create an instructor account under Accounts first.")}</td></tr>`
    }</tbody></table></div></div>`;
}
async function renderDiscover() {
  const data = await api(
    `/v1/subjects/discover?offset=${state.discoverOffset || 0}`,
  );
  $("#center").innerHTML =
    header(
      "Find a subject",
      "Only subjects eligible for your account appear here.",
    ) +
    `<form id="join-code" class="inline-form"><label>Subject code<input name="code" required placeholder="Paste the subject code from your instructor"></label><div class="form-actions"><button class="primary">Enroll</button></div></form>` +
    data.subjects
      .map(
        (s) =>
          `<article class="material"><div class="material-content"><h3>${escape(s.title)}</h3>${s.description ? `<div class="reading-copy">${readingText(s.description)}</div>` : ""}<div class="form-actions">${button("Enroll in subject", "enrol", `data-id="${escape(s.id)}"`, "primary")}</div></div></article>`,
      )
      .join("") +
    (data.subjects.length
      ? ""
      : empty(
          "No new subjects available",
          "Ask your instructor to check your student ID and eligibility.",
        )) +
    `<div class="form-actions">${button("Previous", "discover-page", `data-offset="${Math.max(0, (state.discoverOffset || 0) - 100)}" ${state.discoverOffset ? "" : "disabled"}`)}${button("Next", "discover-page", `data-offset="${(state.discoverOffset || 0) + 100}" ${data.subjects.length < 100 ? "disabled" : ""}`)}</div>`;
}
async function renderAccounts() {
  const d = await api(`/v1/admin/accounts?offset=${state.accountOffset}`);
  $("#center").innerHTML =
    header(
      "Accounts",
      "Create accounts with passwords, update account passwords, and manage instructor/student access.",
      button("+ Create account", "new-account", "", "primary"),
    ) +
    `<div id="account-form-slot"></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Name</th><th>Role / ID</th><th>Status</th><th></th></tr></thead><tbody>${d.accounts.map((a) => `<tr><td>${escape(a.name)}<div class="small muted">${escape(a.email)}</div></td><td>${escape(a.role === "student" ? "student · reader" : a.role)}<div class="small muted">${escape(a.student_number || "")}</div></td><td><span class="tag ${a.status === "active" ? "green" : "red"}">${escape(a.status)}</span></td><td>${a.id !== state.account.id ? `<div class="account-actions">${a.role === "student" ? button("Edit ID", "edit-student-id", `data-id="${escape(a.id)}" data-name="${escape(a.name)}" data-number="${escape(a.student_number || "")}"`, "quiet") : ""}${button("Update password", "reset-password", `data-id="${escape(a.id)}" data-name="${escape(a.name)}"`, "quiet")}${button(a.status === "active" ? "Suspend" : "Reactivate", "account-status", `data-id="${escape(a.id)}" data-status="${a.status === "active" ? "suspended" : "active"}"`, "quiet")}</div>` : `<div class="account-actions">${button("Update my password", "settings", "", "quiet")}</div>`}</td></tr>`).join("")}</tbody></table></div><div class="form-actions">${button("Previous", "account-page", `data-offset="${Math.max(0, state.accountOffset - 100)}" ${state.accountOffset ? "" : "disabled"}`)}${button("Next", "account-page", `data-offset="${state.accountOffset + 100}" ${d.accounts.length < 100 ? "disabled" : ""}`)}</div>`;
}
function renderAnnouncements() {
  $("#center").innerHTML =
    header("Announcements", "Updates for everyone in the workspace.") +
    (state.account.role === "admin"
      ? `<form id="announcement" class="inline-form"><h3>Share an update</h3><label>Title<input name="title" required maxlength="160"></label><label>Message<textarea name="body" required maxlength="5000" rows="3"></textarea></label><div class="form-actions"><button class="primary">Publish announcement</button></div></form>`
      : "") +
    (state.announcements.length
      ? state.announcements
          .map(
            (n) =>
              `<article class="material"><div class="material-content"><span class="small muted">${new Date(n.created_at).toLocaleDateString()}</span><h3>${escape(n.title)}</h3><div class="reading-copy">${readingText(n.body)}</div>${state.account.role === "admin" ? `<div class="form-actions">${button("Delete", "delete-announcement", `data-id="${escape(n.id)}"`, "quiet danger")}</div>` : ""}</div></article>`,
          )
          .join("")
      : empty(
          "No announcements yet",
          state.account.role === "admin"
            ? "Share an update above to notify everyone in this workspace."
            : "Updates from your administrator will appear here.",
        ));
}
function renderSettings() {
  const pending = Boolean(state.account.must_change_password);
  $("#center").innerHTML =
    header("Settings", "Your account and password security.") +
    (pending
      ? `<div class="banner" role="status"><strong>Temporary password change required</strong>Choose a new 15–128 character passphrase different from your temporary password before accessing subjects.</div>`
      : "") +
    `<div class="inline-form"><h3>${state.mode === "local" ? "Local test workspace" : "Organization workspace"}</h3><p class="small muted">${state.mode === "local" ? "This workspace is saved on this PC. It does not synchronize with other computers or the mobile app." : "Your account and subjects are managed by your organization’s Aeronautical Academy Repository server."}</p><p class="small">${escape(state.account.email)}${state.account.student_number ? " · ID " + escape(state.account.student_number) : ""}${state.account.role === "student" ? " · Reader (downloads disabled)" : ""}</p><div class="form-actions">${button("Sign out all devices", "logout-all", "", "quiet")}</div></div><form id="password" class="inline-form"><h3>Update password</h3><label>Current password<span class="password-field"><input name="current" type="password" required autocomplete="current-password">${button("Show", "toggle-confirm-password", 'aria-pressed="false"', "quiet")}</span></label><label>New password · 15–128 characters<span class="password-field"><input name="next" type="password" minlength="15" maxlength="128" required autocomplete="new-password">${button("Show", "toggle-field-password", 'aria-pressed="false"', "quiet")}${button("Generate", "generate-password", 'data-target="next" data-confirm="confirm"', "quiet")}</span></label><label>Confirm new password<span class="password-field"><input name="confirm" type="password" minlength="15" maxlength="128" required autocomplete="new-password">${button("Show", "toggle-confirm-password", 'aria-pressed="false"', "quiet")}</span></label><p class="small muted">${state.mode === "local" ? "In the local workspace, you can update the built-in admin, instructor, or student password using your current sign-in password." : "Updating your password signs out all active sessions on every device."}</p><div class="form-actions"><button class="primary">Update password & sign out</button></div></form>`;
}
function renderHelp() {
  $("#center").innerHTML =
    header("A calmer way to learn", "Everything stays in Aeronautical Academy Repository.") +
    `<div class="inline-form help-card"><h3>Subject access and accounts</h3><p>Administrators create instructor, student, and administrator accounts with strong 15–128 character passwords under Administration → Accounts and can update any account’s password at any time. Users can update their own password under Settings. Under Administration → Subject access, administrators assign instructors to any subject as Read only or Editor and can suspend or activate access per subject. Students default to reader access on enrolled subjects with no download capability.</p><h3>Rich subject content &amp; pasted images</h3><p>Choose a subject where you have editor access and select + Add material or examination. Enter a Title, then type or paste formatted text from Word, Google Docs, or web pages—bold, italic, underline, headings, lists, and indentation are adopted and sanitized automatically. Press Ctrl+V inside the content box to paste screenshot snips or click Image to insert a PNG, JPEG, WebP, or GIF image (up to 5 MB). Use Tab / Shift+Tab or the toolbar buttons to indent paragraphs, and pick Compact, Normal, Relaxed, or Loose paragraph spacing.</p><h3>Minimize entries &amp; drag across levels</h3><p>Click Minimize on any entry card—or Minimize all in the subject toolbar—to collapse cards to a clean outline without losing drafts. Drag the grip at the left of any entry to reorder it before/after entries at any level, drop onto the middle of a material to nest it inside (up to 4 levels deep), or move it back to top level. Keyboard shortcuts: Alt+↑/↓ reorders siblings, Alt+→ indents inside the preceding material, and Alt+← outdents up one level.</p><h3>Activities, quizzes and examinations</h3><p>Click Play on any Quiz, Activity, or Examination card to present questions full screen with lettered options (A–F) only, arrow navigation, and an end-of-item confirmation dialog before revealing the class answer key. In Students &amp; progress, open View work to rate written submissions out of 100 and Export Excel for dated quiz scores and summaries.</p><h3>Current desktop scope and limitations</h3><p>The local test workspace stays on this PC. Organization synchronization requires a deployed compatible backend. Use Schedule on any saved entry to set publication and due dates in Philippine time. Protected PDFs and pasted images render in-app with student downloads disabled.</p></div>`;
}
function renderSubjectForm(edit = false) {
  const s = edit ? state.active : null;
  state.compose = null;
  const context = $("#subject-context");
  if (context) {
    context.hidden = true;
    context.innerHTML = "";
  }
  $("#center").innerHTML =
    header(
      edit ? "Edit subject" : "Create a subject",
      "A simple home for lessons and learning activities.",
    ) +
    `<form id="subject-form" class="inline-form" data-edit="${s ? "true" : "false"}"><label>Subject title<input name="title" maxlength="160" required value="${escape(s?.title || "")}" placeholder="e.g. Aircraft Structures"></label><label>Description<textarea name="description" maxlength="1000" required placeholder="What will students learn?">${escape(s?.description || "")}</textarea></label><div class="form-actions">${s && canDeleteSubject(s) ? button("Delete subject", "delete-subject", `data-id="${escape(s.id)}"`, "quiet danger") + '<span class="push"></span>' : ""}${button("Cancel", s ? "subject" : "subjects", s ? `data-id="${escape(s.id)}"` : "", "quiet")}<button class="primary">${s ? "Save details" : "Create subject"}</button></div></form>`;
}
function capturePosition(preferredId) {
  const center = $("#center");
  if (!center) return null;
  for (const animation of center.getAnimations({subtree:true})) animation.cancel();
  const top = center.getBoundingClientRect().top;
  const cards = [...center.querySelectorAll("[data-item]")].filter((el) => el.getClientRects().length);
  const preferred = cards.find((el) => el.dataset.item === preferredId);
  const anchors = cards.filter((el) => { const rect = el.getBoundingClientRect(); return rect.bottom > top && rect.top < top + center.clientHeight; });
  if (preferred && anchors.includes(preferred)) anchors.unshift(preferred);
  return { subject: state.active?.id, scroll: center.scrollTop, anchors: [...new Set(anchors)].map((el) => ({ id: el.dataset.item, offset: el.getBoundingClientRect().top - top })) };
}
function restorePosition(position, feedbackId, animate = false) {
  const center = $("#center");
  if (!position || !center || position.subject !== state.active?.id) return;
  center.scrollTop = position.scroll;
  for (const anchor of position.anchors) {
    const card = document.querySelector(`[data-item="${anchor.id}"]`);
    if (!card?.getClientRects().length) continue;
    center.scrollTop += card.getBoundingClientRect().top - center.getBoundingClientRect().top - anchor.offset;
    break;
  }
  if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const changed = document.querySelector(`[data-item="${feedbackId}"]`);
    if (changed) changed.animate([{ backgroundColor: "#edf3fc" }, { backgroundColor: "#ffffff" }], { duration: 420 });
  }
}
function revealNearby(element) {
  if (!element) return;
  element.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
}
async function reloadActive({position = capturePosition(), feedbackId} = {}) {
  const id = state.active.id;
  await refreshData();
  await loadSubject(id);
  state.view = "subject";
  // Keep the scroll containers and sidebar alive across subject mutations.
  document.querySelectorAll('#subject-nav [data-action="subject"][data-id]').forEach((entry) => {
    const subject = state.subjects.find((item) => item.id === entry.dataset.id);
    if (subject) entry.querySelector("span").textContent = subject.title;
  });
  renderSubject();
  restorePosition(position, feedbackId, true);
}

const groupFor = (id) => document.querySelector(`[data-group="${id}"]`);
function updateEntryNumbers(items = rootsOf(), prefix = "") {
  items.forEach((item,index) => {
    const number = prefix ? `${prefix}.${index+1}` : String(index+1).padStart(2,"0");
    const rail = groupFor(item.id)?.querySelector(":scope > [data-item] > .entry-rail .number");
    if (rail) rail.textContent = number;
    updateEntryNumbers(childrenOf(item.id), number);
  });
}
async function reorder(ids, anchorId, {movedId = anchorId, placement} = {}) {
  if (ids.every((id,index) => id === state.items[index]?.id)) return;
  const position = capturePosition(anchorId);
  const moved = state.items.find((item) => item.id === movedId);
  const siblings = siblingsOf(moved);
  const oldTops = new Map(siblings.map((item) => [item.id, groupFor(item.id)?.getBoundingClientRect().top]));
  if (placement) {
    // Put the moved header at the chosen drop boundary, keeping it on screen.
    const target = groupFor(placement.id);
    const center = $("#center");
    const boundary = placement.after ? target.getBoundingClientRect().bottom + 16 : target.querySelector(":scope > [data-item]").getBoundingClientRect().top;
    position.anchors.unshift({id:movedId, offset:Math.max(24,Math.min(center.clientHeight-120,boundary-center.getBoundingClientRect().top))});
  }
  const result = await post(`/v1/subjects/${state.active.id}/order`, {
    item_ids: ids,
    expected_revision: state.active.order_revision,
  });
  // Apply only after acknowledgement. Failed/stale saves leave the current tree intact.
  const byId = new Map(state.items.map((item) => [item.id,item]));
  state.items = ids.map((id) => byId.get(id));
  state.active.order_revision = result.revision;
  const container = groupFor(movedId).parentElement;
  const slot = [...container.children].find((el) => el.matches("[data-add-parent]"));
  const fragment = document.createDocumentFragment();
  for (const item of siblingsOf(moved)) fragment.append(groupFor(item.id));
  container.insertBefore(fragment,slot || null);
  updateEntryNumbers();
  restorePosition(position);
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    for (const item of siblingsOf(moved)) {
      const group = groupFor(item.id), rect = group.getBoundingClientRect();
      const delta = oldTops.get(item.id)-rect.top;
      if (Number.isFinite(delta) && Math.abs(delta)>1 && Math.abs(delta)<$("#center").clientHeight && rect.bottom>$("#center").getBoundingClientRect().top && rect.top<$("#center").getBoundingClientRect().bottom)
        group.animate([{transform:`translateY(${delta}px)`},{transform:"translateY(0)"}],{duration:170,easing:"cubic-bezier(.2,.7,.2,1)"});
    }
  }
  renderRight();
  requestAnimationFrame(() => document.querySelector(`[data-drag="${movedId}"]`)?.focus({preventScroll:true}));
  toast("Order saved.");
}

$("#login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  act(async () => {
    const form = e.target;
    $("#login-error").textContent = "";
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
      const session = await desktopApi.login(
        Object.fromEntries(new FormData(form)),
      );
      let resume = resumeWorkspace && resumeWorkspace.id === session.account.id && resumeWorkspace.role === session.account.role && resumeWorkspace.mode === session.mode && resumeWorkspace.origin === session.origin && !session.account.must_change_password;
      if (resume && state.active) {
        try {await desktopApi.request(`/v1/subjects/${state.active.id}`);}
        catch (error) {if (![403,404].includes(error.status)) throw error; resume=false;}
      }
      state.account = session.account;
      state.version = session.version;
      state.mode = session.mode;
      state.origin = session.origin;
      form.elements.password.value = "";
      if (resume) {
        $("#app").hidden = false;
        toast("Signed in. Your unsaved work is restored; review before saving.");
      } else if (state.account.must_change_password) {
        state.view = "settings";
        shell();
        renderSettings();
        toast("Change your temporary password to continue.");
      } else {
        state.dirty = false;
        await start();
      }
      resumeWorkspace = null;
      $("#signin").close();
    } catch (error) {
      $("#login-error").textContent = error.message;
      throw error;
    } finally {
      submit.disabled = false;
    }
  });
});
$("#signin").addEventListener("cancel", (e) => e.preventDefault());
$("#workspace").addEventListener("change", () => {
  const remote = $("#workspace").value === "organization";
  $("#origin-label").hidden = !remote;
  $("#org-hint").hidden = !remote;
  $("#demo-hint").hidden = remote;
  $("#login-form").elements.origin.required = remote;
  $("#login-form").elements.username.value = "";
  $("#login-form").elements.password.value = "";
});
$("#toggle-password")?.addEventListener("click", () => {
  const input = $("#login-form").elements.password;
  const toggle = $("#toggle-password");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  toggle.textContent = show ? "Hide" : "Show";
  toggle.setAttribute("aria-pressed", String(show));
  input.focus();
});
document.addEventListener("click", (event) => {
  const demo = event.target.closest("[data-demo]");
  if (demo) {
    $("#login-form").elements.username.value = demo.dataset.demo;
    $("#login-form").elements.password.value = demo.dataset.demo;
    return;
  }
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const { action, id } = target.dataset;
  if (action === "toggle-material") {
    if (state.collapsedMaterials.has(id)) state.collapsedMaterials.delete(id);
    else state.collapsedMaterials.add(id);
    const position = capturePosition(id);
    syncMaterialSections();
    restorePosition(position);
    return;
  }
  if (action === "toggle-entry") {
    if (state.collapsedEntries.has(id)) state.collapsedEntries.delete(id);
    else state.collapsedEntries.add(id);
    const position = capturePosition(id);
    syncMaterialSections();
    restorePosition(position);
    return;
  }
  if (action === "toggle-all-entries") {
    const allMin = state.items.length > 0 && state.items.every((item) => state.collapsedEntries.has(item.id));
    if (allMin) state.collapsedEntries.clear();
    else for (const item of state.items) state.collapsedEntries.add(item.id);
    syncMaterialSections();
    return;
  }
  if (action === "editor-cmd") {
    const editorEl = $("#rich-editor");
    if (!editorEl) return;
    window.academyEditor?.applyCommand(editorEl, target.dataset.cmd);
    state.dirty = true;
    return;
  }
  if (action === "reorder-handle") {
    toast("Drag this grip to reorder or drop onto another level · keyboard: Alt+↑/↓/←/→.");
    return;
  }
  if (action === "toggle-folder") {
    if (state.collapsedFolders.has(id)) state.collapsedFolders.delete(id);
    else state.collapsedFolders.add(id);
    syncSubjectNav();
    return;
  }
  if (action === "new-folder") {
    if (!canManageFolders()) return;
    state.folderForm = { mode: "create", parentId: target.dataset.parent || "" };
    syncSubjectNav();
    $("#folder-form input[name=name]")?.focus();
    return;
  }
  if (action === "rename-folder") {
    if (!canManageFolders()) return;
    const folder = state.folders.find((f) => f.id === id);
    if (!folder) return;
    state.folderForm = { mode: "rename", id: folder.id, name: folder.name };
    syncSubjectNav();
    const input = $("#folder-form input[name=name]");
    if (input) {
      input.focus();
      input.select();
    }
    return;
  }
  if (action === "cancel-folder") {
    state.folderForm = null;
    syncSubjectNav();
    return;
  }
  if (action === "play-item") {
    if (!manage()) return;
    const item = state.items.find((entry) => entry.id === id);
    if (!item || item.kind === "material") return;
    window.academyPresenter?.open(item, state.active?.title || "");
    return;
  }
  if (action === "toggle-field-password" || action === "toggle-confirm-password") {
    const input = target.closest(".password-field")?.querySelector("input");
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    target.textContent = show ? "Hide" : "Show";
    target.setAttribute("aria-pressed", String(show));
    input.focus();
    return;
  }
  if (action === "generate-password") {
    const form = target.closest("form");
    if (!form) return;
    const pass = generatePassphrase();
    const mainName = target.dataset.target || "password";
    const confirmName = target.dataset.confirm || "confirm_password";
    const mainInput = form.elements[mainName];
    const confirmInput = form.elements[confirmName];
    if (mainInput) {
      mainInput.value = pass;
      mainInput.type = "text";
      const showBtn = mainInput.closest(".password-field")?.querySelector('[data-action="toggle-field-password"]');
      if (showBtn) { showBtn.textContent = "Hide"; showBtn.setAttribute("aria-pressed", "true"); }
    }
    if (confirmInput) {
      confirmInput.value = pass;
      confirmInput.type = "text";
      const showBtn = confirmInput.closest(".password-field")?.querySelector('[data-action="toggle-confirm-password"]');
      if (showBtn) { showBtn.textContent = "Hide"; showBtn.setAttribute("aria-pressed", "true"); }
    }
    state.dirty = true;
    toast("Strong password generated. Copy it before saving.");
    return;
  }
  act(async () => {
    if (action === "insert-image") {
      if (!state.active) return;
      const editorEl = $("#rich-editor");
      if (!editorEl) return;
      const result = await desktopApi.pickImage(state.active.id);
      if (!result.canceled && result.image) {
        window.academyEditor?.insertImageFigure(editorEl, {
          id: result.image.id,
          dataUrl: result.dataUrl,
          alt: "Inserted image",
        });
        state.dirty = true;
        toast("Image inserted.");
      }
      return;
    }
    if (action === "delete-folder") {
      if (!canManageFolders()) return;
      const folder = state.folders.find((f) => f.id === id);
      if (!folder) return;
      if (
        !(await confirmAction(
          "Delete folder?",
          `Remove folder “${folder.name}”? Subjects and subfolders inside will move up one level; no subjects or student records will be deleted.`,
          "Delete folder",
        ))
      )
        return;
      await api(`/v1/admin/folders/${folder.id}`, { method: "DELETE" });
      state.collapsedFolders.delete(folder.id);
      if (state.folderForm?.id === folder.id) state.folderForm = null;
      await refreshData();
      syncSubjectNav();
      if (state.view === "subjects") await navigate("subjects");
      toast("Folder deleted. Contents moved up.");
      return;
    }
    if (
      [
        "subjects",
        "subject",
        "tasks",
        "results",
        "learners",
        "eligibility",
        "access",
        "accounts",
        "announcements",
        "settings",
        "help",
        "discover",
      ].includes(action)
    )
      return navigate(action, id);
    if (action === "logout-all") {
      if(!(await leaveDraft()))return;
      await post("/v1/auth/logout-all",{});
      state.account=null;state.items=[];state.subjects=[];state.folders=[];state.folderForm=null;state.collapsedFolders.clear();state.collapsedEntries.clear();state.active=null;state.activeLearnerId=null;resumeWorkspace=null;
      window.academyPresenter?.close();window.academyEditor?.clearImageCache();await window.academyReader.close();$("#app").replaceChildren();showLogin();toast("Signed out on all devices.");return;
    }
    if (action === "logout") {
      if (!(await leaveDraft())) return;
      await desktopApi.logout();
      resumeWorkspace = null;
      window.academyPresenter?.close();
      window.academyEditor?.clearImageCache();
      await window.academyReader.close();
      state.collapsedFolders.clear();
      state.collapsedEntries.clear();
      Object.assign(state, {
        account: null,
        active: null,
        activeLearnerId: null,
        items: [],
        subjects: [],
        folders: [],
        folderForm: null,
        announcements: [],
      });
      $("#app").innerHTML = "";
      showLogin();
      return;
    }
    if (action === "add") {
      if (!(await leaveDraft())) return;
      const parentId = target.dataset.parent || "";
      if (parentId && !state.treeSupported) throw new Error("Update the learning service to use the subject tree.");
      state.compose = { parentId, kind: parentId ? "activity" : "material" };
      renderComposer();
      revealNearby($("#composer"));
      $("#composer input[name=title]")?.focus({preventScroll:true});
    }
    if (action === "attach") {
      if ($("#link-fields").children.length >= 12) throw new Error("Use up to 12 attached links per entry.");
      $("#link-fields").insertAdjacentHTML("beforeend", linkField());
      $("#link-fields").lastElementChild.querySelector("input").focus();
      state.dirty = true;
    }
    if (action === "remove-link") {
      target.closest(".link-field").remove();
      state.dirty = true;
    }
    if (action === "schedule") {
      if (!(await leaveDraft())) return;
      const item=state.items.find(entry=>entry.id===id);
      if(!item)throw new Error("Refresh before scheduling.");
      state.dirty=true;
      window.academySchedule.show(item,async data=>{
        await post(`/v1/items/${id}/schedule`,data);
        state.dirty=false;await reloadActive();toast("Publishing schedule and due date saved.");
      },()=>{state.dirty=false;});return;
    }
    if (action === "upload-pdf") {
      const item=state.items.find(item=>item.id===target.dataset.id);
      if(!item)throw new Error("Sync before uploading.");
      const result=await desktopApi.uploadMaterial(item.id,item.edit_version);
      if(!result.canceled){await reloadActive();toast("PDF uploaded. Review it before publishing.");}
    }
    if (action === "read-pdf") {
      const item=state.items.find(item=>item.id===target.dataset.id);
      if(!item)throw new Error("Sync before opening this material.");
      await window.academyReader.open(item.id,item.revision);
    }
    if (action === "sync") {
      if(state.dirty){toast("Finish or save your draft before syncing.");return;}
      const position=capturePosition(),id=state.active?.id;
      const receipt=await desktopApi.sync();state.account=receipt.account;
      await refreshData();
      if(id&&state.subjects.some(subject=>subject.id===id))await loadSubject(id);
      else{state.active=null;state.items=[];state.summary=null;}
      await navigate(state.view,id);restorePosition(position);
      toast(state.mode==="local"?"Local test data refreshed. Organization sharing uses the server workspace.":"Synced · materials, results and progress refreshed.");
    }
    if (action === "refresh") {
      if (!(await leaveDraft())) return;
      await reloadActive();
      toast("Subject refreshed.");
    }
    if (action === "cancel-compose") {
      if (!(await leaveDraft())) return;
      state.compose = null;
      renderComposer();
    }
    if (action === "edit") {
      if (!(await leaveDraft())) return;
      state.compose = { item: state.items.find((i) => i.id === id) };
      renderComposer();
      revealNearby($("#composer"));
      $("#composer input[name=title]")?.focus({preventScroll:true});
    }
    if (action === "open-link")
      await desktopApi.openLink({
        id,
        revision: state.items.find((i) => i.id === id).revision,
        url: target.dataset.url,
      });
    if (action === "complete") {
      if (!(await leaveDraft())) return;
      const item = state.items.find((i) => i.id === id);
      await post(`/v1/items/${id}/complete`, { completed: !item.completed });
      await reloadActive();
      toast(item.completed ? "Marked unread." : "Reading marked complete.");
    }
    if (action === "publish") {
      if (!(await leaveDraft())) return;
      const item = state.items.find((i) => i.id === id);
      await api(`/v1/items/${id}`, {
        method: "PATCH",
        body: {
          published: !item.published,
          expected_edit_version: item.edit_version,
        },
      });
      await reloadActive();
      toast(item.published ? "Entry unpublished." : "Entry published.");
    }
    if (action === "delete") {
      if (!(await leaveDraft())) return;
      const children = descendantsOf(id);
      if (
        !(await confirmAction(
          "Delete this entry?",
          children.length ? `Remove this material and its ${children.length} activities/quizzes? Historical learning records are retained.` : "This removes it from the subject. Historical learning records are retained.",
          "Delete entry",
        ))
      )
        return;
      const item = state.items.find((i) => i.id === id);
      await api(`/v1/items/${id}`, {
        method: "PATCH",
        body: { archived: true, expected_edit_version: item.edit_version, ...(children.length ? {archive_children:true, expected_order_revision:state.active.order_revision} : {}) },
      });
      await reloadActive();
      toast("Entry deleted.");
    }
    if (action === "delete-subject") {
      const subject = state.active;
      if (!subject || subject.id !== id || !canDeleteSubject(subject)) return;
      const snapshot = {
        confirm_delete:true, expected_title:subject.title, expected_description:subject.description,
        expected_order_revision:subject.order_revision, expected_eligibility_revision:subject.eligibility_revision,
        expected_items:state.items.map((item) => ({id:item.id,edit_version:item.edit_version})),
      };
      if (!(await confirmAction("Delete this subject?", `Remove “${subject.title}” and all its materials, activities and quizzes from active workspaces? Saved student work and grades are retained.${state.dirty ? " Unsaved changes will be discarded." : ""}`, "Delete subject"))) return;
      await post(`/v1/subjects/${subject.id}/archive`, snapshot);
      // Commit UI removal immediately after acknowledgement, independent of refresh availability.
      state.subjects = state.subjects.filter((item) => item.id !== subject.id);
      Object.assign(state,{active:null,items:[],summary:null,allItems:[],compose:null,dirty:false,search:""});
      state.collapsedMaterials.clear();
      await navigate("subjects");
      toast("Subject deleted.");
      return;
    }
    if (action === "new-subject" || action === "edit-subject") {
      if (!(await leaveDraft())) return;
      renderSubjectForm(action === "edit-subject");
    }
    if (action === "learner" && !(await leaveDraft())) return;
    if (action === "learner") await renderLearner(id);
    if (action === "roster-page") {
      state.rosterOffset = Number(target.dataset.offset);
      await renderLearners();
    }
    if (action === "quiz-count" || action === "add-quiz-choice" || action === "remove-quiz-choice") {
      captureQuizDraft();
      const questions = state.compose.questions;
      if (action === "quiz-count") {
        const count = Number($("#quiz-count").value);
        if (!Number.isInteger(count) || count<1 || count>(state.compose?.kind!=="quiz"&&state.compose?.responseMode==="choice"?20:state.maxQuestions||1)) throw new Error(`Enter 1–${state.compose?.kind!=="quiz"&&state.compose?.responseMode==="choice"?20:state.maxQuestions||1} questions.`);
        if (count<questions.length && questions.slice(count).some(q=>q.prompt.trim()||q.options.some(o=>o.trim())) && !(await confirmAction("Remove questions?", "Questions beyond the new count and their answer choices will be discarded.", "Remove questions"))) return;
        state.compose.questions = Array.from({length:count},(_,i)=>questions[i]||blankQuestion());
      } else {
        const question=questions[Number(target.dataset.question)];
        if (action === "add-quiz-choice" && question.options.length<6) question.options.push("");
        if (action === "remove-quiz-choice" && question.options.length>2) question.options.splice(Number(target.dataset.option),1);
        question.correct_index=null;
      }
      const scroll=$("#center").scrollTop;
      renderQuizBuilder(); $("#center").scrollTop=scroll;
      state.dirty=true;
    }
    if (action === "start-quiz") {
      const item=state.items.find(i=>i.id===id);
      if (!item || item.attempt||item.form_result) return;
      const total=item.question_count||1;
      if (!(await confirmAction("Ready to start?", `${total} ${total===1?"question":"questions"}. Answer every question before submitting. You can minimize and expand this assessment while working. You have one submission for this version.`, "Start"))) return;
      state.readyQuizzes.add(id);
      const card=document.querySelector(`[data-item="${id}"]`);
      card.querySelector(".quiz-intro").hidden=true;
      const details=card.querySelector(".quiz-attempt");details.hidden=false;details.open=true;
      revealNearby(details);
    }
    if (action === "generate-qr") {
      const qr = await desktopApi.subjectQr(state.active.id);
      const host = $("#subject-qr");
      host.innerHTML = `<img src="${escape(qr.image)}" alt="Enrollment QR for ${escape(state.active.title)}"><p class="small muted">Scan with the Academy mobile app.</p>${button("Save QR image (SVG)", "save-qr", "", "quiet")}`;
      host.hidden = false;
    }
    if (action === "save-qr") {
      const result = await desktopApi.subjectQr(state.active.id, true);
      if (result.saved) toast("Subject QR image saved.");
    }
    if (action === "export") {
      const result = await desktopApi.exportReport(
        state.active.id,
        state.rosterOffset,
      );
      if (result.saved) toast("Excel report saved.");
    }
    if (action === "task-item") {
      if (!(await leaveDraft())) return;
      const item = state.items.find((i) => i.id === id);
      for (const parent of ancestorsOf(item)) state.collapsedMaterials.delete(parent.id);
      state.view = "subject";
      shell();
      renderSubject();
      if (manage() && canEditSubject()) {
        state.compose = { item };
        renderComposer();
        revealNearby($("#composer"));
      } else
        document
          .querySelector(`[data-item="${id}"]`)
          ?.scrollIntoView({ block: "center" });
    }
    if (action === "enrol") {
      await post(`/v1/subjects/${id}/enrol`, { source: "self" });
      await refreshData();
      await navigate("subject", id);
      toast("You’re enrolled.");
    }
    if (action === "discover-page") {
      state.discoverOffset = Number(target.dataset.offset);
      await renderDiscover();
    }
    if (action === "account-page") {
      state.accountOffset = Number(target.dataset.offset);
      await renderAccounts();
    }
    if (["grant-instructor", "save-instructor-level", "activate-instructor", "suspend-instructor"].includes(action)) {
      if (!state.active) return;
      const levelEl = document.querySelector(`[data-access-level="${CSS.escape(id)}"]`);
      const access_level = levelEl ? levelEl.value : "read_only";
      if (
        action === "suspend-instructor" &&
        !(await confirmAction(
          "Suspend subject access?",
          "This instructor will immediately lose access to this subject until reactivated.",
          "Suspend access",
        ))
      )
        return;
      const status = action === "suspend-instructor" ? "suspended" : "active";
      await post(`/v1/admin/subjects/${state.active.id}/instructors`, {
        instructor_id: id,
        access_level,
        status,
      });
      await renderAccess();
      toast(
        action === "suspend-instructor"
          ? "Instructor access suspended for this subject."
          : action === "activate-instructor"
            ? `Instructor access activated (${access_level === "editor" ? "Editor" : "Read only"}).`
            : `Instructor access saved (${access_level === "editor" ? "Editor" : "Read only"}).`,
      );
    }
    if (action === "account-status") {
      if (
        !(await confirmAction(
          "Change account access?",
          target.dataset.status === "suspended"
            ? "The account will lose access immediately."
            : "This account will be able to sign in again.",
          "Save change",
        ))
      )
        return;
      await api(`/v1/admin/accounts/${id}`, {
        method: "PATCH",
        body: { status: target.dataset.status },
      });
      await renderAccounts();
      toast("Account updated.");
    }
    if (action === "new-account") {
      if (!(await leaveDraft())) return;
      $("#account-form-slot").innerHTML =
        `<form id="new-account" class="inline-form"><h3>Create account</h3><div class="form-grid"><label>Name<input name="name" maxlength="100" required></label><label>Email<input name="email" type="email" maxlength="254" required></label><label>Role<select name="role"><option value="student">Student (Reader)</option><option value="instructor">Instructor</option><option value="admin">Admin</option></select></label><label id="student-id-field">Student ID · students only<input name="student_number" maxlength="32"></label></div><label>Password · 15–128 characters<span class="password-field"><input name="password" type="password" minlength="15" maxlength="128" required autocomplete="new-password">${button("Show", "toggle-field-password", 'aria-pressed="false"', "quiet")}${button("Generate", "generate-password", 'data-target="password" data-confirm="confirm_password"', "quiet")}</span></label><label>Confirm password<span class="password-field"><input name="confirm_password" type="password" minlength="15" maxlength="128" required autocomplete="new-password">${button("Show", "toggle-confirm-password", 'aria-pressed="false"', "quiet")}</span></label><p class="small muted">Students default to reader access with no download capability. New accounts rotate their initial password at first sign-in.</p><div class="form-actions">${button("Cancel", "cancel-account", "", "quiet")}<button class="primary">Create account</button></div></form>`;
    }
    if (action === "reset-password") {
      if (!(await leaveDraft())) return;
      $("#account-form-slot").innerHTML =
        `<form id="reset-password-form" class="inline-form" data-id="${escape(id)}"><h3>Update password · ${escape(target.dataset.name || "Account")}</h3><label>New password · 15–128 characters<span class="password-field"><input name="password" type="password" minlength="15" maxlength="128" required autocomplete="new-password">${button("Show", "toggle-field-password", 'aria-pressed="false"', "quiet")}${button("Generate", "generate-password", 'data-target="password" data-confirm="confirm_password"', "quiet")}</span></label><label>Confirm new password<span class="password-field"><input name="confirm_password" type="password" minlength="15" maxlength="128" required autocomplete="new-password">${button("Show", "toggle-confirm-password", 'aria-pressed="false"', "quiet")}</span></label><label class="choice"><input type="checkbox" name="require_change" checked>Require password change at next sign-in</label><p class="small muted">All active sessions for this user are signed out immediately after saving.</p><div class="form-actions">${button("Cancel", "cancel-account", "", "quiet")}<button class="primary">Update password</button></div></form>`;
    }
    if (action === "edit-student-id") {
      if (!(await leaveDraft())) return;
      $("#account-form-slot").innerHTML =
        `<form id="edit-student-id-form" class="inline-form" data-id="${escape(id)}"><h3>Edit student ID · ${escape(target.dataset.name || "Student")}</h3><label>Student ID · leave blank to clear<input name="student_number" maxlength="32" value="${escape(target.dataset.number || "")}"></label><div class="form-actions">${button("Cancel", "cancel-account", "", "quiet")}<button class="primary">Save ID</button></div></form>`;
    }
    if (action === "cancel-account") {
      if (!(await leaveDraft())) return;
      $("#account-form-slot").innerHTML = "";
    }
    if (action === "delete-announcement") {
      if (
        !(await confirmAction(
          "Delete announcement?",
          "This removes the update for everyone.",
          "Delete",
        ))
      )
        return;
      await api(`/v1/announcements/${id}`, { method: "DELETE" });
      await refreshData();
      renderAnnouncements();
      renderRight();
      toast("Announcement deleted.");
    }
  });
});
document.addEventListener("submit", (event) => {
  const form = event.target;
  if (form.id === "login-form") return;
  event.preventDefault();
  act(async () => {
    const d = Object.fromEntries(new FormData(form));
    const id = form.dataset.id;
    if (form.id === "composer") {
      const position = capturePosition(state.compose.item?.id || state.compose.parentId);
      const editorEl = $("#rich-editor");
      const serialized = window.academyEditor ? window.academyEditor.serializeEditor(editorEl) : { bodyText: "", bodyHtml: null, imageIds: [], hasFormatting: false };
      let title = String(d.title || "").trim();
      let contentText = serialized.bodyText;
      if (!title && contentText) {
        const lines = contentText.split("\n");
        title = lines.shift().trim();
        contentText = lines.join("\n").trim();
      }
      if (!title || title.length > 160)
        throw new Error("Enter a title between 1 and 160 characters.");
      const rawLinks = new FormData(form).getAll("link").map((raw) => raw.trim());
      const links = await Promise.all(rawLinks.map((raw) => desktopApi.inspectLink(raw)));
      const parts = [title];
      if (contentText && contentText.split("\n")[0]?.trim() !== title) parts.push(contentText);
      else if (contentText && contentText !== title) parts.push(contentText);
      const uniqueLinks = [...new Set(links.map((link) => link.url))];
      if (uniqueLinks.length) parts.push(...uniqueLinks);
      let body = parts.join("\n");
      const spacing = d.paragraph_spacing || "normal";
      let bodyHtml = serialized.hasFormatting ? serialized.bodyHtml : null;
      const item = state.compose.item;
      if (
        item &&
        title === state.compose.initialTitle &&
        contentText === state.compose.initialText &&
        JSON.stringify(rawLinks) === JSON.stringify(state.compose.initialLinks) &&
        bodyHtml === state.compose.initialRichHtml
      ) {
        body = item.body;
      }
      if (body.length > 12000)
        throw new Error("Keep this entry within 12,000 characters.");
      let savedId = item?.id;
      const kind = item?.kind || d.kind;
      const payload = { title, body, published: !!d.published };
      if (state.capabilities.rich_content === "v1") {
        payload.body_html = bodyHtml;
        payload.paragraph_spacing = spacing;
      }
      if (item) {
        const nextParent = form.elements.parent_id ? (d.parent_id || null) : item.parent_id;
        if (nextParent !== (item.parent_id || null)) {
          payload.parent_id = nextParent;
          payload.expected_order_revision = state.active.order_revision;
        }
        await api(`/v1/items/${item.id}`, {
          method: "PATCH",
          body: { ...payload, expected_edit_version: item.edit_version },
        });
      } else {
        payload.kind = kind;
        if (state.compose.parentId) payload.parent_id = state.compose.parentId;
        if (kind === "material") {payload.material_mode = d.format||"text";if(payload.material_mode==="file")payload.published=false;}
        if (kind === "quiz"||(["activity","examination"].includes(kind)&&state.compose.responseMode==="choice")) {
          if (Number($("#quiz-count").value)!==state.compose.questions.length) throw new Error("Apply the question count before saving.");
          captureQuizDraft();
          const questions=state.compose.questions.map((q,i)=>{
            if (!q.prompt.trim() || q.options.length<2 || q.options.length>6 || q.options.some(o=>!o.trim())) throw new Error(`Complete question ${i+1} and all its choices.`);
            if (!Number.isInteger(q.correct_index) || q.correct_index<0 || q.correct_index>=q.options.length) throw new Error(`Select the correct answer for question ${i+1}.`);
            return {prompt:q.prompt.trim(),options:q.options.map(o=>o.trim()),correct_index:q.correct_index};
          });
          if (state.quizSupported||state.formsSupported) payload.questions=questions;
          else {payload.options=questions[0].options;payload.correct_index=questions[0].correct_index;payload.body=questions[0].prompt;}

        }
        const created = await post(`/v1/subjects/${state.active.id}/items`, payload);
        savedId = created.id;
      }
      state.dirty = false;
      state.compose = null;
      renderComposer();
      try { await reloadActive({position, feedbackId:savedId}); }
      catch (error) {
        error.message = "Entry saved. The subject could not refresh; use Refresh before adding another entry. " + error.message;
        throw error;
      }
      if (!item) revealNearby(document.querySelector(`[data-item="${savedId}"]`));
      toast("Entry saved.");
    }
    if (form.id === "subject-form") {
      if (form.dataset.edit === "true") {
        await api(`/v1/subjects/${state.active.id}`, {
          method: "PATCH",
          body: {
            title: d.title,
            description: d.description,
            expected_title: state.active.title,
            expected_description: state.active.description,
          },
        });
        state.dirty = false;
        await reloadActive();
      } else {
        const created = await post("/v1/subjects", {
          title: d.title,
          description: d.description,
        });
        state.dirty = false;
        await refreshData();
        await navigate("subject", created.id);
      }
      toast("Subject saved.");
    }
    if (["quiz","answers","submission"].includes(form.dataset.form)) {
      const position = capturePosition(id);
      if (
        !(await confirmAction(
          "Submit your work?",
          "You can submit once for this version of the entry.",
          "Submit",
        ))
      )
        return;
      form.dataset.key ||= crypto.randomUUID();
      const submitted=await post(
        `/v1/items/${id}/${form.dataset.form === "quiz" ? "quiz" : form.dataset.form === "answers" ? "answers" : "submission"}`,
        form.dataset.form !== "submission"
          ? { answers:(state.items.find(i=>i.id===id).questions||[{}]).map((_,i)=>Number(d[`answer-${i}`])), expected_revision:Number(form.dataset.revision), ...(!state.quizSupported?{choice:Number(d["answer-0"])}:{}) }
          : { output: d.output },
        form.dataset.key,
      );
      state.dirty = false;
      state.readyQuizzes.delete(id);
      // Acknowledged submission: prevent another write if the following refresh fails.
      form.replaceChildren(Object.assign(document.createElement("p"),{textContent:submitted.result?`${submitted.result.correct} / ${submitted.result.total} correct · ${submitted.result.score}%`:submitted.attempt?`${submitted.attempt.score} / ${submitted.attempt.max_score||1} correct`:"Submitted. Refresh to view your result."}));
      await reloadActive({position,feedbackId:id});
      toast("Work submitted.");
    }
    if (form.dataset.form === "grade") {
      const saved = await post(`/v1/submissions/${id}/grade`, {
        score: Number(d.score),
        feedback: d.feedback,
        expected_graded_at: form.dataset.graded ? Number(form.dataset.graded) : null,
      });
      // Acknowledge this form alone. Other grades remain editable and unsaved.
      form.dataset.dirty = "false";
      form.dataset.refreshRequired = "true";
      form.querySelector("button").disabled = true;
      form.querySelector(".grade-status").textContent = "Saved";
      form.closest("[data-item]").querySelector("[data-work-status]").textContent = "Graded";
      state.dirty = Boolean(document.querySelector('[data-form="grade"][data-dirty="true"]'));
      let grade = saved.submission;
      if (!grade) {
        // Compatibility with older organization services returning only graded:true.
        try {
          const view = await api(`/v1/subjects/${state.active.id}/learners/${form.dataset.student}`);
          grade = view.items.find(item => item.submission_id === id);
        } catch (error) {
          form.querySelector(".grade-status").textContent = "Saved · reopen work before editing this grade";
          toast("Grade saved. Other drafts are kept. Reopen this work to refresh its saved grade. " + error.message);
          return;
        }
      }
      if (!grade?.graded_at) {
        form.querySelector(".grade-status").textContent = "Saved · reopen work before editing this grade";
        toast("Grade saved. Reopen this work to refresh its saved grade.");
        return;
      }
      form.dataset.graded = String(grade.graded_at);
      form.dataset.refreshRequired = "false";
      form.elements.score.value = grade.score;
      form.elements.feedback.value = grade.feedback;
      form.querySelector(".grade-status").textContent = "Saved · " + new Date(grade.graded_at).toLocaleString();
      toast("Grade saved.");
    }
    if (form.id === "eligibility") {
      if (
        !(await confirmAction(
          "Save enrollment eligibility?",
          "Self-enrolled students who no longer qualify may lose access. Administrator enrollments remain overrides.",
          "Save eligibility",
        ))
      )
        return;
      await post(`/v1/subjects/${state.active.id}/eligibility`, {
        all_students: !!d.all,
        student_numbers: d.all
          ? []
          : d.numbers
              .split(/[\n,]+/)
              .map((x) => x.trim())
              .filter(Boolean),
        expected_revision: Number(form.dataset.revision),
      });
      state.dirty = false;
      await renderEligibility();
      toast("Eligibility saved.");
    }
    if (form.id === "join-code") {
      const code = d.code.trim().toLowerCase().replace(/^aoa:\/\/subject\//, "");
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(code))
        throw new Error("Enter the full subject code or Academy QR value.");
      await post(`/v1/subjects/${code}/enrol`, { source: "qr" });
      state.dirty = false;
      await refreshData();
      await navigate("subject", code);
      toast("You’re enrolled.");
    }
    if (form.id === "announcement") {
      await post("/v1/announcements", { title: d.title, body: d.body });
      state.dirty = false;
      await refreshData();
      renderAnnouncements();
      renderRight();
      toast("Announcement published.");
    }
    if (form.id === "new-account") {
      if (d.confirm_password !== undefined && d.password !== d.confirm_password)
        throw new Error("Password and confirmation do not match.");
      const payload = { ...d };
      delete payload.confirm_password;
      if (payload.role !== "student" || !payload.student_number?.trim()) delete payload.student_number;
      await post("/v1/admin/accounts", payload);
      state.dirty = false;
      await renderAccounts();
      toast("Account created.");
    }
    if (form.id === "reset-password-form") {
      if (d.confirm_password !== undefined && d.password !== d.confirm_password)
        throw new Error("New password and confirmation do not match.");
      const requireChange = form.elements.require_change ? form.elements.require_change.checked : true;
      if (
        !(await confirmAction(
          "Update account password?",
          requireChange
            ? "All active sessions for this user will be signed out immediately, and they must choose a new password at next sign-in."
            : "All active sessions for this user will be signed out immediately and they can sign in with this new password right away.",
          "Update password",
        ))
      )
        return;
      await post(`/v1/admin/accounts/${id}/password`, { password: d.password, require_change: requireChange });
      state.dirty = false;
      $("#account-form-slot").innerHTML = "";
      toast(requireChange ? "Password updated. User must rotate password at next sign-in." : "Account password updated. Existing sessions signed out.");
    }
    if (form.id === "edit-student-id-form") {
      await api(`/v1/admin/accounts/${id}`, {
        method: "PATCH",
        body: { student_number: d.student_number.trim() || null },
      });
      state.dirty = false;
      await renderAccounts();
      toast("Student ID updated.");
    }
    if (form.id === "folder-form") {
      if (!canManageFolders()) return;
      const mode = form.dataset.mode;
      const name = d.name.trim();
      if (!name) throw new Error("Enter a folder name.");
      if (mode === "rename") {
        const res = await api(`/v1/admin/folders/${id}`, {
          method: "PATCH",
          body: { name },
        });
        state.folders = res.folders;
        state.folderForm = null;
        syncSubjectNav();
        if (state.view === "subjects") await navigate("subjects");
        toast("Folder renamed.");
      } else {
        const parentId = d.parent_id ? d.parent_id : null;
        const res = await post("/v1/admin/folders", { name, parent_id: parentId });
        state.folders = res.folders;
        if (parentId) state.collapsedFolders.delete(parentId);
        state.folderForm = null;
        syncSubjectNav();
        toast("Folder created.");
      }
      return;
    }
    if (form.id === "password") {
      if (d.next !== d.confirm)
        throw new Error("New password and confirmation do not match.");
      await post("/v1/auth/password", {
        current_password: d.current,
        new_password: d.next,
      });
      state.dirty = false;
      resumeWorkspace = null;
      window.academyPresenter?.close();
      window.academyEditor?.clearImageCache();
      await window.academyReader.close();
      state.collapsedFolders.clear();
      state.collapsedEntries.clear();
      Object.assign(state, {
        account: null,
        active: null,
        activeLearnerId: null,
        items: [],
        subjects: [],
        folders: [],
        folderForm: null,
        announcements: [],
      });
      $("#app").innerHTML = "";
      showLogin();
      toast("Password updated. Sign in again.");
    }
  });
});
document.addEventListener("input", (event) => {
  if (event.target.id === "search") {
    state.search = event.target.value;
    applySubjectSearch();
    return;
  }
  if (event.target.matches("[data-question-option]")) {
    event.target.closest("[data-question-editor]").querySelectorAll('input[type=radio]').forEach(el=>{el.checked=false;});
  }
  if (event.target.matches("#composer input[name=link]")) {
    clearTimeout(event.target.linkTimer);
    event.target.linkTimer = setTimeout(() => inspectLinkField(event.target), 200);
  }
  const gradeForm = event.target.closest('[data-form="grade"]');
  if (gradeForm) {
    gradeForm.dataset.dirty = "true";
    gradeForm.querySelector("button").disabled = gradeForm.dataset.refreshRequired === "true";
    gradeForm.querySelector(".grade-status").textContent = gradeForm.dataset.refreshRequired === "true" ? "Reopen work before saving another grade" : "Unsaved changes";
  }
  if (event.target.closest("#app form:not(#folder-form)")) state.dirty = true;
});
document.addEventListener("change", (event) => {
  if (event.target.matches("[data-editor-block]")) {
    const editorEl = $("#rich-editor");
    if (editorEl) {
      window.academyEditor?.applyCommand(editorEl, "formatBlock", event.target.value);
      state.dirty = true;
    }
    return;
  }
  if (event.target.id === "paragraph-spacing") {
    const editorEl = $("#rich-editor");
    if (editorEl) editorEl.dataset.spacing = event.target.value;
    if (state.compose) state.compose.paragraphSpacing = event.target.value;
    state.dirty = true;
    return;
  }
  if (event.target.matches("#new-account select[name=role]")) {
    const isStudent = event.target.value === "student";
    const field = $("#student-id-field");
    if (field) {
      field.hidden = !isStudent;
      if (!isStudent) field.querySelector("input").value = "";
    }
    state.dirty = true;
    return;
  }
  if(event.target.id==="response-mode"){
    captureQuizDraft();state.compose.responseMode=event.target.value;
    const composer=$("#composer"),existing=$("#quiz-builder");if(existing)existing.remove();
    if(event.target.value==="choice"){const host=document.createElement("div");host.id="quiz-builder";composer.querySelector(".form-actions").before(host);renderQuizBuilder();}state.dirty=true;return;
  }
  if (event.target.id === "entry-kind") {
    captureQuizDraft();
    const form = $("#composer");
    const previous = [...form.elements].filter((el) => el.name && el.name !== "kind" && !el.name.startsWith("key-")).map((el) => ({ name: el.name, value: el.value, checked: el.checked }));
    const fields = { ...state.compose.fields };
    if (form.elements.options) delete fields.correct;
    for (const field of previous) {
      if (field.name !== "link" && (field.name !== "correct" || field.checked)) fields[field.name] = field;
    }
    if ($("#link-fields")) fields.links = previous.filter((field) => field.name === "link");
    const richHtml = $("#rich-editor")?.innerHTML || "";
    const paragraphSpacing = form.elements.paragraph_spacing?.value || state.compose.paragraphSpacing || "normal";
    state.compose = { ...state.compose, kind: event.target.value, fields, paragraphSpacing };
    renderComposer();
    const restored = $("#composer");
    if ($("#rich-editor") && richHtml) {
      $("#rich-editor").innerHTML = richHtml;
      $("#rich-editor").dataset.spacing = paragraphSpacing;
    }
    for (const field of [...Object.values(fields).filter((field) => field.name && field.name !== "correct"), ...(fields.links || [])]) {
      if (field.name === "link" && $("#link-fields")) $("#link-fields").insertAdjacentHTML("beforeend", linkField(field.value));
      else if (restored.elements[field.name]) {
        restored.elements[field.name].value = field.value;
        if (restored.elements[field.name].type === "checkbox") restored.elements[field.name].checked = field.checked;
      }
    }

    $("#link-fields")?.querySelectorAll("input").forEach(inspectLinkField);
    state.dirty = true;
  }
  if (event.target.id === "context-subject")
    act(async () => {
      if (!(await leaveDraft())) return;
      state.rosterOffset = 0;
      await loadSubject(event.target.value);
      shell();
      if (state.view === "learners") await renderLearners();
      else if (state.view === "access") await renderAccess();
      else await renderEligibility();
    });
  else if (event.target.closest("#app form:not(#folder-form)")) state.dirty = true;
});
function computeMultiLevelIds(sourceId, nextParentId, targetId = null, position = "inside") {
  const source = state.items.find((entry) => entry.id === sourceId);
  if (!source) return null;
  const groups = new Map();
  const addChild = (parentKey, item) => {
    const key = parentKey || "__root__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  };
  for (const item of state.items) {
    if (item.id === sourceId) continue;
    addChild(item.parent_id || null, item);
  }
  const destKey = nextParentId || "__root__";
  const destList = groups.get(destKey) || [];
  if (position === "before" && targetId) {
    const idx = destList.findIndex((entry) => entry.id === targetId);
    destList.splice(idx >= 0 ? idx : destList.length, 0, source);
  } else if (position === "after" && targetId) {
    const idx = destList.findIndex((entry) => entry.id === targetId);
    destList.splice(idx >= 0 ? idx + 1 : destList.length, 0, source);
  } else {
    destList.push(source);
  }
  groups.set(destKey, destList);
  const visit = (parentKey) =>
    (groups.get(parentKey || "__root__") || []).flatMap((item) => [item.id, ...visit(item.id)]);
  return visit(null);
}
async function moveEntryToLevel(sourceId, nextParentId, targetId = null, position = "inside") {
  const source = state.items.find((entry) => entry.id === sourceId);
  if (!source) return;
  const currentParent = source.parent_id || null;
  if (nextParentId !== null && !canNestEntryInside(sourceId, nextParentId)) return;
  const ids = computeMultiLevelIds(sourceId, nextParentId, targetId, position);
  if (!ids || ids.length !== state.items.length) return;
  if (nextParentId === currentParent) {
    const placement = targetId && (position === "before" || position === "after")
      ? { id: targetId, after: position === "after" }
      : undefined;
    await reorder(ids, targetId || sourceId, { movedId: sourceId, placement });
    return;
  }
  const capture = capturePosition(sourceId);
  await post(`/v1/subjects/${state.active.id}/order`, {
    item_ids: ids,
    expected_revision: state.active.order_revision,
    parent_updates: [{ id: sourceId, parent_id: nextParentId }],
  });
  if (nextParentId) {
    state.collapsedMaterials.delete(nextParentId);
    state.collapsedEntries.delete(nextParentId);
  }
  await reloadActive({ position: capture, feedbackId: sourceId });
  toast(nextParentId ? "Entry moved to new level." : "Entry moved to top level.");
}
document.addEventListener("keydown", (event) => {
  const folderRow = event.target.closest("[data-drag-folder]");
  if (folderRow && canManageFolders() && event.altKey && !event.ctrlKey && !event.metaKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    const id = folderRow.dataset.dragFolder;
    act(async () => {
      const folder = state.folders.find((f) => f.id === id);
      if (!folder) return;
      const parentId = folder.parent_id || null;
      const siblings = folderChildren(parentId);
      const index = siblings.findIndex((f) => f.id === id);
      let body = null;
      if (event.key === "ArrowUp" && index > 0) body = { before_id: siblings[index - 1].id };
      else if (event.key === "ArrowDown" && index < siblings.length - 1) body = { after_id: siblings[index + 1].id };
      else if (event.key === "ArrowLeft" && parentId) {
        const parent = state.folders.find((f) => f.id === parentId);
        body = { parent_id: parent?.parent_id || null };
      } else if (event.key === "ArrowRight" && index > 0) {
        body = { parent_id: siblings[index - 1].id };
        state.collapsedFolders.delete(siblings[index - 1].id);
      }
      if (!body) return;
      const res = await api(`/v1/admin/folders/${id}`, { method: "PATCH", body });
      state.folders = res.folders;
      syncSubjectNav();
      if (state.view === "subjects") await navigate("subjects");
      toast("Folder hierarchy updated.");
    }).then(() => document.querySelector(`[data-drag-folder="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }));
    return;
  }
  const handle = event.target.closest("[data-drag]");
  if (!handle || !event.altKey || event.ctrlKey || event.metaKey || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const id = handle.dataset.drag;
  act(async () => {
    if (!(await leaveDraft())) return;
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return;
    const siblings = siblingsOf(item);
    const index = siblings.findIndex((entry) => entry.id === id);
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const direction = event.key === "ArrowUp" ? -1 : 1;
      const next = index + direction;
      if (next < 0 || next >= siblings.length) return;
      [siblings[index], siblings[next]] = [siblings[next], siblings[index]];
      await reorder(item.parent_id ? flattenTree(rootsOf(), new Map([[item.parent_id, siblings]])) : flattenTree(siblings), id);
    } else if (event.key === "ArrowLeft" && item.parent_id) {
      const parent = state.items.find((entry) => entry.id === item.parent_id);
      await moveEntryToLevel(id, parent?.parent_id || null, parent?.id || null, "after");
    } else if (event.key === "ArrowRight" && index > 0) {
      const prevMaterial = [...siblings.slice(0, index)].reverse().find((s) => s.kind === "material" && canNestEntryInside(id, s.id));
      if (prevMaterial) await moveEntryToLevel(id, prevMaterial.id, null, "inside");
    }
  }).then(() => document.querySelector(`[data-drag="${id}"]`)?.focus({preventScroll:true}));
});
let dragSession = null;
let navDrag = null;
function clearNavDropMarkers() {
  document.querySelectorAll(".nav-drop-before,.nav-drop-after,.nav-drop-inside").forEach((el) =>
    el.classList.remove("nav-drop-before", "nav-drop-after", "nav-drop-inside"),
  );
  if (navDrag) navDrag.drop = null;
}
function endNavDrag() {
  document.querySelectorAll(".is-nav-dragging").forEach((el) => el.classList.remove("is-nav-dragging"));
  $("#subject-nav")?.classList.remove("nav-dragging");
  clearNavDropMarkers();
  navDrag = null;
}
function updateNavDropPlacement(event) {
  if (!navDrag) return null;
  const dropEl = event.target?.closest?.("[data-folder-drop]");
  if (!dropEl) {
    clearNavDropMarkers();
    return null;
  }
  const targetKey = dropEl.dataset.folderDrop;
  if (targetKey === "root") {
    clearNavDropMarkers();
    dropEl.classList.add("nav-drop-inside");
    navDrag.drop = { targetId: null, position: "inside" };
    return navDrag.drop;
  }
  const targetId = targetKey;
  if (navDrag.kind === "subject") {
    clearNavDropMarkers();
    dropEl.classList.add("nav-drop-inside");
    navDrag.drop = { targetId, position: "inside" };
    return navDrag.drop;
  }
  if (targetId === navDrag.id || folderDescendantsLocal(navDrag.id).has(targetId)) {
    clearNavDropMarkers();
    return null;
  }
  let position = "inside";
  if (dropEl.classList.contains("nav-folder-row")) {
    const rect = dropEl.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);
    if (ratio < 0.28) position = "before";
    else if (ratio > 0.72) position = "after";
  }
  clearNavDropMarkers();
  dropEl.classList.add(
    position === "before" ? "nav-drop-before" : position === "after" ? "nav-drop-after" : "nav-drop-inside",
  );
  navDrag.drop = { targetId, position };
  return navDrag.drop;
}
function clearDropMarker() {
  document.querySelectorAll(".drop-before,.drop-after,.drop-inside").forEach((el) => el.classList.remove("drop-before","drop-after","drop-inside"));
  if (dragSession) dragSession.placement = null;
}
function endDrag() {
  if (dragSession?.frame) cancelAnimationFrame(dragSession.frame);
  document.querySelectorAll(".is-dragging,.drag-preview").forEach((el) => el.matches(".drag-preview") ? el.remove() : el.classList.remove("is-dragging"));
  clearDropMarker();
  dragSession = null;
}
function updateDropPlacement(x,y) {
  if (!dragSession) return null;
  const source = state.items.find((item) => item.id === dragSession.id);
  const element = document.elementFromPoint(x,y);
  const center = $("#center"), bounds = center.getBoundingClientRect();
  if (!element || x<bounds.left || x>bounds.right || y<bounds.top || y>bounds.bottom) { clearDropMarker(); return null; }
  const sourceDesc = new Set(descendantsOf(source.id).map((d) => d.id));
  sourceDesc.add(source.id);

  // Drop on an "+ Add ..." slot places at the end of that material (or root level).
  const addSlot = element.closest("[data-add-parent]");
  if (addSlot) {
    const slotParent = addSlot.dataset.addParent || null;
    if (slotParent && (sourceDesc.has(slotParent) || !canNestEntryInside(source.id, slotParent))) {
      clearDropMarker();
      return null;
    }
    const previous = dragSession.placement;
    const key = `slot:${slotParent || "root"}`;
    if (previous?.key !== key) {
      clearDropMarker();
      const siblings = slotParent ? childrenOf(slotParent).filter((i) => i.id !== source.id) : rootsOf().filter((i) => i.id !== source.id);
      const last = siblings.at(-1);
      if (last && groupFor(last.id)) groupFor(last.id).classList.add("drop-after");
      else addSlot.classList.add("drop-inside");
      dragSession.placement = {
        key,
        id: last?.id || slotParent,
        parentId: slotParent,
        position: last ? "after" : "inside",
        after: Boolean(last),
      };
    }
    return dragSession.placement;
  }

  let group = element.closest("[data-group]");
  while (group && sourceDesc.has(group.dataset.group)) {
    group = group.parentElement?.closest("[data-group]");
  }
  if (!group) {
    const container = groupFor(source.id)?.parentElement;
    if (container && container.contains(element)) {
      let nearest = Infinity;
      for (const item of siblingsOf(source)) {
        const candidate = groupFor(item.id);
        if (item.id===source.id || !candidate?.getClientRects().length) continue;
        const rect = candidate.getBoundingClientRect();
        const distance = Math.max(rect.top-y, y-rect.bottom, 0);
        if (distance<nearest) { nearest=distance; group=candidate; }
      }
    }
  }
  if (!group || sourceDesc.has(group.dataset.group)) { clearDropMarker(); return null; }
  const targetItem = state.items.find((entry) => entry.id === group.dataset.group);
  if (!targetItem) { clearDropMarker(); return null; }

  const cardEl = group.querySelector(":scope > [data-item]") || group;
  const cardRect = cardEl.getBoundingClientRect();
  const groupRect = group.getBoundingClientRect();
  const canNest = targetItem.kind === "material" && canNestEntryInside(source.id, targetItem.id);
  const canAdoptTargetParent = !targetItem.parent_id || canNestEntryInside(source.id, targetItem.parent_id);

  let position = "after";
  let nextParentId = targetItem.parent_id || null;
  const previous = dragSession.placement;

  if (canNest && y >= cardRect.top && y <= cardRect.bottom) {
    const ratio = (y - cardRect.top) / Math.max(1, cardRect.height);
    if (canAdoptTargetParent && ratio < 0.25) {
      position = "before";
      nextParentId = targetItem.parent_id || null;
    } else if (canAdoptTargetParent && ratio > 0.75) {
      position = "after";
      nextParentId = targetItem.parent_id || null;
    } else {
      position = "inside";
      nextParentId = targetItem.id;
    }
  } else if (canAdoptTargetParent) {
    const midpoint = groupRect.top + groupRect.height / 2;
    const after = previous?.id === targetItem.id && previous.position !== "inside" && Math.abs(y - midpoint) < 7
      ? previous.after
      : y >= midpoint;
    position = after ? "after" : "before";
    nextParentId = targetItem.parent_id || null;
  } else if (canNest) {
    position = "inside";
    nextParentId = targetItem.id;
  } else {
    clearDropMarker();
    return null;
  }

  const key = `${targetItem.id}:${position}:${nextParentId || "root"}`;
  if (previous?.key !== key) {
    clearDropMarker();
    if (position === "inside") cardEl.classList.add("drop-inside");
    else group.classList.add(position === "after" ? "drop-after" : "drop-before");
    dragSession.placement = {
      key,
      id: targetItem.id,
      parentId: nextParentId,
      position,
      after: position === "after",
    };
  }
  return dragSession.placement;
}
function dragAutoScroll(time) {
  if (!dragSession) return;
  const center = $("#center"), bounds = center.getBoundingClientRect();
  const {x,y} = dragSession;
  const step = Math.min(32,time-(dragSession.time || time));
  dragSession.time = time;
  if (x>=bounds.left && x<=bounds.right && y>=bounds.top && y<=bounds.bottom) {
    const edge=52, distance=y<bounds.top+edge ? y-bounds.top-edge : y>bounds.bottom-edge ? y-bounds.bottom+edge : 0;
    if (distance) {
      const previous = center.scrollTop;
      center.scrollTop += Math.max(-1,Math.min(1,distance/edge))*step*.42;
      if (center.scrollTop!==previous) updateDropPlacement(x,y);
    }
  }
  dragSession.frame = requestAnimationFrame(dragAutoScroll);
}
document.addEventListener("dragstart", (event) => {
  const navSubject = event.target.closest?.("[data-drag-subject]");
  const navFolder = !navSubject ? event.target.closest?.("[data-drag-folder]") : null;
  if (navSubject || navFolder) {
    if (!canManageFolders() || state.busy || (navFolder && event.target.closest("button"))) {
      event.preventDefault();
      return;
    }
    endNavDrag();
    const kind = navSubject ? "subject" : "folder";
    const id = navSubject ? navSubject.dataset.dragSubject : navFolder.dataset.dragFolder;
    navDrag = { kind, id, drop: null };
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
    (navSubject || navFolder).classList.add("is-nav-dragging");
    $("#subject-nav")?.classList.add("nav-dragging");
    return;
  }
  const handle = event.target.closest("[data-drag]");
  if (!handle) return;
  if (state.busy || state.dirty) { event.preventDefault(); if(state.dirty)toast("Save or cancel your draft before dragging."); return; }
  endDrag();
  capturePosition(); // Finish any prior movement before reading hit areas.
  const item = state.items.find((entry) => entry.id===handle.dataset.drag);
  dragSession = {id:item.id,x:event.clientX,y:event.clientY,placement:null};
  event.dataTransfer.setData("text/plain",item.id);
  event.dataTransfer.effectAllowed = "move";
  const preview = document.createElement("div");
  preview.className = "drag-preview";
  preview.textContent = item.title;
  document.body.append(preview);
  event.dataTransfer.setDragImage(preview,18,18);
  groupFor(item.id).classList.add("is-dragging");
  dragSession.frame = requestAnimationFrame(dragAutoScroll);
});
document.addEventListener("dragover", (event) => {
  if (navDrag) {
    if (updateNavDropPlacement(event)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    } else event.dataTransfer.dropEffect = "none";
    return;
  }
  if (!dragSession) return;
  dragSession.x=event.clientX;dragSession.y=event.clientY;
  if (updateDropPlacement(event.clientX,event.clientY)) {
    event.preventDefault();event.dataTransfer.dropEffect="move";
  } else event.dataTransfer.dropEffect="none";
});
document.addEventListener("dragleave", (event) => {
  if (!dragSession || event.relatedTarget) return;
  const bounds = $("#center").getBoundingClientRect();
  if(event.clientX<=bounds.left || event.clientX>=bounds.right || event.clientY<=bounds.top || event.clientY>=bounds.bottom) {
    dragSession.x=event.clientX;dragSession.y=event.clientY;clearDropMarker();
  }
});
document.addEventListener("dragend", () => { endDrag(); endNavDrag(); });
window.addEventListener("blur", () => { endDrag(); endNavDrag(); });
document.addEventListener("drop", (event) => {
  if (navDrag) {
    const drag = navDrag;
    const placement = updateNavDropPlacement(event) || drag.drop;
    event.preventDefault();
    endNavDrag();
    if (!placement) return;
    act(async () => {
      if (drag.kind === "subject") {
        const subject = state.subjects.find((s) => s.id === drag.id);
        if (!subject || (subject.folder_id || null) === placement.targetId) return;
        await post(`/v1/admin/subjects/${drag.id}/folder`, { folder_id: placement.targetId });
        if (placement.targetId) state.collapsedFolders.delete(placement.targetId);
        await refreshData();
        syncSubjectNav();
        if (state.view === "subjects") await navigate("subjects");
        toast(placement.targetId ? "Subject moved into folder." : "Subject moved to top level.");
      } else {
        const body =
          placement.position === "before"
            ? { before_id: placement.targetId }
            : placement.position === "after"
              ? { after_id: placement.targetId }
              : { parent_id: placement.targetId };
        const res = await api(`/v1/admin/folders/${drag.id}`, { method: "PATCH", body });
        state.folders = res.folders;
        if (placement.position === "inside" && placement.targetId)
          state.collapsedFolders.delete(placement.targetId);
        syncSubjectNav();
        if (state.view === "subjects") await navigate("subjects");
        toast("Folder hierarchy updated.");
      }
    });
    return;
  }
  if (!dragSession) return;
  const sourceId=dragSession.id;
  const placement=updateDropPlacement(event.clientX,event.clientY);
  event.preventDefault();
  endDrag();
  if (!placement) return;
  act(async () => {
    await moveEntryToLevel(sourceId, placement.parentId ?? null, placement.id || null, placement.position || "after");
  });
});
window.addEventListener("beforeunload", (event) => {
  if (state.dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
showLogin();
