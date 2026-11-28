import { requireThat } from './security.mjs';

export const MAX_RICH_HTML_BYTES = 48000;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ITEM_IMAGES = 20;
export const PARAGRAPH_SPACINGS = Object.freeze(['compact', 'normal', 'relaxed', 'loose']);

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote',
  'code', 'pre', 'figure', 'figcaption', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span', 'sub', 'sup', 'img',
]);
const VOID_TAGS = new Set(['br', 'hr', 'img']);
const DROP_CONTENT_TAGS = new Set([
  'script', 'style', 'svg', 'math', 'iframe', 'object',
  'embed', 'template', 'noscript', 'head', 'title', 'textarea', 'select', 'option',
]);
const INDENTABLE_TAGS = new Set(['p', 'h2', 'h3', 'h4', 'blockquote', 'pre', 'div', 'li', 'ul', 'ol']);
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function detectImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12 || buffer.length > MAX_IMAGE_BYTES) return null;
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  const head6 = buffer.subarray(0, 6).toString('ascii');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'image/gif';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export function normalizeSpacing(value) {
  if (value === undefined || value === null || value === '') return 'normal';
  requireThat(
    typeof value === 'string' && PARAGRAPH_SPACINGS.includes(value),
    400,
    'Choose compact, normal, relaxed, or loose paragraph spacing.',
  );
  return value;
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(value) {
  return String(value ?? '')
    .replace(/&(?!#(?:\d{1,6}|x[0-9a-fA-F]{1,5});|[a-zA-Z]{2,12};)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decodeBasicEntities(value) {
  return String(value ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseAttributes(raw) {
  const attrs = Object.create(null);
  const re = /([a-zA-Z][a-zA-Z0-9:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(raw))) {
    const key = m[1].toLowerCase();
    const val = m[2] ?? m[3] ?? m[4] ?? '';
    attrs[key] = decodeBasicEntities(val);
  }
  return attrs;
}

export function sanitizeRichHtml(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  requireThat(typeof raw === 'string' && raw.length <= MAX_RICH_HTML_BYTES, 400, 'Formatted entry content is too large.');
  // Strip null bytes and nested/unclosed HTML comments before tokenizing.
  let input = raw.replace(/\0/g, '');
  let prev;
  do {
    prev = input;
    input = input.replace(/<!--[\s\S]*?-->/g, '');
  } while (input !== prev);
  input = input.replace(/<!--[\s\S]*$/, '');
  const out = [];
  const openStack = [];
  let skipTag = null;
  let skipDepth = 0;

  let pos = 0;
  while (pos < input.length) {
    const lt = input.indexOf('<', pos);
    if (lt === -1) {
      if (!skipTag) out.push(escapeText(input.slice(pos)));
      break;
    }
    if (lt > pos && !skipTag) {
      out.push(escapeText(input.slice(pos, lt)));
    }
    const gt = input.indexOf('>', lt + 1);
    if (gt === -1) {
      if (!skipTag) out.push(escapeText(input.slice(lt)));
      break;
    }
    const token = input.slice(lt + 1, gt).trim();
    pos = gt + 1;
    if (!token || token.startsWith('!') || token.startsWith('?')) continue;

    const isClosing = token.startsWith('/');
    const nameMatch = token.match(/^\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/);
    if (!nameMatch) continue;
    const tag = nameMatch[1].toLowerCase();

    if (skipTag) {
      if (tag === skipTag) {
        if (isClosing) {
          skipDepth--;
          if (skipDepth <= 0) { skipTag = null; skipDepth = 0; }
        } else if (!token.endsWith('/')) {
          skipDepth++;
        }
      }
      continue;
    }

    if (DROP_CONTENT_TAGS.has(tag)) {
      if (!isClosing && !token.endsWith('/')) {
        skipTag = tag;
        skipDepth = 1;
      }
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) continue;

    if (isClosing) {
      if (VOID_TAGS.has(tag)) continue;
      const idx = openStack.lastIndexOf(tag);
      if (idx !== -1) {
        while (openStack.length > idx) {
          out.push(`</${openStack.pop()}>`);
        }
      }
      continue;
    }

    const attrSlice = token.slice(nameMatch[0].length).replace(/\/\s*$/, '');
    const attrs = parseAttributes(attrSlice);
    const safeAttrs = [];

    if (tag === 'img') {
      const imgId = String(attrs['data-img'] || '').trim().toLowerCase();
      if (!UUID_RE.test(imgId)) continue;
      safeAttrs.push(`data-img="${imgId}"`);
      const alt = String(attrs.alt || 'Pasted image').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 160);
      safeAttrs.push(`alt="${escapeAttr(alt || 'Pasted image')}"`);
      out.push(`<img ${safeAttrs.join(' ')}>`);
      continue;
    }

    if (tag === 'figure' && attrs['data-img']) {
      const imgId = String(attrs['data-img']).trim().toLowerCase();
      if (UUID_RE.test(imgId)) safeAttrs.push(`data-img="${imgId}"`);
    }

    if (INDENTABLE_TAGS.has(tag) && attrs['data-indent'] !== undefined) {
      const level = Math.floor(Number(attrs['data-indent']));
      if (Number.isInteger(level) && level >= 1 && level <= 6) {
        safeAttrs.push(`data-indent="${level}"`);
      }
    }

    if (tag === 'ol' && attrs.start !== undefined) {
      const start = Math.floor(Number(attrs.start));
      if (Number.isInteger(start) && start >= 1 && start <= 999) {
        safeAttrs.push(`start="${start}"`);
      }
    }

    if ((tag === 'td' || tag === 'th')) {
      for (const spanAttr of ['colspan', 'rowspan']) {
        if (attrs[spanAttr] !== undefined) {
          const n = Math.floor(Number(attrs[spanAttr]));
          if (Number.isInteger(n) && n >= 2 && n <= 20) safeAttrs.push(`${spanAttr}="${n}"`);
        }
      }
    }

    const attrText = safeAttrs.length ? ' ' + safeAttrs.join(' ') : '';
    if (VOID_TAGS.has(tag)) {
      out.push(`<${tag}${attrText}>`);
    } else {
      out.push(`<${tag}${attrText}>`);
      openStack.push(tag);
    }
  }

  while (openStack.length) {
    out.push(`</${openStack.pop()}>`);
  }

  const cleaned = out.join('').trim();
  requireThat(cleaned.length <= MAX_RICH_HTML_BYTES, 400, 'Formatted entry content is too large.');
  return cleaned || null;
}

export function extractImageIds(sanitizedHtml) {
  if (!sanitizedHtml) return [];
  const ids = [];
  const seen = new Set();
  const re = /data-img="([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})"/g;
  let m;
  while ((m = re.exec(sanitizedHtml))) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      ids.push(m[1]);
    }
  }
  requireThat(ids.length <= MAX_ITEM_IMAGES, 400, `An entry can include at most ${MAX_ITEM_IMAGES} images.`);
  return ids;
}
