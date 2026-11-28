import { _electron } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const {version} = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
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
    env: { ...process.env, ACADEMY_TEST_LEGACY_SEED: "1", ACADEMY_TEST_DATA: directory },
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
    if (name === "add" && !extra) extra = '[data-parent=""]';
    console.log("Action:", name);
    if (
      ["settings", "help"].includes(name) &&
      !(await page.locator(`[data-action="${name}"]`).first().isVisible())
    )
      await page.getByText("MORE", { exact: true }).click();
    const control=page.locator(`[data-action="${name}"]${extra}`).first();
    await control.click();
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
  assert.equal(await page.locator('[data-demo="student"]').count(), 0);
  await login("instructor");
  assert.ok((await page.locator('.sidebar-foot').textContent()).includes(version));
  assert.equal(
    await page.locator(".subject-hero h1").textContent(),
    "Introduction to Aeronautics",
  );
  await action("add");
  await page.locator("#composer input[name=title]").fill("Lesson 02 — Aircraft structure");
  await page.locator("#rich-editor").fill("A reference for our next discussion.");
  await action("attach");
  await page.locator("#composer input[name=link]").fill("ftp://www.faa.gov/");
  await page.locator("#composer button[type=submit]").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  assert.equal(
    await page.locator("#composer input[name=title]").inputValue(),
    "Lesson 02 — Aircraft structure",
  );
  assert.match(
    await page.locator("#rich-editor").textContent(),
    /A reference for our next discussion\./,
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
  assert.deepEqual(await page.locator("#entry-kind option").evaluateAll((options) => options.map((option) => option.value)), ["material", "examination"]);
  await page.selectOption("#entry-kind", "examination");
  await page.selectOption("#entry-kind", "material");
  assert.equal(await page.locator("#composer input[name=link]").count(), 7);
  await mkdir(new URL("../../out/desktop-qa/", import.meta.url), {
    recursive: true,
  });
  await page.screenshot({
    path: fileURLToPath(new URL("../../out/desktop-qa/instructor-editor.png", import.meta.url)),
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
  let newCard = page
    .locator("article.material")
    .filter({
      has: page.getByRole("heading", {
        name: "Lesson 02 — Aircraft structure",
        exact: true,
      }),
    });
  const materialId = await newCard.getAttribute("data-item");
  for (const [url, label] of materials) {
    assert.equal(await newCard.locator(`[data-url="${url}"] strong`).textContent(), label);
    await action("open-link", `[data-url="${url}"]`);
  }
  await newCard.locator("[data-action=edit]").click();
  assert.equal(await page.locator("#composer input[name=link]").count(), 7);
  assert.deepEqual(await page.locator("#composer input[name=link]").evaluateAll((inputs) => inputs.slice(1).map((input) => input.value)), materials.map(([url]) => url));
  await page.locator("#composer input[name=title]").fill("Lesson 02 — Aircraft structures");
  await page.locator("#rich-editor").fill("Updated notes for class.");
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
  newCard = page.locator(`[data-item="${materialId}"]`);
  await newCard.locator("[data-drag]").press("Alt+ArrowUp");
  await page.waitForFunction(() => !state.busy);
  await action("add");
  await page.locator("#composer input[name=title]").fill("Keep this draft");
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
  assert.equal(await page.locator("#composer input[name=title]").inputValue(), "Keep this draft");
  // Navigation asks before discarding and keeps the text when cancelled.
  await page.locator(".sidebar [data-action=tasks]").click();
  await page.locator("#confirm[open]").waitFor();
  await page.locator("#confirm-no").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  assert.equal(
    await page.locator("#composer input[name=title]").inputValue(),
    "Keep this draft",
  );
  await page.locator("[data-action=cancel-compose]").click();
  await page.locator("#confirm-yes").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  await action("add");
  await page.locator("#composer input[name=title]").fill("Saved despite refresh failure");
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
  await page.selectOption("#entry-kind", "examination");
  await page.locator("#composer input[name=title]").fill("Midterm examination");
  await page.locator("#rich-editor").fill("Explain the four forces.");
  await page.locator("#composer button[type=submit]").click();
  await page.waitForFunction(() => !state.busy);
  const examGroup = page.locator("[data-group]").filter({ has: page.getByRole("heading", {name:"Midterm examination",exact:true}) });
  assert.equal(await examGroup.locator(".tree-children").count(), 0);
  await action("add", `[data-parent="${materialId}"]`);
  assert.deepEqual(await page.locator("#entry-kind option").evaluateAll((options) => options.map((option) => option.value)), ["activity", "quiz"]);
  await page.selectOption("#entry-kind", "quiz");
  await page.locator('#quiz-count').fill('3');
  await action('quiz-count');
  assert.equal(await page.locator('[data-question-editor]').count(),3);
  const prompts=['Choose the lifting force.','Choose the force opposing motion.','Choose the downward force.'];
  const choices=[['Drag','Lift'],['Drag','Lift'],['Thrust','Weight']];
  for(let i=0;i<3;i++){
    const question=page.locator(`[data-question-editor="${i}"]`);
    await question.locator('[data-question-prompt]').fill(prompts[i]);
    for(let j=0;j<2;j++)await question.locator(`[data-question-option="${j}"]`).fill(choices[i][j]);
    await question.locator(`input[type=radio][value="${i===1?0:1}"]`).check();
  }
  const firstQuestion=page.locator('[data-question-editor="0"]');
  await firstQuestion.locator('[data-question-option="0"]').fill('Resistance');
  assert.equal(await firstQuestion.locator('input[type=radio]:checked').count(),0);
  await firstQuestion.locator('input[type=radio][value="1"]').check();
  await page.selectOption("#entry-kind", "activity");
  await page.selectOption("#entry-kind", "quiz");
  assert.equal(await page.locator('[data-question-editor]').count(),3);
  assert.equal(await firstQuestion.locator('[data-question-prompt]').inputValue(),prompts[0]);
  assert.equal(await firstQuestion.locator('input[type=radio][value="1"]').isChecked(),true);
  await page.locator('#composer input[name=title]').fill('Practice quiz');
  await page.locator('#rich-editor').fill('Three multiple-choice questions.');
  await page.locator("#composer button[type=submit]").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  await page
    .getByRole("heading", { name: "Practice quiz", exact: true })
    .waitFor();
  const quizGroup = page.locator(`[data-group="${materialId}"]`);
  assert.equal(await quizGroup.locator(".tree-children").getByRole("heading",{name:"Practice quiz",exact:true}).count(),1);
  assert.equal(await quizGroup.locator("[data-add-parent]").last().getAttribute("data-add-parent"), materialId);
  await newCard.locator("[data-drag]").press("Alt+ArrowDown");
  await page.waitForFunction(() => !state.busy);
  assert.equal(await page.locator(`[data-group="${materialId}"] .tree-children`).getByRole("heading",{name:"Practice quiz",exact:true}).count(),1);
  // Existing flat entries keep their IDs and can be explicitly assigned to a material.
  const legacyId = await page.evaluate(async () => {
    const created = await desktopApi.request(`/v1/subjects/${state.active.id}/items`, {method:"POST",body:{kind:"activity",title:"Previous standalone activity",body:"x".repeat(12000),published:false}});
    return created.id;
  });
  await action("refresh");
  await page.locator(`[data-item="${legacyId}"] [data-action=edit]`).click();
  await page.selectOption("#composer [name=parent_id]", materialId);
  await page.locator("#composer button[type=submit]").click();
  await page.waitForFunction(() => !state.busy);
  assert.equal(await page.locator(`[data-children="${materialId}"] [data-item="${legacyId}"]`).count(),1);
  const retained = await page.evaluate((id) => state.items.find((item) => item.id === id), legacyId);
  assert.equal(retained.title,"Previous standalone activity");
  assert.equal(retained.body,"x".repeat(12000));
  assert.equal(retained.revision,1);
  const childRegion = page.locator(`[data-children="${materialId}"]`);
  const minimize = page.locator(`[data-action="toggle-material"][data-id="${materialId}"]`);
  assert.equal(await page.locator('[data-action="move"]').count(),0);
  assert.equal(await page.locator('.material-tools [data-drag]').count(),0);
  assert.equal(await newCard.locator('.entry-rail [data-drag]').count(),1);
  await minimize.click();
  assert.equal(await childRegion.isVisible(),false);
  assert.equal(await minimize.getAttribute("aria-expanded"),"false");
  assert.equal(await page.locator(`[data-add-parent="${materialId}"]`).isVisible(),false);
  assert.equal(await newCard.getByRole("heading").isVisible(),true);
  await action("refresh");
  assert.equal(await childRegion.isVisible(),false);
  // Search temporarily opens matching children and restores the viewing preference.
  await page.locator("#search").fill("Previous standalone activity");
  assert.equal(await page.locator(`[data-group="${materialId}"]`).isVisible(),true);
  assert.equal(await page.locator(`[data-item="${legacyId}"]`).isVisible(),true);
  assert.equal(await minimize.getAttribute("aria-expanded"),"true");
  await page.locator("#search").fill("");
  assert.equal(await childRegion.isVisible(),false);
  // Keyboard reorder retains collapsed groups, children and focused grip.
  await newCard.locator("[data-drag]").press("Alt+ArrowDown");
  await page.waitForFunction(() => !state.busy);
  assert.equal(await childRegion.isVisible(),false);
  assert.equal(await newCard.locator("[data-drag]").evaluate((el) => document.activeElement === el),true);
  await minimize.click();
  const quizId = await childRegion.locator('[data-item]').filter({has:page.getByRole("heading",{name:"Practice quiz",exact:true})}).getAttribute("data-item");
  const quizCard = page.locator(`[data-item="${quizId}"]`);
  // Keep the 12,000-character migration fixture, but use adjacent compact cards for pointer drags.
  await action('add',`[data-parent="${materialId}"]`);
  await page.locator('#composer input[name=title]').fill('Short drag activity');
  await page.locator('#composer button[type=submit]').click();
  await page.waitForFunction(() => !state.busy);
  const dragCard = childRegion.locator('[data-item]').filter({has:page.getByRole('heading',{name:'Short drag activity',exact:true})});
  const dragChildId = await dragCard.getAttribute('data-item');
  await dragCard.locator('[data-drag]').press('Alt+ArrowUp');
  await page.waitForFunction(() => !state.busy);
  await quizCard.scrollIntoViewIfNeeded();
  // Native drag from the left grip supports both before and after insertion.
  await dragCard.locator('[data-drag]').dragTo(quizCard,{targetPosition:{x:80,y:8}});
  await page.waitForFunction(() => !state.busy);
  assert.deepEqual(await childRegion.locator('[data-item]').evaluateAll((cards) => cards.map((c) => c.dataset.item)),[dragChildId,quizId,legacyId]);
  const bounds = await quizCard.boundingBox();
  await dragCard.locator('[data-drag]').dragTo(quizCard,{targetPosition:{x:80,y:bounds.height-8}});
  await page.waitForFunction(() => !state.busy);
  assert.deepEqual(await childRegion.locator('[data-item]').evaluateAll((cards) => cards.map((c) => c.dataset.item)),[quizId,dragChildId,legacyId]);
  // Remove the synthetic drag fixture so student workflows still exercise one quiz/activity pair.
  await dragCard.locator('[data-action=delete]').click();
  await page.locator('#confirm-yes').click();
  await page.waitForFunction(() => !state.busy);
  // Collapsing another section never rebuilds or clears the active draft.
  await quizCard.locator('[data-action=edit]').click();
  await page.locator('#composer input[name=title]').fill('Retain this nested draft');
  assert.equal(await minimize.isDisabled(),true);
  // Pick by ID rather than relying on section order.
  const anotherId = await page.evaluate((id) => state.items.find((i) => i.kind==='material' && i.id!==id).id,materialId);
  await action('toggle-material',`[data-id="${anotherId}"]`);
  assert.equal(await page.locator('#composer input[name=title]').inputValue(),'Retain this nested draft');
  await page.locator('[data-action=cancel-compose]').click();
  await page.locator('#confirm-yes').click();
  await page.waitForFunction(() => !state.busy);
  assert.equal(await minimize.isDisabled(),false);
  await action('toggle-material',`[data-id="${anotherId}"]`);
  await page.evaluate(() => {state.treeSupported=false;renderSubject();});
  assert.equal(await page.locator('[data-action=add][data-parent]:not([data-parent=""])').count(),0);
  await page.evaluate(() => {state.treeSupported=true;renderSubject();});
  await action("add");
  await page.locator("#composer input[name=title]").fill("Unpublished sample");
  await page.locator("#composer [name=published]").uncheck();
  await page.locator("#composer button[type=submit]").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  await page.evaluate(() => { document.querySelector("#center").scrollTop=0; });
  await page.screenshot({path:fileURLToPath(new URL("../../out/desktop-qa/subject-tree-instructor.png",import.meta.url)),fullPage:true});
  // Verify removed student/enrolment controls are absent for instructors.
  for (const removed of ["learners", "eligibility", "results", "discover", "generate-qr", "export"]) {
    assert.equal(await page.locator(`[data-action="${removed}"]`).count(), 0, `Removed action ${removed} must not render`);
  }
  await action("tasks");
  await page.locator("#center").getByRole("heading", { name: "Drafts", exact: true }).waitFor();
  await page.locator("#center").getByText("Unpublished sample", { exact: true }).waitFor();
  await action("settings");
  await action("help");
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
  assert.deepEqual(
    await page.locator("#new-account [name=role] option").evaluateAll((options) => options.map((option) => option.value)),
    ["instructor", "admin"],
  );
  assert.equal(await page.locator("#new-account [name=student_number]").count(), 0);
  await page.locator("#new-account [name=name]").fill("Test instructor");
  await page.locator("#new-account [name=email]").fill("new@academy.test");
  await page
    .locator("#new-account [name=password]")
    .fill("A temporary test passphrase!");
  await page
    .locator("#new-account [name=confirm_password]")
    .fill("A temporary test passphrase!");
  await submit("#new-account");
  await page.getByText("new@academy.test", { exact: true }).waitFor();
  // HTML in user text is rendered as text, never executed.
  await action("subject");
  await action("add");
  await page.locator("#composer input[name=title]").fill("<img src=x onerror=alert(1)>");
  await page.locator("#rich-editor").fill("<img src=x onerror=alert(1)>");
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
    await page.waitForFunction(() => document.querySelector("#center").scrollWidth <= document.querySelector("#center").clientWidth);
  }
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1));
  await action("subjects");
  await action("new-subject");
  await page.locator("#subject-form [name=title]").fill("Aircraft Maintenance");
  await page
    .locator("#subject-form [name=description]")
    .fill("A new subject for repository authoring.");
  await page.locator("#subject-form button.primary").click();
  await page.waitForFunction(
    () => !document.body.classList.contains("working"),
  );
  await page
    .getByRole("heading", { name: "Aircraft Maintenance", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: contextual subject/material + controls, collapsed sections/search/draft preservation, left-grip native drag before/after and keyboard reordering, nested quiz creation/type switching, root examinations, material group moves; instructor material/link/edit/reorder/quiz/drafts; admin announcements/accounts/subjects; student features removed; escaped content; 1060px + 125-200% zoom layout.",
  );
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await application?.windows()[0]?.evaluate(() => { state.dirty = false; }).catch(() => {});
  await application?.close();
  await rm(directory, { recursive: true, force: true });
}
