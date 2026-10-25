import qrcode from "./vendor/qrcode.mjs";

// Match Android's QrRouter. This identifies a subject; it grants no access.
export function enrollmentQr(id) {
  if (typeof id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))
    throw new Error("Choose a valid subject.");
  const payload = `aoa://subject/${id}`;
  const code = qrcode(0, "M");
  code.addData(payload, "Byte");
  code.make();
  // Four-module quiet zone. No credentials, account data, origin or answer keys.
  const svg = code.createSvgTag({cellSize:8, margin:32, scalable:true});
  return {payload, svg, image:`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`};
}
