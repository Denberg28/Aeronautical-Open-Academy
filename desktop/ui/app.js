"use strict";
const desktopApi = Object.fromEntries(
  ["login", "request", "logout", "openLink", "inspectLink", "sync", "uploadMaterial", "uploadImage", "pickImage", "readImage", "exportPackage", "previewImport", "commitImport", "cancelImport"].map((method) => [method, async (...args) => {
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
  check: "M5 12l4 4L19 6",
  tasks: "M9 6h12 M9 12h12 M9 18h12 M3 6h1 M3 12h1 M3 18h1",
  users:
    "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M19 8v6 M16 11h6",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
  plus: "M12 5v14 M5 12h14",
  edit: "M15 5l4 4 M3 21l5-1L21 7a2 2 0 0 0-4-4L4 16z",
  chevron: "M8 5l7 7-7 7",
  grip: "M9 5h.01 M15 5h.01 M9 12h.01 M15 12h.01 M9 19h.01 M15 19h.01",
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
  export: "M12 3v12 M7 8l5-5 5 5 M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  import: "M12 15V3 M7 10l5 5 5-5 M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  arrowLeft: "M15 6l-6 6 6 6",
  arrowRight: "M9 6l6 6-6 6",
  panelRight: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M15 5v14",
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
  sidebarState: "normal",
  rightbarCollapsed: false,
  collapsedMaterials: new Set(),
  collapsedEntries: new Set(),
  collapsedFolders: new Set(),
  mode: "local",
  subjects: [],
  folders: [],
  folderForm: null,
  announcements: [],
  active: null,
  items: [],
  capabilities: {},
  view: "subject",
  search: "",
  entryFilter: "all",
  subjectSearch: "",
  compose: null,
  dirty: false,
  busy: false,
  allItems: [],
  accountOffset: 0,
};
const PREFS_UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MAX_SAVED_IDS = 500;
function workspacePrefsKey() {
  if (!state.account?.id) return "";
  const scope = state.mode === "organization" ? state.origin || "org" : "local";
  return `aoa-ui-prefs-v1:${state.mode || "local"}:${scope}:${state.account.id}`;
}
function saveWorkspacePrefs() {
  const key = workspacePrefsKey();
  if (!key) return;
  try {
    const payload = {
      sidebarState: ["collapsed", "normal", "expanded"].includes(state.sidebarState)
        ? state.sidebarState
        : "normal",
      rightbarCollapsed: Boolean(state.rightbarCollapsed),
      collapsedEntries: [...state.collapsedEntries].filter((id) => PREFS_UUID_RE.test(id)).slice(-MAX_SAVED_IDS),
      collapsedMaterials: [...state.collapsedMaterials].filter((id) => PREFS_UUID_RE.test(id)).slice(-MAX_SAVED_IDS),
      collapsedFolders: [...state.collapsedFolders].filter((id) => PREFS_UUID_RE.test(id)).slice(-MAX_SAVED_IDS),
      activeSubjectId: state.active?.id && PREFS_UUID_RE.test(state.active.id) ? state.active.id : null,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* Ignore storage quota or sandbox errors; in-memory state remains active. */
  }
}
function loadWorkspacePrefs() {
  state.sidebarState = "normal";
  state.rightbarCollapsed = false;
  state.collapsedEntries.clear();
  state.collapsedMaterials.clear();
  state.collapsedFolders.clear();
  let preferredSubjectId = null;
  const key = workspacePrefsKey();
  if (!key) return preferredSubjectId;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return preferredSubjectId;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return preferredSubjectId;
    if (["collapsed", "normal", "expanded"].includes(parsed.sidebarState)) {
      state.sidebarState = parsed.sidebarState;
    }
    state.rightbarCollapsed = parsed.rightbarCollapsed === true;
    if (Array.isArray(parsed.collapsedEntries)) {
      for (const id of parsed.collapsedEntries.slice(-MAX_SAVED_IDS)) {
        if (typeof id === "string" && PREFS_UUID_RE.test(id)) state.collapsedEntries.add(id);
      }
    }
    if (Array.isArray(parsed.collapsedMaterials)) {
      for (const id of parsed.collapsedMaterials.slice(-MAX_SAVED_IDS)) {
        if (typeof id === "string" && PREFS_UUID_RE.test(id)) state.collapsedMaterials.add(id);
      }
    }
    if (Array.isArray(parsed.collapsedFolders)) {
      for (const id of parsed.collapsedFolders.slice(-MAX_SAVED_IDS)) {
        if (typeof id === "string" && PREFS_UUID_RE.test(id)) state.collapsedFolders.add(id);
      }
    }
    if (typeof parsed.activeSubjectId === "string" && PREFS_UUID_RE.test(parsed.activeSubjectId)) {
      preferredSubjectId = parsed.activeSubjectId;
    }
  } catch {
    /* Malformed storage falls back to default expanded layout safely. */
  }
  return preferredSubjectId;
}
function clearInMemoryUiState() {
  state.sidebarState = "normal";
  state.rightbarCollapsed = false;
  state.entryFilter = "all";
  state.subjectSearch = "";
  state.collapsedMaterials.clear();
  state.collapsedEntries.clear();
  state.collapsedFolders.clear();
  $("#app")?.classList.remove("sidebar-collapsed", "sidebar-expanded", "rightbar-collapsed");
}
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
let pendingFocus = null;
function focusAfterAct(selector, options = { preventScroll: true }) {
  pendingFocus = { selector, options };
}
async function act(fn) {
  if (state.busy) return;
  state.busy = true;
  pendingFocus = null;
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
      saveWorkspacePrefs();
      if (state.account && state.dirty) resumeWorkspace = { id: state.account.id, role: state.account.role, mode: state.mode, origin: state.origin };
      state.account = null;
      window.academyPresenter?.close();
      window.academyEditor?.clearImageCache();
      await window.academyReader.close();
      // Recovery — Lock a dirty form behind sign-in; discard other private views.
      // Resume below rechecks subject access before revealing the retained editor.
      if (!resumeWorkspace) {state.items=[];state.subjects=[];state.active=null;clearInMemoryUiState();$("#app").replaceChildren();}
      showLogin();
    }
  } finally {
    state.busy = false;
    document.body.classList.remove("working");
    $("#app").inert = false;
    if (pendingFocus) {
      const target = pendingFocus;
      pendingFocus = null;
      const el = typeof target.selector === "function" ? target.selector() : $(target.selector);
      el?.focus(target.options);
    }
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
const isAdmin = () => state.account?.role === "admin";
const owned = (item) =>
  isAdmin() || item.owner_id === state.account.id;
const canEditSubject = (subject = state.active) =>
  Boolean(subject ? (subject.can_edit ?? true) : true);
const canDeleteSubject = (subject = state.active) =>
  Boolean(subject && (subject.can_delete ?? owned(subject)));
const canEditItem = (item) =>
  Boolean(item && (item.can_edit ?? (canEditSubject() && owned(item))));
const navLabel = () =>
  ({
    subject: "My subjects",
    subjects: "My subjects",
    tasks: "Drafts",
    access: "Subject access",
    accounts: "Accounts",
    announcements: "Announcements",
    settings: "Settings",
    help: "Help",
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
  const heroGroup = $("#subject-context .hero-title-group");
  if (heroGroup && state.view === "subject" && state.active) {
    const activeSubject =
      state.subjects.find((item) => item.id === state.active.id) || state.active;
    state.active = { ...state.active, folder_id: activeSubject.folder_id || null };
    const folderPath = folderPathName(activeSubject.folder_id);
    let badge = heroGroup.querySelector(".hero-folder-tag");
    if (folderPath) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "tag hero-folder-tag";
        heroGroup.appendChild(badge);
      }
      badge.textContent = folderPath;
    } else if (badge) {
      badge.remove();
    }
  }
}
function syncSidebarState() {
  const app = $("#app");
  if (!app) return;
  app.classList.toggle("sidebar-collapsed", state.sidebarState === "collapsed");
  app.classList.toggle("sidebar-expanded", state.sidebarState === "expanded");
  const narrowBtn = app.querySelector('[data-action="sidebar-narrow"]');
  const widenBtn = app.querySelector('[data-action="sidebar-widen"]');
  if (narrowBtn) {
    const isCollapsed = state.sidebarState === "collapsed";
    const isExpanded = state.sidebarState === "expanded";
    narrowBtn.hidden = isCollapsed;
    narrowBtn.disabled = isCollapsed;
    const label = isExpanded ? "Restore left column width" : "Collapse left column";
    narrowBtn.title = `${label} (Alt+[)`;
    narrowBtn.setAttribute("aria-label", label);
  }
  if (widenBtn) {
    const isExpanded = state.sidebarState === "expanded";
    const isCollapsed = state.sidebarState === "collapsed";
    widenBtn.disabled = isExpanded;
    const label = isCollapsed
      ? "Expand left column"
      : isExpanded
        ? "Left column expanded"
        : "Expand left column wider";
    widenBtn.title = isExpanded ? label : `${label} (Alt+])`;
    widenBtn.setAttribute("aria-label", label);
    widenBtn.setAttribute("aria-expanded", String(isExpanded));
  }
}
function syncRightbarState() {
  const app = $("#app");
  if (!app) return;
  const collapsed = Boolean(state.rightbarCollapsed);
  app.classList.toggle("rightbar-collapsed", collapsed);
  const label = collapsed ? "Expand right pane" : "Minimize right pane";
  app.querySelectorAll('[data-action="rightbar-toggle"]').forEach((btn) => {
    btn.title = `${label} (Alt+\\)`;
    btn.setAttribute("aria-label", label);
    btn.setAttribute("aria-expanded", String(!collapsed));
    if (btn.classList.contains("rightbar-arrow-btn")) {
      btn.innerHTML = icon(collapsed ? "arrowLeft" : "arrowRight");
    }
  });
}
function shell() {
  const a = state.account;
  const pendingPassword = Boolean(a.must_change_password);
  const roleLabel = a.role === "admin" ? "Administrator" : "Instructor";
  $("#app").innerHTML =
    `<aside class="sidebar" id="sidebar" aria-label="Workspace navigation"><div class="sidebar-head"><div class="brand"><span class="brand-mark">A</span><span class="brand-text">AERONAUTICAL<br>ACADEMY REPOSITORY</span></div><div class="sidebar-width-controls" role="group" aria-label="Left column width">${button(icon("arrowLeft"), "sidebar-narrow", 'title="Collapse left column (Alt+[)" aria-label="Collapse left column"', "quiet sidebar-arrow-btn")}${button(icon("arrowRight"), "sidebar-widen", 'title="Expand left column wider (Alt+])" aria-label="Expand left column wider" aria-expanded="false"', "quiet sidebar-arrow-btn")}</div></div>${
      pendingPassword
        ? `<details open><summary>SECURITY</summary>${nav("Settings", "settings", "settings", true)}</details>`
        : `<details open><summary>WORKSPACE</summary>${nav("My subjects", "subjects", "book", ["subject", "subjects"].includes(state.view), canManageFolders() ? 'data-folder-drop="root"' : "")}<div id="subject-nav">${renderSubjectNav()}</div>${nav("Drafts", "tasks", "tasks", state.view === "tasks")}${!isAdmin() ? nav("Announcements", "announcements", "bell", state.view === "announcements") : ""}</details>${isAdmin() ? `<details open><summary>ADMINISTRATION</summary>${nav("Subject access", "access", "check", state.view === "access")}${nav("Accounts", "accounts", "users", state.view === "accounts")}${nav("Announcements", "announcements", "bell", state.view === "announcements")}</details>` : ""}<details ${["settings", "help"].includes(state.view) ? "open" : ""}><summary>MORE</summary>${nav("Settings", "settings", "settings", state.view === "settings")}${nav("Help", "help", "help", state.view === "help")}</details>`
    }<div class="sidebar-foot"><p class="workspace-label"><span class="dot"></span><span>${state.mode === "local" ? "LOCAL WORKSPACE" : "ORGANIZATION"}</span></p><p class="small muted">Aeronautical Academy Repository · ${escape(state.version)}</p></div></aside><header class="topbar"><div class="breadcrumbs">Repository <span aria-hidden="true"> / </span><strong>${escape(navLabel())}</strong></div><div class="row"><span class="top-date">${new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span><div class="account"><span class="avatar">${escape(
      a.name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join(""),
    )}</span><div><div class="account-name">${escape(a.name)}</div><div class="account-role">${escape(roleLabel)}</div></div></div>${pendingPassword ? "" : button(icon("sync") + "Sync", "sync", 'title="Refresh shared subjects, folders and materials"', "quiet")}${pendingPassword ? "" : button(icon("panelRight"), "rightbar-toggle", 'title="Minimize right pane (Alt+\\)" aria-label="Minimize right pane" aria-expanded="true"', "quiet rightbar-top-toggle")}${button(icon("logout"), "logout", 'title="Sign out" aria-label="Sign out"', "quiet")}</div></header><div class="center-pane"><div id="subject-context" class="subject-context" hidden></div><main class="center" id="center" aria-label="Repository workspace"></main></div><aside class="rightbar" id="rightbar" aria-label="Announcements and drafts"></aside>`;
  syncSidebarState();
  $("#app").hidden = false;
  renderRight();
  syncRightbarState();
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
  const previousId = state.active?.id || null;
  const data = await api(`/v1/subjects/${id}`);
  if (sequence !== loadSequence) return;
  state.active = data.subject;
  state.items = data.items;
  state.treeSupported = data.tree_version >= 1;
  state.quizSupported = data.quiz_version >= 1;
  state.maxQuestions=state.quizSupported?(state.capabilities.max_quiz_questions||50):state.capabilities.choice_forms?20:1;
  state.formsSupported = data.choice_forms === true || state.capabilities.choice_forms === true;
  state.compose = null;
  state.dirty = false;
  if (previousId !== data.subject.id || (state.entryFilter === "drafts" && !canEditSubject(data.subject))) {
    state.entryFilter = "all";
  }
  saveWorkspacePrefs();
}
async function start() {
  state.folderForm = null;
  await refreshData();
  const preferredSubjectId = loadWorkspacePrefs();
  const validFolderIds = new Set(state.folders.map((f) => f.id));
  for (const fid of [...state.collapsedFolders]) {
    if (!validFolderIds.has(fid)) state.collapsedFolders.delete(fid);
  }
  state.items = [];
  state.active = null;
  state.accountOffset = 0;
  state.view = "subject";
  state.search = "";
  state.entryFilter = "all";
  state.subjectSearch = "";
  state.compose = null;
  const targetSubject =
    (preferredSubjectId && state.subjects.find((s) => s.id === preferredSubjectId)) ||
    state.subjects[0] ||
    null;
  if (targetSubject) await loadSubject(targetSubject.id);
  else state.active = null;
  shell();
  renderSubject();
}
function utility() {
  const editable = canEditSubject();
  const allMin = state.items.length > 0 && state.items.every((item) => state.collapsedEntries.has(item.id));
  const pills = state.items.length
    ? [
        ["all", "All"],
        ["materials", "Materials"],
        ["assessments", "Assessments"],
        ...(editable ? [["drafts", "Drafts"]] : []),
      ]
        .map(
          ([key, label]) =>
            `<button type="button" class="filter-pill${state.entryFilter === key ? " active" : ""}" data-action="filter-entries" data-filter="${key}" aria-pressed="${state.entryFilter === key}">${label}</button>`,
        )
        .join("")
    : "";
  return `<div class="utility">${pills ? `<div class="filter-pills" role="group" aria-label="Filter entries">${pills}</div>` : `<span class="eyebrow">${isAdmin() ? "ADMIN SPACE" : "INSTRUCTOR SPACE"}</span>`}<div class="utility-tools"><div class="search-wrap">${icon("search")}<input id="search" type="search" aria-label="Search subject entries" placeholder="Search in this subject" value="${escape(state.search)}"></div>${state.items.length ? button(allMin ? "Expand all" : "Minimize all", "toggle-all-entries", `title="${allMin ? "Expand all subject entries" : "Minimize all subject entries"}"`, "quiet") : ""}${button("Refresh", "refresh", 'title="Reload this subject"', "quiet")}${editable ? button("+ Add", "add", 'data-parent="" title="Add a material, activity, quiz, or examination"', "primary utility-add") : ""}</div></div>`;
}
function header(title, subtitle, actions = "") {
  return `<div class="row between page-header"><div class="page-header-copy"><div class="eyebrow">YOUR WORKSPACE</div><h1>${escape(title)}</h1><p class="muted small">${escape(subtitle)}</p></div>${actions ? `<div class="header-actions">${actions}</div>` : ""}</div>`;
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
const isFilteringEntries = () => Boolean(state.search.trim()) || state.entryFilter !== "all";
function matchesEntryFilter(item) {
  if (!item) return false;
  if (state.entryFilter === "materials") return item.kind === "material";
  if (state.entryFilter === "assessments") return item.kind !== "material";
  if (state.entryFilter === "drafts") return !item.published;
  return true;
}
function applySubjectSearch() {
  const query = state.search.trim().toLowerCase();
  const filtering = isFilteringEntries();
  const matches = (item) =>
    matchesEntryFilter(item) &&
    (!query || (item.title + " " + item.body).toLowerCase().includes(query));
  let count = 0;
  for (const group of document.querySelectorAll("[data-group]")) {
    const item = state.items.find((entry) => entry.id === group.dataset.group);
    const visible =
      !filtering ||
      [item, ...descendantsOf(item.id)].some(matches) ||
      (state.entryFilter === "all" && Boolean(query) && ancestorsOf(item).some(matches));
    group.hidden = !visible;
    if (visible) count++;
  }
  for (const pill of document.querySelectorAll('[data-action="filter-entries"]')) {
    const active = pill.dataset.filter === state.entryFilter;
    pill.classList.toggle("active", active);
    pill.setAttribute("aria-pressed", String(active));
  }
  syncMaterialSections();
  if ($("#search-empty")) $("#search-empty").hidden = count > 0 || !filtering;
}
function applyMySubjectsSearch() {
  const query = state.subjectSearch.trim().toLowerCase();
  let count = 0;
  for (const card of document.querySelectorAll("#subjects-grid .course-card")) {
    const visible = !query || (card.dataset.search || "").toLowerCase().includes(query);
    card.hidden = !visible;
    if (visible) count++;
  }
  const emptyEl = $("#subjects-empty");
  if (emptyEl) emptyEl.hidden = count > 0 || !query;
}
// Collapse only changes the view, leaving active editors intact.
function syncMaterialSections() {
  const filtering = isFilteringEntries();
  for (const bodyEl of document.querySelectorAll("[data-entry-body]")) {
    const id = bodyEl.dataset.entryBody;
    const card = document.querySelector(`[data-item="${id}"]`);
    const toggle = document.querySelector(`[data-action="toggle-entry"][data-id="${id}"]`);
    const editing = Boolean(document.querySelector(`[data-edit-slot="${id}"] #composer`));
    const expanded = !state.collapsedEntries.has(id) || filtering || editing;
    bodyEl.hidden = !expanded;
    card?.classList.toggle("is-minimized", !expanded);
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.setAttribute("aria-label", `${expanded ? "Minimize" : "Expand"} entry`);
      toggle.disabled = filtering || editing;
      toggle.title = editing ? "Finish or cancel editing before minimizing" : filtering ? "Clear search or filter to minimize" : expanded ? "Minimize entry" : "Expand entry";
      toggle.textContent = expanded ? "Minimize" : "Expand";
    }
  }
  for (const region of document.querySelectorAll("[data-children]")) {
    const id = region.dataset.children;
    const toggle = document.querySelector(`[data-action="toggle-material"][data-id="${id}"]`);
    const editing = Boolean(region.querySelector("#composer")) || Boolean(document.querySelector(`[data-edit-slot="${id}"] #composer`));
    const expanded = !state.collapsedMaterials.has(id) || filtering || editing;
    region.hidden = !expanded;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-label", `${expanded ? "Minimize" : "Expand"} activities and quizzes`);
    toggle.disabled = filtering || editing;
    toggle.title = editing ? "Finish or cancel editing before minimizing" : filtering ? "Clear search or filter to minimize" : expanded ? "Minimize section" : "Expand section";
  }
  const allBtn = document.querySelector('[data-action="toggle-all-entries"]');
  if (allBtn && state.items.length) {
    const allMin = state.items.every((item) => state.collapsedEntries.has(item.id));
    allBtn.disabled = filtering;
    allBtn.textContent = allMin ? "Expand all" : "Minimize all";
    allBtn.title = filtering ? "Clear search or filter to minimize" : allMin ? "Expand all subject entries" : "Minimize all subject entries";
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
  const playable = item.kind !== "material";
  return `<article class="material" data-parent="${escape(item.parent_id || "")}" data-item="${escape(item.id)}"><div class="entry-rail"><div class="number">${escape(number)}</div>${editable ? button(icon("grip"), "reorder-handle", `draggable="true" data-drag="${escape(item.id)}" data-id="${escape(item.id)}" aria-label="Reorder or move ${escape(item.title)}" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight" title="Drag to reorder or nest across levels · keyboard: Alt+↑/↓/←/→"`, "quiet drag-handle") : ""}</div><div class="material-content"><div class="entry-topbar"><div class="material-type">${escape(kind)} ${item.parent_id && !isVisibleEntry(item) && item.published ? '<span class="tag gold">Hidden with material</span>' : ""} <span class="tag ${item.publication_state === "scheduled" ? "blue" : item.published ? "green" : "gold"}">${item.publication_state==="scheduled"?"Scheduled":item.published ? "Published" : "Draft"}</span></div>${editable || playable ? `<div class="entry-actions" role="group" aria-label="Entry actions">${playable ? button(icon("play") + "Play", "play-item", `data-id="${escape(item.id)}" title="Play full screen for class"`, "quiet play-btn") : ""}${editable && item.kind==="material"&&item.material_mode==="file"&&state.capabilities.material_upload?button(item.has_file?"Replace PDF":"Upload PDF","upload-pdf",`data-id="${escape(item.id)}"`,"quiet"):""}${editable && state.capabilities.scheduling==="dates-v1"?button("Schedule", "schedule", `data-id="${escape(item.id)}"`, "quiet"):""}${editable ? button(icon("edit") + "Edit", "edit", `data-id="${escape(item.id)}"`, "quiet") : ""}${editable ? button(item.published ? "Unpublish" : "Publish", "publish", `data-id="${escape(item.id)}"`, "quiet") : ""}${editable ? button("Delete", "delete", `data-id="${escape(item.id)}"`, "quiet danger") : ""}</div>` : ""}</div><div class="entry-heading"><h3>${escape(item.title)}</h3><div class="entry-heading-tools">${item.kind === "material" ? button(`${icon("chevron")}<span>${childrenOf(item.id).length}</span>`, "toggle-material", `data-id="${escape(item.id)}" aria-controls="children-${escape(item.id)}" aria-expanded="true" aria-label="Minimize nested entries"`, "quiet material-toggle") : ""}${button("Minimize", "toggle-entry", `data-id="${escape(item.id)}" aria-expanded="true" aria-controls="entry-body-${escape(item.id)}"`, "quiet entry-min-btn")}</div></div><div class="entry-body" id="entry-body-${escape(item.id)}" data-entry-body="${escape(item.id)}">${datesCaption(item)}${bodyParts(item)}${selectable ? quizPreview(item) : ""}</div></div></article>${editable ? `<div class="entry-editor" data-edit-slot="${escape(item.id)}"></div>` : ""}`;
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
        "Your teaching repository starts here.",
        button(icon("import") + "Import", "import-package", 'aria-label="Import subject or repository package"', "quiet") +
          button("+ New subject", "new-subject", "", "primary"),
      ) +
      empty(
        "No subjects yet",
        "Create your first subject, import an exported package, or ask an administrator for subject access.",
      );
    renderRight();
    return;
  }
  const s = state.active;
  const editableSubject = canEditSubject(s);
  const readOnlyInstructor = !editableSubject;
  const folderPath = folderPathName(s.folder_id);
  const materials = state.items.filter((i) => i.kind === "material").length;
  const assessments = state.items.filter((i) => i.kind !== "material" && i.assessment_type !== "examination").length;
  const examinations = state.items.filter((i) => i.assessment_type === "examination").length;
  context.hidden = false;
  context.innerHTML = `<section class="subject-hero"><div class="row between"><div class="hero-title-group"><h1>${escape(s.title)}</h1>${folderPath ? `<span class="tag hero-folder-tag">${escape(folderPath)}</span>` : ""}</div>${editableSubject ? `<div class="hero-actions">${button(icon("export") + "Export", "export-subject", `data-id="${escape(s.id)}" aria-label="Export subject package"`, "quiet")}${button(icon("edit") + "Edit", "edit-subject", 'aria-label="Edit subject"', "quiet")}</div>` : '<span class="tag blue">Read-only access</span>'}</div><span class="subject-meta">${materials} materials · ${assessments} activities & quizzes · ${examinations} examinations${readOnlyInstructor ? " · View only (editing and answer keys disabled)" : ""}</span></section>`;
  center.innerHTML =
    utility() +
    `<details class="subject-details"><summary>About this subject</summary><div class="reading-copy">${readingText(s.description)}</div></details><div id="entries">${state.items.length ? treeMarkup() : empty("A fresh start", editableSubject ? "Add a material or an examination to begin." : "No entries have been added to this subject yet.")}</div><div id="search-empty" hidden>${empty("No matching entries", "Try another filter or search term.")}</div>${editableSubject ? `<div class="composer-slot root-add-slot" data-add-parent=""></div>${!state.treeSupported ? '<p class="small muted">Update your organization backend to enable nested entries inside materials.</p>' : ""}` : ""}`;
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
  slot.innerHTML = `<form id="composer" class="composer"><div class="type-row"><div><h3 class="compose-title">${item ? "Edit entry" : parent ? "Add to this material" : "Add to your subject"}</h3><span class="compose-hint">${parent ? escape(parent.title) : "Materials and examinations start at top level. Drag any entry across levels anytime."}</span></div>${item ? `<span class="tag">${escape(kind)}</span>` : `<select name="kind" id="entry-kind" aria-label="Entry type">${choices.map(([value,label]) => `<option value="${value}" ${value === kind ? "selected" : ""}>${label}</option>`).join("")}</select>`}</div>${parentChoices}<label>Title<input name="title" maxlength="160" value="${escape(initialTitle)}" placeholder="e.g. Lesson 01 — The principles of flight"></label><div class="editor-field"><div class="editor-label-row"><span>Content <span class="muted">· paste formatted text or screenshot snips (Ctrl+V)</span></span><label class="spacing-control">Spacing<select name="paragraph_spacing" id="paragraph-spacing" aria-label="Paragraph spacing"><option value="compact" ${spacing === "compact" ? "selected" : ""}>Compact</option><option value="normal" ${spacing === "normal" ? "selected" : ""}>Normal</option><option value="relaxed" ${spacing === "relaxed" ? "selected" : ""}>Relaxed</option><option value="loose" ${spacing === "loose" ? "selected" : ""}>Loose</option></select></label></div><div class="editor-toolbar" role="toolbar" aria-label="Content formatting"><select data-editor-block aria-label="Paragraph style"><option value="p">Normal</option><option value="h2">Heading</option><option value="h3">Subheading</option><option value="blockquote">Quote</option></select><button type="button" class="quiet tool-btn" data-action="editor-cmd" data-cmd="bold" title="Bold (Ctrl+B)" aria-label="Bold"><strong>B</strong></button><button type="button" class="quiet tool-btn" data-action="editor-cmd" data-cmd="italic" title="Italic (Ctrl+I)" aria-label="Italic"><em>I</em></button><button type="button" class="quiet tool-btn" data-action="editor-cmd" data-cmd="underline" title="Underline (Ctrl+U)" aria-label="Underline"><u>U</u></button><span class="tool-sep" aria-hidden="true"></span><button type="button" class="quiet tool-btn" data-action="editor-cmd" data-cmd="insertUnorderedList" title="Bulleted list" aria-label="Bulleted list">• List</button><button type="button" class="quiet tool-btn" data-action="editor-cmd" data-cmd="insertOrderedList" title="Numbered list" aria-label="Numbered list">1. List</button><span class="tool-sep" aria-hidden="true"></span><button type="button" class="quiet tool-btn" data-action="editor-cmd" data-cmd="outdent" title="Decrease indent (Shift+Tab)" aria-label="Decrease indent">← Indent</button><button type="button" class="quiet tool-btn" data-action="editor-cmd" data-cmd="indent" title="Increase indent (Tab)" aria-label="Increase indent">Indent →</button>${imageCapable ? `<span class="tool-sep" aria-hidden="true"></span>${button(icon("image") + "Image", "insert-image", 'title="Insert image file or paste snip with Ctrl+V"', "quiet tool-btn")}` : ""}</div><div id="rich-editor" class="rich-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Entry content" data-spacing="${escape(spacing)}" data-placeholder="Write instructions, paste formatted notes from Word/Docs, or press Ctrl+V to paste a screenshot snip…">${initialRichHtml}</div><p class="compose-hint">Tab / Shift+Tab indents paragraphs · pasted formatting is adopted and sanitized automatically.</p></div>${kind === "material" ? `${!item&&state.capabilities.material_upload?'<label>Format<select name="format"><option value="text">Text, images and links</option><option value="file">PDF upload · save draft first</option></select></label>':""}<div class="attach-row">${button(icon("link") + " Attach link", "attach", "", "quiet")}<span class="compose-hint">Drive, Docs, Sheets, Slides, YouTube or web references</span></div><div id="link-fields">${links.map(linkField).join("")}</div><p class="compose-hint">Links open in your browser. Share permissions at the original host for assigned instructors.</p>` : ""}${!item&&["activity","examination"].includes(kind)&&state.formsSupported?`<label>Response type<select id="response-mode"><option value="written" ${state.compose.responseMode!=="choice"?"selected":""}>Written prompt</option><option value="choice" ${state.compose.responseMode==="choice"?"selected":""}>Selection form · class presenter &amp; answer key</option></select></label>`:""}${!item&&(kind === "quiz"||(["activity","examination"].includes(kind)&&state.compose.responseMode==="choice")) ? '<div id="quiz-builder"></div>' : ""}<div class="form-actions"><label class="choice"><input type="checkbox" name="published" ${item?.published === false ? "" : "checked"}>Published</label><span class="push"></span>${button("Cancel", "cancel-compose", "", "quiet")}<button type="submit" class="primary">${icon("check")} Done</button></div><p id="compose-error" class="error small" role="alert"></p></form>`;
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
  const rightbar = $("#rightbar");
  if (!rightbar) return;
  const collapsed = Boolean(state.rightbarCollapsed);
  const toggleBtn = button(
    icon(collapsed ? "arrowLeft" : "arrowRight"),
    "rightbar-toggle",
    `title="${collapsed ? "Expand right pane" : "Minimize right pane"} (Alt+\\)" aria-label="${collapsed ? "Expand right pane" : "Minimize right pane"}" aria-expanded="${String(!collapsed)}"`,
    "quiet sidebar-arrow-btn rightbar-arrow-btn",
  );
  if (state.account?.must_change_password) {
    rightbar.innerHTML =
      `<div class="rightbar-head">${toggleBtn}</div><div class="rightbar-body"><section class="progress-box"><div class="eyebrow">ACCOUNT SECURITY</div><p>New and reset accounts must set a private 15–128 character passphrase before opening subjects.</p></section></div>`;
    return;
  }
  const notices = state.announcements.slice(0, 3);
  const editableSubject = canEditSubject();
  const drafts = editableSubject ? state.items.filter((i) => !i.published) : [];
  const publishedCount = state.items.filter(isVisibleEntry).length;
  rightbar.innerHTML =
    `<div class="rightbar-head">${toggleBtn}<span class="eyebrow rightbar-title">WORKSPACE PANEL</span></div><div class="rightbar-body"><section><div class="section-heading"><h2>Announcements</h2>${isAdmin() ? button(icon("plus"), "announcements", 'aria-label="Manage announcements"', "quiet") : icon("bell")}</div>${notices.length ? notices.map((n) => `<article class="notice"><div class="small">${new Date(n.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div><h3>${escape(n.title)}</h3><div class="reading-copy">${readingText(n.body)}</div></article>`).join("") : '<p class="small-info">You’re up to date. Announcements will appear here.</p>'}${state.announcements.length > 3 ? button("View all", "announcements", "", "quiet") : ""}</section><div class="separator"></div><section><div class="section-heading"><h2>Drafts</h2><span class="tag">${drafts.length}</span></div><p class="small-info">${state.active ? escape(state.active.title) : "Choose a subject"}</p>${
      drafts
        .slice(0, 5)
        .map(
          (t) =>
            `<button class="task-row" data-action="task-item" data-id="${escape(t.id)}"><span class="task-icon">${icon("edit")}</span><span><strong>${escape(t.title)}</strong><small>Draft · finish and publish</small></span></button>`,
        )
        .join("") ||
      `<p class="small-info">${state.active && !editableSubject ? "Read-only access on this subject." : "No pending drafts in this subject."}</p>`
    }</section><div class="separator"></div><section class="progress-box"><div class="eyebrow">AT A GLANCE</div><div class="row between"><span class="big">${publishedCount}</span><span class="tag">published entries</span></div><p>${drafts.length ? `${drafts.length} ${drafts.length === 1 ? "draft" : "drafts"} waiting to publish.` : "Knowledge grows, one lesson at a time."}</p></section></div>`;
}
async function navigate(view, id) {
  if (state.account?.must_change_password && view !== "settings") return;
  if (!(await leaveDraft())) return;
  state.compose = null;
  state.search = "";
  if (view !== "subject") state.entryFilter = "all";
  if (view !== "subjects") state.subjectSearch = "";
  state.view = view;
  if (view === "subject") {
    const selected = id || state.active?.id || state.subjects[0]?.id;
    if (selected) await loadSubject(selected);
  }
  shell();
  if (view === "subject") return renderSubject();
  const center = $("#center");
  if (view === "subjects") {
    const canExportAny = state.subjects.some((s) => canEditSubject(s));
    center.innerHTML =
      header(
        "My subjects",
        "A clear home for everything you organize and present.",
        button(icon("import") + "Import", "import-package", 'aria-label="Import subject or repository package"', "quiet") +
          (canExportAny ? button(icon("export") + "Export all", "export-repository", 'aria-label="Export all editable subjects"', "quiet") : "") +
          button("+ New subject", "new-subject", "", "primary"),
      ) +
      (state.subjects.length >= 2
        ? `<div class="subjects-search-bar"><div class="search-wrap">${icon("search")}<input id="subject-search" type="search" aria-label="Search subjects" placeholder="Search subjects or folders" value="${escape(state.subjectSearch)}"></div></div>`
        : "") +
      `<div class="course-grid" id="subjects-grid">${state.subjects.map((s) => { const fp = folderPathName(s.folder_id); const searchHaystack = `${s.title} ${s.description || ""} ${fp || ""}`; return `<button class="course-card" data-action="subject" data-id="${escape(s.id)}" data-search="${escape(searchHaystack)}"><div class="course-card-tags"><span class="tag ${s.access_level === "read_only" ? "blue" : ""}">${s.access_level === "read_only" ? "READ ONLY" : s.access_level === "editor" ? "EDITOR" : "SUBJECT"}</span>${fp ? `<span class="tag">${escape(fp)}</span>` : ""}</div><h3>${escape(s.title)}</h3><p>${escape(s.description)}</p><span class="course-card-foot">Open subject ${icon("arrow")}</span></button>`; }).join("")}</div>` +
      `<div id="subjects-empty" hidden>${empty("No matching subjects", "Try a different subject or folder name.")}</div>` +
      (state.subjects.length
        ? ""
        : empty("No subjects yet", "Create a subject, import an exported package, or ask an administrator for access."));
    applyMySubjectsSearch();
  }
  if (view === "tasks") await renderDrafts();
  if (view === "access") await renderAccess();
  if (view === "accounts") await renderAccounts();
  if (view === "announcements") renderAnnouncements();
  if (view === "settings") renderSettings();
  if (view === "help") renderHelp();
}
function chooseSubject() {
  return `<label>Subject<select id="context-subject">${state.subjects.map((s) => `<option value="${escape(s.id)}" ${state.active?.id === s.id ? "selected" : ""}>${escape(s.title)}</option>`).join("")}</select></label>`;
}
async function renderDrafts() {
  state.allItems = [];
  // Sequential bounded reads avoid overwhelming an organization backend.
  for (const subject of state.subjects) {
    const d = await api(`/v1/subjects/${subject.id}`);
    state.allItems.push(...d.items.map((item) => ({ ...item, subject })));
  }
  const items = state.allItems.filter((i) => !i.published && canEditSubject(i.subject));
  $("#center").innerHTML =
    header(
      "Drafts",
      "Unpublished entries waiting for review across your editable subjects.",
    ) +
    items
      .map(
        (item) =>
          `<article class="material"><div class="material-content"><span class="small muted">${escape(item.subject.title)}</span><h3>${escape(item.title)}</h3>${datesCaption(item)}<p>Draft · unpublished</p>${button("Open subject " + icon("arrow"), "subject", `data-id="${escape(item.subject.id)}"`, "quiet")}</div></article>`,
      )
      .join("") +
    (items.length
      ? ""
      : empty("All clear", "There are no unpublished drafts across your subjects."));
}
// Admin — Per-subject instructor access control (read-only vs editor, active vs suspended).
async function renderAccess() {
  if (!isAdmin()) return;
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
    `<div class="inline-form"><h3>Instructor permissions · ${escape(data.subject.title)}</h3><p class="small muted">Read-only instructors can view materials and present class slides without editing or viewing answer keys. Editors can author, arrange, and present with answer keys. Suspended instructors immediately lose subject access.</p><div class="table-scroll"><table class="data-table"><thead><tr><th>Instructor</th><th>Access</th><th>Controls</th></tr></thead><tbody>${
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
async function renderAccounts() {
  if (!isAdmin()) return;
  const d = await api(`/v1/admin/accounts?offset=${state.accountOffset}`);
  const accounts = d.accounts.filter((a) => a.role === "admin" || a.role === "instructor");
  $("#center").innerHTML =
    header(
      "Accounts",
      "Create administrator and instructor accounts, update passwords, and manage access.",
      button("+ Create account", "new-account", "", "primary"),
    ) +
    `<div id="account-form-slot"></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Name</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${accounts.map((a) => `<tr><td>${escape(a.name)}<div class="small muted">${escape(a.email)}</div></td><td>${escape(a.role === "admin" ? "Administrator" : "Instructor")}</td><td><span class="tag ${a.status === "active" ? "green" : "red"}">${escape(a.status)}</span></td><td>${a.id !== state.account.id ? `<div class="account-actions">${button("Update password", "reset-password", `data-id="${escape(a.id)}" data-name="${escape(a.name)}"`, "quiet")}${button(a.status === "active" ? "Suspend" : "Reactivate", "account-status", `data-id="${escape(a.id)}" data-status="${a.status === "active" ? "suspended" : "active"}"`, "quiet")}</div>` : `<div class="account-actions">${button("Update my password", "settings", "", "quiet")}</div>`}</td></tr>`).join("")}</tbody></table></div><div class="form-actions">${button("Previous", "account-page", `data-offset="${Math.max(0, state.accountOffset - 100)}" ${state.accountOffset ? "" : "disabled"}`)}${button("Next", "account-page", `data-offset="${state.accountOffset + 100}" ${d.accounts.length < 100 ? "disabled" : ""}`)}</div>`;
}
function renderAnnouncements() {
  $("#center").innerHTML =
    header("Announcements", "Updates for administrators and instructors.") +
    (isAdmin()
      ? `<form id="announcement" class="inline-form"><h3>Share an update</h3><label>Title<input name="title" required maxlength="160"></label><label>Message<textarea name="body" required maxlength="5000" rows="3"></textarea></label><div class="form-actions"><button class="primary">Publish announcement</button></div></form>`
      : "") +
    (state.announcements.length
      ? state.announcements
          .map(
            (n) =>
              `<article class="material"><div class="material-content"><span class="small muted">${new Date(n.created_at).toLocaleDateString()}</span><h3>${escape(n.title)}</h3><div class="reading-copy">${readingText(n.body)}</div>${isAdmin() ? `<div class="form-actions">${button("Delete", "delete-announcement", `data-id="${escape(n.id)}"`, "quiet danger")}</div>` : ""}</div></article>`,
          )
          .join("")
      : empty(
          "No announcements yet",
          isAdmin()
            ? "Share an update above to notify everyone in this workspace."
            : "Updates from your administrator will appear here.",
        ));
}
function renderSettings() {
  const pending = Boolean(state.account.must_change_password);
  const canExportAny = state.subjects.some((s) => canEditSubject(s));
  $("#center").innerHTML =
    header("Settings", "Your workspace, backup transfer, and password security.") +
    (pending
      ? `<div class="banner" role="status"><strong>Temporary password change required</strong>Choose a new 15–128 character passphrase different from your temporary password before accessing subjects.</div>`
      : "") +
    `<div class="inline-form"><h3>${state.mode === "local" ? "Local test workspace" : "Organization workspace"}</h3><p class="small muted">${state.mode === "local" ? "This workspace is saved locally on this PC under %APPDATA%\\aeronautical-open-academy-desktop\\local-test-workspace\\academy.sqlite." : "Your account and subjects are managed by your organization’s Aeronautical Academy Repository server."}</p><p class="small">${escape(state.account.email)} · ${escape(isAdmin() ? "Administrator" : "Instructor")}</p><div class="form-actions">${button("Sign out all devices", "logout-all", "", "quiet")}</div></div>${pending ? "" : `<section id="transfer-card" class="inline-form"><h3>Export &amp; Import</h3><p class="small muted">Export editable subjects, rich content, pasted images, folder structure, and assessments as a verified <code>.aoa.json</code> package. Suggested filenames automatically include the subject or repository name and exact date and time of creation (<code>YYYY-MM-DD_HH-mm-ss</code>). Importing validates SHA-256 integrity and adds subjects without overwriting existing work.</p><div class="form-actions">${button(icon("import") + "Import package", "import-package", 'aria-label="Import subject or repository package"', "quiet")}${canExportAny ? button(icon("export") + "Export all subjects", "export-repository", 'aria-label="Export all editable subjects"', "primary") : ""}</div></section>`}<form id="password" class="inline-form"><h3>Update password</h3><label>Current password<span class="password-field"><input name="current" type="password" required autocomplete="current-password">${button("Show", "toggle-confirm-password", 'aria-pressed="false"', "quiet")}</span></label><label>New password · 15–128 characters<span class="password-field"><input name="next" type="password" minlength="15" maxlength="128" required autocomplete="new-password">${button("Show", "toggle-field-password", 'aria-pressed="false"', "quiet")}${button("Generate", "generate-password", 'data-target="next" data-confirm="confirm"', "quiet")}</span></label><label>Confirm new password<span class="password-field"><input name="confirm" type="password" minlength="15" maxlength="128" required autocomplete="new-password">${button("Show", "toggle-confirm-password", 'aria-pressed="false"', "quiet")}</span></label><p class="small muted">${state.mode === "local" ? "In the local workspace, you can update the built-in admin or instructor password using your current sign-in password." : "Updating your password signs out all active sessions on every device."}</p><div class="form-actions"><button class="primary">Update password & sign out</button></div></form>`;
}
function renderHelp() {
  $("#center").innerHTML =
    header("Repository guide", "Admin and instructor tools in Aeronautical Academy Repository.") +
    `<div class="inline-form help-card"><h3>Navigation, collapsible panes &amp; saved workspace state</h3><p>Use the arrow buttons at the top of the left column (Alt+[ / Alt+]) to expand, restore, or collapse the navigation rail, and click the right-pane toggle in the top bar or right pane header (Alt+\\) to minimize or expand Announcements and Drafts without disturbing active drafts or scroll position. Press Ctrl+K or / to jump directly to subject or catalog search (Escape clears), and use the All / Materials / Assessments / Drafts pills in any subject toolbar to narrow entries instantly. Your minimized/expanded entries, collapsed sections, folders, pane widths, and active subject are saved per account and automatically restored when you sign out and sign back in. Administrators can organize subjects into nested folders (up to 5 levels deep) using + New folder and drag-and-drop.</p><h3>Export &amp; import packages</h3><p>Use Export in any editable subject header—or Export all and Import in My subjects or Settings—to save or transfer subjects with their multi-level entries, rich formatting, paragraph spacing, pasted images, schedules, assessments, and folder paths. Export filenames automatically include the date and time of creation (YYYY-MM-DD_HH-mm-ss) and a SHA-256 checksum verified before import. Importing always creates new subjects without overwriting existing work.</p><h3>Administrator subject access &amp; accounts</h3><p>Administrators create administrator and instructor accounts with strong 15–128 character passwords under Administration → Accounts and can update any account’s password at any time. Under Administration → Subject access, administrators assign instructors per subject as Read only or Editor and can suspend or activate access immediately. Any user can update their own password under Settings.</p><h3>Rich subject content &amp; pasted images</h3><p>Open an editable subject and click + Add in the top toolbar (or + Add material or examination at the bottom). Enter a Title, then type or paste formatted text from Word, Google Docs, or web pages—bold, italic, underline, headings, lists, and indentation are adopted and sanitized automatically. Press Ctrl+V inside the content box to paste screenshot snips, drop an image file, or click Image to insert a PNG, JPEG, WebP, or GIF image (up to 5 MB). Use Tab / Shift+Tab or the toolbar buttons to indent paragraphs, pick Compact, Normal, Relaxed, or Loose paragraph spacing, press Ctrl+Enter to save, or press Escape to cancel safely.</p><h3>Minimize entries &amp; drag across levels</h3><p>Click Minimize on any entry card—or Minimize all in the subject toolbar—to collapse cards to a clean outline without losing drafts. Drag the grip at the left of any entry to reorder it before/after entries at any level, drop onto the middle of a material to nest it inside (up to 4 levels deep), or move it back to top level. Keyboard shortcuts: Alt+↑/↓ reorders siblings, Alt+→ indents inside the preceding material, and Alt+← outdents up one level.</p><h3>Instructor-guided fullscreen presentation</h3><p>Click Play on any Quiz, Activity, or Examination card to present formatted questions and figures full screen with lettered options (A–F) only, Previous/Next arrows (or Space, PageDown, PageUp, and F for full screen), and an end-of-item confirmation dialog before revealing the class answer key (restricted to authoring editors and administrators).</p><h3>Current desktop scope and limitations</h3><p>This desktop application is designed for administrators and instructors. Local workspace data is saved under %APPDATA%\\aeronautical-open-academy-desktop\\local-test-workspace\\academy.sqlite; organization synchronization requires a deployed compatible backend. Use Schedule on any saved entry to set publication and due dates in Philippine time.</p></div>`;
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
      "A clear home for lessons, references, and class assessments.",
    ) +
    `<form id="subject-form" class="inline-form" data-edit="${s ? "true" : "false"}"><label>Subject title<input name="title" maxlength="160" required value="${escape(s?.title || "")}" placeholder="e.g. Aircraft Structures"></label><label>Description<textarea name="description" maxlength="1000" required placeholder="Summarize the scope and topics covered by this subject.">${escape(s?.description || "")}</textarea></label><div class="form-actions">${s && canDeleteSubject(s) ? button("Delete subject", "delete-subject", `data-id="${escape(s.id)}"`, "quiet danger") + '<span class="push"></span>' : ""}${button("Cancel", s ? "subject" : "subjects", s ? `data-id="${escape(s.id)}"` : "", "quiet")}<button class="primary">${s ? "Save details" : "Create subject"}</button></div></form>`;
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
    $("#login-form button[type=submit]")?.focus();
    return;
  }
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const { action, id } = target.dataset;
  if (action === "sidebar-widen") {
    state.sidebarState = state.sidebarState === "collapsed" ? "normal" : "expanded";
    syncSidebarState();
    saveWorkspacePrefs();
    return;
  }
  if (action === "sidebar-narrow") {
    state.sidebarState = state.sidebarState === "expanded" ? "normal" : "collapsed";
    syncSidebarState();
    saveWorkspacePrefs();
    return;
  }
  if (action === "rightbar-toggle") {
    state.rightbarCollapsed = !state.rightbarCollapsed;
    syncRightbarState();
    saveWorkspacePrefs();
    return;
  }
  if (action === "toggle-material") {
    if (state.collapsedMaterials.has(id)) state.collapsedMaterials.delete(id);
    else state.collapsedMaterials.add(id);
    saveWorkspacePrefs();
    const position = capturePosition(id);
    syncMaterialSections();
    restorePosition(position);
    return;
  }
  if (action === "toggle-entry") {
    if (state.collapsedEntries.has(id)) state.collapsedEntries.delete(id);
    else state.collapsedEntries.add(id);
    saveWorkspacePrefs();
    const position = capturePosition(id);
    syncMaterialSections();
    restorePosition(position);
    return;
  }
  if (action === "toggle-all-entries") {
    const allMin = state.items.length > 0 && state.items.every((item) => state.collapsedEntries.has(item.id));
    for (const item of state.items) {
      if (allMin) state.collapsedEntries.delete(item.id);
      else state.collapsedEntries.add(item.id);
    }
    saveWorkspacePrefs();
    syncMaterialSections();
    return;
  }
  if (action === "filter-entries") {
    const next = target.dataset.filter || "all";
    if (["all", "materials", "assessments", "drafts"].includes(next)) {
      state.entryFilter = next;
      applySubjectSearch();
    }
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
    saveWorkspacePrefs();
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
    if (!state.account) return;
    const item = state.items.find((entry) => entry.id === id);
    if (!item || item.kind === "material") return;
    window.academyPresenter?.open(item, state.active?.title || "", { readImage: desktopApi.readImage });
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
          `Remove folder “${folder.name}”? Subjects and subfolders inside will move up one level; no subjects or repository content will be deleted.`,
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
        "access",
        "accounts",
        "announcements",
        "settings",
        "help",
      ].includes(action)
    )
      return navigate(action, id);
    if (action === "logout-all") {
      if(!(await leaveDraft()))return;
      saveWorkspacePrefs();
      await post("/v1/auth/logout-all",{});
      state.account=null;state.items=[];state.subjects=[];state.folders=[];state.folderForm=null;state.active=null;resumeWorkspace=null;
      window.academyPresenter?.close();window.academyEditor?.clearImageCache();await window.academyReader.close();clearInMemoryUiState();$("#app").replaceChildren();showLogin();toast("Signed out on all devices.");return;
    }
    if (action === "logout") {
      if (!(await leaveDraft())) return;
      saveWorkspacePrefs();
      await desktopApi.logout();
      resumeWorkspace = null;
      window.academyPresenter?.close();
      window.academyEditor?.clearImageCache();
      await window.academyReader.close();
      clearInMemoryUiState();
      Object.assign(state, {
        account: null,
        active: null,
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
      if (parentId && !state.treeSupported) throw new Error("Update the repository service to use nested entries.");
      state.compose = { parentId, kind: parentId ? "activity" : "material" };
      renderComposer();
      revealNearby($("#composer"));
      focusAfterAct("#composer input[name=title]");
    }
    if (action === "attach") {
      if ($("#link-fields").children.length >= 12) throw new Error("Use up to 12 attached links per entry.");
      $("#link-fields").insertAdjacentHTML("beforeend", linkField());
      focusAfterAct(() => $("#link-fields")?.lastElementChild?.querySelector("input"), {});
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
      else{state.active=null;state.items=[];}
      await navigate(state.view,id);restorePosition(position);
      toast(state.mode==="local"?"Local test data refreshed. Organization sharing uses the server workspace.":"Synced · subjects, folders and materials refreshed.");
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
      focusAfterAct("#composer input[name=title]");
    }
    if (action === "open-link")
      await desktopApi.openLink({
        id,
        revision: state.items.find((i) => i.id === id).revision,
        url: target.dataset.url,
      });
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
          children.length ? `Remove this material and its ${children.length} nested entries? Archived history is retained.` : "This removes it from the subject. Archived history is retained.",
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
      if (!(await confirmAction("Delete this subject?", `Remove “${subject.title}” and all its materials, activities and quizzes from active workspaces? Archived records are retained.${state.dirty ? " Unsaved changes will be discarded." : ""}`, "Delete subject"))) return;
      await post(`/v1/subjects/${subject.id}/archive`, snapshot);
      // Commit UI removal immediately after acknowledgement, independent of refresh availability.
      state.subjects = state.subjects.filter((item) => item.id !== subject.id);
      for (const removed of snapshot.expected_items) {
        state.collapsedMaterials.delete(removed.id);
        state.collapsedEntries.delete(removed.id);
      }
      Object.assign(state,{active:null,items:[],allItems:[],compose:null,dirty:false,search:""});
      saveWorkspacePrefs();
      await navigate("subjects");
      toast("Subject deleted.");
      return;
    }
    if (action === "new-subject" || action === "edit-subject") {
      if (!(await leaveDraft())) return;
      renderSubjectForm(action === "edit-subject");
    }
    if (action === "export-subject" || action === "export-repository") {
      const scope = action === "export-repository" ? "repository" : "subject";
      const subjectId = scope === "subject" ? id || state.active?.id : null;
      const result = await desktopApi.exportPackage({ scope, subjectId });
      if (result.canceled) return;
      toast(
        scope === "repository"
          ? `Exported ${result.filename} (${result.summary.subjectCount} ${result.summary.subjectCount === 1 ? "subject" : "subjects"}, ${result.summary.itemCount} entries).`
          : `Exported ${result.filename} (${result.summary.itemCount} ${result.summary.itemCount === 1 ? "entry" : "entries"}).`,
      );
      return;
    }
    if (action === "import-package") {
      if (!(await leaveDraft())) return;
      const preview = await desktopApi.previewImport();
      if (preview.canceled) return;
      const s = preview.summary;
      const subjectPreview =
        s.subjectTitles.length <= 3
          ? s.subjectTitles.join(", ")
          : `${s.subjectTitles.slice(0, 3).join(", ")} +${s.subjectTitles.length - 3} more`;
      const details = `${s.filename} · Created ${s.createdAtLocal}. Contains ${s.subjectCount} ${s.subjectCount === 1 ? "subject" : "subjects"} (${subjectPreview}), ${s.itemCount} ${s.itemCount === 1 ? "entry" : "entries"}, and ${s.imageCount} embedded ${s.imageCount === 1 ? "image" : "images"}. Existing subjects will not be overwritten.`;
      const ok = await confirmAction("Import package into workspace?", details, "Import");
      if (!ok) {
        await desktopApi.cancelImport(preview.importId).catch(() => {});
        return;
      }
      const imported = await desktopApi.commitImport(preview.importId);
      await refreshData();
      const firstId = imported.importedSubjects?.[0]?.id;
      if (firstId) {
        await loadSubject(firstId);
        state.view = "subject";
        shell();
        renderSubject();
      } else {
        await navigate("subjects");
      }
      toast(
        `Imported ${imported.importedSubjects.length} ${imported.importedSubjects.length === 1 ? "subject" : "subjects"} (${imported.totalItems} ${imported.totalItems === 1 ? "entry" : "entries"}${imported.totalImages ? `, ${imported.totalImages} ${imported.totalImages === 1 ? "image" : "images"}` : ""}).`,
      );
      return;
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
    if (action === "task-item") {
      if (!(await leaveDraft())) return;
      const item = state.items.find((i) => i.id === id);
      if (item) state.collapsedEntries.delete(item.id);
      for (const parent of ancestorsOf(item)) {
        state.collapsedMaterials.delete(parent.id);
        state.collapsedEntries.delete(parent.id);
      }
      saveWorkspacePrefs();
      state.view = "subject";
      shell();
      renderSubject();
      if (canEditSubject()) {
        state.compose = { item };
        renderComposer();
        revealNearby($("#composer"));
      } else
        document
          .querySelector(`[data-item="${id}"]`)
          ?.scrollIntoView({ block: "center" });
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
        `<form id="new-account" class="inline-form"><h3>Create account</h3><div class="form-grid"><label>Name<input name="name" maxlength="100" required></label><label>Email<input name="email" type="email" maxlength="254" required></label></div><label>Role<select name="role"><option value="instructor">Instructor</option><option value="admin">Administrator</option></select></label><label>Password · 15–128 characters<span class="password-field"><input name="password" type="password" minlength="15" maxlength="128" required autocomplete="new-password">${button("Show", "toggle-field-password", 'aria-pressed="false"', "quiet")}${button("Generate", "generate-password", 'data-target="password" data-confirm="confirm_password"', "quiet")}</span></label><label>Confirm password<span class="password-field"><input name="confirm_password" type="password" minlength="15" maxlength="128" required autocomplete="new-password">${button("Show", "toggle-confirm-password", 'aria-pressed="false"', "quiet")}</span></label><p class="small muted">Create an administrator or instructor account. New accounts rotate their initial password at first sign-in.</p><div class="form-actions">${button("Cancel", "cancel-account", "", "quiet")}<button class="primary">Create account</button></div></form>`;
    }
    if (action === "reset-password") {
      if (!(await leaveDraft())) return;
      $("#account-form-slot").innerHTML =
        `<form id="reset-password-form" class="inline-form" data-id="${escape(id)}"><h3>Update password · ${escape(target.dataset.name || "Account")}</h3><label>New password · 15–128 characters<span class="password-field"><input name="password" type="password" minlength="15" maxlength="128" required autocomplete="new-password">${button("Show", "toggle-field-password", 'aria-pressed="false"', "quiet")}${button("Generate", "generate-password", 'data-target="password" data-confirm="confirm_password"', "quiet")}</span></label><label>Confirm new password<span class="password-field"><input name="confirm_password" type="password" minlength="15" maxlength="128" required autocomplete="new-password">${button("Show", "toggle-confirm-password", 'aria-pressed="false"', "quiet")}</span></label><label class="choice"><input type="checkbox" name="require_change" checked>Require password change at next sign-in</label><p class="small muted">All active sessions for this user are signed out immediately after saving.</p><div class="form-actions">${button("Cancel", "cancel-account", "", "quiet")}<button class="primary">Update password</button></div></form>`;
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
        state.entryFilter = "all";
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
      if (!["admin", "instructor"].includes(d.role))
        throw new Error("Choose Administrator or Instructor.");
      const payload = { name: d.name, email: d.email, role: d.role, password: d.password };
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
      saveWorkspacePrefs();
      state.dirty = false;
      resumeWorkspace = null;
      window.academyPresenter?.close();
      window.academyEditor?.clearImageCache();
      await window.academyReader.close();
      clearInMemoryUiState();
      Object.assign(state, {
        account: null,
        active: null,
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
  if (event.target.id === "subject-search") {
    state.subjectSearch = event.target.value;
    applyMySubjectsSearch();
    return;
  }
  if (event.target.matches("[data-question-option]")) {
    event.target.closest("[data-question-editor]").querySelectorAll('input[type=radio]').forEach(el=>{el.checked=false;});
  }
  if (event.target.matches("#composer input[name=link]")) {
    clearTimeout(event.target.linkTimer);
    event.target.linkTimer = setTimeout(() => inspectLinkField(event.target), 200);
  }
  if (!state.busy && event.target.closest("#app form:not(#folder-form)")) state.dirty = true;
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
      $("#rich-editor").innerHTML = window.academyEditor
        ? window.academyEditor.sanitizeHtmlFragment(richHtml, { keepEditorControls: true })
        : "";
      $("#rich-editor").dataset.spacing = paragraphSpacing;
      window.academyEditor?.hydrateImages($("#rich-editor"), desktopApi.readImage, { subjectId: state.active?.id || "" });
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
      await loadSubject(event.target.value);
      shell();
      if (state.view === "access") await renderAccess();
    });
  else if (!state.busy && event.target.closest("#app form:not(#folder-form)")) state.dirty = true;
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
  const modalOpen = Boolean(document.querySelector("dialog[open]"));
  if (state.account && !$("#app")?.hidden && !modalOpen) {
    const typing = Boolean(event.target.closest("input, textarea, select, [contenteditable='true']"));
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key === "Enter") {
      const form = event.target.closest("#composer, #subject-form, #announcement, #new-account, #reset-password-form, #folder-form");
      if (form && !state.busy) {
        event.preventDefault();
        if (document.activeElement instanceof HTMLElement && form.contains(document.activeElement)) {
          document.activeElement.blur();
        }
        form.requestSubmit();
        return;
      }
    }
    if (event.key === "Escape" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.target.id === "search" && event.target.value) {
        event.preventDefault();
        event.target.value = "";
        state.search = "";
        applySubjectSearch();
        return;
      }
      if (event.target.id === "subject-search" && event.target.value) {
        event.preventDefault();
        event.target.value = "";
        state.subjectSearch = "";
        applyMySubjectsSearch();
        return;
      }
      if (event.target.closest("#composer") && !state.busy) {
        event.preventDefault();
        act(async () => {
          if (!(await leaveDraft())) return;
          state.compose = null;
          renderComposer();
        });
        return;
      }
    }
    if (((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") || (!typing && !event.ctrlKey && !event.metaKey && !event.altKey && event.key === "/")) {
      const searchEl = $("#search") || $("#subject-search");
      if (searchEl) {
        event.preventDefault();
        searchEl.focus();
        searchEl.select();
        return;
      }
    }
    if (event.altKey && !event.ctrlKey && !event.metaKey && !typing) {
      if (event.key === "[" || event.key === "]") {
        event.preventDefault();
        if (event.key === "]") state.sidebarState = state.sidebarState === "collapsed" ? "normal" : "expanded";
        else state.sidebarState = state.sidebarState === "expanded" ? "normal" : "collapsed";
        syncSidebarState();
        saveWorkspacePrefs();
        return;
      }
      if (event.key === "\\") {
        event.preventDefault();
        state.rightbarCollapsed = !state.rightbarCollapsed;
        syncRightbarState();
        saveWorkspacePrefs();
        return;
      }
    }
  }
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
