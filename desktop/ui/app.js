"use strict";
const desktopApi = Object.fromEntries(
  ["login", "request", "logout", "openLink", "inspectLink", "exportReport"].map((method) => [method, async (...args) => {
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
  settings:
    "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2 M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0",
};
const icon = (key) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[key] || icons.book}"/></svg>`;
const button = (text, action, extra = "", cls = "") =>
  `<button type="button" class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
const state = {
  account: null,
  collapsedMaterials: new Set(),
  mode: "local",
  subjects: [],
  announcements: [],
  active: null,
  items: [],
  summary: null,
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
      showLogin();
    }
  } finally {
    state.busy = false;
    document.body.classList.remove("working");
    $("#app").inert = false;
  }
}
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
const navLabel = () =>
  ({
    subject: "My subjects",
    subjects: "My subjects",
    tasks: "Tasks",
    results: "My results",
    learners: "Students & progress",
    eligibility: "Enrollment",
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
function shell() {
  const a = state.account;
  $("#app").innerHTML =
    `<aside class="sidebar"><div class="brand"><span class="brand-mark">A</span><span>AERONAUTICAL<br>OPEN ACADEMY</span></div><details open><summary>WORKSPACE</summary>${nav("My subjects", "subjects", "book", ["subject", "subjects"].includes(state.view))}<div id="subject-nav">${state.subjects.map((s) => `<button class="nav-btn subject-nav ${state.active?.id === s.id && state.view === "subject" ? "selected" : ""}" data-action="subject" data-id="${escape(s.id)}"><span>${escape(s.title)}</span></button>`).join("")}</div>${nav("Tasks", "tasks", "tasks", state.view === "tasks")}${!manage() ? nav("My results", "results", "chart", state.view === "results") + nav("Find a subject", "discover", "search", state.view === "discover") : ""}</details>${manage() ? `<details open><summary>TEACHING</summary>${nav("Students & progress", "learners", "users", ["learners", "learner"].includes(state.view))}${nav("Enrollment", "eligibility", "check", state.view === "eligibility")}</details>` : ""}${a.role === "admin" ? `<details open><summary>ADMINISTRATION</summary>${nav("Accounts", "accounts", "users", state.view === "accounts")}${nav("Announcements", "announcements", "bell", state.view === "announcements")}</details>` : ""}<details ${["settings", "help"].includes(state.view) ? "open" : ""}><summary>MORE</summary>${nav("Settings", "settings", "settings", state.view === "settings")}${nav("Help", "help", "help", state.view === "help")}</details><div class="sidebar-foot"><p class="workspace-label"><span class="dot"></span>${state.mode === "local" ? "LOCAL TEST WORKSPACE" : "ORGANIZATION WORKSPACE"}</p><p class="small muted">Academy for PC <span class="muted">· 0.3.0-rc.1</span></p></div></aside><header class="topbar"><div class="breadcrumbs">Workspace <span aria-hidden="true"> / </span><strong>${escape(navLabel())}</strong></div><div class="row"><span class="top-date">${new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span><div class="account"><span class="avatar">${escape(
      a.name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join(""),
    )}</span><div><div class="account-name">${escape(a.name)}</div><div class="account-role">${escape(a.role)}</div></div></div>${button(icon("logout"), "logout", 'title="Sign out" aria-label="Sign out"', "quiet")}</div></header><main class="center" id="center" aria-label="Learning workspace"></main><aside class="rightbar" id="rightbar" aria-label="Announcements and tasks"></aside>`;
  $("#app").hidden = false;
  renderRight();
}
async function refreshData() {
  const [subjects, announcements] = await Promise.all([
    api("/v1/subjects"),
    api("/v1/announcements"),
  ]);
  state.subjects = subjects.subjects;
  state.announcements = announcements.announcements;
}
async function loadSubject(id) {
  const sequence = ++loadSequence;
  const data = await api(`/v1/subjects/${id}`);
  if (sequence !== loadSequence) return;
  state.active = data.subject;
  state.items = data.items;
  state.treeSupported = data.tree_version >= 1;
  state.subsectionsSupported = data.tree_version >= 2;
  state.summary = data.summary || null;
  state.compose = null;
  state.dirty = false;
}
async function start() {
  state.collapsedMaterials.clear();
  await refreshData();
  state.items = [];
  state.summary = null;
  state.active = null;
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
  return `<div class="utility"><span class="eyebrow">${manage() ? "TEACHING SPACE" : "LEARNING SPACE"}</span><div class="search-wrap">${icon("search")}<input id="search" type="search" aria-label="Search subject entries" placeholder="Search in this subject" value="${escape(state.search)}"></div>${button("Refresh", "refresh", 'title="Reload this subject"', "quiet")}</div>`;
}
function header(title, subtitle, actions = "") {
  return `<div class="row between"><div><div class="eyebrow">YOUR WORKSPACE</div><h1>${escape(title)}</h1><p class="muted small">${escape(subtitle)}</p></div>${actions}</div>`;
}
function empty(title, description) {
  return `<div class="empty">${icon("book")}<h3>${escape(title)}</h3><p>${escape(description)}</p></div>`;
}
function bodyParts(item) {
  const material = item.material || { text: item.body, links: [] };
  return `${material.text ? `<p class="preserve">${escape(material.text)}</p>` : ""}<div class="material-links">${material.links.map(({url, label, host}) => button(`${icon("link")}<span><strong>${escape(label)}</strong><small>${escape(host)}</small></span>${icon("external")}`, "open-link", `data-id="${escape(item.id)}" data-url="${escape(url)}" title="Open ${escape(label)}: ${escape(url)}"`, "link resource-link")).join("")}</div>`;
}
const siblingsOf = (item) => state.items.filter((other) => (other.parent_id || null) === (item.parent_id || null));
const childrenOf = (id) => state.items.filter((item) => item.parent_id === id);
const rootsOf = () => state.items.filter((item) => !item.parent_id);
const ancestorsOf = (item) => {
  const parents = [];
  for (let parent = state.items.find((entry) => entry.id === item?.parent_id); parent; parent = state.items.find((entry) => entry.id === parent.parent_id)) parents.push(parent);
  return parents;
};
const descendantsOf = (id) => childrenOf(id).flatMap((item) => [item, ...descendantsOf(item.id)]);
const isVisibleEntry = (item) => [item, ...ancestorsOf(item)].every((entry) => entry.published);
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
  for (const region of document.querySelectorAll("[data-children]")) {
    const id = region.dataset.children;
    const toggle = document.querySelector(`[data-action="toggle-material"][data-id="${id}"]`);
    const editing = Boolean(region.querySelector("#composer")) || Boolean(document.querySelector(`[data-edit-slot="${id}"] #composer`));
    const expanded = !state.collapsedMaterials.has(id) || Boolean(state.search) || editing;
    region.hidden = !expanded;
    const content = document.querySelector(`[data-subsection-body="${id}"]`);
    if (content) content.hidden = !expanded;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-label", `${expanded ? "Minimize" : "Expand"} ${content ? "subsection" : "activities and quizzes"}`);
    toggle.disabled = Boolean(state.search) || editing;
    toggle.title = editing ? "Finish or cancel editing before minimizing" : state.search ? "Clear search to minimize" : expanded ? "Minimize section" : "Expand section";
  }
}
function treeMarkup(items = rootsOf(), prefix = "") {
  return items.map((item, index) => {
    const number = prefix ? `${prefix}.${index+1}` : String(index+1).padStart(2,"0");
    return `<section class="subject-group ${item.parent_id && item.kind === "material" ? "subsection-group" : ""} ${item.kind === "material" ? "material-group" : "assessment-group"}" data-group="${escape(item.id)}">${itemCard(item,index,number)}${item.kind === "material" ? `<div class="tree-children" id="children-${escape(item.id)}" data-children="${escape(item.id)}" role="region" aria-label="Contents for ${escape(item.title)}">${treeMarkup(childrenOf(item.id),number)}${manage() && owned(item) && state.treeSupported ? `<div class="composer-slot" data-add-parent="${escape(item.id)}"></div>` : ""}</div>` : ""}</section>`;
  }).join("");
}
function itemCard(item, index, number) {
  const editable = manage() && owned(item);
  const kind =
    item.assessment_type === "examination"
      ? "Written examination"
      : item.kind === "quiz"
        ? "Quiz"
        : item.kind === "activity"
          ? "Written activity"
          : item.parent_id ? "Subsection" : "Material";
  let student = "";
  if (!manage()) {
    if (item.kind === "material")
      student = `<div class="material-tools">${button(`${icon(item.completed ? "check" : "book")}${item.completed ? "Read · mark unread" : "Mark as read"}`, "complete", `data-id="${escape(item.id)}"`, item.completed ? "quiet" : "")}<span class="compose-hint">Self-reported reading</span></div>`;
    if (item.kind === "quiz")
      student = item.attempt
        ? `<div class="result">Submitted · score ${item.attempt.score} / 1</div>`
        : `<form data-form="quiz" data-id="${escape(item.id)}">${item.options.map((option, i) => `<label class="choice"><input type="radio" name="choice" value="${i}" required>${escape(option)}</label>`).join("")}<div class="form-actions"><button class="primary" type="submit">Submit answer</button></div></form>`;
    if (item.kind === "activity")
      student = item.submission
        ? `<div class="result">${item.submission.score == null ? "Submitted · awaiting assessment" : `Score ${item.submission.score} / 100`}${item.submission.feedback ? `<p class="preserve">${escape(item.submission.feedback)}</p>` : ""}<details><summary>Your response</summary><p class="preserve">${escape(item.submission.output)}</p></details></div>`
        : `<form data-form="submission" data-id="${escape(item.id)}"><label>Your response<textarea name="output" maxlength="12000" required rows="3" placeholder="Write your response here…"></textarea></label><div class="form-actions"><button class="primary" type="submit">Submit work</button></div></form>`;
  }
  return `<article class="material" data-parent="${escape(item.parent_id || "")}" data-item="${escape(item.id)}"><div class="entry-rail"><div class="number">${escape(number)}</div>${editable ? button(icon("grip"), "reorder-handle", `draggable="true" data-drag="${escape(item.id)}" data-id="${escape(item.id)}" aria-label="Reorder ${escape(item.title)}" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" title="Drag to reorder · keyboard: Alt+↑ / Alt+↓"`, "quiet drag-handle") : ""}</div><div class="material-content"><div class="material-type">${escape(kind)} ${manage() && item.parent_id && !isVisibleEntry(item) && item.published ? '<span class="tag gold">Hidden with material</span>' : ""} ${manage() && !item.parent_id && item.kind !== "material" && item.assessment_type !== "examination" ? '<span class="tag gold">Choose a material</span>' : ""} ${manage() ? `<span class="tag ${item.published ? "green" : "gold"}">${item.published ? "Published" : "Draft"}</span>` : item.completed ? '<span class="tag green">Complete</span>' : ""}</div><div class="entry-heading"><h3>${escape(item.title)}</h3>${item.kind === "material" ? button(`${icon("chevron")}<span>${childrenOf(item.id).length}</span>`, "toggle-material", `data-id="${escape(item.id)}" aria-controls="children-${escape(item.id)}" aria-expanded="true" aria-label="Minimize activities and quizzes"`, "quiet material-toggle") : ""}</div>${item.kind === "material" && item.parent_id ? `<div data-subsection-body="${escape(item.id)}">` : ""}${bodyParts(item)}${student}${editable ? `<div class="material-tools">${button(icon("edit") + "Edit", "edit", `data-id="${escape(item.id)}"`, "quiet")}${button(item.published ? "Unpublish" : "Publish", "publish", `data-id="${escape(item.id)}"`, "quiet")}${button("Delete", "delete", `data-id="${escape(item.id)}"`, "quiet danger")}</div>` : ""}${item.kind === "material" && item.parent_id ? "</div>" : ""}</div></article>${editable ? `<div class="entry-editor" data-edit-slot="${escape(item.id)}"></div>` : ""}`;
}
function renderSubject() {
  const center = $("#center");
  if (!state.active) {
    center.innerHTML =
      header(
        "My subjects",
        "Your teaching and learning start here.",
        manage() ? button("+ New subject", "new-subject", "", "primary") : "",
      ) +
      empty(
        "No subjects yet",
        manage()
          ? "Create your first subject to start adding materials."
          : "Choose Find a subject to enroll.",
      );
    renderRight();
    return;
  }
  const s = state.active;
  const materials = state.items.filter((i) => i.kind === "material").length;
  const assessments = state.items.filter((i) => i.kind !== "material" && i.assessment_type !== "examination").length;
  const examinations = state.items.filter((i) => i.assessment_type === "examination").length;
  center.innerHTML =
    utility() +
    `<section class="subject-hero"><div class="row between"><span class="tag">${manage() ? "INSTRUCTOR WORKSPACE" : "MY SUBJECT"}</span>${manage() ? button(icon("more"), "edit-subject", 'aria-label="Edit subject details" title="Edit subject details"', "quiet") : ""}</div><div class="eyebrow">AERONAUTICAL OPEN ACADEMY</div><h1>${escape(s.title)}</h1><p class="preserve">${escape(s.description)}</p><div class="hero-toolbar"><span>${materials} ${materials === 1 ? "material" : "materials"}</span><span>·</span><span>${assessments} activities & quizzes</span><span>·</span><span>${examinations} ${examinations === 1 ? "examination" : "examinations"}</span>${!manage() ? `<span>· ${state.summary?.completion_percent || 0}% complete</span>` : ""}</div></section><div class="section-heading"><h2>${manage() ? "Subject content" : "Your learning materials"}</h2><span>${manage() ? "Create. Arrange. Share." : "One step at a time."}</span></div><div id="entries">${state.items.length ? treeMarkup() : empty("A fresh start", manage() ? "Add a material or an examination to begin." : "Your instructor has not published any content yet.")}</div><div id="search-empty" hidden>${empty("No matching entries", "Try another search.")}</div>${manage() ? `<div class="composer-slot root-add-slot" data-add-parent=""></div>${!state.treeSupported ? '<p class="small muted">Update your organization backend to enable activities and quizzes inside materials.</p>' : ""}` : ""}`;
  if (manage()) renderComposer();
  applySubjectSearch();
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
    const material = state.items.find((entry) => entry.id === parent);
    slot.innerHTML = (parent && !material?.parent_id && state.subsectionsSupported ? button(icon("plus") + " Subsection", "add-subsection", `data-parent="${escape(parent)}" aria-label="Add subsection to this material"`, "add-line") : "") + button(icon("plus") + (parent ? " Add activity or quiz" : " Add material or examination"), "add", `data-parent="${escape(parent)}" aria-label="${parent ? "Add activity or quiz to this material" : "Add material or examination to this subject"}"`, "add-line");
  });
  if (!state.compose) { syncMaterialSections(); restorePosition(position); return; }
  const item = state.compose.item;
  const parentId = item?.parent_id || state.compose.parentId || "";
  const parent = state.items.find((entry) => entry.id === parentId);
  const slot = item ? document.querySelector(`[data-edit-slot="${item.id}"]`) : document.querySelector(`[data-add-parent="${parentId}"]`);
  if (!slot) return;
  const kind = item ? (item.assessment_type === "examination" ? "examination" : item.kind) : state.compose.kind || (parentId ? "activity" : "material");
  const choices = parentId ? [...(!parent?.parent_id && state.subsectionsSupported ? [["material", "Subsection / links"]] : []), ["activity", "Activity"], ["quiz", "Quiz"]] : [["material", "Material / links"], ["examination", "Examination"]];
  const parentChoices = item && ["activity", "quiz"].includes(item.kind) && item.assessment_type !== "examination" && state.treeSupported ? `<label>Material<select name="parent_id" aria-label="Parent material" required>${!item.parent_id ? '<option value="">Choose a material to group this entry</option>' : ""}${state.items.filter((entry) => entry.kind === "material" && (owned(entry) || entry.id === item.parent_id)).map((entry) => `<option value="${escape(entry.id)}" ${entry.id === item.parent_id ? "selected" : ""}>${escape((entry.parent_id ? "↳ " : "") + entry.title)}</option>`).join("")}</select></label>` : "";
  let text = item?.body || "";
  if (item && text.split("\n")[0].trim() !== item.title.trim()) text = item.title + "\n" + text;
  const links = [];
  if (item && kind === "material") {
    const lines = text.split("\n");
    while (/^https?:\/\/\S+$/.test(lines.at(-1))) links.unshift(lines.pop());
    text = lines.join("\n") || item.title;
  }
  if (item) { state.compose.initialText = text; state.compose.initialLinks = [...links]; }
  slot.innerHTML = `<form id="composer" class="composer"><div class="type-row"><div><h3 class="compose-title">${item ? "Edit entry" : parent ? "Add to this material" : "Add to your subject"}</h3><span class="compose-hint">${parent ? escape(parent.title) : "Materials and examinations appear at subject level."}</span></div>${item ? `<span class="tag">${escape(kind)}</span>` : `<select name="kind" id="entry-kind" aria-label="Entry type">${choices.map(([value,label]) => `<option value="${value}" ${value === kind ? "selected" : ""}>${label}</option>`).join("")}</select>`}</div>${parentChoices}<label>Text <span class="muted">· first line becomes the title</span><textarea name="text" rows="3" maxlength="11500" required placeholder="e.g. Lesson 01 — The principles of flight">${escape(text)}</textarea></label>${kind === "material" ? `<div class="attach-row">${button(icon("link") + " Attach link", "attach", "", "quiet")}<span class="compose-hint">Drive, Docs, Sheets, Slides, YouTube or images</span></div><div id="link-fields">${links.map(linkField).join("")}</div><p class="compose-hint">Links open in your browser. Give students access at the original host.</p>` : ""}${kind === "quiz" && !item ? '<label>Answer choices · one per line<textarea name="options" rows="3" maxlength="1800" placeholder="First choice\nSecond choice" required></textarea></label><label>Correct choice number<input name="correct" type="number" min="1" max="6" value="1" required></label>' : ""}<div class="form-actions"><label class="choice"><input type="checkbox" name="published" ${item?.published === false ? "" : "checked"}>Publish to students</label><span class="push"></span>${button("Cancel", "cancel-compose", "", "quiet")}<button type="submit" class="primary">${icon("check")} Done</button></div><p id="compose-error" class="error small" role="alert"></p></form>`;
  slot.querySelectorAll("input[name=link]").forEach(inspectLinkField);
  syncMaterialSections();
  restorePosition(position);
}
function renderRight() {
  const notices = state.announcements.slice(0, 3);
  const tasks = state.items.filter((i) =>
    manage() ? !i.published : !i.completed && i.kind !== "material",
  );
  $("#rightbar").innerHTML =
    `<section><div class="section-heading"><h2>Announcements</h2>${state.account.role === "admin" ? button(icon("plus"), "announcements", 'aria-label="Manage announcements"', "quiet") : icon("bell")}</div>${notices.length ? notices.map((n) => `<article class="notice"><div class="small">${new Date(n.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div><h3>${escape(n.title)}</h3><p class="preserve">${escape(n.body)}</p></article>`).join("") : '<p class="small-info">You’re up to date. Announcements will appear here.</p>'}${state.announcements.length > 3 ? button("View all", "announcements", "", "quiet") : ""}</section><div class="separator"></div><section><div class="section-heading"><h2>${manage() ? "Teaching tasks" : "Your tasks"}</h2><span class="tag">${tasks.length}</span></div><p class="small-info">${state.active ? escape(state.active.title) : "Choose a subject"}</p>${
      tasks
        .slice(0, 5)
        .map(
          (t) =>
            `<button class="task-row" data-action="task-item" data-id="${escape(t.id)}"><span class="task-icon">${icon(manage() ? "edit" : "tasks")}</span><span><strong>${escape(t.title)}</strong><small>${manage() ? "Draft · finish and publish" : t.kind === "quiz" ? "Quiz · not submitted" : "Written work · not submitted"}</small></span></button>`,
        )
        .join("") ||
      '<p class="small-info">No pending tasks in this subject.</p>'
    }${manage() && state.active ? `<button class="task-row" data-action="learners"><span class="task-icon">${icon("users")}</span><span><strong>Review student progress</strong><small>Read, submitted and graded work</small></span></button>` : ""}</section><div class="separator"></div><section class="progress-box"><div class="eyebrow">${manage() ? "AT A GLANCE" : "YOUR PROGRESS"}</div><div class="row between"><span class="big">${manage() ? state.items.filter(isVisibleEntry).length : (state.summary?.completion_percent || 0) + "%"}</span><span class="tag">${manage() ? "published entries" : "completed"}</span></div>${!manage() ? `<div class="progress-track"><progress max="100" value="${state.summary?.completion_percent || 0}" aria-label="Subject completion"></progress></div>` : ""}<p>${manage() ? "Knowledge grows, one lesson at a time." : "Reading is self-reported; completion is separate from grades."}</p></section>`;
}
async function navigate(view, id) {
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
      `<div class="course-grid">${state.subjects.map((s) => `<button class="course-card" data-action="subject" data-id="${escape(s.id)}"><span class="tag">${manage() ? "SUBJECT" : "ENROLLED"}</span><h3>${escape(s.title)}</h3><p>${escape(s.description)}</p>${!manage() ? `<progress value="${s.summary.completion_percent}" max="100"></progress><span class="small muted">${s.summary.completion_percent}% complete</span>` : icon("arrow")}</button>`).join("")}</div>` +
      (state.subjects.length
        ? ""
        : empty("No subjects yet", "Create or enroll in a subject to begin."));
  if (view === "tasks" || view === "results") await renderAllWork(view);
  if (view === "learners") await renderLearners();
  if (view === "eligibility") await renderEligibility();
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
      ? state.allItems.filter((i) => (manage() ? !i.published : !i.completed))
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
          `<article class="material"><div class="material-content"><span class="small muted">${escape(item.subject.title)}</span><h3>${escape(item.title)}</h3><p>${item.kind === "material" ? "Reading · self-reported" : item.attempt ? `Quiz score: ${item.attempt.score} / 1` : item.submission?.score != null ? `Written score: ${item.submission.score} / 100` : item.submission ? "Submitted · awaiting assessment" : manage() ? "Draft · unpublished" : "Not submitted"}</p>${button("Open subject " + icon("arrow"), "subject", `data-id="${escape(item.subject.id)}"`, "quiet")}</div></article>`,
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
  $("#center").innerHTML =
    header(
      "Students & progress",
      "A clear view of participation and assessment.",
    ) +
    chooseSubject() +
    `<div class="section-heading"><span>${d.total} enrolled students · showing ${d.learners.length}</span>${button("Export Excel", "export", "", "quiet")}</div><div class="table-scroll"><table class="data-table"><thead><tr><th>Student</th><th>Read</th><th>Submitted</th><th>Graded</th><th></th></tr></thead><tbody>${d.learners.map((l) => `<tr><td>${escape(l.student.name)}<div class="small muted">${escape(l.student.student_number || l.student.email)}</div></td><td>${l.summary.read}/${l.summary.materials}</td><td>${l.summary.submitted}/${l.summary.required}</td><td>${l.summary.graded}</td><td>${button("View work", "learner", `data-id="${escape(l.student.id)}"`, "quiet")}</td></tr>`).join("")}</tbody></table></div>${!d.learners.length ? empty("No students enrolled yet", "Open Enrollment to set who can join.") : ""}<div class="form-actions">${button("Previous", "roster-page", `data-offset="${Math.max(0, state.rosterOffset - 100)}" ${state.rosterOffset ? "" : "disabled"}`)}${button("Next students", "roster-page", `data-offset="${d.next_offset || 0}" ${d.next_offset == null ? "disabled" : ""}`)}</div>`;
}
async function renderLearner(id) {
  const data = await api(`/v1/subjects/${state.active.id}/learners/${id}`);
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
          `<article class="material"><div class="material-content"><h3>${escape(item.title)}</h3><span class="tag">${escape(item.status)}</span>${item.output ? `<p class="preserve">${escape(item.output)}</p>` : ""}${item.answer ? `<p>Answer: ${escape(item.answer)}</p>` : ""}${item.submission_id ? `<form data-form="grade" data-id="${escape(item.submission_id)}" data-student="${escape(id)}" data-graded="${item.graded_at || ""}"><div class="form-grid"><label>Score / 100<input type="number" min="0" max="100" step="any" name="score" value="${item.score ?? ""}" required></label><label>Feedback<input name="feedback" maxlength="1000" value="${escape(item.feedback)}"></label></div><div class="form-actions"><button class="primary">Save assessment</button></div></form>` : item.score != null ? `<p>Score: ${item.score} / ${item.max_score}</p>` : ""}</div></article>`,
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
  $("#center").innerHTML =
    header("Enrollment", "Choose who can join this subject.") +
    chooseSubject() +
    `<form id="eligibility" class="inline-form" data-revision="${d.revision}"><h3>Eligible students</h3><p class="small muted">Students find the subject and join using their administrator-assigned ID. Existing administrator enrollments remain overrides.</p><label class="choice"><input name="all" type="checkbox" ${d.all_students ? "checked" : ""}>All students</label><label>Or allow these student IDs · one per line<textarea name="numbers" rows="5" placeholder="2026-001\n2026-002">${escape(d.student_numbers.join("\n"))}</textarea></label><p class="small muted">No IDs and All students unchecked closes self-enrollment. Changing eligibility can remove self-enrolled students’ access.</p><div class="form-actions"><button class="primary">Save eligibility</button></div></form><div class="inline-form"><h3>Subject code</h3><p class="small muted">Eligible students can paste this code in Find a subject.</p><input readonly aria-label="Subject code" value="${escape(state.active.id)}"></div>`;
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
          `<article class="material"><div class="material-content"><h3>${escape(s.title)}</h3>${button("Enroll in subject", "enrol", `data-id="${escape(s.id)}"`, "primary")}</div></article>`,
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
      "Manage access to your learning workspace.",
      button("+ Create account", "new-account", "", "primary"),
    ) +
    `<div id="account-form-slot"></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Name</th><th>Role / ID</th><th>Status</th><th></th></tr></thead><tbody>${d.accounts.map((a) => `<tr><td>${escape(a.name)}<div class="small muted">${escape(a.email)}</div></td><td>${escape(a.role)}<div class="small muted">${escape(a.student_number || "")}</div></td><td>${escape(a.status)}</td><td>${a.id !== state.account.id ? button(a.status === "active" ? "Suspend" : "Reactivate", "account-status", `data-id="${escape(a.id)}" data-status="${a.status === "active" ? "suspended" : "active"}"`, "quiet") : ""}</td></tr>`).join("")}</tbody></table></div><div class="form-actions">${button("Previous", "account-page", `data-offset="${Math.max(0, state.accountOffset - 100)}" ${state.accountOffset ? "" : "disabled"}`)}${button("Next", "account-page", `data-offset="${state.accountOffset + 100}" ${d.accounts.length < 100 ? "disabled" : ""}`)}</div>`;
}
function renderAnnouncements() {
  $("#center").innerHTML =
    header("Announcements", "Updates for everyone in the workspace.") +
    (state.account.role === "admin"
      ? `<form id="announcement" class="inline-form"><h3>Share an update</h3><label>Title<input name="title" required maxlength="160"></label><label>Message<textarea name="body" required maxlength="5000" rows="3"></textarea></label><div class="form-actions"><button class="primary">Publish announcement</button></div></form>`
      : "") +
    state.announcements
      .map(
        (n) =>
          `<article class="material"><div class="material-content"><span class="small muted">${new Date(n.created_at).toLocaleDateString()}</span><h3>${escape(n.title)}</h3><p class="preserve">${escape(n.body)}</p>${state.account.role === "admin" ? button("Delete", "delete-announcement", `data-id="${escape(n.id)}"`, "quiet danger") : ""}</div></article>`,
      )
      .join("");
}
function renderSettings() {
  $("#center").innerHTML =
    header("Settings", "Your account and workspace.") +
    `<div class="inline-form"><h3>${state.mode === "local" ? "Local test workspace" : "Organization workspace"}</h3><p class="small muted">${state.mode === "local" ? "This workspace is saved on this PC. It does not synchronize with other computers or the Android test app." : "Your account and subjects are managed by your organization’s Academy server."}</p><p class="small">${escape(state.account.email)}${state.account.student_number ? " · " + escape(state.account.student_number) : ""}</p></div><form id="password" class="inline-form"><h3>Change password</h3><label>Current password<input name="current" type="password" required autocomplete="current-password"></label><label>New passphrase · 15–128 characters<input name="next" type="password" minlength="15" maxlength="128" required autocomplete="new-password"></label><div class="form-actions"><button class="primary">Change password & sign out</button></div></form>`;
}
function renderHelp() {
  $("#center").innerHTML =
    header("A calmer way to learn", "Everything stays in one workspace.") +
    `<div class="inline-form"><h3>Add a material</h3><p>Choose a subject, select + Add material or examination at subject level, choose Material, write a text line and attach the material’s web link. Select Done to save. Published entries are visible to enrolled students.</p><h3>Activities, quizzes and examinations</h3><p>Each material has + Subsection and + Add activity or quiz below its last child. A subsection holds text, links, activities and quizzes; minimize it with the chevron beside its title. The subject-level + creates materials or examinations. To group an older standalone activity or quiz, choose Edit → Material. Examinations stay beside materials.</p><h3>Arrange your subject</h3><p>Drag the grip at the left of an entry within the same level. For keyboard reordering, focus the grip and press Alt+Up or Alt+Down. Minimize or expand activities and quizzes using the chevron beside a material title. Moving a material carries its activities and quizzes. Use Edit → Material to move a child between materials. Edit, unpublish or delete an entry using the controls beneath it.</p><h3>Learn and keep track</h3><p>Open a material link in your browser. Mark reading as done, answer a quiz or submit written work. Results and tasks appear in the left navigation.</p><h3>Share access</h3><p>Instructors choose eligible student IDs or All students under Enrollment. Students join using Find a subject or a subject code. Accounts are created by an administrator.</p><h3>Keep originals where they belong</h3><p>Google Drive, Docs, Sheets, Slides, YouTube and image links open in your browser. Attach several links to one material or paste links into its text. Share the original with your students’ Google accounts; a Drive link alone does not grant access. Their own sharing permissions and sign-in still apply. This version is designed for links; upload and protected PDF viewing use the Android app.</p><h3>If a link does not open</h3><p>Sign in to the correct Google account in your browser. Ask the owner to grant access if needed. Academy keeps the original sharing URL and does not change its permissions. After an entry is changed, use Refresh before opening an old link.</p><h3>Desktop release candidate limitations</h3><p>The local test workspace stays on this PC. Organization synchronization requires a deployed Academy backend. Quizzes are one question per entry, written work accepts text, and tasks do not have scheduled deadlines. Accounts currently support creation and suspension/reactivation; account deletion, ID edits and password resets remain available in the Android client. Enrollment uses codes rather than camera QR scanning.</p></div>`;
}
function renderSubjectForm(edit = false) {
  const s = edit ? state.active : null;
  state.compose = null;
  $("#center").innerHTML =
    header(
      edit ? "Subject details" : "Create a subject",
      "A simple home for lessons and learning activities.",
    ) +
    `<form id="subject-form" class="inline-form" data-edit="${s ? "true" : "false"}"><label>Subject title<input name="title" maxlength="160" required value="${escape(s?.title || "")}" placeholder="e.g. Aircraft Structures"></label><label>Description<textarea name="description" maxlength="1000" required placeholder="What will students learn?">${escape(s?.description || "")}</textarea></label><div class="form-actions">${button("Cancel", "subject", s ? `data-id="${escape(s.id)}"` : "", "quiet")}<button class="primary">${s ? "Save details" : "Create subject"}</button></div></form>`;
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
  return { subject: state.active?.id, scroll: center.scrollTop, anchors: [...new Set(anchors)].map((el) => ({ id: el.dataset.item, offset: el.getBoundingClientRect().top - top })), rects: new Map(cards.map((el) => [el.dataset.item,el.getBoundingClientRect().top])) };
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
    for (const card of center.querySelectorAll("[data-item]")) {
      const rect = card.getBoundingClientRect();
      const previous = position.rects.get(card.dataset.item);
      const delta = previous - rect.top;
      if (Number.isFinite(delta) && Math.abs(delta) > 1 && Math.abs(delta) < center.clientHeight && rect.bottom > center.getBoundingClientRect().top && rect.top < center.getBoundingClientRect().bottom)
        card.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], { duration: 180, easing: "ease-out" });
    }
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
  document.querySelectorAll("#subject-nav [data-id]").forEach((entry) => {
    const subject = state.subjects.find((item) => item.id === entry.dataset.id);
    if (subject) entry.querySelector("span").textContent = subject.title;
  });
  renderSubject();
  restorePosition(position, feedbackId, true);
}

async function reorder(ids, anchorId) {
  const position = capturePosition(anchorId);
  await post(`/v1/subjects/${state.active.id}/order`, {
    item_ids: ids,
    expected_revision: state.active.order_revision,
  });
  await reloadActive({position, feedbackId: anchorId});
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
      const resume = resumeWorkspace && resumeWorkspace.id === session.account.id && resumeWorkspace.role === session.account.role && resumeWorkspace.mode === session.mode && resumeWorkspace.origin === session.origin && !session.account.must_change_password;
      state.account = session.account;
      state.mode = session.mode;
      state.origin = session.origin;
      form.elements.password.value = "";
      if (resume) {
        $("#app").hidden = false;
        toast("Signed in. Your unsaved work is restored; review before saving.");
      } else if (state.account.must_change_password) {
        shell();
        state.view = "settings";
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
  $("#login-form").elements.username.value = "";
  $("#login-form").elements.password.value = "";
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
  if (action === "reorder-handle") {
    toast("Drag this grip to reorder, or focus it and press Alt+↑ / Alt+↓.");
    return;
  }
  act(async () => {
    if (
      [
        "subjects",
        "subject",
        "tasks",
        "results",
        "learners",
        "eligibility",
        "accounts",
        "announcements",
        "settings",
        "help",
        "discover",
      ].includes(action)
    )
      return navigate(action, id);
    if (action === "logout") {
      if (!(await leaveDraft())) return;
      await desktopApi.logout();
      resumeWorkspace = null;
      Object.assign(state, {
        account: null,
        active: null,
        items: [],
        subjects: [],
        announcements: [],
      });
      $("#app").innerHTML = "";
      showLogin();
      return;
    }
    if (action === "add" || action === "add-subsection") {
      if (!(await leaveDraft())) return;
      const parentId = target.dataset.parent || "";
      if (parentId && !state.treeSupported) throw new Error("Update the learning service to use the subject tree.");
      state.compose = { parentId, kind: action === "add-subsection" ? "material" : parentId ? "activity" : "material" };
      renderComposer();
      revealNearby($("#composer"));
      $("#composer textarea").focus({preventScroll:true});
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
      $("#composer textarea").focus({preventScroll:true});
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
          children.length ? `Remove this material and its ${children.length} subsections/activities/quizzes? Historical learning records are retained.` : "This removes it from the subject. Historical learning records are retained.",
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
      if (manage()) {
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
      $("#account-form-slot").innerHTML =
        `<form id="new-account" class="inline-form"><h3>Create account</h3><div class="form-grid"><label>Name<input name="name" maxlength="100" required></label><label>Email<input name="email" type="email" maxlength="254" required></label><label>Role<select name="role"><option value="student">Student</option><option value="instructor">Instructor</option><option value="admin">Admin</option></select></label><label>Student ID · students only<input name="student_number" maxlength="32"></label></div><label>Temporary passphrase · at least 15 characters<input name="password" type="password" minlength="15" maxlength="128" required autocomplete="new-password"></label><p class="small muted">The new account must change its password at first sign-in.</p><div class="form-actions"><button class="primary">Create account</button></div></form>`;
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
      const text = d.text.trim();
      const rawLinks = new FormData(form).getAll("link").map((raw) => raw.trim());
      const links = await Promise.all(rawLinks.map((raw) => desktopApi.inspectLink(raw)));
      let body = [text, ...new Set(links.map((link) => link.url))].join("\n");
      const title = text.split("\n")[0].trim();
      if (!title || title.length > 160)
        throw new Error("Keep the first line between 1 and 160 characters.");
      const item = state.compose.item;
      if (item && text === state.compose.initialText && JSON.stringify(rawLinks) === JSON.stringify(state.compose.initialLinks)) body = item.body;
      if (body.length > 12000)
        throw new Error("Keep this entry within 12,000 characters.");
      let savedId = item?.id;
      const kind = item?.kind || d.kind;
      const payload = { title, body, published: !!d.published };
      if (item) {
        if (d.parent_id && d.parent_id !== item.parent_id) {
          payload.parent_id = d.parent_id;
          payload.expected_order_revision = state.active.order_revision;
        }
        await api(`/v1/items/${item.id}`, {
          method: "PATCH",
          body: { ...payload, expected_edit_version: item.edit_version },
        });
      } else {
        payload.kind = kind;
        if (state.compose.parentId) payload.parent_id = state.compose.parentId;
        if (kind === "material") payload.material_mode = "text";
        if (kind === "quiz") {
          payload.options = d.options
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          payload.correct_index = Number(d.correct) - 1;
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
    if (form.dataset.form === "quiz" || form.dataset.form === "submission") {
      if (
        !(await confirmAction(
          "Submit your work?",
          "You can submit once for this version of the entry.",
          "Submit",
        ))
      )
        return;
      form.dataset.key ||= crypto.randomUUID();
      await post(
        `/v1/items/${id}/${form.dataset.form === "quiz" ? "quiz" : "submission"}`,
        form.dataset.form === "quiz"
          ? { choice: Number(d.choice) }
          : { output: d.output },
        form.dataset.key,
      );
      state.dirty = false;
      await reloadActive();
      toast("Work submitted.");
    }
    if (form.dataset.form === "grade") {
      await post(`/v1/submissions/${id}/grade`, {
        score: Number(d.score),
        feedback: d.feedback,
        expected_graded_at: form.dataset.graded
          ? Number(form.dataset.graded)
          : null,
      });
      state.dirty = false;
      await renderLearner(form.dataset.student);
      toast("Assessment saved.");
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
      if (!/^[a-f0-9-]{36}$/.test(d.code.trim()))
        throw new Error("Enter the full subject code.");
      await post(`/v1/subjects/${d.code.trim()}/enrol`, { source: "qr" });
      await refreshData();
      await navigate("subject", d.code.trim());
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
      const payload = { ...d };
      if (!payload.student_number) delete payload.student_number;
      await post("/v1/admin/accounts", payload);
      state.dirty = false;
      await renderAccounts();
      toast("Account created.");
    }
    if (form.id === "password") {
      await post("/v1/auth/password", {
        current_password: d.current,
        new_password: d.next,
      });
      state.dirty = false;
      state.account = null;
      $("#app").innerHTML = "";
      showLogin();
      toast("Password changed. Sign in again.");
    }
  });
});
document.addEventListener("input", (event) => {
  if (event.target.id === "search") {
    state.search = event.target.value;
    applySubjectSearch();
    return;
  }
  if (event.target.matches("#composer input[name=link]")) {
    clearTimeout(event.target.linkTimer);
    event.target.linkTimer = setTimeout(() => inspectLinkField(event.target), 200);
  }
  if (event.target.closest("#app form")) state.dirty = true;
});
document.addEventListener("change", (event) => {
  if (event.target.id === "entry-kind") {
    const form = $("#composer");
    const previous = [...form.elements].filter((el) => el.name && el.name !== "kind").map((el) => ({ name: el.name, value: el.value, checked: el.checked }));
    const fields = { ...state.compose.fields };
    for (const field of previous) {
      if (field.name !== "link") fields[field.name] = field;
    }
    if ($("#link-fields")) fields.links = previous.filter((field) => field.name === "link");
    state.compose = { ...state.compose, kind: event.target.value, fields };
    renderComposer();
    const restored = $("#composer");
    for (const field of [...Object.values(fields).filter((field) => field.name), ...(fields.links || [])]) {
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
      else await renderEligibility();
    });
  else if (event.target.closest("#app form")) state.dirty = true;
});
document.addEventListener("keydown", (event) => {
  const handle = event.target.closest("[data-drag]");
  if (!handle || !event.altKey || event.ctrlKey || event.metaKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  const id = handle.dataset.drag;
  const direction = event.key === "ArrowUp" ? -1 : 1;
  act(async () => {
    if (!(await leaveDraft())) return;
    const item = state.items.find((entry) => entry.id === id);
    const siblings = siblingsOf(item);
    const index = siblings.findIndex((entry) => entry.id === id);
    const next = index + direction;
    if (next < 0 || next >= siblings.length) return;
    [siblings[index], siblings[next]] = [siblings[next], siblings[index]];
    await reorder(item.parent_id ? flattenTree(rootsOf(), new Map([[item.parent_id, siblings]])) : flattenTree(siblings), id);
  }).then(() => document.querySelector(`[data-drag="${id}"]`)?.focus({preventScroll:true}));
});
let dragId;
document.addEventListener("dragstart", (event) => {
  const handle = event.target.closest("[data-drag]");
  if (!handle) return;
  dragId = handle.dataset.drag;
  event.dataTransfer.setData("text/plain", dragId);
  event.dataTransfer.effectAllowed = "move";
});
document.addEventListener("dragover", (event) => {
  const card = event.target.closest("[data-item]");
  if (dragId && card) {
    event.preventDefault();
    document.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target", "drop-after"));
    card.classList.add("drop-target");
    const bounds = card.getBoundingClientRect();
    card.classList.toggle("drop-after", event.clientY >= bounds.top + bounds.height / 2);
  }
});
document.addEventListener("dragleave", (event) =>
  event.target.closest("[data-item]")?.classList.remove("drop-target", "drop-after"),
);
document.addEventListener("dragend", () => {
  dragId = null;
  document
    .querySelectorAll(".drop-target")
    .forEach((el) => el.classList.remove("drop-target", "drop-after"));
});
document.addEventListener("drop", (event) => {
  const target = event.target.closest("[data-item]"),
    source = dragId;
  dragId = null;
  if (!target || !source) return;
  event.preventDefault();
  document
    .querySelectorAll(".drop-target")
    .forEach((el) => el.classList.remove("drop-target", "drop-after"));
  act(async () => {
    if (!(await leaveDraft())) return;
    const sourceItem = state.items.find((item) => item.id === source);
    const targetItem = state.items.find((item) => item.id === target.dataset.item);
    if (!sourceItem || !targetItem || source === targetItem.id) return;
    if ((sourceItem.parent_id || null) !== (targetItem.parent_id || null)) {
      toast("Drag within the same level. Use Edit → Material to move an activity or quiz to another material.");
      return;
    }
    const siblings = siblingsOf(sourceItem).filter((item) => item.id !== source);
    const bounds = target.getBoundingClientRect();
    const after = event.clientY >= bounds.top + bounds.height / 2;
    siblings.splice(siblings.findIndex((item) => item.id === targetItem.id) + Number(after), 0, sourceItem);
    await reorder(sourceItem.parent_id ? flattenTree(rootsOf(), new Map([[sourceItem.parent_id,siblings]])) : flattenTree(siblings), targetItem.id);
  });
});
window.addEventListener("beforeunload", (event) => {
  if (state.dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
showLogin();
