import { randomUUID, randomBytes } from "node:crypto";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { createAcademy } from "../server/src/server.mjs";
import { hashPassword } from "../server/src/security.mjs";
import { externalUrl } from "../server/src/links.mjs";
import { materialPresentation, describeLink } from "./materials.mjs";

const demoPassword = (role) => `${role}-local-demonstration-only`;
const roles = ["admin", "instructor", "student"];
export async function startLocal(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const academy = await createAcademy({
    dbPath: join(directory, "academy.sqlite"),
  });
  // Seed only a completely empty LOCAL demonstration database; never touch a remote service.
  if (!academy.db.prepare("SELECT id FROM accounts LIMIT 1").get()) {
    const hashes = [];
    for (const role of roles)
      hashes.push(await hashPassword(demoPassword(role)));
    const ids = roles.map(() => randomUUID());
    academy.db.exec("BEGIN IMMEDIATE");
    try {
      roles.forEach((role, i) =>
        academy.db
          .prepare(
            "INSERT INTO accounts(id,email,name,role,password_hash,must_change_password,created_at,student_number) VALUES(?,?,?,?,?,0,?,?)",
          )
          .run(
            ids[i],
            `${role}@academy.test`,
            role === "admin"
              ? "Administrator"
              : role === "instructor"
                ? "Demo instructor"
                : "Demo student",
            role,
            hashes[i],
            Date.now(),
            role === "student" ? "TEST-001" : null,
          ),
      );
      const subject = randomUUID();
      academy.db
        .prepare(
          "INSERT INTO subjects(id,title,description,owner_id,created_at,self_enrol,eligibility_all) VALUES(?,?,?,?,?,1,1)",
        )
        .run(
          subject,
          "Introduction to Aeronautics",
          "A place for your lessons, references and learning activities.",
          ids[1],
          Date.now(),
        );
      academy.db
        .prepare(
          "INSERT INTO enrolments(subject_id,student_id,source) VALUES(?,?,'admin')",
        )
        .run(subject, ids[2]);
      const materialId = randomUUID();
      academy.db
        .prepare(
          "INSERT INTO items(id,subject_id,owner_id,kind,title,body,published,created_at,material_mode,sort_order) VALUES(?,?,?,'material',?,?,1,?,'text',0)",
        )
        .run(
          materialId,
          subject,
          ids[1],
          "The principles of flight",
          "The principles of flight\nExplore NASA’s guide to the forces that act on an aircraft.\nhttps://www1.grc.nasa.gov/beginners-guide-to-aeronautics/",
          Date.now(),
        );
      academy.db
        .prepare(
          "INSERT INTO items(id,subject_id,owner_id,kind,title,body,published,created_at,material_mode,sort_order) VALUES(?,?,?,'activity',?,?,1,?,'file',1)",
        )
        .run(
          randomUUID(),
          subject,
          ids[1],
          "Reflect on the four forces",
          "In your own words, describe how lift, weight, thrust and drag interact during steady flight.",
          Date.now(),
        );
      academy.db.prepare("UPDATE items SET parent_id=? WHERE subject_id=? AND kind='activity'").run(materialId,subject);
      academy.db
        .prepare(
          "INSERT INTO announcements(id,title,body,author_id,created_at) VALUES(?,?,?,?,?)",
        )
        .run(
          randomUUID(),
          "Welcome to your learning workspace",
          "Choose a subject to begin. Open material links in your browser, and keep your learning organized here.",
          ids[0],
          Date.now(),
        );
      academy.db.exec("COMMIT");
    } catch (error) {
      academy.db.exec("ROLLBACK");
      await academy.close();
      throw error;
    }
  }
  // A private random header also prevents other local browser tabs from reaching this test API.
  const accessKey = randomBytes(32).toString("hex");
  const handler = academy.server.listeners("request")[0];
  academy.server.removeAllListeners("request");
  academy.server.on("request", (req, res) => {
    if (req.headers["x-academy-desktop"] !== accessKey) {
      res.writeHead(403);
      res.end();
      return;
    }
    handler(req, res);
  });
  await new Promise((resolve) =>
    academy.server.listen(0, "127.0.0.1", resolve),
  );
  return {
    academy,
    accessKey,
    origin: `http://127.0.0.1:${academy.server.address().port}`,
  };
}

export function validateOrigin(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter your organization’s HTTPS server address.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use an HTTPS origin without a path, query or credentials.",
    );
  return url.origin;
}
function validateRequest(path, options) {
  if (
    typeof path !== "string" ||
    !/^\/v1\/[a-z0-9/-]+(?:\?offset=\d{1,6})?$/.test(path) ||
    path.includes("//") ||
    path.length > 250
  )
    throw new Error("Invalid Academy request.");
  const method = options.method || "GET";
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method))
    throw new Error("Invalid request method.");
  if (
    options.body !== undefined &&
    Buffer.byteLength(JSON.stringify(options.body)) > 65536
  )
    throw new Error("This entry is too long.");
  if (options.key && !/^[a-f0-9-]{36}$/.test(options.key))
    throw new Error("Invalid submission key.");
  return method;
}
export class AcademyBridge {
  constructor(local, { fetcher = fetch, openExternal = async () => {} } = {}) {
    this.local = local;
    this.fetcher = fetcher;
    this.openExternal = openExternal;
    this.origin = local.origin;
    this.token = "";
    this.mode = "local";
    this.account = null;
  }
  async fetch(path, options = {}, binary = false) {
    const method = validateRequest(path, options);
    const headers = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (this.mode === "local")
      headers["X-Academy-Desktop"] = this.local.accessKey;
    if (options.body !== undefined)
      headers["Content-Type"] = "application/json";
    if (options.key) headers["Idempotency-Key"] = options.key;
    let response;
    try {
      response = await this.fetcher(this.origin + path, {
        method,
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error(
        "Cannot reach the learning service. Your unsaved text is still here. Try again.",
      );
    }
    if (response.status === 401) {
      this.token = "";
      this.account = null;
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(
        error.error || error.message || `Request failed (${response.status}).`,
      );
      err.status = response.status;
      throw err;
    }
    if (binary) return Buffer.from(await response.arrayBuffer());
    return response.json();
  }
  async login({ mode = "local", origin, username, password }) {
    if (!["local", "organization"].includes(mode))
      throw new Error("Choose a workspace.");
    if (this.token) await this.logout();
    this.mode = mode;
    this.origin = mode === "local" ? this.local.origin : validateOrigin(origin);
    let email = String(username || "").trim();
    let pass = password;
    const alias = email.replace(/@academy\.test$/i, "").toLowerCase();
    if (mode === "local" && roles.includes(alias)) {
      email = `${alias}@academy.test`;
      if (password === alias) pass = demoPassword(alias);
    }
    const result = await this.fetch("/v1/auth/login", {
      method: "POST",
      body: { email, password: pass },
    });
    this.token = result.token;
    this.account = result.account;
    return {
      account: result.account,
      mode,
      origin: mode === "organization" ? this.origin : null,
    };
  }
  async request(path, options = {}) {
    if (!this.token) {
      const error = new Error("Sign in to continue.");
      error.status = 401;
      throw error;
    }
    if (
      path.startsWith("/v1/auth/login") ||
      path.endsWith("/export") ||
      path.endsWith("/content")
    )
      throw new Error("Use the dedicated sign-in or export action.");
    const result = await this.fetch(path, options);
    if (path === "/v1/auth/password") {
      this.token = "";
      this.account = null;
    }
    if (Array.isArray(result.items))
      result.items = result.items.map((item) => ({ ...item, material: materialPresentation(item) }));
    return result;
  }
  inspectLink(raw) {
    const link = describeLink(raw);
    // Attached links are stored as plain text, using the backend's same parser.
    const presentation = materialPresentation({ body: link.url, title: "" });
    if (presentation.links[0]?.url !== link.url)
      throw new Error("Remove trailing sentence punctuation from the material link.");
    return link;
  }
  async logout() {
    try {
      if (this.token) await this.fetch("/v1/auth/logout", { method: "POST" });
    } finally {
      this.token = "";
      this.account = null;
    }
    return { signed_out: true };
  }
  async openLink({ id, revision, url }) {
    const result = await this.request(`/v1/items/${id}/open-link`, {
      method: "POST",
      body: { url, expected_revision: revision },
    });
    const safe = externalUrl(result.url);
    await this.openExternal(safe);
    return { opened: true };
  }
  async exportReport(id, offset = 0) {
    if (
      !this.token ||
      !/^[a-f0-9-]{36}$/.test(id) ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 100000
    )
      throw new Error("Choose a subject and report page.");
    return this.fetch(`/v1/subjects/${id}/export?offset=${offset}`, {}, true);
  }
}
