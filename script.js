"use strict";

const API_BASE = "https://api.midvash.com/v1";
const BIBLE_VERSION = "kjv";
const STORAGE_KEY = "bibleTagExplorer.userData.v1";
const THEME_KEY = "bibleTagExplorer.theme.v1";

const $ = (id) => document.getElementById(id);

const tagList = $("tagList");
const chapterList = $("chapterList");
const tagSearch = $("tagSearch");
const chapterSearch = $("chapterSearch");

const resultTitle = $("resultTitle");
const resultCount = $("resultCount");
const statusMessage = $("statusMessage");

const chapterView = $("chapterView");
const readerView = $("readerView");
const readerTitle = $("readerTitle");
const readerSubtitle = $("readerSubtitle");

const verseList = $("verseList");
const backButton = $("backButton");
const verseDetail = $("verseDetail");

const selectedVerseReference = $("selectedVerseReference");
const selectedVerseText = $("selectedVerseText");
const closeVerseButton = $("closeVerseButton");
const copyrightNotice = $("copyrightNotice");

const chapterTagEditor = $("chapterTagEditor");
const newTagForm = $("newTagForm");
const newTagInput = $("newTagInput");
const clearFiltersButton = $("clearFiltersButton");

const settingsDialog = $("settingsDialog");
const settingsStatus = $("settingsStatus");
const themeSelect = $("themeSelect");

let chapters = [];
let customTags = [];
let selectedTag = null;
let currentChapter = null;
let selectedVerseButton = null;
let chapterRequestNumber = 0;
let lastSettingsFocus = null;
let tagLogicFilter = null;

/* =======================================================
   ADVANCED FILTER FIELD
======================================================= */

function setupAdvancedFilter() {
  if (!chapterSearch || $("tagLogicFilter")) {
    tagLogicFilter = $("tagLogicFilter");
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "advanced-filter-controls";

  const filter = document.createElement("input");
  filter.id = "tagLogicFilter";
  filter.type = "search";
  filter.placeholder = "Tag logic: (Creation; Man), God's Wall";
  filter.setAttribute("aria-label", "Advanced tag logic filter");
  filter.autocomplete = "off";
  filter.spellcheck = false;

  const help = document.createElement("p");
  help.className = "advanced-filter-help";
  help.textContent =
    "; = AND · , = OR · ( ) = group · / = exact tag set";

  const parent = chapterSearch.parentElement;

  parent.insertBefore(wrapper, chapterSearch);
  wrapper.append(chapterSearch, filter, help);

  const style = document.createElement("style");
  style.id = "advancedFilterStyles";
  style.textContent = `
    .advanced-filter-controls {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
      min-width: 0;
    }

    .advanced-filter-controls input {
      width: 100%;
      max-width: none;
      min-width: 0;
    }

    .advanced-filter-help {
      margin: 0;
      color: var(--muted, #9696a5);
      font-size: 11px;
      line-height: 1.5;
    }

    @media (max-width: 600px) {
      .advanced-filter-controls {
        width: 100%;
      }
    }
  `;

  document.head.appendChild(style);
  tagLogicFilter = filter;
}

/* =======================================================
   STATUS AND SAVED DATA
======================================================= */

function setStatus(message) {
  if (statusMessage) statusMessage.textContent = message;
}

function setSettingsStatus(message) {
  if (settingsStatus) settingsStatus.textContent = message;
}

function showChapterMessage(message) {
  if (!chapterList) return;

  chapterList.replaceChildren();

  const p = document.createElement("p");
  p.className = "muted-message";
  p.textContent = message;

  chapterList.appendChild(p);
}

function getSavedData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);

    if (!data || !Array.isArray(data.chapters)) {
      return null;
    }

    return {
      chapters: data.chapters,
      customTags: Array.isArray(data.customTags)
        ? data.customTags.filter(
            (tag) => typeof tag === "string" && tag.trim()
          )
        : []
    };
  } catch (error) {
    console.error("Could not read saved Bible data:", error);
    return null;
  }
}

function normalizeChapters(data) {
  if (!Array.isArray(data)) {
    throw new Error("Chapter data must be a JSON array of chapter records.");
  }

  return data
    .filter(
      (chapter) =>
        chapter &&
        typeof chapter.book === "string" &&
        chapter.book.trim() &&
        chapter.chapter !== undefined &&
        chapter.chapter !== null
    )
    .map((chapter) => ({
      ...chapter,
      tags: Array.isArray(chapter.tags)
        ? [
            ...new Set(
              chapter.tags
                .filter((tag) => typeof tag === "string" && tag.trim())
                .map((tag) => tag.trim())
            )
          ]
        : [],
      description:
        typeof chapter.description === "string"
          ? chapter.description
          : ""
    }));
}

function saveLocalData(announce = true) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ chapters, customTags })
    );

    if (announce) {
      setStatus("Changes saved on this device.");
    }

    return true;
  } catch (error) {
    console.error("Could not save Bible data:", error);

    setStatus(
      "Could not save locally. Export JSON to preserve your changes."
    );

    setSettingsStatus(
      "Could not save locally. Your browser storage may be full or disabled."
    );

    return false;
  }
}

async function loadBible() {
  if (resultCount) resultCount.textContent = "Loading...";

  showChapterMessage("Loading your Bible chapter index...");

  const saved = getSavedData();

  try {
    const response = await fetch("./bible.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Could not load bible.json (HTTP ${response.status}).`
      );
    }

    const originalData = await response.json();

    if (!Array.isArray(originalData)) {
      throw new Error("bible.json must contain an array of chapter records.");
    }

    chapters = normalizeChapters(
      saved ? saved.chapters : originalData
    );

    customTags = saved ? saved.customTags : [];

    if (!chapters.length) {
      throw new Error("No valid chapter records were found.");
    }

    renderTags();
    renderChapters();

    setStatus(
      saved
        ? "Loaded your saved chapter edits from this device."
        : ""
    );
  } catch (error) {
    console.error("Bible index loading error:", error);

    if (saved) {
      try {
        chapters = normalizeChapters(saved.chapters);
        customTags = saved.customTags;

        if (!chapters.length) {
          throw new Error("No saved chapter records were found.");
        }

        renderTags();
        renderChapters();

        setStatus(
          "Using saved local data because bible.json could not load."
        );

        return;
      } catch (savedError) {
        console.error("Saved Bible data is invalid:", savedError);
      }
    }

    chapters = [];
    customTags = [];

    renderTags();

    if (resultTitle) resultTitle.textContent = "Unable to load Bible";
    if (resultCount) resultCount.textContent = "Loading failed";

    showChapterMessage(
      `${error.message} Check that bible.json exists in the repository root and contains valid JSON.`
    );
  }
}

/* =======================================================
   TAG LIST
======================================================= */

function getAllTags() {
  const tags = new Set(customTags);

  chapters.forEach((chapter) => {
    (chapter.tags || []).forEach((tag) => tags.add(tag));
  });

  return [...tags].sort((a, b) => a.localeCompare(b));
}

function findExistingTag(name) {
  const normalized = name.trim().toLocaleLowerCase();

  return getAllTags().find(
    (tag) => tag.toLocaleLowerCase() === normalized
  );
}

function renderTags() {
  if (!tagList) return;

  const search = tagSearch
    ? tagSearch.value.trim().toLocaleLowerCase()
    : "";

  tagList.replaceChildren();

  const all = document.createElement("button");
  all.type = "button";
  all.className =
    "tag-button" + (selectedTag === null ? " active" : "");
  all.textContent = "All Chapters";

  all.addEventListener("click", () => {
    selectedTag = null;
    renderTags();
    renderChapters();
  });

  tagList.appendChild(all);

  const matching = getAllTags().filter((tag) =>
    tag.toLocaleLowerCase().includes(search)
  );

  matching.forEach((tag) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className =
      "tag-button" + (selectedTag === tag ? " active" : "");

    button.append(document.createTextNode(tag));

    const count = document.createElement("span");
    count.className = "tag-number";
    count.textContent = String(
      chapters.filter((chapter) => chapter.tags.includes(tag)).length
    );

    button.appendChild(count);

    button.addEventListener("click", () => {
      selectedTag = selectedTag === tag ? null : tag;
      renderTags();
      renderChapters();
    });

    tagList.appendChild(button);
  });

  if (!matching.length && search) {
    const p = document.createElement("p");
    p.className = "muted-message";
    p.textContent = "No tags match your search.";

    tagList.appendChild(p);
  }
}

/* =======================================================
   ADVANCED TAG FILTER PARSER

   ; = AND
   , = OR
   ( ) = grouping
   / = exact tag set for an AND group
======================================================= */

function parseTagLogicFilter(input) {
  const text = input.trim();
  if (!text) return null;

  let position = 0;

  function skipSpaces() {
    while (
      position < text.length &&
      /\s/.test(text[position])
    ) {
      position++;
    }
  }

  function parseExpression() {
    return parseOr();
  }

  function parseOr() {
    const terms = [parseAnd()];
    skipSpaces();

    while (text[position] === ",") {
      position++;
      skipSpaces();

      if (
        position >= text.length ||
        text[position] === ")" ||
        text[position] === "," ||
        text[position] === ";"
      ) {
        throw new Error("A condition is missing after a comma.");
      }

      terms.push(parseAnd());
      skipSpaces();
    }

    return terms.length === 1
      ? terms[0]
      : { type: "or", terms };
  }

  function parseAnd() {
    skipSpaces();

    let exact = false;

    if (text[position] === "/") {
      exact = true;
      position++;
      skipSpaces();
    }

    const terms = [parsePrimary()];
    skipSpaces();

    while (text[position] === ";") {
      position++;
      skipSpaces();

      if (
        position >= text.length ||
        text[position] === ")" ||
        text[position] === "," ||
        text[position] === ";"
      ) {
        throw new Error("A condition is missing after a semicolon.");
      }

      terms.push(parsePrimary());
      skipSpaces();
    }

    const expression =
      terms.length === 1
        ? terms[0]
        : { type: "and", terms };

    return exact
      ? { type: "exact", expression }
      : expression;
  }

  function parsePrimary() {
    skipSpaces();

    if (position >= text.length) {
      throw new Error("A tag name is missing.");
    }

    if (text[position] === "(") {
      position++;
      skipSpaces();

      if (text[position] === ")") {
        throw new Error("Parentheses cannot be empty.");
      }

      const expression = parseExpression();
      skipSpaces();

      if (text[position] !== ")") {
        throw new Error("Missing closing parenthesis.");
      }

      position++;
      return expression;
    }

    if (
      text[position] === ")" ||
      text[position] === "," ||
      text[position] === ";" ||
      text[position] === "/"
    ) {
      throw new Error("A tag name is missing.");
    }

    const start = position;

    while (
      position < text.length &&
      !";,()".includes(text[position])
    ) {
      position++;
    }

    const name = text.slice(start, position).trim();

    if (!name) {
      throw new Error("A tag name is missing.");
    }

    return { type: "tag", name };
  }

  const expression = parseExpression();
  skipSpaces();

  if (position !== text.length) {
    throw new Error(
      `Unexpected character "${text[position]}". Check your parentheses and separators.`
    );
  }

  return expression;
}

function evaluateTagLogicFilter(expression, chapterTags) {
  if (!expression) return true;

  const tags = Array.isArray(chapterTags) ? chapterTags : [];
  const normalizedTags = tags.map((tag) =>
    tag.toLocaleLowerCase()
  );

  switch (expression.type) {
    case "tag":
      return normalizedTags.includes(
        expression.name.toLocaleLowerCase()
      );

    case "and":
      return expression.terms.every((term) =>
        evaluateTagLogicFilter(term, tags)
      );

    case "or":
      return expression.terms.some((term) =>
        evaluateTagLogicFilter(term, tags)
      );

    case "exact":
      return evaluateExactTagSet(expression.expression, tags);

    default:
      return false;
  }
}

function evaluateExactTagSet(expression, chapterTags) {
  const requiredTags = [];

  function collectRequiredTags(node) {
    if (node.type === "tag") {
      requiredTags.push(node.name.toLocaleLowerCase());
      return true;
    }

    if (node.type === "and") {
      return node.terms.every(collectRequiredTags);
    }

    return false;
  }

  if (!collectRequiredTags(expression)) {
    throw new Error(
      "Exact matching requires a tag or an AND group. Example: /Creation; Man"
    );
  }

  const actualTags = chapterTags.map((tag) =>
    tag.toLocaleLowerCase()
  );

  const uniqueRequired = [...new Set(requiredTags)];
  const uniqueActual = [...new Set(actualTags)];

  return (
    uniqueActual.length === uniqueRequired.length &&
    uniqueRequired.every((tag) => uniqueActual.includes(tag))
  );
}

/* =======================================================
   CHAPTER SEARCH AND FILTERING
======================================================= */

function getSearchTerms() {
  return chapterSearch
    ? chapterSearch.value
        .split(",")
        .map((term) => term.trim().toLocaleLowerCase())
        .filter(Boolean)
    : [];
}

function chapterMatchesSearch(chapter, terms) {
  if (!terms.length) return true;

  const searchable =
    `${chapter.book} ${chapter.chapter} ` +
    `${(chapter.tags || []).join(" ")} ` +
    `${chapter.description || ""}`;

  const normalized = searchable.toLocaleLowerCase();

  return terms.some((term) => normalized.includes(term));
}

function renderChapters() {
  if (!chapterList) return;

  chapterList.replaceChildren();

  const terms = getSearchTerms();
  const filterText = tagLogicFilter
    ? tagLogicFilter.value.trim()
    : "";

  let parsedFilter = null;
  let filterError = null;

  if (filterText) {
    try {
      parsedFilter = parseTagLogicFilter(filterText);
    } catch (error) {
      filterError = error;
    }
  }

  if (filterError) {
    if (resultTitle) resultTitle.textContent = "Invalid tag filter";
    if (resultCount) resultCount.textContent = "Check filter syntax";

    showChapterMessage(`Filter error: ${filterError.message}`);
    return;
  }

  let filtered;

  try {
    filtered = chapters.filter((chapter) => {
      const matchesSelectedTag =
        selectedTag === null ||
        (chapter.tags || []).includes(selectedTag);

      const matchesSearch = chapterMatchesSearch(chapter, terms);

      const matchesLogic = evaluateTagLogicFilter(
        parsedFilter,
        chapter.tags || []
      );

      return matchesSelectedTag && matchesSearch && matchesLogic;
    });
  } catch (error) {
    if (resultTitle) resultTitle.textContent = "Invalid tag filter";
    if (resultCount) resultCount.textContent = "Check filter syntax";

    showChapterMessage(`Filter error: ${error.message}`);
    return;
  }

  if (resultTitle) {
    resultTitle.textContent = selectedTag || "All Chapters";
  }

  if (resultCount) {
    resultCount.textContent =
      `${filtered.length} chapter${filtered.length === 1 ? "" : "s"}`;
  }

  if (!filtered.length) {
    showChapterMessage(
      chapters.length
        ? "No matching chapters found. Try clearing your filters."
        : "No chapter data is available."
    );
    return;
  }

  setStatus("");

  filtered.forEach((chapter) => {
    const card = document.createElement("article");
    card.className = "chapter-card";

    const heading = document.createElement("div");
    heading.className = "chapter-card-heading";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "chapter-open-button";
    openButton.textContent = `${chapter.book} ${chapter.chapter}`;

    openButton.addEventListener("click", () => openChapter(chapter));
    heading.appendChild(openButton);

    const tagContainer = document.createElement("div");
    tagContainer.className = "chapter-card-tags";

    if (!chapter.tags.length) {
      const empty = document.createElement("span");
      empty.className = "chapter-tag empty-tag";
      empty.textContent = "No tags";
      tagContainer.appendChild(empty);
    } else {
      chapter.tags.forEach((tag) => {
        const chip = document.createElement("span");
        chip.className = "chapter-tag";
        chip.textContent = tag;
        tagContainer.appendChild(chip);
      });
    }

    const descriptionArea = document.createElement("section");
    descriptionArea.className = "chapter-description-area";

    const descriptionToggle = document.createElement("button");
    descriptionToggle.type = "button";
    descriptionToggle.className = "description-toggle";
    descriptionToggle.setAttribute("aria-expanded", "false");

    const arrow = document.createElement("span");
    arrow.className = "description-arrow";
    arrow.textContent = "▸";

    const toggleText = document.createElement("span");
    toggleText.textContent = chapter.description
      ? "Description"
      : "Add description";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "description-edit-button";
    editButton.setAttribute(
      "aria-label",
      `Edit description for ${chapter.book} ${chapter.chapter}`
    );
    editButton.title = "Edit description";
    editButton.textContent = "✎";

    const descriptionContent = document.createElement("div");
    descriptionContent.className = "chapter-description-content";
    descriptionContent.hidden = true;

    const descriptionText = document.createElement("p");
    descriptionText.className = "chapter-description-text";
    descriptionText.textContent =
      chapter.description || "No description yet.";

    const editArea = document.createElement("div");
    editArea.className = "description-edit-area";
    editArea.hidden = true;

    const textarea = document.createElement("textarea");
    textarea.className = "description-input";
    textarea.rows = 4;
    textarea.maxLength = 5000;
    textarea.placeholder = "Write a description for this chapter...";
    textarea.value = chapter.description || "";
    textarea.setAttribute(
      "aria-label",
      `Description for ${chapter.book} ${chapter.chapter}`
    );

    const editActions = document.createElement("div");
    editActions.className = "description-edit-actions";

    const saveDescription = document.createElement("button");
    saveDescription.type = "button";
    saveDescription.className = "action-button small-button";
    saveDescription.textContent = "Save description";

    const cancelDescription = document.createElement("button");
    cancelDescription.type = "button";
    cancelDescription.className = "secondary-button small-button";
    cancelDescription.textContent = "Cancel";

    editActions.append(saveDescription, cancelDescription);
    editArea.append(textarea, editActions);
    descriptionContent.append(descriptionText, editArea);
    descriptionToggle.append(arrow, toggleText);

    descriptionArea.append(
      descriptionToggle,
      editButton,
      descriptionContent
    );

    descriptionToggle.addEventListener("click", () => {
      const opening = descriptionContent.hidden;

      descriptionContent.hidden = !opening;
      descriptionToggle.setAttribute(
        "aria-expanded",
        String(opening)
      );

      arrow.textContent = opening ? "▾" : "▸";
    });

    editButton.addEventListener("click", () => {
      descriptionContent.hidden = false;
      descriptionToggle.setAttribute("aria-expanded", "true");
      arrow.textContent = "▾";

      editArea.hidden = false;
      descriptionText.hidden = true;
      editButton.hidden = true;
      toggleText.textContent = "Editing description";

      textarea.value = chapter.description || "";
      textarea.focus();
    });

    saveDescription.addEventListener("click", () => {
      chapter.description = textarea.value.trim();

      saveLocalData();

      descriptionText.textContent =
        chapter.description || "No description yet.";

      descriptionText.hidden = false;
      editArea.hidden = true;
      editButton.hidden = false;

      toggleText.textContent = chapter.description
        ? "Description"
        : "Add description";

      renderChapters();
    });

    cancelDescription.addEventListener("click", () => {
      editArea.hidden = true;
      descriptionText.hidden = false;
      editButton.hidden = false;

      toggleText.textContent = chapter.description
        ? "Description"
        : "Add description";

      textarea.value = chapter.description || "";
    });

    card.addEventListener("click", (event) => {
      if (event.target.closest("button, textarea, input, label")) {
        return;
      }

      openChapter(chapter);
    });

    card.append(heading, tagContainer, descriptionArea);
    chapterList.appendChild(card);
  });
}

/* =======================================================
   CHAPTER TAG EDITOR
======================================================= */

function renderChapterTagEditor() {
  if (!chapterTagEditor || !currentChapter) return;

  chapterTagEditor.replaceChildren();

  const allTags = getAllTags();

  if (!allTags.length) {
    const p = document.createElement("p");
    p.className = "muted-message";
    p.textContent = "No tags exist yet. Create one below.";

    chapterTagEditor.appendChild(p);
    return;
  }

  allTags.forEach((tag) => {
    const label = document.createElement("label");
    label.className = "tag-edit-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = currentChapter.tags.includes(tag);
    checkbox.setAttribute("aria-label", `Assign ${tag}`);

    checkbox.addEventListener("change", () => {
      if (!currentChapter) return;

      if (checkbox.checked) {
        if (!currentChapter.tags.includes(tag)) {
          currentChapter.tags.push(tag);
        }
      } else {
        currentChapter.tags = currentChapter.tags.filter(
          (existingTag) => existingTag !== tag
        );
      }

      saveLocalData();
      renderChapterTagEditor();
      renderTags();
      renderChapters();
    });

    const text = document.createElement("span");
    text.textContent = tag;

    label.append(checkbox, text);
    chapterTagEditor.appendChild(label);
  });
}

function createTag(event) {
  event.preventDefault();

  if (!currentChapter || !newTagInput) {
    setStatus("Open a chapter before creating a tag.");
    return;
  }

  const name = newTagInput.value.trim();

  if (!name) {
    setStatus("Enter a tag name first.");
    return;
  }

  if (name.length > 60) {
    setStatus("Tag names must be 60 characters or fewer.");
    return;
  }

  const existing = findExistingTag(name);
  const tag = existing || name;

  if (!existing) customTags.push(tag);

  if (!currentChapter.tags.includes(tag)) {
    currentChapter.tags.push(tag);
  }

  newTagInput.value = "";

  saveLocalData();
  renderChapterTagEditor();
  renderTags();
  renderChapters();

  setStatus(
    existing
      ? `Assigned existing tag "${tag}".`
      : `Created and assigned "${tag}".`
  );
}

/* =======================================================
   SCRIPTURE READER
======================================================= */

function getBookSlug(bookName) {
  return String(bookName)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function openChapter(chapter) {
  currentChapter = chapter;
  selectedVerseButton = null;

  const requestNumber = ++chapterRequestNumber;

  chapterView.hidden = true;
  readerView.hidden = false;

  readerTitle.textContent = `${chapter.book} ${chapter.chapter}`;
  readerSubtitle.textContent = "King James Version";

  verseList.replaceChildren();

  const loading = document.createElement("p");
  loading.className = "muted-message";
  loading.textContent = "Loading verses.";

  verseList.appendChild(loading);

  if (verseDetail) verseDetail.hidden = true;
  if (copyrightNotice) copyrightNotice.textContent = "";

  setStatus("");
  renderChapterTagEditor();

  window.dispatchEvent(
    new CustomEvent("bte:chapter-opened", {
      detail: { chapter }
    })
  );

  const url =
    `${API_BASE}/${BIBLE_VERSION}/` +
    `${getBookSlug(chapter.book)}/` +
    `${encodeURIComponent(chapter.chapter)}`;

  try {
    const response = await fetch(url);
    const payload = await response.json();

    if (!response.ok || payload.error) {
      throw new Error(
        payload.error?.message ||
        payload.message ||
        `The Scripture API returned HTTP ${response.status}.`
      );
    }

    const data = payload.data ?? payload;

    if (!Array.isArray(data.verses)) {
      throw new Error(
        "The API response did not contain a verses array."
      );
    }

    const verses = data.verses.map((verse, index) =>
      typeof verse === "string"
        ? { number: index + 1, text: verse }
        : {
            number: verse.verse ?? verse.number ?? index + 1,
            text: verse.text ?? verse.content ?? ""
          }
    );

    if (requestNumber !== chapterRequestNumber) return;

    renderVerses(verses);

    resultCount.textContent =
      `${verses.length} verses · ${chapter.book} ${chapter.chapter}`;

    const copyright =
      payload.meta?.copyright ?? data.copyright ?? "";

    copyrightNotice.textContent = copyright
      ? `Text attribution: ${copyright}`
      : "King James Version (KJV).";
  } catch (error) {
    if (requestNumber !== chapterRequestNumber) return;

    console.error("Verse loading error:", error);

    verseList.replaceChildren();

    const p = document.createElement("p");
    p.className = "muted-message";
    p.textContent =
      `Could not load ${chapter.book} ${chapter.chapter}. ${error.message}`;

    verseList.appendChild(p);
    resultCount.textContent = "Verse loading failed.";
  }
}

function renderVerses(verses) {
  verseList.replaceChildren();

  if (!verses.length) {
    const p = document.createElement("p");
    p.className = "muted-message";
    p.textContent = "No verses were returned for this chapter.";

    verseList.appendChild(p);
    return;
  }

  verses.forEach((verse) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "verse";

    const number = document.createElement("span");
    number.className = "verse-number";
    number.textContent = verse.number;

    button.append(number, document.createTextNode(` ${verse.text}`));

    button.addEventListener("click", () => {
      if (selectedVerseButton) {
        selectedVerseButton.classList.remove("selected");
      }

      selectedVerseButton = button;
      button.classList.add("selected");

      selectedVerseReference.textContent =
        `${currentChapter.book} ${currentChapter.chapter}:${verse.number}`;

      selectedVerseText.textContent = verse.text;
      verseDetail.hidden = false;

      verseDetail.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    });

    verseList.appendChild(button);
  });
}

function closeReader() {
  chapterRequestNumber++;
  currentChapter = null;
  selectedVerseButton = null;

  readerView.hidden = true;
  chapterView.hidden = false;

  window.dispatchEvent(
    new CustomEvent("bte:chapter-opened", {
      detail: { chapter: null }
    })
  );

  verseDetail.hidden = true;

  setStatus("");
  renderChapters();
}

function closeVerseDetail() {
  verseDetail.hidden = true;

  if (selectedVerseButton) {
    selectedVerseButton.classList.remove("selected");
    selectedVerseButton = null;
  }
}

/* =======================================================
   FILTER CONTROLS
======================================================= */

function clearFilters() {
  selectedTag = null;

  if (tagSearch) tagSearch.value = "";
  if (chapterSearch) chapterSearch.value = "";
  if (tagLogicFilter) tagLogicFilter.value = "";

  renderTags();
  renderChapters();
}

/* =======================================================
   IMPORT AND EXPORT
======================================================= */

function downloadJson(filename, data) {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportChapterTags() {
  if (!chapters.length) {
    setSettingsStatus("There is no chapter data to export.");
    return;
  }

  try {
    downloadJson("bible.json", chapters);
    setSettingsStatus("Chapter and tag JSON export started.");
  } catch (error) {
    console.error(error);
    setSettingsStatus(
      "Export failed. Check the browser console for details."
    );
  }
}

function chapterKey(chapter) {
  return (
    `${String(chapter.book).trim()} ` +
    `${String(chapter.chapter).trim()}`
  ).toLocaleLowerCase();
}

function exportDescriptions() {
  const descriptions = chapters
    .filter(
      (chapter) =>
        chapter.description && chapter.description.trim()
    )
    .map((chapter) => ({
      book: chapter.book,
      chapter: chapter.chapter,
      description: chapter.description
    }));

  try {
    downloadJson("bible-descriptions.json", {
      format: "bible-tag-explorer-descriptions-v1",
      descriptions
    });

    setSettingsStatus(
      `Description export started (${descriptions.length} saved descriptions).`
    );
  } catch (error) {
    console.error(error);
    setSettingsStatus("Description export failed.");
  }
}

async function readJsonFile(input) {
  const file = input.files && input.files[0];
  if (!file) return null;

  try {
    return JSON.parse(await file.text());
  } catch {
    throw new Error("That file is not valid JSON.");
  } finally {
    input.value = "";
  }
}

async function importChapterTags(event) {
  try {
    const data = await readJsonFile(event.target);
    if (!data) return;

    let importedChapters;
    let importedCustomTags = [];

    if (Array.isArray(data)) {
      importedChapters = data;
    } else if (data && Array.isArray(data.chapters)) {
      importedChapters = data.chapters;
      importedCustomTags = Array.isArray(data.customTags)
        ? data.customTags
        : [];
    } else {
      throw new Error(
        "Expected an array of chapter records or an object containing a chapters array."
      );
    }

    const normalized = normalizeChapters(importedChapters);

    if (!normalized.length) {
      throw new Error(
        "No valid chapter records were found in this file."
      );
    }

    const tagSet = new Set(
      importedCustomTags
        .filter((tag) => typeof tag === "string" && tag.trim())
        .map((tag) => tag.trim())
    );

    normalized.forEach((chapter) => {
      chapter.tags.forEach((tag) => tagSet.add(tag));
    });

    if (
      !window.confirm(
        `Import ${normalized.length} chapter records? This replaces the current chapter/tag dataset on this device.`
      )
    ) {
      return;
    }

    chapters = normalized;
    customTags = [...tagSet];
    selectedTag = null;

    saveLocalData(false);
    renderTags();
    renderChapters();

    if (currentChapter) {
      currentChapter =
        chapters.find(
          (chapter) =>
            chapterKey(chapter) === chapterKey(currentChapter)
        ) || null;

      if (currentChapter) renderChapterTagEditor();
    }

    setSettingsStatus(
      `Imported ${chapters.length} chapter records successfully.`
    );

    setStatus("Imported chapter and tag data saved on this device.");
  } catch (error) {
    console.error("Chapter import failed:", error);
    setSettingsStatus(`Import failed: ${error.message}`);
  }
}

async function importDescriptions(event) {
  try {
    const data = await readJsonFile(event.target);
    if (!data) return;

    let records;

    if (Array.isArray(data)) {
      records = data;
    } else if (data && Array.isArray(data.descriptions)) {
      records = data.descriptions;
    } else if (data && typeof data === "object") {
      records = Object.entries(data)
        .map(([key, description]) => {
          const match = key.match(/^(.*)\s+(\d+)$/);

          return match
            ? {
                book: match[1],
                chapter: match[2],
                description
              }
            : null;
        })
        .filter(Boolean);
    } else {
      throw new Error(
        "Expected a descriptions array or an object mapping chapter names to descriptions."
      );
    }

    let updated = 0;
    let unmatched = 0;

    records.forEach((record) => {
      if (
        !record ||
        typeof record.book !== "string" ||
        record.chapter === undefined ||
        typeof record.description !== "string"
      ) {
        unmatched++;
        return;
      }

      const target = chapters.find(
        (chapter) => chapterKey(chapter) === chapterKey(record)
      );

      if (!target) {
        unmatched++;
        return;
      }

      target.description = record.description;
      updated++;
    });

    saveLocalData(false);
    renderChapters();

    if (currentChapter) {
      currentChapter =
        chapters.find(
          (chapter) =>
            chapterKey(chapter) === chapterKey(currentChapter)
        ) || currentChapter;

      window.dispatchEvent(
        new CustomEvent("bte:descriptions-updated")
      );
    }

    setSettingsStatus(
      `Imported ${updated} description${updated === 1 ? "" : "s"}.` +
      (
        unmatched
          ? ` ${unmatched} record(s) were skipped because they were invalid or did not match a chapter.`
          : ""
      )
    );
  } catch (error) {
    console.error("Description import failed:", error);
    setSettingsStatus(`Import failed: ${error.message}`);
  }
}

/* =======================================================
   THEME AND SETTINGS
======================================================= */

function applyTheme(theme) {
  const normalized = theme === "light" ? "light" : "dark";

  document.documentElement.dataset.theme = normalized;
  document.documentElement.style.colorScheme = normalized;

  try {
    localStorage.setItem(THEME_KEY, normalized);
  } catch (error) {
    console.warn("Could not save theme preference:", error);
  }

  if (themeSelect) themeSelect.value = normalized;

  const meta = document.querySelector('meta[name="theme-color"]');

  if (meta) {
    meta.content =
      normalized === "light" ? "#f5f5f8" : "#09090b";
  }
}

function loadTheme() {
  let theme = "dark";

  try {
    const saved = localStorage.getItem(THEME_KEY);

    if (saved === "light" || saved === "dark") {
      theme = saved;
    }
  } catch (error) {
    console.warn(error);
  }

  applyTheme(theme);
}

function openSettings() {
  lastSettingsFocus = document.activeElement;
  settingsDialog.hidden = false;
  setSettingsStatus("");

  if (themeSelect) themeSelect.focus();
}

function closeSettings() {
  settingsDialog.hidden = true;

  if (
    lastSettingsFocus &&
    typeof lastSettingsFocus.focus === "function"
  ) {
    lastSettingsFocus.focus();
  }
}

/* =======================================================
   EVENT LISTENERS AND INITIALIZATION
======================================================= */

if (tagSearch) {
  tagSearch.addEventListener("input", renderTags);
}

if (chapterSearch) {
  chapterSearch.addEventListener("input", renderChapters);
}

setupAdvancedFilter();

if (tagLogicFilter) {
  tagLogicFilter.addEventListener("input", renderChapters);
}

if (backButton) {
  backButton.addEventListener("click", closeReader);
}

if (newTagForm) {
  newTagForm.addEventListener("submit", createTag);
}

if (clearFiltersButton) {
  clearFiltersButton.addEventListener("click", clearFilters);
}

if (closeVerseButton) {
  closeVerseButton.addEventListener("click", closeVerseDetail);
}

$("settingsButton").addEventListener("click", openSettings);
$("closeSettingsButton").addEventListener("click", closeSettings);
$("closeSettingsFooterButton").addEventListener("click", closeSettings);

settingsDialog.addEventListener("click", (event) => {
  if (event.target === settingsDialog) {
    closeSettings();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsDialog.hidden) {
    closeSettings();
  }
});

$("exportTagsButton").addEventListener("click", exportChapterTags);
$("exportDescriptionsButton").addEventListener(
  "click",
  exportDescriptions
);

$("importTagsInput").addEventListener(
  "change",
  importChapterTags
);

$("importDescriptionsInput").addEventListener(
  "change",
  importDescriptions
);

themeSelect.addEventListener("change", () => {
  applyTheme(themeSelect.value);

  setSettingsStatus(
    `Theme set to ${themeSelect.value} mode.`
  );
});

loadTheme();
loadBible();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((error) =>
        console.error("Service worker registration failed:", error)
      );
  });
}

/* =======================================================
   PUBLIC BRIDGE FOR SEPARATE FEATURE MODULES
======================================================= */

function saveChapterDescription(chapter, description) {
  if (!chapter || typeof description !== "string") return false;

  const target = chapters.find(
    (item) => chapterKey(item) === chapterKey(chapter)
  );

  if (!target) return false;

  target.description = description;

  if (
    currentChapter &&
    chapterKey(currentChapter) === chapterKey(target)
  ) {
    currentChapter = target;
  }

  const saved = saveLocalData(false);
  if (!saved) return false;

  renderChapters();
  setStatus("Chapter description saved on this device.");

  window.dispatchEvent(
    new CustomEvent("bte:descriptions-updated")
  );

  return true;
}

window.BibleTagExplorerCore = {
  getCurrentChapter: () => currentChapter,
  saveChapterDescription
};
