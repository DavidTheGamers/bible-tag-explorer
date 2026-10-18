
const API_BASE = "https://api.midvash.com/v1";
const BIBLE_VERSION = "kjv";

const STORAGE_KEY = "bibleTagExplorer.userData.v1";

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

let chapters = [];
let customTags = [];
let selectedTag = null;
let currentChapter = null;
let selectedVerseButton = null;

// Load locally saved edits, if available.
function getSavedData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return null;

    const data = JSON.parse(saved);

    if (!Array.isArray(data.chapters)) return null;

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

// Save all chapter assignments and custom tag names on this device.
function saveLocalData() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        chapters,
        customTags
      })
    );

    statusMessage.textContent = "Changes saved on this device.";
    return true;
  } catch (error) {
    console.error("Could not save Bible data:", error);

    statusMessage.textContent =
      "Local saving failed. Export your JSON to preserve your changes.";

    return false;
  }
}

// Normalize chapter records without changing their existing structure.
function normalizeChapters(data) {
  return data.map((chapter) => ({
    ...chapter,
    tags: Array.isArray(chapter.tags)
      ? [...new Set(
          chapter.tags.filter(
            (tag) => typeof tag === "string" && tag.trim()
          )
        )]
      : []
  }));
}

// Load the original JSON, then prefer this device's saved edits.
async function loadBible() {
  statusMessage.textContent = "Loading chapter index...";

  const saved = getSavedData();

  try {
    const response = await fetch("./bible.json");

    if (!response.ok) {
      throw new Error("Could not load bible.json.");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("bible.json must contain an array of chapters.");
    }

    chapters = normalizeChapters(saved ? saved.chapters : data);

    if (saved) {
      customTags = saved.customTags;
      statusMessage.textContent =
        "Loaded your saved tags from this device.";
    } else {
      customTags = [];
      statusMessage.textContent = "";
    }
  } catch (error) {
    if (saved) {
      chapters = normalizeChapters(saved.chapters);
      customTags = saved.customTags;

      statusMessage.textContent =
        "Using your saved chapters. The online JSON could not be loaded.";
    } else {
      statusMessage.textContent =
        `${error.message} Check that bible.json exists and the app is served through a web server.`;

      resultCount.textContent = "Unable to load chapters.";
      return;
    }
  }

  renderTags();
  renderChapters();
}

// Get every unique tag, including newly created tags.
function getAllTags() {
  const tags = new Set(customTags);

  chapters.forEach((chapter) => {
    chapter.tags.forEach((tag) => tags.add(tag));
  });

  return [...tags].sort((a, b) => a.localeCompare(b));
}

// Find an existing tag without regard to capitalization.
function findExistingTag(name) {
  const normalized = name.trim().toLocaleLowerCase();

  return getAllTags().find(
    (tag) => tag.toLocaleLowerCase() === normalized
  );
}

// Display tag filter buttons.
function renderTags() {
  const search = tagSearch.value.trim().toLowerCase();
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

  getAllTags()
    .filter((tag) => tag.toLowerCase().includes(search))
    .forEach((tag) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className =
        "tag-button" + (selectedTag === tag ? " active" : "");
      button.textContent = tag;

      button.addEventListener("click", () => {
        selectedTag = selectedTag === tag ? null : tag;
        renderTags();
        renderChapters();
      });

      tagList.appendChild(button);
    });
}

// Show chapters matching the selected tag and search.
function renderChapters() {
  chapterList.replaceChildren();

  const search = chapterSearch.value.trim().toLowerCase();

  const filtered = chapters.filter((chapter) => {
    const matchesTag =
      selectedTag === null || chapter.tags.includes(selectedTag);

    const reference =
      `${chapter.book} ${chapter.chapter}`.toLowerCase();

    return matchesTag && reference.includes(search);
  });

  resultTitle.textContent = selectedTag || "All Chapters";
  resultCount.textContent =
    `${filtered.length} chapter${filtered.length === 1 ? "" : "s"}`;

  if (filtered.length === 0) {
    statusMessage.textContent = "No matching chapters found.";
    return;
  }

  filtered.forEach((chapter) => {
    const card = document.createElement("button");

    card.type = "button";
    card.className = "chapter-card";

    const heading = document.createElement("h3");
    heading.textContent = `${chapter.book} ${chapter.chapter}`;

    const chips = document.createElement("div");
    chips.className = "tag-chips";

    chapter.tags.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = tag;
      chips.appendChild(chip);
    });

    card.append(heading, chips);

    card.addEventListener("click", () => openChapter(chapter));

    chapterList.appendChild(card);
  });
}

// Display tag controls for the currently open chapter.
function renderChapterTagEditor() {
  if (!currentChapter || !chapterTagEditor) return;

  chapterTagEditor.replaceChildren();

  const allTags = getAllTags();

  if (allTags.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent =
      "No tags exist yet. Create one below.";
    chapterTagEditor.appendChild(emptyMessage);
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

// Create a new tag and assign it to the current chapter.
function createTag(event) {
  event.preventDefault();

  if (!currentChapter) return;

  const name = newTagInput.value.trim();

  if (!name) {
    statusMessage.textContent = "Enter a tag name first.";
    return;
  }

  if (name.length > 60) {
    statusMessage.textContent =
      "Tag names must be 60 characters or fewer.";
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

  statusMessage.textContent = existing
    ? `Assigned existing tag "${tag}".`
    : `Created and assigned "${tag}".`;
}

// Convert a book name into an API-friendly slug.
function getBookSlug(bookName) {
  return String(bookName)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Fetch and display an entire chapter.
async function openChapter(chapter) {
  currentChapter = chapter;
  selectedVerseButton = null;

  chapterView.hidden = true;
  readerView.hidden = false;

  readerTitle.textContent = `${chapter.book} ${chapter.chapter}`;
  readerSubtitle.textContent = "King James Version";
  verseList.replaceChildren();
  verseDetail.hidden = true;
  copyrightNotice.textContent = "";
  statusMessage.textContent = "";

  renderChapterTagEditor();

  resultCount.textContent = "Loading verses...";

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
        "The API could not find this chapter."
      );
    }

    const data = payload.data ?? payload;

    const verses = Array.isArray(data.verses)
      ? data.verses.map((text, index) => ({
          number: index + 1,
          text
        }))
      : null;

    if (!verses) {
      throw new Error("The API returned an unexpected chapter format.");
    }

    if (currentChapter !== chapter) return;

    renderVerses(verses);

    resultCount.textContent =
      `${verses.length} verses · ${chapter.book} ${chapter.chapter}`;

    const copyright = payload.meta?.copyright ?? "";

    copyrightNotice.textContent = copyright
      ? `Text attribution: ${copyright}`
      : "King James Version (KJV).";
  } catch (error) {
    if (currentChapter !== chapter) return;

    statusMessage.textContent =
      `Unable to load ${chapter.book} ${chapter.chapter}: ${error.message}`;

    resultCount.textContent = "Verse loading failed.";
  }
}

// Display clickable verses.
function renderVerses(verses) {
  verseList.replaceChildren();

  verses.forEach((verse) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "verse-button";

    const number = document.createElement("span");
    number.className = "verse-number";
    number.textContent = verse.number;

    const text = document.createElement("span");
    text.className = "verse-content";
    text.textContent = verse.text;

    button.append(number, text);

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

// Export the complete chapter index as a JSON file.
function exportBibleJson() {
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

  URL.revokeObjectURL(url);

  statusMessage.textContent =
    "Exported bible.json. Upload it to GitHub to publish your changes.";
}

// Return to the chapter list.
function closeReader() {
  currentChapter = null;
  selectedVerseButton = null;

  readerView.hidden = true;
  chapterView.hidden = false;

  verseDetail.hidden = true;
  statusMessage.textContent = "";

  renderChapters();
}

tagSearch.addEventListener("input", renderTags);
chapterSearch.addEventListener("input", renderChapters);
backButton.addEventListener("click", closeReader);

if (newTagForm) {
  newTagForm.addEventListener("submit", createTag);
}

if (exportButton) {
  exportButton.addEventListener("click", exportBibleJson);
}

closeVerseButton.addEventListener("click", () => {
  verseDetail.hidden = true;

  if (selectedVerseButton) {
    selectedVerseButton.classList.remove("selected");
    selectedVerseButton = null;
  }
});

loadBible();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}
