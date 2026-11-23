"use strict";
// Instructor-guided fullscreen presentation mode for quizzes, activities, and examinations.
// Displays one question per fullscreen flash slide with lettered options only (no selection or key),
// then prompts for explicit confirmation at the end of the item before revealing the answer key.
window.academyPresenter = (() => {
  const LETTERS = ["A", "B", "C", "D", "E", "F"];
  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
          c
        ],
    );
  const paragraphs = (text) =>
    String(text ?? "")
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
      .join("");

  let current = null;
  let wired = false;

  const dialogEl = () => document.getElementById("presenter-dialog");

  function normalizeItem(item, subjectTitle) {
    const kind =
      item.assessment_type === "examination"
        ? "Examination"
        : item.kind === "quiz"
          ? "Quiz"
          : "Activity";
    let questions = [];
    if (Array.isArray(item.questions) && item.questions.length) {
      questions = item.questions.map((q) => ({
        prompt: String(q.prompt ?? ""),
        options: Array.isArray(q.options) ? q.options.map((o) => String(o ?? "")) : [],
        ...(Number.isInteger(q.correct_index) ? { correct_index: q.correct_index } : {}),
      }));
    } else if (item.kind === "quiz" && Array.isArray(item.options) && item.options.length) {
      questions = [
        {
          prompt: String(item.body ?? ""),
          options: item.options.map((o) => String(o ?? "")),
          ...(Number.isInteger(item.correct_index) ? { correct_index: item.correct_index } : {}),
        },
      ];
    }
    const hasAnswerKey =
      questions.length > 0 &&
      questions.every(
        (q) =>
          Number.isInteger(q.correct_index) &&
          q.correct_index >= 0 &&
          q.correct_index < q.options.length,
      );
    return {
      id: item.id,
      kind,
      title: String(item.title ?? ""),
      body: String(item.body ?? ""),
      subjectTitle: String(subjectTitle ?? ""),
      questions,
      hasAnswerKey,
      index: 0,
      view: questions.length ? "slide" : "written",
      confirmOpen: false,
    };
  }

  function render() {
    const dialog = dialogEl();
    if (!dialog || !current) return;
    const total = current.questions.length;
    const isLast = total > 0 && current.index === total - 1;
    const statusText =
      current.view === "written"
        ? "Instructor-guided prompt"
        : current.view === "key"
          ? `Answer key · ${total} ${total === 1 ? "question" : "questions"}`
          : `Question ${current.index + 1} of ${total}`;

    let stageMarkup = "";
    let navMarkup = "";

    if (current.view === "written") {
      stageMarkup = `<div class="presenter-card presenter-written"><div class="presenter-eyebrow">${escapeHtml(current.kind.toUpperCase())} · INSTRUCTOR-GUIDED</div><h2>${escapeHtml(current.title)}</h2><div class="presenter-body">${paragraphs(current.body)}</div></div>`;
      navMarkup = `<span class="presenter-counter">Written prompt · no multiple-choice answer key</span><button type="button" class="primary" data-presenter="close">Exit presentation</button>`;
    } else if (current.view === "slide") {
      const q = current.questions[current.index];
      const num = String(current.index + 1).padStart(2, "0");
      const tot = String(total).padStart(2, "0");
      // Strictly render lettered options only — never expose selection controls or correct answers during play.
      stageMarkup = `<div class="presenter-card" data-presenter-slide="${current.index + 1}"><div class="presenter-eyebrow">QUESTION ${num} OF ${tot}</div><h2 class="presenter-prompt">${escapeHtml(q.prompt)}</h2><ol class="presenter-options">${q.options
        .map(
          (option, idx) =>
            `<li class="presenter-option"><span class="presenter-letter">${escapeHtml(LETTERS[idx] || String(idx + 1))}</span><span class="presenter-option-text">${escapeHtml(option)}</span></li>`,
        )
        .join("")}</ol></div>`;
      navMarkup = `<button type="button" class="presenter-arrow" data-presenter="prev" ${current.index === 0 ? "disabled" : ""} aria-label="Previous question"><span aria-hidden="true">←</span> Previous</button><span class="presenter-counter">${current.index + 1} / ${total}</span><button type="button" class="primary presenter-arrow" data-presenter="next" aria-label="${isLast ? "Finish and check answers" : "Next question"}">${isLast ? "Finish" : "Next"} <span aria-hidden="true">→</span></button>`;
    } else {
      stageMarkup = `<div class="presenter-card presenter-key-card" data-presenter-key="true"><div class="presenter-eyebrow">ANSWER KEY · CLASS CHECK</div><h2>${escapeHtml(current.title)}</h2><ol class="presenter-key-list">${current.questions
        .map((q, i) => {
          const letter = LETTERS[q.correct_index] || String(q.correct_index + 1);
          const answerText = q.options[q.correct_index] ?? "";
          return `<li class="presenter-key-row"><span class="presenter-key-num">${String(i + 1).padStart(2, "0")}</span><div class="presenter-key-detail"><div class="presenter-key-prompt">${escapeHtml(q.prompt)}</div><div class="presenter-key-answer"><span class="presenter-letter answer">${escapeHtml(letter)}</span><span>${escapeHtml(answerText)}</span></div></div></li>`;
        })
        .join("")}</ol></div>`;
      navMarkup = `<button type="button" class="presenter-arrow" data-presenter="review-slides"><span aria-hidden="true">←</span> Back to questions</button><span class="presenter-counter">Answer key revealed</span><button type="button" class="primary" data-presenter="close">Exit presentation</button>`;
    }

    const confirmMarkup = current.confirmOpen
      ? `<div id="presenter-confirm" class="presenter-confirm" role="alertdialog" aria-modal="true" aria-labelledby="presenter-confirm-title"><div class="presenter-confirm-box"><h3 id="presenter-confirm-title">${
          current.hasAnswerKey ? "Show answer key?" : "End of assessment"
        }</h3><p>${
          current.hasAnswerKey
            ? "You have reached the end of this item. Reveal the answer key now so the class can check their answers?"
            : "You have reached the last question. Answer keys are restricted to the authoring editor or administrator."
        }</p><div class="presenter-confirm-actions"><button type="button" data-presenter="confirm-no">${
          current.hasAnswerKey ? "Cancel" : "Stay on question"
        }</button>${
          current.hasAnswerKey
            ? '<button type="button" class="primary" data-presenter="confirm-yes">Show answer key</button>'
            : '<button type="button" class="primary" data-presenter="close">Exit presentation</button>'
        }</div></div></div>`
      : "";

    dialog.innerHTML = `<div class="presenter-shell"><header class="presenter-header"><div class="presenter-meta"><span class="tag blue">${escapeHtml(current.kind)}</span><div><div class="presenter-title">${escapeHtml(current.title)}</div>${current.subjectTitle ? `<div class="presenter-subject">${escapeHtml(current.subjectTitle)}</div>` : ""}</div></div><div class="presenter-status" role="status" aria-live="polite">${escapeHtml(statusText)}</div><div class="presenter-controls"><button type="button" class="quiet" data-presenter="fullscreen" aria-label="Toggle full screen">${document.fullscreenElement === dialog ? "Exit full screen" : "Full screen"}</button><button type="button" class="quiet" data-presenter="close" aria-label="Exit presentation">Exit</button></div></header><main class="presenter-stage">${stageMarkup}</main><footer class="presenter-footer">${navMarkup}</footer>${confirmMarkup}</div>`;

    if (current.confirmOpen) {
      dialog.querySelector('[data-presenter="confirm-yes"], [data-presenter="confirm-no"]')?.focus();
    }
  }

  function advance() {
    if (!current || current.view !== "slide" || current.confirmOpen) return;
    if (current.index < current.questions.length - 1) {
      current.index++;
      render();
    } else {
      current.confirmOpen = true;
      render();
    }
  }

  function back() {
    if (!current || current.view !== "slide" || current.confirmOpen) return;
    if (current.index > 0) {
      current.index--;
      render();
    }
  }

  function close() {
    current = null;
    const dialog = dialogEl();
    if (!dialog) return;
    if (document.fullscreenElement === dialog) {
      document.exitFullscreen().catch(() => {});
    }
    dialog.innerHTML = "";
    if (dialog.open) dialog.close();
  }

  function wire() {
    if (wired) return;
    wired = true;
    const dialog = dialogEl();
    if (!dialog) return;
    dialog.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-presenter]");
      if (!btn || !current) return;
      const action = btn.dataset.presenter;
      if (action === "close") return close();
      if (action === "prev") return back();
      if (action === "next") return advance();
      if (action === "confirm-no") {
        current.confirmOpen = false;
        render();
        return;
      }
      if (action === "confirm-yes") {
        if (!current.hasAnswerKey) return;
        current.confirmOpen = false;
        current.view = "key";
        render();
        return;
      }
      if (action === "review-slides") {
        current.view = "slide";
        current.index = 0;
        current.confirmOpen = false;
        render();
        return;
      }
      if (action === "fullscreen") {
        if (document.fullscreenElement === dialog) {
          document.exitFullscreen().catch(() => {});
        } else if (typeof dialog.requestFullscreen === "function") {
          dialog.requestFullscreen().catch(() => {});
        }
      }
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      if (current?.confirmOpen) {
        current.confirmOpen = false;
        render();
      } else {
        close();
      }
    });
    dialog.addEventListener("keydown", (event) => {
      if (!current) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        advance();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        back();
      }
    });
    document.addEventListener("fullscreenchange", () => {
      if (current && dialog.open) render();
    });
  }

  function open(item, subjectTitle = "") {
    wire();
    const dialog = dialogEl();
    if (!dialog || !item) return;
    current = normalizeItem(item, subjectTitle);
    render();
    if (!dialog.open) dialog.showModal();
    if (typeof dialog.requestFullscreen === "function") {
      dialog.requestFullscreen().catch(() => {});
    }
    dialog.querySelector('[data-presenter="next"], [data-presenter="close"]')?.focus();
  }

  return { open, close };
})();
