"use strict";

/*
 * Bible Tag Explorer — Scripture Reader Descriptions
 *
 * Responsibilities:
 * - Create the reader description panel.
 * - Expand and collapse the panel.
 * - Edit, save, and cancel description edits.
 * - Synchronize descriptions with the chapter library.
 * - Remember the expanded/collapsed state.
 *
 * Requires:
 * - index.html elements: readerView, chapterTagEditor, verseList
 * - script.js: window.BibleTagExplorerCore
 */

(() => {
  const EXPANDED_KEY =
    "bibleTagExplorer.readerDescriptionExpanded.v1";

  const STYLE_ID = "readerDescriptionStyles";
  const PANEL_ID = "readerDescriptionPanel";

  let panel = null;
  let currentChapter = null;
  let editing = false;
  let expanded = true;
  let originalDescription = "";

  const $ = (id) => document.getElementById(id);

  function getCore() {
    return window.BibleTagExplorerCore || null;
  }

  function getCurrentChapter() {
    const core = getCore();

    if (!core || typeof core.getCurrentChapter !== "function") {
      return null;
    }

    return core.getCurrentChapter();
  }

  function readExpandedPreference() {
    try {
      const saved = localStorage.getItem(EXPANDED_KEY);

      if (saved === "false") return false;
      if (saved === "true") return true;
    } catch (error) {
      console.warn(
        "Could not read description panel preference:",
        error
      );
    }

    return true;
  }

  function saveExpandedPreference(value) {
    try {
      localStorage.setItem(EXPANDED_KEY, String(value));
    } catch (error) {
      console.warn(
        "Could not save description panel preference:",
        error
      );
    }
  }

  function addStyles() {
    if ($(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      #${PANEL_ID} {
        margin: 0 0 18px;
        border: 1px solid var(--border, #30303a);
        border-radius: 12px;
        overflow: hidden;
        background: var(--panel, #111116);
        color: var(--text, #ededf3);
      }

      #${PANEL_ID} .reader-description-summary {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 15px 17px;
        border: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
        font: inherit;
      }

      #${PANEL_ID} .reader-description-summary:hover {
        background: rgba(128, 128, 150, 0.08);
      }

      #${PANEL_ID} .reader-description-title {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      #${PANEL_ID} .reader-description-title strong {
        font-size: 14px;
        font-weight: 700;
      }

      #${PANEL_ID} .reader-description-hint {
        color: var(--muted, #9696a5);
        font-size: 12px;
        line-height: 1.4;
      }

      #${PANEL_ID} .reader-description-chevron {
        flex: 0 0 auto;
        font-size: 17px;
        transition: transform 0.15s ease;
      }

      #${PANEL_ID}[data-expanded="true"]
      .reader-description-chevron {
        transform: rotate(90deg);
      }

      #${PANEL_ID} .reader-description-content {
        padding: 0 17px 17px;
      }

      #${PANEL_ID} .reader-description-text {
        margin: 0;
        line-height: 1.75;
        font-size: 14px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      #${PANEL_ID} .reader-description-empty {
        color: var(--muted, #9696a5);
        font-style: italic;
      }

      #${PANEL_ID} .reader-description-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 13px;
      }

      #${PANEL_ID} .reader-description-edit {
        width: 100%;
        min-height: 120px;
        resize: vertical;
        box-sizing: border-box;
        padding: 11px 12px;
        border: 1px solid var(--border, #30303a);
        border-radius: 8px;
        background: var(--input-bg, #09090b);
        color: inherit;
        font: inherit;
        line-height: 1.6;
      }

      #${PANEL_ID} .reader-description-edit:focus {
        outline: 2px solid var(--accent, #8888ff);
        outline-offset: 2px;
      }

      #${PANEL_ID} .reader-description-status {
        min-height: 1em;
        margin: 10px 0 0;
        color: var(--muted, #9696a5);
        font-size: 12px;
      }

      #${PANEL_ID} .reader-description-status:empty {
        display: none;
      }

      #${PANEL_ID} button.reader-description-action {
        padding: 8px 12px;
        border: 1px solid var(--border, #30303a);
        border-radius: 7px;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
      }

      #${PANEL_ID} button.reader-description-action:hover {
        background: rgba(128, 128, 150, 0.12);
      }

      #${PANEL_ID} button.reader-description-save {
        border-color: var(--accent, #8888ff);
      }

      #${PANEL_ID} button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      #${PANEL_ID}[hidden],
      #${PANEL_ID} [hidden] {
        display: none !important;
      }

      @media (max-width: 600px) {
        #${PANEL_ID} .reader-description-summary {
          padding: 13px;
        }

        #${PANEL_ID} .reader-description-content {
          padding: 0 13px 13px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createButton(text, className, handler) {
    const button = document.createElement("button");

    button.type = "button";
    button.className =
      `reader-description-action ${className || ""}`.trim();

    button.textContent = text;
    button.addEventListener("click", handler);

    return button;
  }

  function createPanel() {
    if (panel && panel.isConnected) return panel;

    const reader = $("readerView");

    if (!reader) {
      console.warn(
        "Reader description panel: #readerView was not found."
      );
      return null;
    }

    addStyles();

    panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.dataset.expanded = String(expanded);

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "reader-description-summary";
    summary.setAttribute("aria-expanded", String(expanded));
    summary.setAttribute(
      "aria-controls",
      "readerDescriptionContent"
    );

    const titleGroup = document.createElement("span");
    titleGroup.className = "reader-description-title";

    const title = document.createElement("strong");
    title.textContent = "Chapter description";

    const hint = document.createElement("span");
    hint.className = "reader-description-hint";
    hint.id = "readerDescriptionHint";
    hint.textContent = "Your notes about this chapter";

    titleGroup.append(title, hint);

    const chevron = document.createElement("span");
    chevron.className = "reader-description-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "›";

    summary.append(titleGroup, chevron);

    const content = document.createElement("div");
    content.className = "reader-description-content";
    content.id = "readerDescriptionContent";
    content.hidden = !expanded;

    const descriptionText = document.createElement("p");
    descriptionText.className = "reader-description-text";
    descriptionText.id = "readerDescriptionText";

    const textarea = document.createElement("textarea");
    textarea.className = "reader-description-edit";
    textarea.id = "readerDescriptionInput";
    textarea.maxLength = 5000;
    textarea.rows = 5;
    textarea.placeholder =
      "Write your description for this chapter...";
    textarea.setAttribute(
      "aria-label",
      "Edit chapter description"
    );
    textarea.hidden = true;

    const actions = document.createElement("div");
    actions.className = "reader-description-actions";
    actions.id = "readerDescriptionActions";

    const status = document.createElement("p");
    status.className = "reader-description-status";
    status.id = "readerDescriptionStatus";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    const editButton = createButton(
      "Edit description",
      "reader-description-edit-button",
      startEditing
    );

    const saveButton = createButton(
      "Save",
      "reader-description-save",
      saveEditing
    );

    const cancelButton = createButton(
      "Cancel",
      "reader-description-cancel",
      cancelEditing
    );

    actions.append(editButton);
    content.append(descriptionText, textarea, actions, status);
    panel.append(summary, content);

    summary.addEventListener("click", () => {
      if (editing) return;

      setExpanded(!expanded);
    });

    panel._readerDescriptionElements = {
      summary,
      hint,
      content,
      descriptionText,
      textarea,
      actions,
      status,
      editButton,
      saveButton,
      cancelButton
    };

    /*
     * Place the description directly before the chapter tag editor.
     * This keeps it inside the reader, above the chapter tags.
     */
    const tagEditor = $("tagEditorDetails");

    if (tagEditor && tagEditor.parentElement === reader) {
      reader.insertBefore(panel, tagEditor);
    } else {
      const verseSection = $("verseList");

      if (
        verseSection &&
        verseSection.closest("#readerView")
      ) {
        const section = verseSection.closest(".scripture-section");

        if (section && section.parentElement === reader) {
          reader.insertBefore(panel, section);
        } else {
          reader.appendChild(panel);
        }
      } else {
        reader.appendChild(panel);
      }
    }

    renderDescription();
    return panel;
  }

  function setExpanded(value) {
    expanded = Boolean(value);

    if (!panel) return;

    const elements = panel._readerDescriptionElements;

    panel.dataset.expanded = String(expanded);
    elements.summary.setAttribute(
      "aria-expanded",
      String(expanded)
    );
    elements.content.hidden = !expanded;

    saveExpandedPreference(expanded);
  }

  function getDescription(chapter) {
    if (!chapter) return "";

    return typeof chapter.description === "string"
      ? chapter.description
      : "";
  }

  function renderDescription() {
    if (!panel) return;

    const elements = panel._readerDescriptionElements;
    const chapter = getCurrentChapter();

    currentChapter = chapter;

    if (!chapter) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;

    const description = getDescription(chapter);

    elements.descriptionText.textContent =
      description || "No description has been added yet.";

    elements.descriptionText.classList.toggle(
      "reader-description-empty",
      !description
    );

    elements.hint.textContent =
      `${chapter.book} ${chapter.chapter}`;

    if (!editing) {
      elements.textarea.value = description;
      elements.textarea.hidden = true;
      elements.descriptionText.hidden = false;

      elements.actions.replaceChildren(elements.editButton);
      elements.status.textContent = "";
    }

    setExpanded(expanded);
  }

  function startEditing() {
    const chapter = getCurrentChapter();

    if (!chapter || !panel) return;

    currentChapter = chapter;
    originalDescription = getDescription(chapter);
    editing = true;

    const elements = panel._readerDescriptionElements;

    elements.textarea.value = originalDescription;
    elements.descriptionText.hidden = true;
    elements.textarea.hidden = false;
    elements.status.textContent = "";

    elements.actions.replaceChildren(
      elements.saveButton,
      elements.cancelButton
    );

    setExpanded(true);
    elements.textarea.focus();
  }

  function saveEditing() {
    if (!panel || !editing) return;

    const chapter = getCurrentChapter();

    if (!chapter) {
      editing = false;
      renderDescription();
      return;
    }

    const elements = panel._readerDescriptionElements;
    const description = elements.textarea.value.trim();
    const core = getCore();

    if (
      !core ||
      typeof core.saveChapterDescription !== "function"
    ) {
      elements.status.textContent =
        "Unable to save: the main script connection is unavailable.";
      return;
    }

    const saved = core.saveChapterDescription(
      chapter,
      description
    );

    if (!saved) {
      elements.status.textContent =
        "The description could not be saved. Please try again.";
      return;
    }

    editing = false;
    currentChapter = getCurrentChapter();
    originalDescription = description;

    renderDescription();

    elements.status.textContent = "Description saved.";
  }

  function cancelEditing() {
    if (!panel) return;

    editing = false;

    const elements = panel._readerDescriptionElements;

    elements.textarea.value = originalDescription;
    elements.textarea.hidden = true;
    elements.descriptionText.hidden = false;

    renderDescription();
  }

  function handleChapterOpened(event) {
    const chapter = event.detail
      ? event.detail.chapter
      : getCurrentChapter();

    if (!chapter) {
      currentChapter = null;
      editing = false;

      if (panel) panel.hidden = true;
      return;
    }

    /*
     * A chapter change discards the unfinished editor state.
     * Saved descriptions remain unchanged.
     */
    if (
      currentChapter &&
      (
        currentChapter.book !== chapter.book ||
        String(currentChapter.chapter) !== String(chapter.chapter)
      )
    ) {
      editing = false;
    }

    currentChapter = chapter;

    createPanel();
    renderDescription();
  }

  function handleDescriptionsUpdated() {
    if (!panel) return;

    const chapter = getCurrentChapter();

    if (!chapter) {
      panel.hidden = true;
      return;
    }

    currentChapter = chapter;

    if (!editing) {
      renderDescription();
    }
  }

  function initialize() {
    expanded = readExpandedPreference();

    createPanel();

    window.addEventListener(
      "bte:chapter-opened",
      handleChapterOpened
    );

    window.addEventListener(
      "bte:descriptions-updated",
      handleDescriptionsUpdated
    );

    window.addEventListener(
      "bte:descriptions-updated",
      renderDescription
    );

    const chapter = getCurrentChapter();

    if (chapter) {
      currentChapter = chapter;
      renderDescription();
    } else if (panel) {
      panel.hidden = true;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, {
      once: true
    });
  } else {
    initialize();
  }
})();
