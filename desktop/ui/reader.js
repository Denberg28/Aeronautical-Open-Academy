"use strict";
// Reader — Canvas pages only; there is no PDF toolbar, external reader, save or print action.
// Recheck current access and revision on every page turn; discard bytes when the dialog closes.
window.academyReader = (() => {
  let dialog, task, documentPdf, current = 1, itemId, revision, generation = 0;
  async function close() {
    generation++;
    const previous=task;task = null; documentPdf = null;
    dialog?.remove(); dialog = null;
    try{await previous?.destroy();}catch{/* Removing the private view still completes. */}
  }
  async function page(number) {
    const request = ++generation;
    const result = await window.academy.request(`/v1/items/${itemId}`);
    if (request !== generation) return;
    if (!result.ok || result.value.item.revision !== revision) {
      await close(); const error=new Error("Material changed or access ended. Sync before reading again.");
      error.status=result.status;throw error;
    }
    const source = await documentPdf.getPage(number);
    if (request !== generation) return;
    const base = source.getViewport({scale: 1});
    const viewport = source.getViewport({scale: Math.min(1400/base.width, 2000/base.height, 2)});
    const canvas = dialog.querySelector("canvas");
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await source.render({canvas, viewport}).promise;
    if (request !== generation) return;
    current = number;
    dialog.querySelector("[data-page]").textContent = `Page ${number} of ${documentPdf.numPages}`;
    dialog.querySelector("[data-prev]").disabled = number <= 1;
    dialog.querySelector("[data-next]").disabled = number >= documentPdf.numPages;
  }
  async function open(id, version) {
    // Lifecycle — A close/sign-out during loading must never reopen private content.
    const closing = close(), request = generation;
    await closing;
    if (request !== generation) return;
    itemId = id; revision = version;
    const result = await window.academy.readMaterial(id, version);
    if (request !== generation) return;
    if (!result.ok) {const error=new Error(result.error);error.status=result.status;throw error;}
    const pdfjs = await import("/pdfjs/pdf.mjs");
    if (request !== generation) return;
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.mjs";
    const bytes = Uint8Array.from(atob(result.value.data), c => c.charCodeAt(0));
    task = pdfjs.getDocument({data: bytes, isEvalSupported: false, useSystemFonts: true,
      wasmUrl: "/pdfjs/wasm/", cMapUrl: "/pdfjs/cmaps/", cMapPacked: true,
      standardFontDataUrl: "/pdfjs/standard_fonts/"});
    let loaded;
    try { loaded = await task.promise; }
    catch (error) {if (request !== generation) return; await close(); throw error;}
    if (request !== generation) return;
    documentPdf = loaded;
    if (!documentPdf.numPages || documentPdf.numPages > 2000) {await close(); throw new Error("Use a PDF with 1–2000 pages.");}
    dialog = document.createElement("dialog"); dialog.className = "pdf-reader";
    dialog.innerHTML = '<h2></h2><div class="pdf-reader-bar"><div class="pdf-reader-nav"><button type="button" data-prev>Previous</button><span data-page></span><button type="button" data-next>Next</button></div><button type="button" class="quiet" data-close>Close</button></div><div class="pdf-pages"><canvas aria-label="Material page"></canvas></div><p role="status"></p>';
    dialog.querySelector("h2").textContent = result.value.title;
    document.body.append(dialog);
    dialog.addEventListener("cancel", event => {event.preventDefault();void close();});
    dialog.querySelector("[data-close]").onclick = () => void close();
    const turn = async number => {
      dialog.querySelector("canvas").getContext("2d").clearRect(0, 0, 1400, 2000);
      dialog.querySelectorAll("[data-prev],[data-next]").forEach(button => button.disabled = true);
      try {await page(number);} catch(error) {await close();document.dispatchEvent(new CustomEvent("academy-reader-error",{detail:{message:error.message,status:error.status}}));}
    };
    dialog.querySelector("[data-prev]").onclick = () => void turn(current - 1);
    dialog.querySelector("[data-next]").onclick = () => void turn(current + 1);
    dialog.showModal(); await page(1);
  }
  return {open, close};
})();
