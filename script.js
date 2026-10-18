
const API_BASE = "https://api.midvash.com/v1";
const BIBLE_VERSION = "kjv";

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

let chapters = [];
let selectedTag = null;
let currentChapter = null;
let selectedVerseButton = null;

// Load your existing tag index.
async function loadBible() {
  try {
    statusMessage.textContent = "Loading chapter index...";

    const response = await fetch("./bible.json");

    if (!response.ok) {
      throw new Error("Could not load bible.json.");
    }

    chapters = await response.json();

    if (!Array.isArray(chapters)) {
      throw new Error("bible.json must contain an array of chapters.");
    }

    renderTags();
    renderChapters();

    statusMessage.textContent = "";
  } catch (error) {
    statusMessage.textContent =
      `${error.message} Check that bible.json exists and the app is served through a local web server.`;

    resultCount.textContent = "Unable to load chapters.";
  }
}

// Get every unique tag from the chapter index.
function getAllTags() {
  const tags = new Set();

  chapters.forEach((chapter) => {
    if (Array.isArray(chapter.tags)) {
      chapter.tags.forEach((tag) => tags.add(tag));
    }
  });

  return [...tags].sort((a, b) => a.localeCompare(b));
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
      selectedTag === null ||
      (Array.isArray(chapter.tags) &&
        chapter.tags.includes(selectedTag));

    const reference = `${chapter.book} ${chapter.chapter}`.toLowerCase();
    const matchesSearch = reference.includes(search);

    return matchesTag && matchesSearch;
  });

  resultTitle.textContent = selectedTag || "All Chapters";
  resultCount.textContent = `${filtered.length} chapter${filtered.length === 1 ? "" : "s"}`;

  if (filtered.length === 0) {
    statusMessage.textContent = "No matching chapters found.";
    return;
  }

  statusMessage.textContent = "";

  filtered.forEach((chapter) => {
    const card = document.createElement("button");

    card.type = "button";
    card.className = "chapter-card";

    const heading = document.createElement("h3");
    heading.textContent = `${chapter.book} ${chapter.chapter}`;

    const chips = document.createElement("div");
    chips.className = "tag-chips";

    (Array.isArray(chapter.tags) ? chapter.tags : []).forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = tag;
      chips.appendChild(chip);
    });

    card.append(heading, chips);

    card.addEventListener("click", () => {
      openChapter(chapter);
    });

    chapterList.appendChild(card);
  });
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
          text: text
        }))
      : null;


    if (!verses) {
      throw new Error("The API returned an unexpected chapter format.");
    }

    // Ignore a response if the user has already opened another chapter.
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
    navigator.serviceWorker.register("./sw.js")
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  });
}
