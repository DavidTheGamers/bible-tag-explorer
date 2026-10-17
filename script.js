
const tagList = document.getElementById("tagList");
const chapterList = document.getElementById("chapterList");
const tagSearch = document.getElementById("tagSearch");
const chapterSearch = document.getElementById("chapterSearch");
const resultTitle = document.getElementById("resultTitle");
const resultCount = document.getElementById("resultCount");

let chapters = [];
let selectedTag = null;

async function loadBible() {
  try {
    const response = await fetch("./bible.json");

    if (!response.ok) {
      throw new Error("Could not load bible.json");
    }

    chapters = await response.json();

    renderTags();
    renderChapters();
  } catch (error) {
    chapterList.textContent =
      "Could not load Bible data. Run the app using a local server.";
    console.error(error);
  }
}

function getAllTags() {
  return [...new Set(
    chapters.flatMap(chapter => chapter.tags || [])
  )].sort((a, b) => a.localeCompare(b));
}

function renderTags() {
  const query = tagSearch.value.toLowerCase();

  tagList.replaceChildren();

  const allButton = document.createElement("button");
  allButton.className =
    "tag-button" + (selectedTag === null ? " active" : "");
  allButton.textContent = "All tags";
  allButton.onclick = () => {
    selectedTag = null;
    renderTags();
    renderChapters();
  };

  tagList.appendChild(allButton);

  getAllTags()
    .filter(tag => tag.toLowerCase().includes(query))
    .forEach(tag => {
      const button = document.createElement("button");

      button.className =
        "tag-button" + (selectedTag === tag ? " active" : "");

      button.textContent = tag;

      button.onclick = () => {
        selectedTag = tag;
        renderTags();
        renderChapters();
      };

      tagList.appendChild(button);
    });
}

function renderChapters() {
  const query = chapterSearch.value.toLowerCase();

  const filtered = chapters.filter(chapter => {
    const matchesTag =
      selectedTag === null ||
      (chapter.tags || []).includes(selectedTag);

    const matchesSearch =
      `${chapter.book} ${chapter.chapter}`
        .toLowerCase()
        .includes(query);

    return matchesTag && matchesSearch;
  });

  resultTitle.textContent = selectedTag || "All Chapters";
  resultCount.textContent =
    `${filtered.length} chapter${filtered.length === 1 ? "" : "s"}`;

  chapterList.replaceChildren();

  if (filtered.length === 0) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = "No matching chapters found.";
    chapterList.appendChild(message);
    return;
  }

  filtered.forEach(chapter => {
    const card = document.createElement("article");
    card.className = "chapter-card";

    const heading = document.createElement("h3");
    heading.textContent = `${chapter.book} ${chapter.chapter}`;

    const tags = document.createElement("div");
    tags.className = "tag-list";

    (chapter.tags || []).forEach(tag => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = tag;
      tags.appendChild(chip);
    });

    card.append(heading, tags);
    chapterList.appendChild(card);
  });
}

tagSearch.addEventListener("input", renderTags);
chapterSearch.addEventListener("input", renderChapters);

loadBible();
