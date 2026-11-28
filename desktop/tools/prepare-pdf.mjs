// Packaging — Copy pinned upstream PDF.js assets verbatim; never edit generated vendor files.
import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
const desktop=resolve(import.meta.dirname,'..'),target=resolve(desktop,'vendor/pdfjs');
await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});
for(const file of ['pdf.mjs','pdf.worker.mjs'])await cp(resolve(desktop,'node_modules/pdfjs-dist/build',file),resolve(target,file));
for(const file of ['cmaps','wasm','standard_fonts','LICENSE'])await cp(resolve(desktop,'node_modules/pdfjs-dist',file),resolve(target,file),{recursive:true});
