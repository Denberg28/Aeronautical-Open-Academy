import { _electron } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const directory = await mkdtemp(join(tmpdir(), "academy-ui-"));
let application;
try {
  application = await _electron.launch({
    args: [
      resolve(import.meta.dirname, ".."),
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
    env: { ...process.env, ACADEMY_TEST_DATA: directory },
    timeout: 30000,
  });
  console.log("Electron launched");
  const page = await application.firstWindow();
  // Electron's will-prevent-unload handler owns the native close confirmation.
  // Do not let Playwright auto-dismiss the same beforeunload event.
  page.on("dialog", (dialog) => { void dialog.dismiss().catch(() => {}); });
  page.setDefaultTimeout(15000);
  console.log("Window ready");
  await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1480, 960),
  );
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const action = async (name, extra = "") => {
    console.log("Action:", name);
    if (
      ["settings", "help"].includes(name) &&
      !(await page.locator(`[data-action="${name}"]`).first().isVisible())
    )
      await page.getByText("MORE", { exact: true }).click();
    await page.locator(`[data-action="${name}"]${extra}`).first().click();
    await page.waitForFunction(
      () => !document.body.classList.contains("working"),
    );
  };
  const login = async (role) => {
    console.log("Login:", role);
    await page.locator(`[data-demo="${role}"]`).click();
    await page.locator("#login-form button[type=submit]").click();
    await page.waitForSelector("#app:not([hidden]) .center");
    await page.waitForFunction(
      () => !document.body.classList.contains("working"),
    );
  };
  const submit = async (selector) => {
    await page
      .locator(
        selector + " button[type=submit], " + selector + " button:not([type])",
      )
      .last()
      .click();
    await page.waitForFunction(
      () => !document.body.classList.contains("working"),
    );
  };
  await login("instructor");
  assert.equal(
    await page.locator(".subject-hero h1").textContent(),
    "Introduction to Aeronautics",
  );
  await action("add");
  await page
    .locator("#composer textarea[name=text]")
    .fill(
      "Lesson 02 — Aircraft structure\nA reference for our next discussion.",
    );
  await action("attach");
  await page.locator("#composer input[name=link]").fill("ftp://www.faa.gov/");
  await page.locator("#composer button[type=submit]").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  assert.equal(
    await page.locator("#composer textarea").inputValue(),
    "Lesson 02 — Aircraft structure\nA reference for our next discussion.",
  );
  await page.locator("#composer input[name=link]").fill("https://www.faa.gov/");
  const materials = [
    ["https://drive.google.com/file/d/synthetic/view?usp=sharing&resourcekey=0-demo", "Google Drive"],
    ["https://docs.google.com/document/d/synthetic/edit?usp=sharing", "Google Docs"],
    ["https://docs.google.com/spreadsheets/d/synthetic/edit#gid=14", "Google Sheets"],
    ["https://docs.google.com/presentation/d/synthetic/edit#slide=id.demo", "Google Slides"],
    ["https://youtu.be/synthetic?t=30", "YouTube"],
    ["https://images.nasa.gov/synthetic.jpg?download=1", "Image"],
  ];
  for (const [url] of materials) {
    await action("attach");
    await page.locator("#composer input[name=link]").last().fill(url);
  }
  await page.selectOption("#entry-kind", "quiz");
  await page.locator("#composer [name=options]").fill("Lift\nDrag");
  await page.selectOption("#entry-kind", "material");
  assert.equal(await page.locator("#composer input[name=link]").count(), 7);
  await page.selectOption("#entry-kind", "quiz");
  assert.equal(await page.locator("#composer [name=options]").inputValue(), "Lift\nDrag");
  await page.selectOption("#entry-kind", "material");
  await mkdir(new URL("../../out/desktop-qa/", import.meta.url), {
    recursive: true,
  });
  await page.screenshot({
    path: new URL("../../out/desktop-qa/instructor-editor.png", import.meta.url)
      .pathname,
    fullPage: true,
  });
  await page.locator("#composer button[type=submit]").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  await page
    .getByRole("heading", {
      name: "Lesson 02 — Aircraft structure",
      exact: true,
    })
    .waitFor();
  await action("open-link", '[data-url="https://www.faa.gov/"]');
  const newCard = page
    .locator("article.material")
    .filter({
      has: page.getByRole("heading", {
        name: "Lesson 02 — Aircraft structure",
        exact: true,
      }),
    });
  for (const [url, label] of materials) {
    assert.equal(await newCard.locator(`[data-url="${url}"] strong`).textContent(), label);
    await action("open-link", `[data-url="${url}"]`);
  }
  await newCard.locator("[data-action=edit]").click();
  assert.equal(await page.locator("#composer input[name=link]").count(), 7);
  assert.deepEqual(await page.locator("#composer input[name=link]").evaluateAll((inputs) => inputs.slice(1).map((input) => input.value)), materials.map(([url]) => url));
  await page
    .locator("#composer textarea")
    .fill("Lesson 02 — Aircraft structures\nUpdated notes for class.");
  await page.locator("#composer button[type=submit]").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  await page
    .getByRole("heading", {
      name: "Lesson 02 — Aircraft structures",
      exact: true,
    })
    .waitFor();
  await action("move", '[data-direction="-1"]:not([disabled])');
  await action("add");
  await page.locator("#composer textarea").fill("Keep this draft");
  console.log("Cancel quit check");
  // A simulated cancelled close must leave the local service alive.
  await application.evaluate(({ app, BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    const close = window.close;
    window.close = () => {};
    app.quit();
    window.close = close;
  });
  assert.ok((await page.evaluate(() => desktopApi.request("/v1/subjects"))).subjects.length);
  console.log("Cancelled quit retained API");
  // Expire the session while an instructor is editing. Reauthentication to the
  // same account restores the live form without bypassing backend edit versions.
  console.log("Expire underlying session");
  await page.evaluate(() => desktopApi.logout());
  console.log("Session cleared; attempt save");
  await page.locator("#composer button[type=submit]").click();
  await page.locator("#signin[open]").waitFor();
  await page.waitForFunction(() => !document.body.classList.contains("working"));
  await login("instructor");
  assert.equal(await page.locator("#composer textarea").inputValue(), "Keep this draft");
  // Navigation asks before discarding and keeps the text when cancelled.
  await page.locator(".sidebar [data-action=tasks]").click();
  await page.locator("#confirm[open]").waitFor();
  await page.locator("#confirm-no").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  assert.equal(
    await page.locator("#composer textarea").inputValue(),
    "Keep this draft",
  );
  await page.locator("[data-action=cancel-compose]").click();
  await page.locator("#confirm-yes").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  await action("add");
  await page.locator("#composer textarea").fill("Saved despite refresh failure");
  await page.evaluate(() => {
    window.academyOriginalReload = reloadActive;
    reloadActive = async () => { throw new Error("Synthetic refresh outage"); };
  });
  await page.locator("#composer button[type=submit]").click();
  await page.waitForFunction(() => !document.body.classList.contains("working"));
  assert.equal(await page.locator("#composer").count(), 0);
  assert.ok((await page.locator("#toast").textContent()).startsWith("Entry saved."));
  await page.evaluate(() => { reloadActive = window.academyOriginalReload; });
  await action("refresh");
  assert.equal(await page.getByRole("heading", { name: "Saved despite refresh failure", exact: true }).count(), 1);
  await action("add");
  await page.selectOption("#entry-kind", "quiz");
  await page
    .locator("#composer textarea[name=text]")
    .fill("Practice quiz\nChoose the lifting force.");
  await page.locator("#composer textarea[name=options]").fill("Lift\nDrag");
  await page.locator("#composer button[type=submit]").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  await page
    .getByRole("heading", { name: "Practice quiz", exact: true })
    .waitFor();
  await action("add");
  await page.locator("#composer textarea").fill("Unpublished sample");
  await page.locator("#composer [name=published]").uncheck();
  await page.locator("#composer button[type=submit]").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  await action("eligibility");
  await page.locator("#eligibility").waitFor();
  await action("learners");
  await page
    .getByRole("heading", { name: "Students & progress", exact: true })
    .waitFor();
  await action("export");
  await action("logout");
  await login("student");
  assert.equal(
    await page
      .getByRole("heading", { name: "Unpublished sample", exact: true })
      .count(),
    0,
  );
  assert.equal(await page.locator("[data-action=add]").count(), 0);
  await action("complete");
  const written = page.locator("form[data-form=submission]");
  await written
    .locator("textarea")
    .fill("Lift balances weight. Thrust balances drag.");
  await written.locator("button[type=submit]").click();
  await page.locator("#confirm-yes").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  assert.equal(await page.locator("form[data-form=submission]").count(), 0);
  const quiz = page.locator("form[data-form=quiz]");
  await quiz.locator('input[value="0"]').check();
  await quiz.locator("button[type=submit]").click();
  await page.locator("#confirm-yes").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  await page.getByText("Submitted · score 1 / 1").waitFor();
  await page.screenshot({
    path: new URL("../../out/desktop-qa/student-viewer.png", import.meta.url)
      .pathname,
    fullPage: true,
  });
  await action("results");
  assert.ok(
    (await page.locator("#center").textContent()).includes("Quiz score: 1 / 1"),
  );
  await action("tasks");
  await action("discover");
  await action("settings");
  await action("help");
  await action("logout");
  await login("instructor");
  await action("learners");
  await action("learner");
  await page.locator("[data-form=grade] [name=score]").fill("95");
  await page
    .locator("[data-form=grade] [name=feedback]")
    .fill("Clear explanation.");
  await page.locator("[data-form=grade] button").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  assert.equal(
    await page.locator("[data-form=grade] [name=score]").inputValue(),
    "95",
  );
  await action("logout");
  await login("admin");
  await action("announcements");
  await page.locator("#announcement [name=title]").fill("Next class");
  await page.locator("#announcement [name=body]").fill("Bring your notes.");
  await submit("#announcement");
  await page
    .locator("#rightbar")
    .getByRole("heading", { name: "Next class", exact: true })
    .waitFor();
  await action("accounts");
  await action("new-account");
  await page.locator("#new-account [name=name]").fill("Test learner");
  await page.locator("#new-account [name=email]").fill("new@academy.test");
  await page.locator("#new-account [name=student_number]").fill("TEST-002");
  await page
    .locator("#new-account [name=password]")
    .fill("A temporary test passphrase!");
  await submit("#new-account");
  await page.getByText("new@academy.test", { exact: true }).waitFor();
  // HTML in user text is rendered as text, never executed.
  await action("subject");
  await action("add");
  await page.locator("#composer textarea").fill("<img src=x onerror=alert(1)>");
  await page.locator("#composer button[type=submit]").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  assert.equal(await page.locator("#entries img").count(), 0);
  await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1060, 720),
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  for (const zoom of [1.25, 1.5, 2]) {
    await application.evaluate(({ BrowserWindow }, factor) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(factor), zoom);
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
  }
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1));
  await action("subjects");
  await action("new-subject");
  await page.locator("#subject-form [name=title]").fill("Aircraft Maintenance");
  await page
    .locator("#subject-form [name=description]")
    .fill("A new subject for enrollment testing.");
  await page.locator("#subject-form button.primary").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  await page
    .getByRole("heading", { name: "Aircraft Maintenance", exact: true })
    .waitFor();
  await action("eligibility");
  await page.locator("#eligibility [name=all]").check();
  await page.locator("#eligibility button.primary").click();
  await page.locator("#confirm-yes").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  await action("logout");
  await login("student");
  await action("discover");
  await action("enrol");
  await page
    .getByRole("heading", { name: "Aircraft Maintenance", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: instructor material/link/edit/reorder/quiz/draft; student reading/submissions/quiz/results; grading/export; admin announcements/accounts; escaped content; 1060px layout.",
  );
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await application?.windows()[0]?.evaluate(() => { state.dirty = false; }).catch(() => {});
  await application?.close();
  await rm(directory, { recursive: true, force: true });
}
