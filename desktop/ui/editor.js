"use strict";
// Rich subject content editor helper: adopts sanitized pasted formatting, supports inline pasted/picked images,
// paragraph indentation (data-indent 1..6), paragraph spacing preview, and authenticated image hydration.
window.academyEditor = (() => {
  const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
  const BLOCK_TAGS = new Set(["P", "H2", "H3", "H4", "BLOCKQUOTE", "PRE", "DIV", "LI"]);
  const INDENT_TAGS = new Set(["P", "H2", "H3", "H4", "BLOCKQUOTE", "PRE", "DIV", "LI", "UL", "OL"]);
  const ALLOWED_TAGS = new Set([
    "P", "BR", "STRONG", "B", "EM", "I", "U", "S",
    "H2", "H3", "H4", "UL", "OL", "LI", "BLOCKQUOTE",
    "CODE", "PRE", "FIGURE", "FIGCAPTION", "HR",
    "TABLE", "THEAD", "TBODY", "TR", "TH", "TD",
    "DIV", "SPAN", "SUB", "SUP", "IMG",
  ]);
  const DROP_TAGS = new Set([
    "SCRIPT", "STYLE", "SVG", "MATH", "IFRAME", "OBJECT",
    "EMBED", "TEMPLATE", "NOSCRIPT", "HEAD", "TITLE", "META", "LINK", "TEXTAREA", "SELECT", "OPTION", "BUTTON",
  ]);

  let imageGeneration = 0;
  const imageCache = new Map();

  function clearImageCache() {
    imageGeneration++;
    imageCache.clear();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  }

  function parsePx(raw) {
    if (!raw) return 0;
    const m = String(raw).trim().match(/^(-?\d+(?:\.\d+)?)\s*(px|pt|em|rem|in|cm|mm)?$/i);
    if (!m) return 0;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const unit = (m[2] || "px").toLowerCase();
    if (unit === "pt") return n * 1.333;
    if (unit === "em" || unit === "rem") return n * 16;
    if (unit === "in") return n * 96;
    if (unit === "cm") return n * 37.8;
    if (unit === "mm") return n * 3.78;
    return n;
  }

  function detectIndent(el) {
    const explicit = Number(el.getAttribute?.("data-indent"));
    if (Number.isInteger(explicit) && explicit >= 1 && explicit <= 6) return explicit;
    const style = el.getAttribute?.("style") || "";
    let px = 0;
    for (const prop of ["margin-left", "padding-left", "text-indent"]) {
      const match = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i"));
      if (match) px += parsePx(match[1]);
    }
    if (px >= 14) return Math.min(6, Math.max(1, Math.round(px / 28)));
    return 0;
  }

  function sanitizeNode(node, doc, { keepEditorControls = false } = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      return doc.createTextNode(node.nodeValue || "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    let tag = node.tagName.toUpperCase();
    if (DROP_TAGS.has(tag)) return null;

    if (tag === "H1") tag = "H2";
    if (tag === "H5" || tag === "H6") tag = "H4";
    if (tag === "DEL" || tag === "STRIKE") tag = "S";

    // Preserve links as visible text so existing link authorization remains the sole external-open path.
    if (tag === "A") {
      const frag = doc.createDocumentFragment();
      for (const child of node.childNodes) {
        const clean = sanitizeNode(child, doc, { keepEditorControls });
        if (clean) frag.append(clean);
      }
      const href = String(node.getAttribute("href") || "").trim();
      const text = (frag.textContent || "").trim();
      if (/^https?:\/\/\S+$/i.test(href) && !text.includes(href)) {
        frag.append(doc.createTextNode(text ? ` (${href})` : href));
      }
      return frag;
    }

    // Handle images strictly by data-img UUID (never arbitrary external src or inline data URIs from paste).
    if (tag === "IMG") {
      const imgId = String(node.getAttribute("data-img") || "").trim().toLowerCase();
      if (!UUID_RE.test(imgId)) return null;
      const img = doc.createElement("img");
      img.setAttribute("data-img", imgId);
      const alt = String(node.getAttribute("alt") || "Pasted image").replace(/[\r\n\t]+/g, " ").trim().slice(0, 160);
      img.setAttribute("alt", alt || "Pasted image");
      img.setAttribute("draggable", "false");
      if (keepEditorControls && node.src && node.src.startsWith("data:image/")) {
        img.src = node.src;
      }
      return img;
    }

    // Adopt inline bold/italic/underline styles from Word/Google Docs spans.
    const style = node.getAttribute("style") || "";
    const isBold = /(?:^|;)\s*font-weight\s*:\s*(?:bold|[6-9]00)\b/i.test(style);
    const isItalic = /(?:^|;)\s*font-style\s*:\s*italic\b/i.test(style);
    const isUnderline = /(?:^|;)\s*text-decoration(?:-line)?\s*:[^;]*underline/i.test(style);
    const isStrike = /(?:^|;)\s*text-decoration(?:-line)?\s*:[^;]*line-through/i.test(style);

    if (!ALLOWED_TAGS.has(tag)) {
      const frag = doc.createDocumentFragment();
      for (const child of node.childNodes) {
        const clean = sanitizeNode(child, doc, { keepEditorControls });
        if (clean) frag.append(clean);
      }
      return frag;
    }

    if (tag === "B") tag = "STRONG";
    if (tag === "I") tag = "EM";

    const out = doc.createElement(tag.toLowerCase());
    if (tag === "FIGURE") {
      const figImg = String(node.getAttribute("data-img") || "").trim().toLowerCase();
      if (UUID_RE.test(figImg)) {
        out.setAttribute("data-img", figImg);
        if (keepEditorControls) {
          out.className = "entry-figure";
          out.setAttribute("contenteditable", "false");
        }
      }
    }
    if (INDENT_TAGS.has(tag)) {
      const indent = detectIndent(node);
      if (indent > 0) out.setAttribute("data-indent", String(indent));
    }
    if (tag === "OL") {
      const start = Math.floor(Number(node.getAttribute("start")));
      if (Number.isInteger(start) && start >= 1 && start <= 999) out.setAttribute("start", String(start));
    }
    if (tag === "TD" || tag === "TH") {
      for (const attr of ["colspan", "rowspan"]) {
        const n = Math.floor(Number(node.getAttribute(attr)));
        if (Number.isInteger(n) && n >= 2 && n <= 20) out.setAttribute(attr, String(n));
      }
    }

    for (const child of node.childNodes) {
      const clean = sanitizeNode(child, doc, { keepEditorControls });
      if (clean) out.append(clean);
    }

    if (tag === "FIGURE" && out.getAttribute("data-img")) {
      if (!out.querySelector("img[data-img]")) return null;
      if (keepEditorControls) {
        const rmBtn = doc.createElement("button");
        rmBtn.type = "button";
        rmBtn.className = "figure-remove";
        rmBtn.setAttribute("data-remove-img", out.getAttribute("data-img"));
        rmBtn.setAttribute("aria-label", "Remove image");
        rmBtn.setAttribute("title", "Remove image");
        rmBtn.textContent = "×";
        out.append(rmBtn);
      }
    }

    // Wrap styled spans/divs with semantic tags when adopting pasted Word/Docs inline styling.
    let wrapped = out;
    if (tag === "SPAN") {
      if (!isBold && !isItalic && !isUnderline && !isStrike) {
        const frag = doc.createDocumentFragment();
        while (out.firstChild) frag.append(out.firstChild);
        return frag;
      }
      let inner = doc.createDocumentFragment();
      while (out.firstChild) inner.append(out.firstChild);
      if (isStrike) { const s = doc.createElement("s"); s.append(inner); inner = s; }
      if (isUnderline) { const u = doc.createElement("u"); u.append(inner); inner = u; }
      if (isItalic) { const em = doc.createElement("em"); em.append(inner); inner = em; }
      if (isBold) { const strong = doc.createElement("strong"); strong.append(inner); inner = strong; }
      return inner;
    }
    if ((isBold || isItalic || isUnderline) && ["P", "DIV", "LI"].includes(tag)) {
      const wrapInline = (tagName, el) => {
        const w = doc.createElement(tagName);
        while (el.firstChild) w.append(el.firstChild);
        el.append(w);
      };
      if (isUnderline) wrapInline("u", wrapped);
      if (isItalic) wrapInline("em", wrapped);
      if (isBold) wrapInline("strong", wrapped);
    }
    return wrapped;
  }

  function sanitizeHtmlFragment(rawHtml, { keepEditorControls = false } = {}) {
    if (!rawHtml) return "";
    const parsed = new DOMParser().parseFromString(String(rawHtml), "text/html");
    const outDoc = document.implementation.createHTMLDocument("");
    const container = outDoc.createElement("div");
    for (const child of parsed.body.childNodes) {
      const clean = sanitizeNode(child, outDoc, { keepEditorControls });
      if (clean) container.append(clean);
    }
    return container.innerHTML.trim();
  }

  function plainTextToHtml(plain) {
    const text = String(plain || "").replace(/\r\n/g, "\n");
    if (!text.trim()) return "";
    return text
      .split("\n")
      .map((line) => {
        if (!line.trim()) return "";
        const leadMatch = line.match(/^([\t ]+)/);
        let indent = 0;
        if (leadMatch) {
          const spaces = leadMatch[1].replace(/\t/g, "    ").length;
          indent = Math.min(6, Math.floor(spaces / 4));
        }
        const trimmed = line.trim();
        const attr = indent > 0 ? ` data-indent="${indent}"` : "";
        return `<p${attr}>${escapeHtml(trimmed)}</p>`;
      })
      .filter(Boolean)
      .join("");
  }

  function extractPlainText(root) {
    const blocks = [];
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.nodeValue || "";
        if (t.trim()) blocks.push(t.replace(/\s+/g, " ").trim());
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toUpperCase();
      if (tag === "BUTTON") return;
      if (tag === "IMG" && node.getAttribute("data-img")) {
        blocks.push(`[Image: ${node.getAttribute("alt") || "Pasted image"}]`);
        return;
      }
      if (tag === "FIGURE" && node.getAttribute("data-img")) {
        const img = node.querySelector("img[data-img]");
        blocks.push(`[Image: ${img?.getAttribute("alt") || "Pasted image"}]`);
        return;
      }
      if (tag === "BR") {
        blocks.push("\n");
        return;
      }
      if (["P", "H2", "H3", "H4", "LI", "BLOCKQUOTE", "PRE", "DIV", "TR"].includes(tag)) {
        const sub = [];
        for (const c of node.childNodes) {
          if (c.nodeType === Node.TEXT_NODE) sub.push(c.nodeValue || "");
          else if (c.nodeType === Node.ELEMENT_NODE) {
            const ct = c.tagName.toUpperCase();
            if (ct === "BR") sub.push("\n");
            else if (ct === "IMG" && c.getAttribute("data-img")) sub.push(`[Image: ${c.getAttribute("alt") || "Pasted image"}]`);
            else if (ct === "BUTTON") continue;
            else if (["P", "DIV", "UL", "OL", "FIGURE", "TABLE", "BLOCKQUOTE"].includes(ct)) {
              const joined = sub.join("").trim();
              if (joined) { blocks.push(joined); sub.length = 0; }
              walk(c);
            } else {
              sub.push(c.textContent || "");
            }
          }
        }
        const line = sub.join("").replace(/[ \t]+\n/g, "\n").trim();
        if (line) {
          const indent = Number(node.getAttribute("data-indent")) || 0;
          const prefix = tag === "LI" ? "- " : indent > 0 ? "  ".repeat(indent) : "";
          blocks.push(prefix + line);
        }
        return;
      }
      for (const c of node.childNodes) walk(c);
    };
    for (const c of root.childNodes) walk(c);
    return blocks.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function serializeEditor(editorEl) {
    if (!editorEl) return { bodyText: "", bodyHtml: null, imageIds: [], hasFormatting: false };
    const cleanHtml = sanitizeHtmlFragment(editorEl.innerHTML, { keepEditorControls: false });
    const parsed = new DOMParser().parseFromString(cleanHtml, "text/html");
    const bodyText = extractPlainText(parsed.body);
    const imageIds = [...new Set([...parsed.body.querySelectorAll("[data-img]")].map((el) => el.getAttribute("data-img")).filter((id) => UUID_RE.test(id || "")))];
    const hasFormatting = Boolean(
      imageIds.length ||
      parsed.body.querySelector("strong,b,em,i,u,s,h2,h3,h4,ul,ol,li,blockquote,pre,code,table,hr,[data-indent]"),
    );
    return {
      bodyText,
      bodyHtml: cleanHtml || null,
      imageIds,
      hasFormatting,
    };
  }

  function renderSafeHtml(bodyHtml, itemId) {
    const clean = sanitizeHtmlFragment(bodyHtml, { keepEditorControls: false });
    if (!clean) return "";
    const parsed = new DOMParser().parseFromString(clean, "text/html");
    for (const img of parsed.body.querySelectorAll("img[data-img]")) {
      img.className = "entry-image";
      img.setAttribute("data-item-id", itemId || "");
      img.setAttribute("draggable", "false");
      img.setAttribute("loading", "lazy");
    }
    for (const fig of parsed.body.querySelectorAll("figure[data-img]")) {
      fig.className = "entry-figure readonly";
    }
    return parsed.body.innerHTML;
  }

  function hydrateImages(rootEl, readImageFn, { subjectId = "" } = {}) {
    if (!rootEl || typeof readImageFn !== "function") return;
    const gen = imageGeneration;
    const imgs = [...rootEl.querySelectorAll("img[data-img]")].filter((img) => !img.dataset.loaded && !img.src?.startsWith("data:image/"));
    for (const img of imgs) {
      const imageId = img.getAttribute("data-img");
      const itemId = img.getAttribute("data-item-id") || "";
      if (!UUID_RE.test(imageId || "")) continue;
      const key = `${itemId || subjectId}:${imageId}`;
      if (imageCache.has(key)) {
        img.src = imageCache.get(key);
        img.dataset.loaded = "1";
        continue;
      }
      img.dataset.loaded = "loading";
      Promise.resolve(readImageFn({ itemId: itemId || undefined, subjectId: itemId ? undefined : subjectId, imageId }))
        .then((res) => {
          if (gen !== imageGeneration || !img.isConnected) return;
          if (res?.dataUrl) {
            if (imageCache.size > 120) {
              const firstKey = imageCache.keys().next().value;
              imageCache.delete(firstKey);
            }
            imageCache.set(key, res.dataUrl);
            img.src = res.dataUrl;
            img.dataset.loaded = "1";
          }
        })
        .catch(() => {
          if (gen !== imageGeneration || !img.isConnected) return;
          img.dataset.loaded = "error";
          img.alt = "Image unavailable";
        });
    }
  }

  function ensureSelectionBlocks(editorEl) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editorEl.contains(sel.anchorNode)) {
      if (!editorEl.firstElementChild) {
        const p = document.createElement("p");
        p.append(document.createElement("br"));
        editorEl.append(p);
      }
      return [editorEl.firstElementChild];
    }
    const range = sel.getRangeAt(0);
    // Wrap direct text nodes inside editorEl into <p> so indentation applies cleanly.
    if (range.startContainer === editorEl || (range.startContainer.nodeType === Node.TEXT_NODE && range.startContainer.parentNode === editorEl)) {
      const targetNode = range.startContainer === editorEl ? editorEl.childNodes[range.startOffset] : range.startContainer;
      if (targetNode && targetNode.nodeType === Node.TEXT_NODE) {
        const p = document.createElement("p");
        targetNode.parentNode.insertBefore(p, targetNode);
        p.append(targetNode);
        const nextRange = document.createRange();
        nextRange.selectNodeContents(p);
        nextRange.collapse(false);
        sel.removeAllRanges();
        sel.addRange(nextRange);
        return [p];
      }
    }
    const blocks = new Set();
    const closestBlock = (node) => {
      let cur = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
      while (cur && cur !== editorEl) {
        if (BLOCK_TAGS.has(cur.tagName)) return cur;
        cur = cur.parentElement;
      }
      return null;
    };
    const startBlock = closestBlock(range.startContainer);
    const endBlock = closestBlock(range.endContainer);
    if (startBlock) blocks.add(startBlock);
    if (endBlock) blocks.add(endBlock);
    if (startBlock && endBlock && startBlock !== endBlock) {
      for (const candidate of editorEl.querySelectorAll("p,h2,h3,h4,li,blockquote,pre,div")) {
        if (range.intersectsNode(candidate)) blocks.add(candidate);
      }
    }
    if (!blocks.size) {
      const p = document.createElement("p");
      while (editorEl.firstChild) p.append(editorEl.firstChild);
      if (!p.childNodes.length) p.append(document.createElement("br"));
      editorEl.append(p);
      blocks.add(p);
    }
    return [...blocks];
  }

  function adjustIndent(editorEl, delta) {
    editorEl.focus();
    const blocks = ensureSelectionBlocks(editorEl);
    for (const block of blocks) {
      const current = Number(block.getAttribute("data-indent")) || 0;
      const next = Math.max(0, Math.min(6, current + delta));
      if (next > 0) block.setAttribute("data-indent", String(next));
      else block.removeAttribute("data-indent");
    }
  }

  function insertNodeAtCaret(editorEl, node) {
    editorEl.focus();
    const lastInserted = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? node.lastChild : node;
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editorEl.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(node);
      if (lastInserted && lastInserted.parentNode) {
        range.setStartAfter(lastInserted);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      editorEl.append(node);
      if (lastInserted && lastInserted.parentNode && sel) {
        const range = document.createRange();
        range.setStartAfter(lastInserted);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }

  function insertImageFigure(editorEl, { id, dataUrl, alt = "Pasted image" }) {
    if (!editorEl || !UUID_RE.test(id || "")) return;
    const figure = document.createElement("figure");
    figure.className = "entry-figure";
    figure.setAttribute("contenteditable", "false");
    figure.setAttribute("data-img", id);
    const img = document.createElement("img");
    img.setAttribute("data-img", id);
    img.setAttribute("alt", alt);
    img.setAttribute("draggable", "false");
    img.src = dataUrl;
    img.dataset.loaded = "1";
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "figure-remove";
    rm.setAttribute("data-remove-img", id);
    rm.setAttribute("aria-label", "Remove image");
    rm.setAttribute("title", "Remove image");
    rm.textContent = "×";
    figure.append(img, rm);
    const after = document.createElement("p");
    after.append(document.createElement("br"));
    const frag = document.createDocumentFragment();
    frag.append(figure, after);
    insertNodeAtCaret(editorEl, frag);
    const sel = window.getSelection();
    if (sel && after.isConnected) {
      const range = document.createRange();
      range.selectNodeContents(after);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function applyCommand(editorEl, command, value = null) {
    if (!editorEl) return;
    editorEl.focus();
    if (command === "indent") return adjustIndent(editorEl, 1);
    if (command === "outdent") return adjustIndent(editorEl, -1);
    if (command === "clearFormat") {
      document.execCommand("removeFormat", false, null);
      for (const block of ensureSelectionBlocks(editorEl)) block.removeAttribute("data-indent");
      return;
    }
    if (command === "formatBlock") {
      const tag = ["p", "h2", "h3", "blockquote"].includes(value) ? value : "p";
      document.execCommand("formatBlock", false, `<${tag}>`);
      return;
    }
    if (["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList"].includes(command)) {
      document.execCommand(command, false, null);
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const str = String(reader.result || "");
        const comma = str.indexOf(",");
        resolve(comma >= 0 ? str.slice(comma + 1) : str);
      };
      reader.onerror = () => reject(new Error("Could not read pasted image."));
      reader.readAsDataURL(blob);
    });
  }

  function wireEditor(editorEl, { getSubjectId, uploadImage, onChange, onError }) {
    if (!editorEl || editorEl.dataset.editorWired === "1") return;
    editorEl.dataset.editorWired = "1";

    const uploadBlob = async (blob, name = "Pasted image") => {
      const subjectId = getSubjectId?.();
      if (!subjectId) throw new Error("Choose a subject before pasting an image.");
      if (blob.size > 5 * 1024 * 1024) throw new Error("Paste or choose an image up to 5 MB.");
      const base64 = await blobToBase64(blob);
      const uploaded = await uploadImage(subjectId, base64);
      insertImageFigure(editorEl, {
        id: uploaded.image.id,
        dataUrl: uploaded.dataUrl,
        alt: name || "Pasted image",
      });
      onChange?.();
    };

    editorEl.addEventListener("paste", (event) => {
      const dt = event.clipboardData;
      if (!dt) return;
      const imageFile =
        [...(dt.files || [])].find((f) => IMAGE_MIMES.has(f.type)) ||
        [...(dt.items || [])].find((item) => item.kind === "file" && IMAGE_MIMES.has(item.type))?.getAsFile();
      if (imageFile) {
        event.preventDefault();
        uploadBlob(imageFile, imageFile.name || "Pasted snip").catch((err) => onError?.(err));
        return;
      }
      const html = dt.getData("text/html");
      const plain = dt.getData("text/plain");
      if (html) {
        event.preventDefault();
        const clean = sanitizeHtmlFragment(html, { keepEditorControls: true });
        if (clean) {
          const tpl = document.createElement("template");
          tpl.innerHTML = clean;
          insertNodeAtCaret(editorEl, tpl.content);
        } else if (plain) {
          const tpl = document.createElement("template");
          tpl.innerHTML = plainTextToHtml(plain);
          insertNodeAtCaret(editorEl, tpl.content);
        }
        onChange?.();
        return;
      }
      if (plain) {
        event.preventDefault();
        const lines = plain.replace(/\r\n/g, "\n").split("\n");
        if (lines.length === 1 && !/^[\t ]{4}/.test(lines[0])) {
          insertNodeAtCaret(editorEl, document.createTextNode(lines[0]));
        } else {
          const tpl = document.createElement("template");
          tpl.innerHTML = plainTextToHtml(plain);
          insertNodeAtCaret(editorEl, tpl.content);
        }
        onChange?.();
      }
    });

    editorEl.addEventListener("drop", (event) => {
      const files = [...(event.dataTransfer?.files || [])].filter((f) => IMAGE_MIMES.has(f.type));
      if (!files.length) return;
      event.preventDefault();
      event.stopPropagation();
      Promise.all(files.slice(0, 5).map((f) => uploadBlob(f, f.name || "Dropped image"))).catch((err) => onError?.(err));
    });

    editorEl.addEventListener("keydown", (event) => {
      if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        adjustIndent(editorEl, event.shiftKey ? -1 : 1);
        onChange?.();
      }
    });

    editorEl.addEventListener("click", (event) => {
      const rm = event.target.closest("[data-remove-img]");
      if (!rm) return;
      event.preventDefault();
      rm.closest("figure")?.remove();
      onChange?.();
    });

    editorEl.addEventListener("input", () => onChange?.());
  }

  return {
    sanitizeHtmlFragment,
    plainTextToHtml,
    serializeEditor,
    renderSafeHtml,
    hydrateImages,
    clearImageCache,
    applyCommand,
    insertImageFigure,
    wireEditor,
  };
})();
