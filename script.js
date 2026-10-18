
"use strict";

const API_BASE = "https://api.midvash.com/v1";
const BIBLE_VERSION = "kjv";
const STORAGE_KEY = "bibleTagExplorer.userData.v1";

// HTML elements
const tagList = document.getElementById("tagList");
const chapterList = document.getElementById("chapterList");
const tagSearch = document.getElementById("tagSearch");
const chapterSearch = document.getElementById("chapterSearch");
const resultTitle = document.getElementById("resultTitle");
const resultCount = document.getElementById("resultCount");

const statusMessage = document.getElementById("statusMessage");
const chapterView = document.getElementById("chapterView");
const readerView = document.getElementById("readerView");
const readerTitle = document.getElementById("readerTitle");
const readerSubtitle = document.getElementById("readerSubtitle");
const verseList = document.getElementById("verseList");
const backButton = document.getElementById("backButton");

const verseDetail = document.getElementById("verseDetail");
const selectedVerseReference = document.getElementById(
  "selectedVerseReference"
);
const selectedVerseText = document.getElementById("selectedVerseText");
const closeVerseButton = document.getElementById("closeVerseButton");
const copyrightNotice = document.getElementById("copyrightNotice");

const chapterTagEditor = document.getElementById("chapterTagEditor");
const newTagForm = document.getElementById("newTagForm");
const newTagInput = document.getElementById("newTagInput");
const exportButton = document.getElementById("exportTagsButton");
const clearFiltersButton = document.getElementById("clearFiltersButton");

// Application state
let chapters = [];
let customTags = [];
let selectedTag = null;
let currentChapter = null;
let selectedVerseButton = null;
let chapterRequestNumber = 0;

// Display a message without assuming the reader is open.
function setStatus(message) {
  if (statusMessage) {
    statusMessage.textContent = message;
  }
}

// Show an error or information message in the chapter area.
function showChapterMessage(message) {
  if (!chapterList) return;

  chapterList.replaceChildren();

  const paragraph = document.createElement("p");
  paragraph.className = "muted-message";
  paragraph.textContent = message;

  chapterList.appendChild(paragraph);
}

// Safely read saved data from this device.
function getSavedData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return null;

    const data = JSON.parse(saved);

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

// Normalize chapter data while preserving other existing fields.
function normalizeChapters(data) {
  if (!Array.isArray(data)) {
    throw new Error("The Bible chapter data must be an array.");
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
              chapter.tags.filter(
                (tag) => typeof tag === "string" && tag.trim()
              )
            )
          ]
        : []
    }));
}

// Save the current data locally.
function saveLocalData() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        chapters,
        customTags
      })
    );

    setStatus("Changes saved on this device.");
    return true;
  } catch (error) {
    console.error("Could not save Bible data:", error);

    setStatus(
      "Could not save locally. Use Export JSON to preserve your changes."
    );

    return false;
  }
}

// Load bible.json first. Existing local edits take priority when available.
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
      throw new Error(
        "bible.json must contain an array of chapter records."
      );
    }

    // Use the original JSON when there are no local edits.
    // Otherwise, use the saved local version.
    chapters = normalizeChapters(
      saved ? saved.chapters : originalData
    );

    customTags = saved ? saved.customTags : [];

    if (chapters.length === 0) {
      throw new Error("No valid chapter records were found.");
    }

    renderTags();
    renderChapters();

    if (saved) {
      setStatus("Loaded your saved chapter edits from this device.");
    } else {
      setStatus("");
    }

    console.info(
      `Bible Tag Explorer loaded ${chapters.length} chapters.`
    );
  } catch (error) {
    console.error("Bible index loading error:", error);

    // If the network file is unavailable, use saved data when possible.
    if (saved) {
      try {
        chapters = normalizeChapters(saved.chapters);
        customTags = saved.customTags;

        if (chapters.length === 0) {
          throw new Error("No saved chapter records were found.");
        }

        renderTags();
        renderChapters();

        setStatus(
          "Using your saved local data because bible.json could not load."
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

// Get all tags, including tags not currently assigned to a chapter.
function getAllTags() {
  const tags = new Set(customTags);

  chapters.forEach((chapter) => {
    chapter.tags.forEach((tag) => tags.add(tag));
  });

  return [...tags].sort((a, b) => a.localeCompare(b));
}

// Find a tag without regard to capitalization.
function findExistingTag(name) {
  const normalized = name.trim().toLocaleLowerCase();

  return getAllTags().find(
    (tag) => tag.toLocaleLowerCase() === normalized
  );
}

// Render tag filters in the sidebar.
function renderTags() {
  if (!tagList) return;

  const search = tagSearch
    ? tagSearch.value.trim().toLocaleLowerCase()
    : "";

  tagList.replaceChildren();

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className =
    "tag-button" + (selectedTag === null ? " active" : "");
  allButton.textContent = "All Chapters";

  allButton.addEventListener("click", () => {
    selectedTag = null;
    renderTags();
    renderChapters();
  });

  tagList.appendChild(allButton);

  const matchingTags = getAllTags().filter((tag) =>
    tag.toLocaleLowerCase().includes(search)
  );

  matchingTags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "tag-button" + (selectedTag === tag ? " active" : "");
    button.textContent = tag;

    const count = chapters.filter((chapter) =>
      chapter.tags.includes(tag)
    ).length;

    const number = document.createElement("span");
    number.className = "tag-number";
    number.textContent = String(count);

    button.appendChild(number);

    button.addEventListener("click", () => {
      selectedTag = selectedTag === tag ? null : tag;
      renderTags();
      renderChapters();
    });

    tagList.appendChild(button);
  });

  if (matchingTags.length === 0 && search) {
    const message = document.createElement("p");
    message.className = "muted-message";
    message.textContent = "No tags match your search.";
    tagList.appendChild(message);
  }
}

// Render the chapter cards.
function renderChapters() {
  if (!chapterList) return;

  chapterList.replaceChildren();

  const search = chapterSearch
    ? chapterSearch.value.trim().toLocaleLowerCase()
    : "";

  const filtered = chapters.filter((chapter) => {
    const matchesTag =
      selectedTag === null || chapter.tags.includes(selectedTag);

    const reference =
      `${chapter.book} ${chapter.chapter}`.toLocaleLowerCase();

    return matchesTag && reference.includes(search);
  });

  if (resultTitle) {
    resultTitle.textContent = selectedTag || "All Chapters";
  }

  if (resultCount) {
    resultCount.textContent =
      `${filtered.length} chapter${filtered.length === 1 ? "" : "s"}`;
  }

  if (filtered.length === 0) {
    showChapterMessage(
      chapters.length === 0
        ? "No chapter data is available."
        : "No matching chapters found. Try clearing your filters."
    );
    return;
  }

  filtered.forEach((chapter) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "chapter-card";

    const heading = document.createElement("div");
    heading.className = "chapter-card-heading";

    const title = document.createElement("h3");
    title.textContent = `${chapter.book} ${chapter.chapter}`;

    heading.appendChild(title);

    const tagContainer = document.createElement("div");
    tagContainer.className = "chapter-card-tags";

    if (chapter.tags.length === 0) {
      const empty = document.createElement("span");
      empty.className = "chapter-tag";
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

    card.append(heading, tagContainer);

    card.addEventListener("click", () => {
      openChapter(chapter);
    });

    chapterList.appendChild(card);
  });
}

// Render the tag editor for the currently selected chapter.
function renderChapterTagEditor() {
  if (!chapterTagEditor || !currentChapter) return;

  chapterTagEditor.replaceChildren();

  const allTags = getAllTags();

  if (allTags.length === 0) {
    const message = document.createElement("p");
    message.className = "muted-message";
    message.textContent = "No tags exist yet. Create one below.";
    chapterTagEditor.appendChild(message);
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
          (existing) => existing !== tag
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

// Create a tag and assign it to the open chapter.
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

  if (!existing) {
    customTags.push(tag);
  }

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

// Convert a book name into a URL-friendly API slug.
function getBookSlug(bookName) {
  return String(bookName)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Open a chapter and fetch its verses.
async function openChapter(chapter) {
  currentChapter = chapter;
  selectedVerseButton = null;

  const requestNumber = ++chapterRequestNumber;

  if (chapterView) chapterView.hidden = true;
  if (readerView) readerView.hidden = false;

  if (readerTitle) {
    readerTitle.textContent = `${chapter.book} ${chapter.chapter}`;
  }

  if (readerSubtitle) {
    readerSubtitle.textContent = "King James Version";
  }

  if (verseList) {
    verseList.replaceChildren();

    const message = document.createElement("p");
    message.className = "muted-message";
    message.textContent = "Loading verses...";
    verseList.appendChild(message);
  }

  if (verseDetail) verseDetail.hidden = true;
  if (copyrightNotice) copyrightNotice.textContent = "";

  setStatus("");
  renderChapterTagEditor();

  const loadingMessage = document.createElement("p");
  loadingMessage.className = "muted-message";
  loadingMessage.textContent = "Loading verses...";

  if (verseList) {
    verseList.replaceChildren(loadingMessage);
  }

  const bookSlug = getBookSlug(chapter.book);
  const chapterNumber = encodeURIComponent(chapter.chapter);
  const url =
    `${API_BASE}/${BIBLE_VERSION}/${bookSlug}/${chapterNumber}`;

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

    const verses = data.verses.map((verse, index) => {
      if (typeof verse === "string") {
        return {
          number: index + 1,
          text: verse
        };
      }

      return {
        number: verse.verse ?? verse.number ?? index + 1,
        text: verse.text ?? verse.content ?? ""
      };
    });

    // Ignore an older request if another chapter was opened meanwhile.
    if (requestNumber !== chapterRequestNumber) return;

    renderVerses(verses);

    if (resultCount) {
      resultCount.textContent =
        `${verses.length} verses · ${chapter.book} ${chapter.chapter}`;
    }

    if (copyrightNotice) {
      const copyright =
        payload.meta?.copyright ??
        data.copyright ??
        "";

      copyrightNotice.textContent = copyright
        ? `Text attribution: ${copyright}`
        : "King James Version (KJV).";
    }
  } catch (error) {
    if (requestNumber !== chapterRequestNumber) return;

    console.error("Verse loading error:", error);

    if (verseList) {
      verseList.replaceChildren();

      const message = document.createElement("p");
      message.className = "muted-message";
      message.textContent =
        `Could not load ${chapter.book} ${chapter.chapter}. ${error.message}`;

      verseList.appendChild(message);
    }

    if (resultCount) {
      resultCount.textContent = "Verse loading failed.";
    }
  }
}

// Render the chapter's verses as selectable buttons.
function renderVerses(verses) {
  if (!verseList) return;

  verseList.replaceChildren();

  if (verses.length === 0) {
    const message = document.createElement("p");
    message.className = "muted-message";
    message.textContent = "No verses were returned for this chapter.";
    verseList.appendChild(message);
    return;
  }

  verses.forEach((verse) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "verse";

    const number = document.createElement("span");
    number.className = "verse-number";
    number.textContent = verse.number;

    button.appendChild(number);
    button.appendChild(document.createTextNode(` ${verse.text}`));

    button.addEventListener("click", () => {
      if (selectedVerseButton) {
        selectedVerseButton.classList.remove("selected");
      }

      selectedVerseButton = button;
      button.classList.add("selected");

      if (selectedVerseReference) {
        selectedVerseReference.textContent =
          `${currentChapter.book} ${currentChapter.chapter}:${verse.number}`;
      }

      if (selectedVerseText) {
        selectedVerseText.textContent = verse.text;
      }

      if (verseDetail) {
        verseDetail.hidden = false;
        verseDetail.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }
    });

    verseList.appendChild(button);
  });
}

// Close the chapter reader.
function closeReader() {
  chapterRequestNumber++;

  currentChapter = null;
  selectedVerseButton = null;

  if (readerView) readerView.hidden = true;
  if (chapterView) chapterView.hidden = false;
  if (verseDetail) verseDetail.hidden = true;

  setStatus("");
  renderChapters();
}

// Close the selected verse detail.
function closeVerseDetail() {
  if (verseDetail) verseDetail.hidden = true;

  if (selectedVerseButton) {
    selectedVerseButton.classList.remove("selected");
    selectedVerseButton = null;
  }
}

// Clear both searches and the selected tag filter.
function clearFilters() {
  selectedTag = null;

  if (tagSearch) tagSearch.value = "";
  if (chapterSearch) chapterSearch.value = "";

  renderTags();
  renderChapters();
}

// Export chapter records as bible.json.
function exportBibleJson() {
  if (chapters.length === 0) {
    setStatus("There is no chapter data to export.");
    return;
  }

  try {
    const json = JSON.stringify(chapters, null, 2);
    const blob = new Blob([json], {
      type: "application/json;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "bible.json";

    document.body.appendChild(link);
    link.click();
    link.remove();

    // Delay cleanup so the browser can begin the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setStatus(
      "Export started. Upload the downloaded bible.json to GitHub to publish your edits."
    );
  } catch (error) {
    console.error("JSON export failed:", error);
    setStatus("Export failed. Check the browser console for details.");
  }
}

// Event listeners
if (tagSearch) {
  tagSearch.addEventListener("input", renderTags);
}

if (chapterSearch) {
  chapterSearch.addEventListener("input", renderChapters);
}

if (backButton) {
  backButton.addEventListener("click", closeReader);
}

if (newTagForm) {
  newTagForm.addEventListener("submit", createTag);
}

if (exportButton) {
  exportButton.addEventListener("click", exportBibleJson);
}

if (clearFiltersButton) {
  clearFiltersButton.addEventListener("click", clearFilters);
}

if (closeVerseButton) {
  closeVerseButton.addEventListener("click", closeVerseDetail);
}

// Start the app.
loadBible();

// Register the existing service worker.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}
