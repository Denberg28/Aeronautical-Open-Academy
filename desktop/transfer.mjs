import { createHash } from "node:crypto";
import { detectImageMime, extractImageIds, MAX_IMAGE_BYTES } from "../server/src/richtext.mjs";

export const FORMAT_ID = "aoa-export-v1";
export const MAX_PACKAGE_BYTES = 50 * 1024 * 1024;
const MAX_SUBJECTS = 50;
const MAX_ITEMS_PER_SUBJECT = 200;
const MAX_IMAGES_PER_ITEM = 20;
const MAX_FOLDERS = 200;
const MAX_ENTRY_DEPTH = 4;
const MAX_FOLDER_DEPTH = 5;
const VALID_SPACINGS = new Set(["compact", "normal", "relaxed", "loose"]);
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function formatCreationTimestamp(input = Date.now()) {
  const date = input instanceof Date ? input : new Date(input);
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = safe.getFullYear();
  const month = pad2(safe.getMonth() + 1);
  const day = pad2(safe.getDate());
  const hours = pad2(safe.getHours());
  const minutes = pad2(safe.getMinutes());
  const seconds = pad2(safe.getSeconds());
  return {
    stamp: `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`,
    display: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`,
    iso: safe.toISOString(),
    ms: safe.getTime(),
  };
}

export function slugifyTitle(title, fallback = "Repository-Export") {
  const cleaned = String(title || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, " ")
    .replace(/[^a-zA-Z0-9._ -]+/g, " ")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return cleaned || fallback;
}

export function buildExportFilename({ scope = "subject", title = "", createdAt = Date.now() } = {}) {
  const ts = formatCreationTimestamp(createdAt);
  const base =
    scope === "repository"
      ? "Aeronautical-Academy-Repository"
      : slugifyTitle(title, "Subject");
  return `${base}_${ts.stamp}.aoa.json`;
}

export function computePackageDigest(payload) {
  const canonical = JSON.stringify({
    format: payload.format,
    scope: payload.scope,
    created_at_ms: payload.created_at_ms,
    folders: payload.folders,
    subjects: payload.subjects,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function folderPathFor(folders, folderId) {
  if (!folderId || !Array.isArray(folders)) return [];
  const byId = new Map(folders.map((f) => [f.id, f]));
  const names = [];
  const seen = new Set();
  let cur = byId.get(folderId);
  while (cur && !seen.has(cur.id) && names.length < MAX_FOLDER_DEPTH) {
    seen.add(cur.id);
    names.unshift(cur.name);
    cur = cur.parent_id ? byId.get(cur.parent_id) : null;
  }
  return names;
}

function orderTreeTopological(items) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const childrenMap = new Map();
  for (const item of items) {
    const key = item.parent_id && byId.has(item.parent_id) ? item.parent_id : "";
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key).push(item);
  }
  const ordered = [];
  const visited = new Set();
  const visit = (parentKey) => {
    for (const item of childrenMap.get(parentKey) || []) {
      if (visited.has(item.id)) continue;
      visited.add(item.id);
      ordered.push(item);
      visit(item.id);
    }
  };
  visit("");
  for (const item of items) {
    if (!visited.has(item.id)) {
      visited.add(item.id);
      ordered.push(item);
    }
  }
  return ordered;
}

function orderFoldersTopological(folders) {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const childrenMap = new Map();
  for (const folder of folders) {
    const key = folder.parent_id && byId.has(folder.parent_id) ? folder.parent_id : "";
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key).push(folder);
  }
  const ordered = [];
  const visited = new Set();
  const visit = (parentKey) => {
    const list = (childrenMap.get(parentKey) || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    for (const folder of list) {
      if (visited.has(folder.id)) continue;
      visited.add(folder.id);
      ordered.push(folder);
      visit(folder.id);
    }
  };
  visit("");
  return ordered;
}

export async function buildExportPackage(bridge, { scope = "subject", subjectId = null, appVersion = "0.13.0-rc.2", now = Date.now() } = {}) {
  if (!bridge?.account || !["admin", "instructor"].includes(bridge.account.role)) {
    const err = new Error("Only administrators and instructors can export repository packages.");
    err.status = 403;
    throw err;
  }
  const listing = await bridge.request("/v1/subjects");
  const allSubjects = Array.isArray(listing.subjects) ? listing.subjects : [];
  const allFolders = Array.isArray(listing.folders) ? listing.folders : [];

  let targets = [];
  if (scope === "subject") {
    const found = allSubjects.find((s) => s.id === subjectId);
    if (!found) {
      const err = new Error("Subject not found.");
      err.status = 404;
      throw err;
    }
    if (bridge.account.role !== "admin" && (found.can_edit === false || found.access_level === "read_only")) {
      const err = new Error("Read-only instructors cannot export subject packages.");
      err.status = 403;
      throw err;
    }
    targets = [found];
  } else if (scope === "repository") {
    targets = allSubjects.filter(
      (s) => bridge.account.role === "admin" || (s.can_edit !== false && s.access_level !== "read_only"),
    );
    if (!targets.length) {
      const err = new Error("There are no editable subjects available to export.");
      err.status = 400;
      throw err;
    }
  } else {
    const err = new Error("Choose a valid export scope.");
    err.status = 400;
    throw err;
  }

  const orderedFolders = orderFoldersTopological(allFolders);
  const folderIdMap = new Map(orderedFolders.map((f, idx) => [f.id, `f-${idx + 1}`]));
  const exportedFolders =
    scope === "repository" && bridge.account.role === "admin"
      ? orderedFolders.map((f, idx) => ({
          export_id: folderIdMap.get(f.id),
          name: String(f.name || "").trim(),
          parent_export_id: f.parent_id ? folderIdMap.get(f.parent_id) || null : null,
          sort_order: Number.isInteger(f.sort_order) ? f.sort_order : idx,
        }))
      : [];

  const exportedSubjects = [];
  let totalItems = 0;
  let totalImages = 0;

  for (const subjectMeta of targets) {
    const detail = await bridge.request(`/v1/subjects/${subjectMeta.id}`);
    const subj = detail.subject || subjectMeta;
    const rawItems = Array.isArray(detail.items) ? detail.items : [];
    const orderedItems = orderTreeTopological(rawItems);
    const itemIdMap = new Map(orderedItems.map((item, idx) => [item.id, `i-${idx + 1}`]));
    const exportedItems = [];

    for (let idx = 0; idx < orderedItems.length; idx++) {
      const item = orderedItems[idx];
      if (bridge.account.role !== "admin" && item.can_edit === false) continue;
      const bodyHtml = typeof item.body_html === "string" ? item.body_html : null;
      const imageIds = bodyHtml ? extractImageIds(bodyHtml) : [];
      const images = [];
      for (const imageId of imageIds) {
        const fetched = await bridge.readImage({
          subjectId: subj.id,
          itemId: item.id,
          imageId,
        });
        const base64 =
          typeof fetched.base64 === "string"
            ? fetched.base64
            : typeof fetched.dataUrl === "string" && fetched.dataUrl.includes(",")
              ? fetched.dataUrl.split(",")[1]
              : "";
        if (!base64) continue;
        const buf = Buffer.from(base64, "base64");
        const mime = detectImageMime(buf);
        if (!mime || buf.length > MAX_IMAGE_BYTES) continue;
        images.push({
          old_id: imageId,
          mime_type: mime,
          sha256: createHash("sha256").update(buf).digest("hex"),
          base64,
        });
        totalImages++;
      }

      const exportedItem = {
        export_id: itemIdMap.get(item.id),
        parent_export_id: item.parent_id ? itemIdMap.get(item.parent_id) || null : null,
        kind: item.assessment_type === "examination" ? "examination" : item.kind,
        material_mode: item.kind === "material" ? "text" : undefined,
        title: String(item.title || ""),
        body: String(item.body || ""),
        body_html: bodyHtml,
        paragraph_spacing: VALID_SPACINGS.has(item.paragraph_spacing) ? item.paragraph_spacing : "normal",
        published: Boolean(item.published),
        publish_at: Number.isFinite(item.publish_at) ? item.publish_at : null,
        due_at: Number.isFinite(item.due_at) ? item.due_at : null,
        sort_order: idx,
        images,
      };

      if (Array.isArray(item.questions) && item.questions.length) {
        exportedItem.questions = item.questions.map((q) => ({
          prompt: String(q.prompt || ""),
          options: Array.isArray(q.options) ? q.options.map((o) => String(o || "")) : [],
          correct_index: Number.isInteger(q.correct_index) ? q.correct_index : 0,
        }));
      }

      exportedItems.push(exportedItem);
      totalItems++;
    }

    exportedSubjects.push({
      title: String(subj.title || ""),
      description: String(subj.description || ""),
      created_at: Number.isFinite(subj.created_at) ? subj.created_at : null,
      folder_path: folderPathFor(allFolders, subj.folder_id),
      items: exportedItems,
    });
  }

  const ts = formatCreationTimestamp(now);
  const filename = buildExportFilename({
    scope,
    title: scope === "subject" ? exportedSubjects[0]?.title : "",
    createdAt: ts.ms,
  });

  const payload = {
    format: FORMAT_ID,
    app: "Aeronautical Academy Repository",
    app_version: appVersion,
    scope,
    created_at: ts.iso,
    created_at_ms: ts.ms,
    created_at_local: ts.display,
    filename,
    folders: exportedFolders,
    subjects: exportedSubjects,
  };
  payload.integrity = {
    algorithm: "sha256",
    sha256: computePackageDigest(payload),
  };

  const json = JSON.stringify(payload, null, 2);
  if (Buffer.byteLength(json, "utf8") > MAX_PACKAGE_BYTES) {
    const err = new Error("Export package exceeds the 50 MB size limit.");
    err.status = 413;
    throw err;
  }

  return {
    filename,
    json,
    payload,
    summary: {
      scope,
      filename,
      createdAtLocal: ts.display,
      createdAtIso: ts.iso,
      subjectCount: exportedSubjects.length,
      subjectTitles: exportedSubjects.map((s) => s.title),
      itemCount: totalItems,
      imageCount: totalImages,
      folderCount: exportedFolders.length,
    },
  };
}

function failImport(message) {
  const err = new Error(message);
  err.status = 400;
  throw err;
}

export function parseAndValidateImport(rawInput, filename = "") {
  const bytes = Buffer.isBuffer(rawInput) ? rawInput : Buffer.from(String(rawInput || ""), "utf8");
  if (!bytes.length) failImport("The selected file is empty.");
  if (bytes.length > MAX_PACKAGE_BYTES) failImport("Import file exceeds the 50 MB limit.");

  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    failImport("The selected file is not a valid JSON export package.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    failImport("Invalid export package format.");
  }
  if (parsed.format !== FORMAT_ID) {
    failImport("Unsupported file format. Select an Aeronautical Academy Repository (.aoa.json) export file.");
  }
  if (!["subject", "repository"].includes(parsed.scope)) {
    failImport("Invalid export scope.");
  }
  if (!Number.isFinite(parsed.created_at_ms)) {
    failImport("Export package is missing its creation timestamp.");
  }
  if (!Array.isArray(parsed.subjects) || parsed.subjects.length < 1 || parsed.subjects.length > MAX_SUBJECTS) {
    failImport(`Export package must contain between 1 and ${MAX_SUBJECTS} subjects.`);
  }
  if (!Array.isArray(parsed.folders) || parsed.folders.length > MAX_FOLDERS) {
    failImport("Export package contains an invalid folder list.");
  }

  const expectedDigest = parsed.integrity?.sha256;
  if (typeof expectedDigest !== "string" || !/^[a-f0-9]{64}$/.test(expectedDigest)) {
    failImport("Export package is missing a valid SHA-256 integrity checksum.");
  }
  const actualDigest = computePackageDigest(parsed);
  if (actualDigest !== expectedDigest) {
    failImport("Export package integrity check failed. The file may be corrupted or modified.");
  }

  // Validate folders (names, no cycles, depth <= 5)
  const folderById = new Map();
  for (const folder of parsed.folders) {
    if (!folder || typeof folder !== "object") failImport("Invalid folder entry.");
    const id = String(folder.export_id || "").trim();
    const name = String(folder.name || "").trim();
    if (!id || !name || name.length > 80) failImport("Invalid folder name in export package.");
    if (folderById.has(id)) failImport("Duplicate folder ID in export package.");
    folderById.set(id, folder);
  }
  for (const folder of parsed.folders) {
    let depth = 1;
    let cur = folder;
    const seen = new Set([folder.export_id]);
    while (cur.parent_export_id) {
      if (seen.has(cur.parent_export_id)) failImport("Circular folder hierarchy detected in export package.");
      const parent = folderById.get(cur.parent_export_id);
      if (!parent) failImport("Missing parent folder reference in export package.");
      seen.add(parent.export_id);
      depth++;
      if (depth > MAX_FOLDER_DEPTH) failImport("Folder hierarchy exceeds the maximum depth of 5 levels.");
      cur = parent;
    }
  }

  let totalItems = 0;
  let totalImages = 0;
  for (const subj of parsed.subjects) {
    if (!subj || typeof subj !== "object") failImport("Invalid subject entry.");
    const title = String(subj.title || "").trim();
    const desc = String(subj.description || "").trim();
    if (!title || title.length > 160) failImport("Subject title is missing or exceeds 160 characters.");
    if (!desc || desc.length > 1000) failImport("Subject description is missing or exceeds 1,000 characters.");
    if (subj.folder_path !== undefined) {
      if (!Array.isArray(subj.folder_path) || subj.folder_path.length > MAX_FOLDER_DEPTH) {
        failImport("Invalid subject folder path in export package.");
      }
      for (const seg of subj.folder_path) {
        if (typeof seg !== "string" || !seg.trim() || seg.trim().length > 80) {
          failImport("Invalid folder path segment in export package.");
        }
      }
    }
    if (!Array.isArray(subj.items) || subj.items.length > MAX_ITEMS_PER_SUBJECT) {
      failImport(`A subject cannot import more than ${MAX_ITEMS_PER_SUBJECT} entries.`);
    }

    const itemById = new Map();
    for (const item of subj.items) {
      if (!item || typeof item !== "object") failImport("Invalid entry in export package.");
      const id = String(item.export_id || "").trim();
      if (!id || itemById.has(id)) failImport("Duplicate or missing entry ID in export package.");
      if (!["material", "activity", "quiz", "examination"].includes(item.kind)) {
        failImport("Unsupported entry type in export package.");
      }
      const itemTitle = String(item.title || "").trim();
      const itemBody = String(item.body || "");
      if (!itemTitle || itemTitle.length > 160) failImport("Entry title is missing or exceeds 160 characters.");
      if (itemBody.length > 12000) failImport("Entry body exceeds 12,000 characters.");
      if (item.paragraph_spacing && !VALID_SPACINGS.has(item.paragraph_spacing)) {
        failImport("Invalid paragraph spacing in export package.");
      }
      if (item.questions !== undefined) {
        if (!Array.isArray(item.questions) || item.questions.length < 1 || item.questions.length > 50) {
          failImport("Invalid assessment questions in export package.");
        }
        for (const q of item.questions) {
          if (!q || typeof q.prompt !== "string" || !q.prompt.trim() || q.prompt.length > 600) {
            failImport("Invalid question prompt in export package.");
          }
          if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
            failImport("Each question must have 2–6 choices.");
          }
          if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index >= q.options.length) {
            failImport("Invalid question answer key in export package.");
          }
        }
      }
      if (item.images !== undefined) {
        if (!Array.isArray(item.images) || item.images.length > MAX_IMAGES_PER_ITEM) {
          failImport(`An entry cannot contain more than ${MAX_IMAGES_PER_ITEM} embedded images.`);
        }
        for (const img of item.images) {
          if (!img || typeof img.old_id !== "string" || !UUID_RE.test(img.old_id) || typeof img.base64 !== "string") {
            failImport("Invalid embedded image metadata in export package.");
          }
          const buf = Buffer.from(img.base64, "base64");
          if (!buf.length || buf.length > MAX_IMAGE_BYTES) {
            failImport("Embedded image exceeds the 5 MB limit.");
          }
          const mime = detectImageMime(buf);
          if (!mime) failImport("Embedded image has an unsupported or invalid image signature.");
          const digest = createHash("sha256").update(buf).digest("hex");
          if (img.sha256 !== digest) {
            failImport("Embedded image SHA-256 checksum mismatch.");
          }
          totalImages++;
        }
      }
      itemById.set(id, item);
      totalItems++;
    }

    // Check parent_export_id depth & cycles
    for (const item of subj.items) {
      let depth = 1;
      let cur = item;
      const seen = new Set([item.export_id]);
      while (cur.parent_export_id) {
        if (item.kind === "examination") {
          failImport("Examinations must remain at subject top level.");
        }
        if (seen.has(cur.parent_export_id)) failImport("Circular entry hierarchy detected in export package.");
        const parent = itemById.get(cur.parent_export_id);
        if (!parent) failImport("Missing parent entry reference in export package.");
        if (parent.kind !== "material") failImport("Nested entries must be placed inside a material.");
        seen.add(parent.export_id);
        depth++;
        if (depth > MAX_ENTRY_DEPTH) failImport("Entry hierarchy exceeds the maximum depth of 4 levels.");
        cur = parent;
      }
    }
  }

  const ts = formatCreationTimestamp(parsed.created_at_ms);
  return {
    payload: parsed,
    summary: {
      scope: parsed.scope,
      filename: filename || parsed.filename || "export.aoa.json",
      createdAtLocal: parsed.created_at_local || ts.display,
      createdAtIso: parsed.created_at || ts.iso,
      subjectCount: parsed.subjects.length,
      subjectTitles: parsed.subjects.map((s) => String(s.title).trim()),
      itemCount: totalItems,
      imageCount: totalImages,
      folderCount: parsed.folders.length,
    },
  };
}

function remapHtmlImages(html, idMap) {
  if (!html || typeof html !== "string") return html;
  return html.replace(
    /<figure[^>]*>\s*<img\b[^>]*\bdata-img=["']([a-f0-9-]{36})["'][^>]*>\s*<\/figure>|<img\b[^>]*\bdata-img=["']([a-f0-9-]{36})["'][^>]*>|data-img=["']([a-f0-9-]{36})["']/gi,
    (full, figId, imgId, attrId) => {
      const oldId = (figId || imgId || attrId || "").toLowerCase();
      const replacement = idMap.get(oldId);
      if (!replacement) return "";
      return full.replace(/data-img=["'][a-f0-9-]{36}["']/gi, `data-img="${replacement}"`);
    },
  );
}

async function ensureFolderPath(bridge, pathNames, existingFolders, createdCounter) {
  if (!Array.isArray(pathNames) || !pathNames.length) return null;
  let parentId = null;
  for (const rawName of pathNames.slice(0, MAX_FOLDER_DEPTH)) {
    const name = String(rawName || "").trim();
    if (!name) break;
    const match = existingFolders.find(
      (f) => (f.parent_id || null) === parentId && f.name.toLowerCase() === name.toLowerCase(),
    );
    if (match) {
      parentId = match.id;
    } else {
      const res = await bridge.request("/v1/admin/folders", {
        method: "POST",
        body: { name, parent_id: parentId },
      });
      if (Array.isArray(res.folders)) {
        existingFolders.length = 0;
        existingFolders.push(...res.folders);
      }
      parentId = res.folder?.id || null;
      createdCounter.count++;
      if (!parentId) break;
    }
  }
  return parentId;
}

export async function importPackage(bridge, payload) {
  if (!bridge?.account || !["admin", "instructor"].includes(bridge.account.role)) {
    const err = new Error("Only administrators and instructors can import repository packages.");
    err.status = 403;
    throw err;
  }

  const [me, listing] = await Promise.all([
    bridge.request("/v1/me"),
    bridge.request("/v1/subjects"),
  ]);
  const capabilities = me.capabilities || {};
  const existingFolders = Array.isArray(listing.folders) ? [...listing.folders] : [];
  const isAdmin = bridge.account.role === "admin";
  const supportsFolders = isAdmin && capabilities.subject_folders === "v1";
  const supportsRich = capabilities.rich_content === "v1";
  const supportsImages = capabilities.entry_images === "v1";
  const supportsMultiLevel = capabilities.multi_level_entries === "v1";
  const supportsScheduling = capabilities.scheduling === "dates-v1";
  const createdFolders = { count: 0 };

  // Recreate standalone exported folders for Admins (repository backups)
  if (supportsFolders && Array.isArray(payload.folders) && payload.folders.length) {
    const byExportId = new Map(payload.folders.map((f) => [f.export_id, f]));
    const pathForExportFolder = (f) => {
      const segs = [];
      let cur = f;
      const seen = new Set();
      while (cur && !seen.has(cur.export_id)) {
        seen.add(cur.export_id);
        segs.unshift(cur.name);
        cur = cur.parent_export_id ? byExportId.get(cur.parent_export_id) : null;
      }
      return segs;
    };
    for (const f of payload.folders) {
      await ensureFolderPath(bridge, pathForExportFolder(f), existingFolders, createdFolders);
    }
  }

  const importedSubjects = [];
  let totalItems = 0;
  let totalImages = 0;
  const warnings = [];

  for (const subj of payload.subjects) {
    const createdSubject = await bridge.request("/v1/subjects", {
      method: "POST",
      body: {
        title: String(subj.title).trim(),
        description: String(subj.description).trim(),
      },
    });
    const subjectId = createdSubject.id;

    if (supportsFolders && Array.isArray(subj.folder_path) && subj.folder_path.length) {
      const folderId = await ensureFolderPath(bridge, subj.folder_path, existingFolders, createdFolders);
      if (folderId) {
        await bridge.request(`/v1/admin/subjects/${subjectId}/folder`, {
          method: "POST",
          body: { folder_id: folderId },
        });
      }
    }

    const ordered = [];
    const byExportId = new Map(subj.items.map((it) => [it.export_id, it]));
    const depthOf = (it) => {
      let d = 1;
      let cur = it;
      while (cur.parent_export_id && byExportId.has(cur.parent_export_id) && d <= MAX_ENTRY_DEPTH) {
        d++;
        cur = byExportId.get(cur.parent_export_id);
      }
      return d;
    };
    // Ensure parents are always created before their children while preserving sibling sort_order
    const childrenByParent = new Map();
    for (const it of subj.items) {
      const key = it.parent_export_id && byExportId.has(it.parent_export_id) ? it.parent_export_id : "";
      if (!childrenByParent.has(key)) childrenByParent.set(key, []);
      childrenByParent.get(key).push(it);
    }
    const visit = (key) => {
      const list = (childrenByParent.get(key) || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      for (const it of list) {
        ordered.push(it);
        visit(it.export_id);
      }
    };
    visit("");

    const createdIdByExport = new Map();
    const createdOrderIds = [];

    for (const item of ordered) {
      const imageIdMap = new Map();
      if (supportsImages && Array.isArray(item.images) && item.images.length) {
        for (const img of item.images) {
          const uploaded = await bridge.uploadImage(subjectId, Buffer.from(img.base64, "base64"));
          const newId = uploaded.image?.id || uploaded.id;
          if (newId) {
            imageIdMap.set(img.old_id.toLowerCase(), newId);
            totalImages++;
          }
        }
      } else if (!supportsImages && Array.isArray(item.images) && item.images.length) {
        warnings.push(`Embedded images in "${item.title}" were skipped because the server does not support entry images.`);
      }

      const depth = depthOf(item);
      let parentId = item.parent_export_id ? createdIdByExport.get(item.parent_export_id) || null : null;
      if (!supportsMultiLevel && depth > 2) {
        // Older 2-level servers allow material -> child only; attach to root material
        let top = item;
        while (top.parent_export_id && byExportId.has(top.parent_export_id)) {
          top = byExportId.get(top.parent_export_id);
        }
        parentId = top.export_id !== item.export_id ? createdIdByExport.get(top.export_id) || null : null;
        if (item.kind === "material") parentId = null;
      }

      const body = {
        kind: item.kind,
        title: String(item.title).trim(),
        body: String(item.body || "").trim() || String(item.title).trim(),
        published: Boolean(item.published),
        parent_id: parentId,
      };
      if (item.kind === "material") body.material_mode = "text";
      if (supportsRich) {
        body.paragraph_spacing = VALID_SPACINGS.has(item.paragraph_spacing) ? item.paragraph_spacing : "normal";
        if (item.body_html) body.body_html = remapHtmlImages(item.body_html, imageIdMap);
      }
      if (Array.isArray(item.questions) && item.questions.length) {
        body.questions = item.questions;
      }

      const createdItem = await bridge.request(`/v1/subjects/${subjectId}/items`, {
        method: "POST",
        body,
      });
      createdIdByExport.set(item.export_id, createdItem.id);
      createdOrderIds.push(createdItem.id);
      totalItems++;

      if (supportsScheduling && (item.publish_at != null || item.due_at != null)) {
        await bridge.request(`/v1/items/${createdItem.id}/schedule`, {
          method: "POST",
          body: {
            expected_edit_version: 1,
            publish_at: item.publish_at,
            due_at: item.due_at,
            published: Boolean(item.published),
          },
        });
      }
    }

    if (createdOrderIds.length > 1) {
      const fresh = await bridge.request(`/v1/subjects/${subjectId}`);
      await bridge.request(`/v1/subjects/${subjectId}/order`, {
        method: "POST",
        body: {
          item_ids: createdOrderIds,
          expected_revision: fresh.subject.order_revision,
        },
      });
    }

    importedSubjects.push({ id: subjectId, title: String(subj.title).trim(), itemCount: createdOrderIds.length });
  }

  return {
    importedSubjects,
    totalItems,
    totalImages,
    createdFolders: createdFolders.count,
    warnings,
  };
}
