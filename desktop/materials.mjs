import { externalUrl, linksInText } from "../server/src/links.mjs";

// Labels describe the address, never the remote file's contents or permissions.
export function describeLink(raw) {
  const url = externalUrl(raw);
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;
  let label = "Website";
  if (host === "docs.google.com") {
    if (/^\/document\//.test(path)) label = "Google Docs";
    else if (/^\/spreadsheets\//.test(path)) label = "Google Sheets";
    else if (/^\/presentation\//.test(path)) label = "Google Slides";
    else label = "Google Drive";
  } else if (host === "drive.google.com") label = "Google Drive";
  else if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"].includes(host)) label = "YouTube";
  else if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(path)) label = "Image";
  else if (/\.pdf$/i.test(path)) label = "PDF";
  else if (/\.(xlsx?|csv|ods)$/i.test(path)) label = "Spreadsheet";
  else if (/\.(pptx?|odp)$/i.test(path)) label = "Presentation";
  return { url, host, label };
}

export function materialPresentation(item) {
  const lines = String(item.body || "").split("\n");
  // A URL-only entry still needs a clickable reference when it is also the title.
  if (lines[0]?.trim() === item.title?.trim() && !linksInText(lines[0]).length) lines.shift();
  const source = lines.join("\n");
  const links = linksInText(source).map(describeLink);
  const text = source.replace(/https?:\/\/[^\s<>"`]+/gi, (raw) => {
    const url = linksInText(raw)[0];
    if (!url) return raw;
    // Keep the sentence's trailing punctuation while removing the actual address.
    let trimmed = raw.replace(/[.,;!]+$/, "");
    for (const [open, close] of [["(", ")"], ["[", "]"], ["{", "}"]])
      while (trimmed.endsWith(close) && trimmed.split(close).length > trimmed.split(open).length)
        trimmed = trimmed.slice(0, -1);
    trimmed = trimmed.replace(/[.,;!]+$/, "");
    return raw.slice(trimmed.length);
  }).trim();
  return { text, links };
}
