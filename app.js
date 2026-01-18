const storageKey = "notebook-state-v1";
const themeStorageKey = "notebook-theme";
const soundscapeStorageKey = "notebook-soundscape";

const sectionList = document.getElementById("section-list");
const addSectionButton = document.getElementById("add-section");
const addPageButton = document.getElementById("add-page");
const workspaceSection = document.getElementById("workspace-section");
const workspacePage = document.getElementById("workspace-page");
const sectionColorInput = document.getElementById("section-color");
const sectionBgSelect = document.getElementById("section-bg");
const sectionBgUpload = document.getElementById("section-bg-upload");
const pageBgInput = document.getElementById("page-bg");
const pageTitleInput = document.getElementById("page-title");
const page = document.getElementById("page");
const pageWrap = document.querySelector(".page-wrap");
const canvas = document.getElementById("ink");
const textColorInput = document.getElementById("text-color");
const highlightColorInput = document.getElementById("highlight-color");
const fontSizeSelect = document.getElementById("font-size");
const penColorInput = document.getElementById("pen-color");
const penSizeInput = document.getElementById("pen-size");
const clearInkButton = document.getElementById("clear-ink");
const addStickyButton = document.getElementById("add-sticky");
const emojiButton = document.getElementById("emoji-button");
const emojiPicker = document.getElementById("emoji-picker");
const toggleNavButton = document.getElementById("toggle-nav");
const themeToggle = document.getElementById("theme-toggle");
const soundscape = document.getElementById("soundscape");
const soundCards = Array.from(document.querySelectorAll(".sound-card"));
const sectionBgPresets = [
  "cozy1.jpg",
  "cozy2.jpg",
  "cozy3.jpg",
  "cozy4.jpg",
  "cozy5.jpg",
  "cozy6.jpg",
  "cozy7.jpg",
  "cozy8.jpg",
  "cozy9.jpg",
  "cozy10.jpg"
];

const entryDialog = document.getElementById("entry-dialog");
const entryForm = document.getElementById("entry-form");
const entryTitle = document.getElementById("entry-title");
const entryName = document.getElementById("entry-name");
const entryColor = document.getElementById("entry-color");
const entryBg = document.getElementById("entry-bg");
const entryColorField = document.getElementById("entry-color-field");
const entryBgField = document.getElementById("entry-bg-field");
const entryCancel = document.getElementById("entry-cancel");

const confirmDialog = document.getElementById("confirm-dialog");
const confirmTitle = document.getElementById("confirm-title");
const confirmMessage = document.getElementById("confirm-message");
const confirmCancel = document.getElementById("confirm-cancel");
const confirmConfirm = document.getElementById("confirm-confirm");

const modeButtons = Array.from(document.querySelectorAll(".mode"));
const commandButtons = Array.from(document.querySelectorAll("[data-command]"));

let state = loadState();
let currentMode = "write";
let isDrawing = false;
let lastPoint = null;
let strokePoints = [];
let entryMode = "section";
let entrySectionId = null;
let entrySubsectionId = null;
let suspendSave = false;
let dpr = window.devicePixelRatio || 1;
let imageDragState = null;
let imageResizeState = null;
let stickyDragState = null;
let activeStickyId = null;
let emojiTarget = "page";
let confirmAction = null;
let savedRange = null;
let soundscapeReady = false;
let soundscapeAllowPersist = false;
let pendingSoundResume = [];
let soundResumeHandler = null;

const ctx = canvas.getContext("2d");
const emojiList = ["😊", "✨", "📌", "🧠", "📎", "✅", "🔥", "💡", "📝", "🌿", "🎯", "⚡"];
const stickyPalette = ["#fff1a8", "#ffe1d6", "#e2f4ff", "#e9f7d2", "#f9e7ff", "#ffeec5"];

if (!state) {
  state = createDefaultState();
  saveState();
} else {
  state = migrateState(state);
  saveState();
}

document.execCommand("styleWithCSS", false, true);
initTheme();
setMode("write");
ensureActiveSelection();
saveState();
renderAll();
setupEvents();
renderEmojiPicker();
setupSoundscape();
observePageResize();

function createDefaultState() {
  const engineering = createSection("Data Engineering", "#5f7f74", [
    createPage("Pipeline plan", "#f6f1ea", "")
  ]);
  const science = createSection("Data Science", "#4a6f78", [
    createPage("Model ideas", "#f6f1ea", "")
  ]);

  return {
    sections: [engineering, science],
    activeSectionId: engineering.id,
    activeSubsectionId: null,
    activePageId: engineering.pages[0].id
  };
}

function createSection(name, color, pages = [], subsections = [], backgroundImage = "") {
  return {
    id: createId("section"),
    name,
    color,
    pages,
    subsections,
    backgroundImage
  };
}

function createSubsection(name, pages = []) {
  return {
    id: createId("subsection"),
    name,
    pages
  };
}

function createPage(title, bgColor, content = "") {
  return {
    id: createId("page"),
    title,
    bgColor,
    content,
    ink: "",
    stickyNotes: []
  };
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Failed to parse notebook state", error);
    return null;
  }
}

function migrateState(rawState) {
  const next = {
    sections: Array.isArray(rawState.sections) ? rawState.sections.map(migrateSection) : [],
    activeSectionId: rawState.activeSectionId || null,
    activeSubsectionId: rawState.activeSubsectionId || null,
    activePageId: rawState.activePageId || null
  };
  return next;
}

function migrateSection(section) {
  return {
    id: section.id || createId("section"),
    name: section.name || "Untitled section",
    color: section.color || "#5f7f74",
    pages: Array.isArray(section.pages) ? section.pages.map(migratePage) : [],
    subsections: Array.isArray(section.subsections) ? section.subsections.map(migrateSubsection) : [],
    backgroundImage: section.backgroundImage || ""
  };
}

function migrateSubsection(subsection) {
  return {
    id: subsection.id || createId("subsection"),
    name: subsection.name || "Untitled subsection",
    pages: Array.isArray(subsection.pages) ? subsection.pages.map(migratePage) : []
  };
}

function migratePage(pageData) {
  return {
    id: pageData.id || createId("page"),
    title: pageData.title || "Untitled page",
    bgColor: pageData.bgColor || "#f6f1ea",
    content: pageData.content || "",
    ink: pageData.ink || "",
    stickyNotes: Array.isArray(pageData.stickyNotes)
      ? pageData.stickyNotes.map(migrateStickyNote)
      : []
  };
}

function migrateStickyNote(note) {
  return {
    id: note.id || createId("sticky"),
    text: note.text || "",
    color: note.color || stickyPalette[0],
    textColor: note.textColor || "#1f2a33",
    emoji: note.emoji || "📝",
    x: Number.isFinite(note.x) ? note.x : 80,
    y: Number.isFinite(note.y) ? note.y : 120
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function getSectionById(sectionId) {
  return state.sections.find((section) => section.id === sectionId);
}

function getSubsectionById(section, subsectionId) {
  if (!section) {
    return null;
  }
  return section.subsections.find((subsection) => subsection.id === subsectionId);
}

function getActiveSection() {
  return getSectionById(state.activeSectionId);
}

function getActiveSubsection() {
  const section = getActiveSection();
  if (!section || !state.activeSubsectionId) {
    return null;
  }
  return getSubsectionById(section, state.activeSubsectionId);
}

function getActivePage() {
  const section = getActiveSection();
  if (!section) {
    return null;
  }
  if (state.activeSubsectionId) {
    const subsection = getSubsectionById(section, state.activeSubsectionId);
    if (!subsection) {
      return null;
    }
    return subsection.pages.find((pageItem) => pageItem.id === state.activePageId);
  }
  return section.pages.find((pageItem) => pageItem.id === state.activePageId);
}

function findFirstPage(section) {
  if (!section) {
    return null;
  }
  if (section.pages.length) {
    return { page: section.pages[0], subsectionId: null };
  }
  for (const subsection of section.subsections) {
    if (subsection.pages.length) {
      return { page: subsection.pages[0], subsectionId: subsection.id };
    }
  }
  return null;
}

function ensureActiveSelection() {
  if (!state.sections.length) {
    const fallbackSection = createSection("New section", "#5f7f74", [
      createPage("Untitled page", "#f6f1ea", "")
    ]);
    state.sections.push(fallbackSection);
    state.activeSectionId = fallbackSection.id;
    state.activeSubsectionId = null;
    state.activePageId = fallbackSection.pages[0].id;
    return;
  }

  let section = getSectionById(state.activeSectionId);
  if (!section) {
    section = state.sections[0];
    state.activeSectionId = section.id;
    state.activeSubsectionId = null;
    state.activePageId = null;
  }

  if (state.activeSubsectionId && !getSubsectionById(section, state.activeSubsectionId)) {
    state.activeSubsectionId = null;
  }

  if (!getActivePage()) {
    const fallback = findFirstPage(section);
    if (fallback) {
      state.activeSubsectionId = fallback.subsectionId;
      state.activePageId = fallback.page.id;
    } else {
      const newPage = createPage("Untitled page", "#f6f1ea", "");
      section.pages.push(newPage);
      state.activeSubsectionId = null;
      state.activePageId = newPage.id;
    }
  }
}

function renderAll() {
  renderSidebar();
  renderWorkspace();
}

function getSectionBackgroundSelectValue(backgroundImage) {
  if (!backgroundImage) {
    return "";
  }
  const value = backgroundImage.trim();
  if (value.startsWith("data:") || value.startsWith("blob:")) {
    return "__custom__";
  }
  const filename = value.startsWith("img/") ? value.slice(4) : value;
  return sectionBgPresets.includes(filename) ? filename : "__custom__";
}

function getSectionBackgroundImageValue(backgroundImage) {
  if (!backgroundImage) {
    return "none";
  }
  const value = backgroundImage.trim();
  if (
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    value.startsWith("http") ||
    value.startsWith("/") ||
    value.startsWith("img/")
  ) {
    return `url("${value}")`;
  }
  return `url("img/${value}")`;
}

function renderSidebar() {
  sectionList.innerHTML = "";

  state.sections.forEach((section, index) => {
    const card = document.createElement("div");
    card.className = "section-card";
    card.style.setProperty("--section-color", section.color);
    card.style.setProperty("--delay", `${index * 0.05}s`);

    const header = document.createElement("div");
    header.className = "section-header";

    const titleButton = document.createElement("button");
    titleButton.className = "section-title";
    titleButton.type = "button";
    titleButton.textContent = section.name;
    titleButton.addEventListener("click", () => setActiveSection(section.id));

    const actions = document.createElement("div");
    actions.className = "section-actions";
    const addPage = document.createElement("button");
    addPage.className = "ghost add-page-btn";
    addPage.type = "button";
    addPage.textContent = "Add page";
    addPage.addEventListener("click", () => openEntryDialog("page", section.id, null));

    const addSubsection = document.createElement("button");
    addSubsection.className = "ghost";
    addSubsection.type = "button";
    addSubsection.textContent = "Add sub section";
    addSubsection.addEventListener("click", () => openEntryDialog("subsection", section.id));

    const deleteSection = document.createElement("button");
    deleteSection.className = "icon-button";
    deleteSection.type = "button";
    deleteSection.textContent = "x";
    deleteSection.addEventListener("click", () => confirmDeleteSection(section.id, section.name));

    actions.appendChild(addPage);
    actions.appendChild(addSubsection);
    actions.appendChild(deleteSection);
    header.appendChild(titleButton);
    header.appendChild(actions);

    const pageList = document.createElement("div");
    pageList.className = "page-list";

    section.pages.forEach((pageItem, pageIndex) => {
      const row = createPageRow(section.id, null, pageItem, pageIndex);
      pageList.appendChild(row);
    });

    const subsectionList = document.createElement("div");
    subsectionList.className = "subsection-list";

    section.subsections.forEach((subsection, subsectionIndex) => {
      const subsectionCard = document.createElement("div");
      subsectionCard.className = "subsection-card";
      subsectionCard.style.setProperty("--delay", `${subsectionIndex * 0.04}s`);

      const subsectionHeader = document.createElement("div");
      subsectionHeader.className = "subsection-header";

      const subsectionTitle = document.createElement("button");
      subsectionTitle.type = "button";
      subsectionTitle.className = "subsection-title";
      subsectionTitle.textContent = subsection.name;
      if (subsection.id === state.activeSubsectionId && section.id === state.activeSectionId) {
        subsectionTitle.classList.add("active");
      }
      subsectionTitle.addEventListener("click", () => setActiveSubsection(section.id, subsection.id));

      const subsectionActions = document.createElement("div");
      subsectionActions.className = "subsection-actions";

      const addSubPage = document.createElement("button");
      addSubPage.type = "button";
      addSubPage.className = "ghost add-page-btn";
      addSubPage.textContent = "Add page";
      addSubPage.addEventListener("click", () => openEntryDialog("page", section.id, subsection.id));

      const deleteSubsection = document.createElement("button");
      deleteSubsection.type = "button";
      deleteSubsection.className = "icon-button";
      deleteSubsection.textContent = "x";
      deleteSubsection.addEventListener("click", () => confirmDeleteSubsection(section.id, subsection.id, subsection.name));

      subsectionActions.appendChild(addSubPage);
      subsectionActions.appendChild(deleteSubsection);

      subsectionHeader.appendChild(subsectionTitle);
      subsectionHeader.appendChild(subsectionActions);
      subsectionCard.appendChild(subsectionHeader);

      const subsectionPages = document.createElement("div");
      subsectionPages.className = "page-list";
      subsection.pages.forEach((pageItem, pageIndex) => {
        const row = createPageRow(section.id, subsection.id, pageItem, pageIndex);
        subsectionPages.appendChild(row);
      });

      subsectionCard.appendChild(subsectionPages);
      subsectionList.appendChild(subsectionCard);
    });

    card.appendChild(header);
    card.appendChild(pageList);
    card.appendChild(subsectionList);
    sectionList.appendChild(card);
  });
}

function createPageRow(sectionId, subsectionId, pageItem, pageIndex) {
  const row = document.createElement("div");
  row.className = "page-row";
  row.style.setProperty("--delay", `${pageIndex * 0.04}s`);

  const pageButton = document.createElement("button");
  pageButton.type = "button";
  pageButton.className = "page-item";
  pageButton.textContent = pageItem.title || "Untitled page";

  if (
    pageItem.id === state.activePageId &&
    sectionId === state.activeSectionId &&
    subsectionId === state.activeSubsectionId
  ) {
    pageButton.classList.add("active");
  }

  pageButton.addEventListener("click", () => setActivePage(sectionId, subsectionId, pageItem.id));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "icon-button";
  deleteButton.textContent = "x";
  deleteButton.addEventListener("click", () => {
    confirmDeletePage(sectionId, subsectionId, pageItem.id, pageItem.title);
  });

  row.appendChild(pageButton);
  row.appendChild(deleteButton);
  return row;
}

function renderWorkspace() {
  const section = getActiveSection();
  const pageData = getActivePage();
  if (!section || !pageData) {
    return;
  }

  const subsection = getActiveSubsection();
  workspaceSection.textContent = subsection ? `${section.name} / ${subsection.name}` : section.name;
  workspacePage.textContent = pageData.title || "Untitled page";

  sectionColorInput.value = section.color;
  if (sectionBgSelect) {
    sectionBgSelect.value = getSectionBackgroundSelectValue(section.backgroundImage);
  }
  pageBgInput.value = pageData.bgColor;
  pageTitleInput.value = pageData.title || "";

  document.documentElement.style.setProperty("--accent", section.color);
  document.documentElement.style.setProperty(
    "--section-bg-image",
    getSectionBackgroundImageValue(section.backgroundImage)
  );

  page.className = "page";
  page.style.setProperty("--page-bg", pageData.bgColor);

  suspendSave = true;
  page.innerHTML = pageData.content || "";
  suspendSave = false;
  const normalized = normalizeImages();
  if (normalized) {
    saveActiveContent();
  }
  activeStickyId = null;
  emojiTarget = "page";
  savedRange = null;
  closeEmojiPicker();
  imageDragState = null;
  imageResizeState = null;
  stickyDragState = null;
  renderStickyNotes(pageData);

  syncCanvasSize(pageData.ink);
}

function setActiveSection(sectionId) {
  const section = getSectionById(sectionId);
  if (!section) {
    return;
  }
  state.activeSectionId = sectionId;
  const fallback = findFirstPage(section);
  if (fallback) {
    state.activeSubsectionId = fallback.subsectionId;
    state.activePageId = fallback.page.id;
  } else {
    const newPage = createPage("Untitled page", "#f6f1ea", "");
    section.pages.push(newPage);
    state.activeSubsectionId = null;
    state.activePageId = newPage.id;
  }
  saveState();
  renderAll();
}

function setActiveSubsection(sectionId, subsectionId) {
  const section = getSectionById(sectionId);
  if (!section) {
    return;
  }
  const subsection = getSubsectionById(section, subsectionId);
  if (!subsection) {
    return;
  }
  state.activeSectionId = sectionId;
  state.activeSubsectionId = subsectionId;
  if (subsection.pages.length) {
    state.activePageId = subsection.pages[0].id;
  } else {
    const newPage = createPage("Untitled page", "#f6f1ea", "");
    subsection.pages.push(newPage);
    state.activePageId = newPage.id;
  }
  saveState();
  renderAll();
}

function setActivePage(sectionId, subsectionId, pageId) {
  state.activeSectionId = sectionId;
  state.activeSubsectionId = subsectionId || null;
  state.activePageId = pageId;
  saveState();
  renderAll();
}

function setupEvents() {
  addSectionButton.addEventListener("click", () => openEntryDialog("section"));
  addPageButton.addEventListener("click", () => openEntryDialog("page", state.activeSectionId, state.activeSubsectionId));
  entryCancel.addEventListener("click", () => entryDialog.close());
  confirmCancel.addEventListener("click", () => closeConfirm());
  confirmConfirm.addEventListener("click", () => {
    if (confirmAction) {
      confirmAction();
    }
  });
  confirmDialog.addEventListener("close", () => {
    confirmAction = null;
  });

  entryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (entryMode === "section") {
      createSectionFromDialog();
    } else if (entryMode === "subsection") {
      createSubsectionFromDialog();
    } else {
      createPageFromDialog();
    }
    entryDialog.close();
  });

  sectionColorInput.addEventListener("input", () => {
    const section = getActiveSection();
    if (!section) {
      return;
    }
    section.color = sectionColorInput.value;
    saveState();
    renderSidebar();
    renderWorkspace();
  });

  if (sectionBgSelect) {
    sectionBgSelect.addEventListener("change", () => {
      const section = getActiveSection();
      if (!section) {
        return;
      }
      if (sectionBgSelect.value === "__custom__") {
        if (sectionBgUpload) {
          sectionBgUpload.click();
        }
        sectionBgSelect.value = getSectionBackgroundSelectValue(section.backgroundImage);
        return;
      }
      section.backgroundImage = sectionBgSelect.value;
      saveState();
      renderWorkspace();
    });
  }

  if (sectionBgUpload) {
    sectionBgUpload.addEventListener("change", () => {
      const section = getActiveSection();
      if (!section) {
        return;
      }
      const file = sectionBgUpload.files && sectionBgUpload.files[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        section.backgroundImage = reader.result;
        saveState();
        renderWorkspace();
        sectionBgUpload.value = "";
      };
      reader.readAsDataURL(file);
    });
  }

  pageBgInput.addEventListener("input", () => {
    const pageData = getActivePage();
    if (!pageData) {
      return;
    }
    pageData.bgColor = pageBgInput.value;
    page.style.setProperty("--page-bg", pageData.bgColor);
    saveState();
  });

  pageTitleInput.addEventListener("input", () => {
    const pageData = getActivePage();
    if (!pageData) {
      return;
    }
    pageData.title = pageTitleInput.value.trim();
    workspacePage.textContent = pageData.title || "Untitled page";
    saveState();
    renderSidebar();
  });

  page.addEventListener("input", () => {
    if (suspendSave) {
      return;
    }
    const pageData = getActivePage();
    if (!pageData) {
      return;
    }
    pageData.content = page.innerHTML;
    saveState();
  });

  page.addEventListener("mouseup", saveSelection);
  page.addEventListener("keyup", saveSelection);
  page.addEventListener("touchend", saveSelection);
  page.addEventListener("paste", handlePaste);
  page.addEventListener("drop", handleDrop);
  page.addEventListener("dragover", (event) => event.preventDefault());
  page.addEventListener("click", handleImageTools);
  page.addEventListener("pointerdown", handleImagePointerDown);
  page.addEventListener("keydown", handlePageKeydown);

  const stickyHost = pageWrap || page;
  if (stickyHost) {
    stickyHost.addEventListener("pointerdown", handleStickyPointerDown);
    stickyHost.addEventListener("click", handleStickyClick);
    stickyHost.addEventListener("input", handleStickyInput);
    stickyHost.addEventListener("focusin", handleStickyFocusIn);
  }

  window.addEventListener("pointermove", handleGlobalPointerMove);
  window.addEventListener("pointerup", handleGlobalPointerUp);
  window.addEventListener("pointercancel", handleGlobalPointerUp);

  commandButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const command = button.dataset.command;
      if (command === "insertOrderedList") {
        handleOrderedListCommand(event);
        return;
      }
      page.focus();
      restoreSelection();
      document.execCommand(command, false, null);
      saveActiveContent();
    });
  });

  textColorInput.addEventListener("input", () => applyColor("foreColor", textColorInput.value));
  highlightColorInput.addEventListener("input", () => {
    applyColor("hiliteColor", highlightColorInput.value);
    applyColor("backColor", highlightColorInput.value);
  });

  if (fontSizeSelect) {
    fontSizeSelect.addEventListener("change", () => {
      applyFontSize(fontSizeSelect.value);
    });
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  clearInkButton.addEventListener("click", () => {
    clearCanvas();
    const pageData = getActivePage();
    if (pageData) {
      pageData.ink = "";
      saveState();
    }
  });

  addStickyButton.addEventListener("click", () => addStickyNote());
  emojiButton.addEventListener("click", (event) => {
    event.preventDefault();
    toggleEmojiPicker();
  });
  emojiPicker.addEventListener("click", handleEmojiPick);
  document.addEventListener("click", handleEmojiDismiss);

  canvas.addEventListener("pointerdown", startDraw);
  canvas.addEventListener("pointermove", moveDraw);
  canvas.addEventListener("pointerup", endDraw);
  canvas.addEventListener("pointerleave", endDraw);
  canvas.addEventListener("pointercancel", endDraw);

  toggleNavButton.addEventListener("click", () => {
    document.body.classList.toggle("nav-open");
  });

  document.addEventListener("click", (event) => {
    if (!document.body.classList.contains("nav-open")) {
      return;
    }
    const isSidebar = event.target.closest(".sidebar");
    const isToggle = event.target.closest("#toggle-nav");
    if (!isSidebar && !isToggle) {
      document.body.classList.remove("nav-open");
    }
  });

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const currentTheme = document.body.dataset.theme === "dark" ? "dark" : "light";
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      setTheme(nextTheme);
      localStorage.setItem(themeStorageKey, nextTheme);
    });
  }
}

function initTheme() {
  const stored = localStorage.getItem(themeStorageKey);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const nextTheme = stored || (prefersDark ? "dark" : "light");
  setTheme(nextTheme);
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  if (!themeToggle) {
    return;
  }
  const isDark = theme === "dark";
  const label = isDark ? "Light mode" : "Dark mode";
  themeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
  themeToggle.title = label;
  const labelNode = themeToggle.querySelector(".theme-text");
  if (labelNode) {
    labelNode.textContent = label;
  }
  const iconNode = themeToggle.querySelector(".btn-icon");
  if (iconNode) {
    iconNode.textContent = isDark ? "L" : "D";
  }
}

function openEntryDialog(mode, sectionId = null, subsectionId = null) {
  entryMode = mode;
  entrySectionId = sectionId;
  entrySubsectionId = subsectionId || null;
  entryForm.reset();

  if (mode === "section") {
    entryTitle.textContent = "New section";
    entryName.placeholder = "Section name";
    entryColorField.hidden = false;
    entryBgField.hidden = true;
    entryColor.value = sectionColorInput.value || "#5f7f74";
  } else if (mode === "subsection") {
    entryTitle.textContent = "New subsection";
    entryName.placeholder = "Subsection name";
    entryColorField.hidden = true;
    entryBgField.hidden = true;
    entrySubsectionId = null;
  } else {
    entryTitle.textContent = "New page";
    entryName.placeholder = "Page title";
    entryColorField.hidden = true;
    entryBgField.hidden = false;
    entryBg.value = pageBgInput.value || "#f6f1ea";
  }

  entryDialog.showModal();
  entryName.focus();
}

function createSectionFromDialog() {
  const name = entryName.value.trim() || "New section";
  const color = entryColor.value || "#5f7f74";
  const pageData = createPage("Untitled page", "#f6f1ea", "");
  const section = createSection(name, color, [pageData], []);
  state.sections.push(section);
  state.activeSectionId = section.id;
  state.activeSubsectionId = null;
  state.activePageId = pageData.id;
  saveState();
  renderAll();
}

function createSubsectionFromDialog() {
  const section = getSectionById(entrySectionId || state.activeSectionId);
  if (!section) {
    return;
  }
  const name = entryName.value.trim() || "New subsection";
  const pageData = createPage("Untitled page", pageBgInput.value || "#f6f1ea", "");
  const subsection = createSubsection(name, [pageData]);
  section.subsections.push(subsection);
  state.activeSectionId = section.id;
  state.activeSubsectionId = subsection.id;
  state.activePageId = pageData.id;
  saveState();
  renderAll();
}

function createPageFromDialog() {
  const title = entryName.value.trim() || "Untitled page";
  const bg = entryBg.value || "#f6f1ea";
  const pageData = createPage(title, bg, "");
  const section = getSectionById(entrySectionId || state.activeSectionId);
  if (!section) {
    return;
  }

  if (entrySubsectionId) {
    const subsection = getSubsectionById(section, entrySubsectionId);
    if (!subsection) {
      return;
    }
    subsection.pages.push(pageData);
    state.activeSubsectionId = subsection.id;
  } else {
    section.pages.push(pageData);
    state.activeSubsectionId = null;
  }

  state.activeSectionId = section.id;
  state.activePageId = pageData.id;
  saveState();
  renderAll();
}

function openConfirm(title, message, onConfirm, confirmLabel = "Delete") {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmConfirm.textContent = confirmLabel;
  confirmAction = () => {
    onConfirm();
    closeConfirm();
  };
  confirmDialog.showModal();
}

function closeConfirm() {
  confirmDialog.close();
  confirmAction = null;
}

function confirmDeleteSection(sectionId, name) {
  openConfirm(
    "Delete section",
    `Delete "${name || "this section"}" and all its pages and subsections?`,
    () => deleteSection(sectionId)
  );
}

function confirmDeleteSubsection(sectionId, subsectionId, name) {
  openConfirm(
    "Delete subsection",
    `Delete "${name || "this subsection"}" and all its pages?`,
    () => deleteSubsection(sectionId, subsectionId)
  );
}

function confirmDeletePage(sectionId, subsectionId, pageId, title) {
  openConfirm(
    "Delete page",
    `Delete "${title || "this page"}"?`,
    () => deletePage(sectionId, subsectionId, pageId)
  );
}

function deleteSection(sectionId) {
  const index = state.sections.findIndex((section) => section.id === sectionId);
  if (index === -1) {
    return;
  }
  state.sections.splice(index, 1);
  if (state.activeSectionId === sectionId) {
    state.activeSectionId = state.sections[0] ? state.sections[0].id : null;
    state.activeSubsectionId = null;
    state.activePageId = null;
  }
  ensureActiveSelection();
  saveState();
  renderAll();
}

function deleteSubsection(sectionId, subsectionId) {
  const section = getSectionById(sectionId);
  if (!section) {
    return;
  }
  const index = section.subsections.findIndex((subsection) => subsection.id === subsectionId);
  if (index === -1) {
    return;
  }
  section.subsections.splice(index, 1);
  if (state.activeSubsectionId === subsectionId) {
    state.activeSubsectionId = null;
    state.activePageId = null;
  }
  ensureActiveSelection();
  saveState();
  renderAll();
}

function deletePage(sectionId, subsectionId, pageId) {
  const section = getSectionById(sectionId);
  if (!section) {
    return;
  }
  const list = subsectionId
    ? getSubsectionById(section, subsectionId)?.pages
    : section.pages;
  if (!list) {
    return;
  }
  const index = list.findIndex((pageItem) => pageItem.id === pageId);
  if (index === -1) {
    return;
  }
  list.splice(index, 1);
  if (state.activePageId === pageId) {
    state.activePageId = null;
  }
  ensureActiveSelection();
  saveState();
  renderAll();
}

function saveSelection() {
  if (currentMode !== "write") {
    return;
  }
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }
  const range = selection.getRangeAt(0);
  if (!page.contains(range.commonAncestorContainer)) {
    return;
  }
  savedRange = range.cloneRange();
}

function restoreSelection() {
  if (!savedRange) {
    return;
  }
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  selection.removeAllRanges();
  try {
    selection.addRange(savedRange);
  } catch (error) {
    savedRange = null;
  }
}

function applyColor(command, color) {
  page.focus();
  restoreSelection();
  document.execCommand(command, false, color);
  saveActiveContent();
}

function applyFontSize(sizeValue) {
  if (currentMode !== "write") {
    return;
  }
  const size = Number(sizeValue);
  if (!size) {
    return;
  }
  page.focus();
  restoreSelection();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }
  const range = selection.getRangeAt(0);
  if (!page.contains(range.commonAncestorContainer)) {
    return;
  }
  const sizeLabel = `${size}px`;
  if (range.collapsed) {
    const span = document.createElement("span");
    span.style.fontSize = sizeLabel;
    const spacer = document.createTextNode("\u200b");
    span.appendChild(spacer);
    range.insertNode(span);
    range.setStart(spacer, 1);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    const span = document.createElement("span");
    span.style.fontSize = sizeLabel;
    try {
      range.surroundContents(span);
      selection.removeAllRanges();
      const nextRange = document.createRange();
      nextRange.selectNodeContents(span);
      nextRange.collapse(false);
      selection.addRange(nextRange);
    } catch (error) {
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
      selection.removeAllRanges();
      const nextRange = document.createRange();
      nextRange.selectNodeContents(span);
      nextRange.collapse(false);
      selection.addRange(nextRange);
    }
  }
  saveSelection();
  saveActiveContent();
}

function saveActiveContent() {
  const pageData = getActivePage();
  if (!pageData) {
    return;
  }
  pageData.content = page.innerHTML;
  saveState();
}

function setMode(mode) {
  currentMode = mode;
  document.body.dataset.mode = mode;
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  page.setAttribute("contenteditable", mode === "write" ? "true" : "false");
  closeEmojiPicker();
}

function startDraw(event) {
  if (!isDrawMode()) {
    return;
  }
  event.preventDefault();
  isDrawing = true;
  canvas.setPointerCapture(event.pointerId);
  lastPoint = getCanvasPoint(event);
  strokePoints = [lastPoint];
  const settings = getStrokeSettings(event);
  applyStrokeSettings(settings);
  ctx.beginPath();
  ctx.moveTo(lastPoint.x, lastPoint.y);
}

function moveDraw(event) {
  if (!isDrawing || !isDrawMode()) {
    return;
  }
  event.preventDefault();
  const events = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
  events.forEach((evt) => {
    const point = getCanvasPoint(evt);
    const settings = getStrokeSettings(evt);
    addStrokePoint(point, settings);
  });
}

function endDraw(event) {
  if (!isDrawing) {
    return;
  }
  event.preventDefault();
  isDrawing = false;
  lastPoint = null;
  strokePoints = [];
  ctx.closePath();
  storeInk();
}

function addStrokePoint(point, settings) {
  strokePoints.push(point);
  const length = strokePoints.length;
  if (length < 2) {
    return;
  }
  applyStrokeSettings(settings);
  if (length === 2) {
    const first = strokePoints[0];
    const second = strokePoints[1];
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    ctx.lineTo(second.x, second.y);
    ctx.stroke();
    lastPoint = second;
    return;
  }
  const p0 = strokePoints[length - 3];
  const p1 = strokePoints[length - 2];
  const p2 = strokePoints[length - 1];
  const m1 = midpoint(p0, p1);
  const m2 = midpoint(p1, p2);
  ctx.beginPath();
  ctx.moveTo(m1.x, m1.y);
  ctx.quadraticCurveTo(p1.x, p1.y, m2.x, m2.y);
  ctx.stroke();
  lastPoint = p2;
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function storeInk() {
  const pageData = getActivePage();
  if (!pageData) {
    return;
  }
  pageData.ink = canvas.toDataURL("image/png");
  saveState();
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function isDrawMode() {
  return currentMode === "draw" || currentMode === "erase";
}

function getStrokeSettings(event) {
  const size = Number(penSizeInput.value);
  const pressure = event && event.pressure ? Math.max(0.25, event.pressure) : 1;
  if (currentMode === "erase") {
    return {
      composite: "destination-out",
      color: "#000000",
      width: size * 2.4,
      alpha: 1
    };
  }
  return {
    composite: "source-over",
    color: penColorInput.value,
    width: size * (0.6 + pressure * 0.6),
    alpha: 1
  };
}

function applyStrokeSettings(settings) {
  ctx.globalCompositeOperation = settings.composite;
  ctx.strokeStyle = settings.color;
  ctx.lineWidth = settings.width;
  ctx.globalAlpha = settings.alpha;
}

function syncCanvasSize(inkData) {
  const rect = page.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.imageSmoothingEnabled = true;
  renderInk(inkData);
}

function renderInk(dataUrl) {
  clearCanvas();
  if (!dataUrl) {
    return;
  }
  const img = new Image();
  img.onload = () => {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rect = page.getBoundingClientRect();
    ctx.drawImage(img, 0, 0, rect.width, rect.height);
    ctx.restore();
  };
  img.src = dataUrl;
}

function clearCanvas() {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function observePageResize() {
  const observer = new ResizeObserver(() => {
    const pageData = getActivePage();
    syncCanvasSize(pageData ? pageData.ink : null);
    if (pageData) {
      renderStickyNotes(pageData);
    }
  });
  observer.observe(page);
}

function handlePaste(event) {
  if (currentMode !== "write") {
    return;
  }
  const items = event.clipboardData && event.clipboardData.items;
  if (!items) {
    return;
  }
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = () => {
        insertImage(reader.result);
        saveActiveContent();
      };
      reader.readAsDataURL(file);
      event.preventDefault();
      break;
    }
  }
}

function handleDrop(event) {
  if (currentMode !== "write") {
    return;
  }
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (!file || !file.type.startsWith("image/")) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    insertImage(reader.result, { x: event.clientX, y: event.clientY });
    saveActiveContent();
  };
  reader.readAsDataURL(file);
}

function insertImage(dataUrl, pointer = null) {
  const wrapper = buildImageWrapper(dataUrl, "Note image");
  page.appendChild(wrapper);
  const position = pointer
    ? getRelativePosition(pointer.x, pointer.y)
    : getSelectionPosition();
  setImagePosition(wrapper, position.x, position.y);
}

function buildImageWrapper(dataUrl, altText) {
  const wrapper = document.createElement("figure");
  wrapper.className = "note-image";
  wrapper.contentEditable = "false";
  wrapper.dataset.imageId = createId("image");
  wrapper.dataset.size = "320";
  wrapper.style.width = "320px";
  wrapper.style.left = "80px";
  wrapper.style.top = "120px";
  wrapper.tabIndex = 0;

  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = altText || "Note image";
  img.setAttribute("draggable", "false");

  const tools = document.createElement("div");
  tools.className = "image-tools";
  tools.innerHTML = `
    <button type="button" data-image-action="delete">x</button>
  `;

  wrapper.appendChild(img);
  wrapper.appendChild(tools);
  const resizeHandle = document.createElement("div");
  resizeHandle.className = "image-resize-handle";
  resizeHandle.dataset.imageAction = "resize";
  wrapper.appendChild(resizeHandle);
  return wrapper;
}

function handleImageTools(event) {
  const button = event.target.closest("[data-image-action]");
  if (!button) {
    return;
  }
  const wrapper = button.closest(".note-image");
  if (!wrapper) {
    return;
  }
  event.preventDefault();
  const action = button.dataset.imageAction;
  if (action !== "delete") {
    return;
  }
  wrapper.remove();
  saveActiveContent();
}

function handleImagePointerDown(event) {
  if (currentMode !== "write") {
    return;
  }
  const wrapper = event.target.closest(".note-image");
  if (!wrapper || event.target.closest(".image-tools")) {
    return;
  }
  if (event.target.closest(".image-resize-handle")) {
    startImageResize(event, wrapper);
    return;
  }
  if (!wrapper.dataset.imageId) {
    wrapper.dataset.imageId = createId("image");
  }
  event.preventDefault();
  const rect = wrapper.getBoundingClientRect();
  imageDragState = {
    id: wrapper.dataset.imageId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top
  };
  wrapper.classList.add("is-dragging");
}

function handlePageKeydown(event) {
  if (currentMode !== "write" || event.key !== "Tab") {
    return;
  }
  event.preventDefault();
  page.focus();
  restoreSelection();
  if (event.shiftKey) {
    document.execCommand("outdent", false, null);
  } else {
    document.execCommand("indent", false, null);
  }
  saveActiveContent();
}

function handleOrderedListCommand(event) {
  page.focus();
  restoreSelection();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }
  const range = selection.getRangeAt(0);
  const listItem = getClosestElement(range.startContainer, "li");
  if (listItem) {
    document.execCommand("insertOrderedList", false, null);
    saveActiveContent();
    return;
  }
  const targetDepth = getIndentDepth(range.startContainer) + 1;
  const previous = !event.shiftKey ? getPreviousOrderedList(range, targetDepth) : null;

  document.execCommand("insertOrderedList", false, null);

  if (previous) {
    const newList = getClosestElement(selection.anchorNode, "ol");
    if (newList && newList !== previous) {
      const prevStart = Number.parseInt(previous.getAttribute("start"), 10) || 1;
      const prevCount = previous.querySelectorAll(":scope > li").length;
      newList.setAttribute("start", String(prevStart + prevCount));
    }
  }

  saveActiveContent();
}

function getClosestElement(node, selector) {
  if (!node) {
    return null;
  }
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!element) {
    return null;
  }
  return element.closest(selector);
}

function getPreviousOrderedList(range, targetDepth) {
  const lists = Array.from(page.querySelectorAll("ol"));
  let candidate = null;
  lists.forEach((list) => {
    if (list.contains(range.startContainer)) {
      return;
    }
    const listDepth = getIndentDepth(list);
    if (listDepth !== targetDepth) {
      return;
    }
    const listRange = document.createRange();
    listRange.selectNode(list);
    if (listRange.compareBoundaryPoints(Range.END_TO_START, range) <= 0) {
      candidate = list;
    }
  });
  return candidate;
}

function getIndentDepth(node) {
  let current = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  let depth = 0;
  while (current && current !== page) {
    const tag = current.tagName;
    if (tag === "OL" || tag === "UL" || tag === "BLOCKQUOTE") {
      depth += 1;
    }
    current = current.parentElement;
  }
  return depth;
}

function startImageResize(event, wrapper) {
  event.preventDefault();
  if (!wrapper.dataset.imageId) {
    wrapper.dataset.imageId = createId("image");
  }
  const rect = wrapper.getBoundingClientRect();
  imageResizeState = {
    id: wrapper.dataset.imageId,
    startWidth: rect.width,
    startLeft: wrapper.offsetLeft,
    startTop: wrapper.offsetTop,
    startX: event.clientX,
    startY: event.clientY
  };
  wrapper.classList.add("is-resizing");
}

function handleGlobalPointerMove(event) {
  if (imageResizeState) {
    const wrapper = page.querySelector(`[data-image-id="${imageResizeState.id}"]`);
    if (!wrapper) {
      return;
    }
    const pageRect = page.getBoundingClientRect();
    const deltaX = event.clientX - imageResizeState.startX;
    let nextWidth = imageResizeState.startWidth + deltaX;
    const anchorLeft = Number.isFinite(imageResizeState.startLeft)
      ? imageResizeState.startLeft
      : wrapper.offsetLeft;
    const anchorTop = Number.isFinite(imageResizeState.startTop)
      ? imageResizeState.startTop
      : wrapper.offsetTop;
    const maxWidth = Math.max(160, pageRect.width - anchorLeft);
    nextWidth = Math.min(900, Math.max(160, Math.min(nextWidth, maxWidth)));
    wrapper.dataset.size = String(Math.round(nextWidth));
    wrapper.style.width = `${Math.round(nextWidth)}px`;
    wrapper.style.left = `${anchorLeft}px`;
    wrapper.style.top = `${anchorTop}px`;
    return;
  }
  if (imageDragState) {
    const wrapper = page.querySelector(`[data-image-id="${imageDragState.id}"]`);
    if (!wrapper) {
      return;
    }
    const pageRect = page.getBoundingClientRect();
    const x = event.clientX - pageRect.left - imageDragState.offsetX;
    const y = event.clientY - pageRect.top - imageDragState.offsetY;
    setImagePosition(wrapper, x, y);
    return;
  }
  if (stickyDragState) {
    const note = pageWrap?.querySelector(`[data-sticky-id="${stickyDragState.id}"]`);
    if (!note) {
      return;
    }
    const pageRect = page.getBoundingClientRect();
    const x = event.clientX - pageRect.left - stickyDragState.offsetX;
    const y = event.clientY - pageRect.top - stickyDragState.offsetY;
    setStickyPosition(note, x, y);
  }
}

function handleGlobalPointerUp() {
  if (imageResizeState) {
    const wrapper = page.querySelector(`[data-image-id="${imageResizeState.id}"]`);
    if (wrapper) {
      wrapper.classList.remove("is-resizing");
    }
    imageResizeState = null;
    saveActiveContent();
  }
  if (imageDragState) {
    const wrapper = page.querySelector(`[data-image-id="${imageDragState.id}"]`);
    if (wrapper) {
      wrapper.classList.remove("is-dragging");
    }
    imageDragState = null;
    saveActiveContent();
  }
  if (stickyDragState) {
    const note = pageWrap?.querySelector(`[data-sticky-id="${stickyDragState.id}"]`);
    if (note) {
      note.classList.remove("is-dragging");
    }
    updateStickyPosition(stickyDragState.id);
    stickyDragState = null;
    saveState();
    renderStickyNotes(getActivePage());
  }
}

function getSelectionPosition() {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect && rect.width + rect.height > 0) {
      const pageRect = page.getBoundingClientRect();
      return {
        x: rect.left - pageRect.left,
        y: rect.top - pageRect.top
      };
    }
  }
  const pageRect = page.getBoundingClientRect();
  return {
    x: pageRect.width * 0.5 - 160,
    y: pageRect.height * 0.2
  };
}

function getRelativePosition(clientX, clientY) {
  const pageRect = page.getBoundingClientRect();
  return {
    x: clientX - pageRect.left,
    y: clientY - pageRect.top
  };
}

function setImagePosition(wrapper, x, y) {
  const pageRect = page.getBoundingClientRect();
  const maxX = Math.max(0, pageRect.width - wrapper.offsetWidth);
  const maxY = Math.max(0, pageRect.height - wrapper.offsetHeight);
  const clampedX = Math.min(maxX, Math.max(0, x));
  const clampedY = Math.min(maxY, Math.max(0, y));
  wrapper.style.left = `${clampedX}px`;
  wrapper.style.top = `${clampedY}px`;
}

function addStickyNote() {
  const pageData = getActivePage();
  if (!pageData) {
    return;
  }
  if (!Array.isArray(pageData.stickyNotes)) {
    pageData.stickyNotes = [];
  }
  const note = createStickyNoteData(pageData.stickyNotes.length);
  pageData.stickyNotes.push(note);
  activeStickyId = note.id;
  saveState();
  renderStickyNotes(pageData);
  const textarea = pageWrap?.querySelector(`[data-sticky-id="${note.id}"] .sticky-body`);
  if (textarea) {
    textarea.focus();
  }
}

function createStickyNoteData(index) {
  const pageRect = page.getBoundingClientRect();
  const baseX = Math.max(20, pageRect.width - 260);
  const baseY = 60 + index * 20;
  return {
    id: createId("sticky"),
    text: "",
    color: stickyPalette[index % stickyPalette.length],
    textColor: "#1f2a33",
    emoji: "📝",
    x: baseX,
    y: baseY
  };
}

function renderStickyNotes(pageData) {
  if (!pageWrap || !pageData) {
    return;
  }
  pageWrap.querySelectorAll(".sticky-note").forEach((note) => note.remove());
  if (!Array.isArray(pageData.stickyNotes)) {
    pageData.stickyNotes = [];
    saveState();
  }
  const notes = pageData.stickyNotes;
  notes.forEach((note) => {
    const element = buildStickyNoteElement(note);
    pageWrap.appendChild(element);
    setStickyPosition(element, note.x, note.y);
  });
}

function buildStickyNoteElement(note) {
  const wrapper = document.createElement("div");
  wrapper.className = "sticky-note";
  wrapper.dataset.stickyId = note.id;
  wrapper.style.left = `${note.x}px`;
  wrapper.style.top = `${note.y}px`;
  wrapper.style.background = note.color || stickyPalette[0];
  wrapper.contentEditable = "false";

  const header = document.createElement("div");
  header.className = "sticky-note-header";

  const emojiButton = document.createElement("button");
  emojiButton.type = "button";
  emojiButton.className = "sticky-emoji";
  emojiButton.dataset.stickyAction = "emoji";
  emojiButton.textContent = note.emoji || "📝";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "sticky-delete";
  deleteButton.dataset.stickyAction = "delete";
  deleteButton.textContent = "x";

  header.appendChild(emojiButton);
  header.appendChild(deleteButton);

  const colorRow = document.createElement("div");
  colorRow.className = "sticky-colors";

  const bgColor = document.createElement("input");
  bgColor.type = "color";
  bgColor.className = "sticky-color";
  bgColor.value = note.color || stickyPalette[0];
  bgColor.dataset.stickyField = "color";

  const textColor = document.createElement("input");
  textColor.type = "color";
  textColor.className = "sticky-color";
  textColor.value = note.textColor || "#1f2a33";
  textColor.dataset.stickyField = "textColor";

  colorRow.appendChild(bgColor);
  colorRow.appendChild(textColor);

  const body = document.createElement("textarea");
  body.className = "sticky-body";
  body.placeholder = "Sticky note";
  body.value = note.text || "";
  body.spellcheck = false;
  body.style.color = note.textColor || "#1f2a33";

  wrapper.appendChild(header);
  wrapper.appendChild(colorRow);
  wrapper.appendChild(body);
  return wrapper;
}

function handleStickyPointerDown(event) {
  if (currentMode !== "write") {
    return;
  }
  const note = event.target.closest(".sticky-note");
  if (!note || !event.target.closest(".sticky-note-header") || event.target.closest("button")) {
    return;
  }
  event.preventDefault();
  const rect = note.getBoundingClientRect();
  stickyDragState = {
    id: note.dataset.stickyId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top
  };
  activeStickyId = note.dataset.stickyId;
  note.classList.add("is-dragging");
}

function handleStickyClick(event) {
  const actionButton = event.target.closest("[data-sticky-action]");
  if (!actionButton) {
    return;
  }
  const note = actionButton.closest(".sticky-note");
  if (!note) {
    return;
  }
  event.preventDefault();
  const noteId = note.dataset.stickyId;
  const action = actionButton.dataset.stickyAction;
  if (action === "delete") {
    deleteStickyNote(noteId);
    return;
  }
  if (action === "emoji") {
    activeStickyId = noteId;
    emojiTarget = "sticky";
    openEmojiPicker(actionButton);
  }
}

function handleStickyInput(event) {
  const note = event.target.closest(".sticky-note");
  if (!note) {
    return;
  }
  const pageData = getActivePage();
  if (!pageData) {
    return;
  }
  const noteData = pageData.stickyNotes.find((item) => item.id === note.dataset.stickyId);
  if (!noteData) {
    return;
  }

  const colorInput = event.target.closest(".sticky-color");
  if (colorInput) {
    const field = colorInput.dataset.stickyField;
    if (field === "color") {
      noteData.color = colorInput.value;
      note.style.background = colorInput.value;
    } else if (field === "textColor") {
      noteData.textColor = colorInput.value;
      const body = note.querySelector(".sticky-body");
      if (body) {
        body.style.color = colorInput.value;
      }
    }
    saveState();
    return;
  }

  const textarea = event.target.closest(".sticky-body");
  if (!textarea) {
    return;
  }
  noteData.text = textarea.value;
  saveState();
}

function handleStickyFocusIn(event) {
  const note = event.target.closest(".sticky-note");
  if (note) {
    activeStickyId = note.dataset.stickyId;
  }
}

function deleteStickyNote(noteId) {
  const pageData = getActivePage();
  if (!pageData || !Array.isArray(pageData.stickyNotes)) {
    return;
  }
  pageData.stickyNotes = pageData.stickyNotes.filter((note) => note.id !== noteId);
  if (activeStickyId === noteId) {
    activeStickyId = null;
  }
  saveState();
  renderStickyNotes(pageData);
}

function updateStickyPosition(noteId) {
  const noteEl = pageWrap?.querySelector(`[data-sticky-id="${noteId}"]`);
  const pageData = getActivePage();
  if (!noteEl || !pageData || !Array.isArray(pageData.stickyNotes)) {
    return;
  }
  const noteData = pageData.stickyNotes.find((note) => note.id === noteId);
  if (!noteData) {
    return;
  }
  noteData.x = parseFloat(noteEl.style.left) || 0;
  noteData.y = parseFloat(noteEl.style.top) || 0;
}

function setStickyPosition(noteEl, x, y) {
  const pageRect = page.getBoundingClientRect();
  const maxX = Math.max(0, pageRect.width - noteEl.offsetWidth);
  const maxY = Math.max(0, pageRect.height - noteEl.offsetHeight);
  const clampedX = Math.min(maxX, Math.max(0, x));
  const clampedY = Math.min(maxY, Math.max(0, y));
  noteEl.style.left = `${clampedX}px`;
  noteEl.style.top = `${clampedY}px`;
}

function renderEmojiPicker() {
  if (!emojiPicker) {
    return;
  }
  emojiPicker.innerHTML = "";
  emojiList.forEach((emoji) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "emoji-option";
    button.dataset.emoji = emoji;
    button.textContent = emoji;
    emojiPicker.appendChild(button);
  });
}

function toggleEmojiPicker() {
  if (!emojiPicker) {
    return;
  }
  if (!emojiPicker.hidden) {
    closeEmojiPicker();
    return;
  }
  emojiTarget = "page";
  activeStickyId = null;
  openEmojiPicker(emojiButton);
}

function openEmojiPicker(anchor) {
  if (!emojiPicker || !anchor) {
    return;
  }
  const rect = anchor.getBoundingClientRect();
  emojiPicker.hidden = false;
  const pickerRect = emojiPicker.getBoundingClientRect();
  const left = Math.min(window.innerWidth - pickerRect.width - 12, Math.max(12, rect.left));
  const top = Math.min(window.innerHeight - pickerRect.height - 12, rect.bottom + 10);
  emojiPicker.style.left = `${left}px`;
  emojiPicker.style.top = `${top}px`;
}

function closeEmojiPicker() {
  if (!emojiPicker) {
    return;
  }
  emojiPicker.hidden = true;
}

function handleEmojiPick(event) {
  const button = event.target.closest("[data-emoji]");
  if (!button) {
    return;
  }
  const emoji = button.dataset.emoji;
  if (emojiTarget === "sticky" && activeStickyId) {
    const pageData = getActivePage();
    if (pageData) {
      const note = pageData.stickyNotes.find((item) => item.id === activeStickyId);
      if (note) {
        note.emoji = emoji;
        saveState();
        renderStickyNotes(pageData);
      }
    }
  } else {
    insertEmojiIntoPage(emoji);
  }
  emojiTarget = "page";
  activeStickyId = null;
  closeEmojiPicker();
}

function handleEmojiDismiss(event) {
  if (!emojiPicker || emojiPicker.hidden) {
    return;
  }
  if (
    event.target.closest("#emoji-picker") ||
    event.target.closest("#emoji-button") ||
    event.target.closest("[data-sticky-action=\"emoji\"]")
  ) {
    return;
  }
  closeEmojiPicker();
}

function insertEmojiIntoPage(emoji) {
  if (currentMode !== "write") {
    return;
  }
  page.focus();
  const inserted = document.execCommand("insertText", false, emoji);
  if (!inserted) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(emoji);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      page.appendChild(document.createTextNode(emoji));
    }
  }
  saveActiveContent();
}

function loadSoundscapeState() {
  try {
    const stored = JSON.parse(localStorage.getItem(soundscapeStorageKey));
    return stored && typeof stored === "object" ? stored : {};
  } catch (error) {
    return {};
  }
}

function persistSoundscapeState() {
  if (!soundscapeReady || !soundscapeAllowPersist || !soundCards.length) {
    return;
  }
  const nextState = {};
  soundCards.forEach((card) => {
    const soundId = card.dataset.sound;
    if (!soundId) {
      return;
    }
    const audio = document.getElementById(`audio-${soundId}`);
    if (!audio) {
      return;
    }
    const volumeInput = card.querySelector(".sound-volume");
    const volumeValue = volumeInput ? Number(volumeInput.value) : audio.volume;
    const shouldResume = pendingSoundResume.includes(audio);
    nextState[soundId] = {
      playing: shouldResume || !audio.paused,
      volume: Number.isFinite(volumeValue) ? volumeValue : audio.volume
    };
  });
  localStorage.setItem(soundscapeStorageKey, JSON.stringify(nextState));
}

function applySoundscapeState() {
  const stored = loadSoundscapeState();
  const resume = [];
  soundCards.forEach((card) => {
    const soundId = card.dataset.sound;
    if (!soundId) {
      return;
    }
    const audio = document.getElementById(`audio-${soundId}`);
    if (!audio) {
      return;
    }
    const volumeInput = card.querySelector(".sound-volume");
    const toggle = card.querySelector("[data-sound-action=\"toggle\"]");
    const status = card.querySelector(".sound-status");
    const trackState = stored[soundId];
    if (trackState && typeof trackState.volume === "number") {
      const volume = Math.min(1, Math.max(0, trackState.volume));
      audio.volume = volume;
      if (volumeInput) {
        volumeInput.value = String(volume);
      }
    }
    if (trackState && trackState.playing) {
      resume.push(audio);
    }
    updateSoundCardState(card, audio, status, toggle);
  });
  if (resume.length) {
    resumeSoundscapePlayback(resume);
    queueSoundscapeResume(resume);
  }
}

function resumeSoundscapePlayback(audios) {
  audios.forEach((audio) => {
    if (!audio || !audio.paused) {
      return;
    }
    audio.play().catch(() => {});
  });
}

function queueSoundscapeResume(audios) {
  pendingSoundResume = audios.filter(Boolean);
  if (!pendingSoundResume.length || soundResumeHandler) {
    return;
  }
  soundResumeHandler = () => {
    const resume = pendingSoundResume;
    pendingSoundResume = [];
    resumeSoundscapePlayback(resume);
    document.removeEventListener("pointerdown", soundResumeHandler);
    document.removeEventListener("keydown", soundResumeHandler);
    soundResumeHandler = null;
  };
  document.addEventListener("pointerdown", soundResumeHandler, { passive: true });
  document.addEventListener("keydown", soundResumeHandler);
}

function setupSoundscape() {
  if (!soundscape || !soundCards.length) {
    return;
  }
  soundCards.forEach((card) => {
    const soundId = card.dataset.sound;
    if (!soundId) {
      return;
    }
    const audio = document.getElementById(`audio-${soundId}`);
    const toggle = card.querySelector("[data-sound-action=\"toggle\"]");
    const fileInput = card.querySelector(".sound-file-input");
    const volumeInput = card.querySelector(".sound-volume");
    const status = card.querySelector(".sound-status");

    if (!audio) {
      return;
    }
    audio.loop = true;

    if (volumeInput) {
      audio.volume = Number(volumeInput.value) || 0.4;
      volumeInput.addEventListener("input", () => {
        soundscapeAllowPersist = true;
        audio.volume = Number(volumeInput.value) || 0;
        updateSoundCardState(card, audio, status, toggle);
      });
    }

    if (fileInput) {
      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
          return;
        }
        if (audio.dataset.objectUrl) {
          URL.revokeObjectURL(audio.dataset.objectUrl);
        }
        const url = URL.createObjectURL(file);
        audio.dataset.objectUrl = url;
        audio.src = url;
        audio.load();
        updateSoundCardState(card, audio, status, toggle);
      });
    }

    if (toggle) {
      toggle.addEventListener("click", () => {
        if (!audio.src) {
          if (fileInput) {
            fileInput.click();
          }
          return;
        }
        soundscapeAllowPersist = true;
        if (audio.paused) {
          audio.play().catch(() => {});
        } else {
          audio.pause();
        }
      });
    }

    audio.addEventListener("play", () => {
      soundscapeAllowPersist = true;
      updateSoundCardState(card, audio, status, toggle);
    });
    audio.addEventListener("pause", () => {
      updateSoundCardState(card, audio, status, toggle);
    });
    audio.addEventListener("loadeddata", () => {
      updateSoundCardState(card, audio, status, toggle);
    });

    updateSoundCardState(card, audio, status, toggle);
  });
  applySoundscapeState();
  soundscapeReady = true;
}

function updateSoundCardState(card, audio, status, toggle) {
  const hasSource = Boolean(audio && audio.src);
  const isPlaying = Boolean(audio && !audio.paused);
  card.classList.toggle("is-playing", isPlaying);
  if (toggle) {
    toggle.classList.toggle("is-playing", isPlaying);
    toggle.textContent = !hasSource ? "Load" : isPlaying ? "Pause" : "Play";
  }
  if (status) {
    if (!hasSource) {
      status.textContent = "No audio loaded";
    } else {
      status.textContent = isPlaying ? "Playing" : "Paused";
    }
  }
  persistSoundscapeState();
}

function normalizeImages() {
  const images = Array.from(page.querySelectorAll("img"));
  let changed = false;
  images.forEach((img, index) => {
    if (img.closest(".note-image")) {
      return;
    }
    const wrapper = buildImageWrapper(img.src, img.alt);
    page.appendChild(wrapper);
    setImagePosition(wrapper, 60 + index * 30, 80 + index * 30);
    img.remove();
    changed = true;
  });

  const wrappers = Array.from(page.querySelectorAll(".note-image"));
  wrappers.forEach((wrapper, index) => {
    wrapper.contentEditable = "false";
    wrapper.tabIndex = 0;
    wrapper.style.margin = "0";
    if (!wrapper.dataset.imageId) {
      wrapper.dataset.imageId = createId("image");
    }
    if (!wrapper.style.width) {
      wrapper.style.width = "320px";
      wrapper.dataset.size = wrapper.dataset.size || "320";
    }
    if (!wrapper.style.left || !wrapper.style.top) {
      setImagePosition(wrapper, 80 + index * 20, 120 + index * 20);
      changed = true;
    }
    const image = wrapper.querySelector("img");
    if (image) {
      image.setAttribute("draggable", "false");
    }
    const tools = wrapper.querySelector(".image-tools");
    if (tools) {
      tools.innerHTML = `<button type="button" data-image-action="delete">x</button>`;
    } else {
      const nextTools = document.createElement("div");
      nextTools.className = "image-tools";
      nextTools.innerHTML = `<button type="button" data-image-action="delete">x</button>`;
      wrapper.appendChild(nextTools);
    }
    if (!wrapper.querySelector(".image-resize-handle")) {
      const resizeHandle = document.createElement("div");
      resizeHandle.className = "image-resize-handle";
      resizeHandle.dataset.imageAction = "resize";
      wrapper.appendChild(resizeHandle);
    }
  });
  return changed;
}
