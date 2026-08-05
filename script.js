// ==================== CONFIGURAÇÃO FIREBASE ====================
const firebaseConfig = {
  apiKey: "AIzaSyBc3ryOJEFBQlJIUpy835Anej0OulZqHEQ",
  authDomain: "linksdrive-4012c.firebaseapp.com",
  projectId: "linksdrive-4012c",
  storageBucket: "linksdrive-4012c.firebasestorage.app",
  messagingSenderId: "91948654259",
  appId: "1:91948654259:web:2b596baed6d1ab78cc5ac6",
  measurementId: "G-V1EZDLJQ2K"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let linksRef = db.collection("links");
let notesRef = db.collection("notes");
let foldersRef = db.collection("folders");

function setCollectionRefs(uid) {
  if (uid) {
    linksRef = db.collection("users").doc(uid).collection("links");
    notesRef = db.collection("users").doc(uid).collection("notes");
    foldersRef = db.collection("folders");
  }
}

db.enablePersistence({ synchronizeTabs: true })
  .catch(err => {
    if (err.code === 'failed-precondition') {
      console.warn('Cache offline desativado: múltiplas abas abertas.');
    } else if (err.code === 'unimplemented') {
      console.warn('Cache offline não suportado neste navegador.');
    }
  });

// ==================== CACHE KEYS (localStorage) ====================
const CACHE_KEYS = {
  links: "cache_links_v1",
  notes: "cache_notes_v1",
  folders: "cache_folders_v1",
  linkSize: "linkCardSize",
  groupSize: "groupCardSize",
  theme: "dashboardTheme",
};

function cacheWrite(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("Cache localStorage cheio, ignorando:", e.message);
  }
}

function cacheRead(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// ==================== ESTADO GLOBAL ====================
const state = {
  allLinks: cacheRead(CACHE_KEYS.links) || [],
  allNotes: cacheRead(CACHE_KEYS.notes) || [],
  allFolders: cacheRead(CACHE_KEYS.folders) || [],
  activeCategory: "Todos",
  searchTerm: "",
  activeView: "groups",
  activeGroup: null,
  sortValue: "manual",
  isNotesView: false,
  activeFolder: "Todas",
  linkSize: localStorage.getItem(CACHE_KEYS.linkSize) || "small",
  groupSize: localStorage.getItem(CACHE_KEYS.groupSize) || "small",
  firestoreReady: false,
  user: null
};

function renderAll() {
  if (state.activeView === 'groups') {
    renderGroups();
  } else if (state.activeView === 'notes') {
    renderNotes();
  } else {
    renderCategories();
    renderLinks();
  }
}

function setAllLinks(links) {
  state.allLinks = links;
  cacheWrite(CACHE_KEYS.links, links);
  updateLinkBackupMeta();
}

function setAllNotes(notes) {
  state.allNotes = notes;
  cacheWrite(CACHE_KEYS.notes, notes);
}

// ==================== UTILITÁRIOS DE DOMÍNIO E FAVICON ====================
function getMainDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');
    if (parts.length > 2 && !hostname.endsWith('.gov.br') && !hostname.endsWith('.com.br')) {
      return parts.slice(-2).join('.');
    }
    return hostname;
  } catch (e) {
    return 'google.com';
  }
}

// ==================== BADGE ONLINE/OFFLINE ====================
function setBadge(online) {
  const badge = document.getElementById("offlineBadge");
  const label = document.getElementById("offlineLabel");
  if (!badge || !label) return;
  badge.classList.add("visible");
  if (online) {
    badge.classList.add("online");
    label.textContent = "Sincronizado";
    setTimeout(() => badge.classList.remove("visible"), 3000);
  } else {
    badge.classList.remove("online");
    label.textContent = "Cache local";
  }
}

// ==================== TOAST ====================
function showToast(message, type = "success") {
  const container = document.getElementById("toastWrap");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "err" : "ok"}`;
  const icon = type === "error" ? "fa-circle-exclamation" : "fa-check-circle";
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "fadeOut 0.3s ease-out forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m =>
    m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;'
  );
}

function getColorCode(colorNum) {
  const colors = { 1: '#FFE4E0', 2: '#E0F2FE', 3: '#E0F2E9', 4: '#FFF3E0', 5: '#F3E8FF', 6: '#FFE4F0' };
  return colors[colorNum] || '#FFE4E0';
}

// ==================== BACKUP E IMPORTAÇÃO/EXPORTAÇÃO ====================
const BACKUP_META_KEY = "links_backup_meta";

function updateLinkBackupMeta() {
  const existing = cacheRead(BACKUP_META_KEY) || {};
  cacheWrite(BACKUP_META_KEY, {
    ...existing,
    count: state.allLinks.length,
    lastAutoSave: new Date().toISOString(),
  });
  refreshBackupBtnLabel();
}

function refreshBackupBtnLabel() {
  const btn = document.getElementById("exportLinksBtn");
  if (!btn) return;
  const meta = cacheRead(BACKUP_META_KEY);
  if (meta && meta.count > 0) {
    btn.title = `Último auto-save: ${new Date(meta.lastAutoSave).toLocaleString()}\n${meta.count} links`;
  }
}

function exportLinksAsJSON() {
  if (state.allLinks.length === 0) {
    showToast("Nenhum link para exportar.", "error");
    return;
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);

  const jsonData = state.allLinks.map(l => ({
    title: l.title,
    url: l.url,
    category: l.category,
  }));
  downloadBlob(
    JSON.stringify(jsonData, null, 2),
    `links_backup_${dateStr}.json`,
    "application/json"
  );

  const byCategory = {};
  state.allLinks.forEach(l => {
    if (!byCategory[l.category]) byCategory[l.category] = [];
    byCategory[l.category].push(l);
  });

  const categories = Object.keys(byCategory).sort();
  let txt = `MyDashboard — Backup de Links\nGerado em: ${now.toLocaleString()}\nTotal: ${state.allLinks.length} links\n`;
  txt += "=".repeat(50) + "\n\n";

  categories.forEach(cat => {
    txt += `\n[${cat}]\n`;
    byCategory[cat]
      .sort((a, b) => a.title.localeCompare(b.title))
      .forEach(l => {
        txt += `  ${l.title}\n  ${l.url}\n\n`;
      });
  });

  setTimeout(() => {
    downloadBlob(txt, `links_backup_${dateStr}.txt`, "text/plain");
  }, 300);

  showToast(`${state.allLinks.length} links exportados (JSON + TXT)!`, "success");
}

function parseLinksTxt(txtContent) {
  const lines = txtContent.split('\n');
  const links = [];
  let currentCategory = "Geral";
  let currentTitle = "";

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("MyDashboard") || line.startsWith("Gerado em") || line.startsWith("Total") || line.startsWith("===")) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      currentCategory = line.slice(1, -1);
      continue;
    }
    if (line.startsWith("http://") || line.startsWith("https://")) {
      if (currentTitle) {
        links.push({ title: currentTitle, url: line, category: currentCategory });
        currentTitle = "";
      }
    } else {
      currentTitle = line;
    }
  }
  return links;
}

async function handleLinkFileImport(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      let linksArray = [];
      const content = e.target.result;
      if (file.name.endsWith('.json')) {
        linksArray = JSON.parse(content);
      } else {
        linksArray = parseLinksTxt(content);
      }

      let salvos = 0, ignorados = 0;
      for (const link of linksArray) {
        if (!link.url) continue;
        const normUrl = link.url.trim().toLowerCase();
        if (state.allLinks.some(l => l.url && l.url.trim().toLowerCase() === normUrl)) {
          ignorados++;
          continue;
        }
        await addLink({
          title: link.title || "Sem Título",
          url: link.url,
          category: link.category || "Geral"
        });
        salvos++;
      }
      showToast(`Importação de links: ${salvos} salvos (${ignorados} duplicados ignorados).`, "success");
    } catch (err) {
      console.error(err);
      showToast("Erro ao processar o arquivo de links.", "error");
    }
  };
  reader.readAsText(file);
}

function exportNotesAsJSON() {
  if (state.allNotes.length === 0) {
    showToast("Nenhuma nota para exportar.", "error");
    return;
  }
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const data = {
    folders: state.allFolders,
    notes: state.allNotes.map(n => ({
      title: n.title || "",
      content: n.content || "",
      color: n.color || 1,
      folder: n.folder || "Geral",
      order: n.order || 0
    }))
  };
  downloadBlob(JSON.stringify(data, null, 2), `notas_backup_${dateStr}.json`, "application/json");
  showToast(`${state.allNotes.length} notas exportadas com sucesso!`, "success");
}

async function handleNoteFileImport(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const notesArray = data.notes || (Array.isArray(data) ? data : []);
      const foldersArray = data.folders || [];

      for (const f of foldersArray) {
        if (f && f !== "Geral" && !state.allFolders.includes(f)) {
          await addFolder(f);
        }
      }

      let salvos = 0, ignorados = 0;
      for (const n of notesArray) {
        if (state.allNotes.some(ex => ex.title === n.title && ex.content === n.content)) {
          ignorados++;
          continue;
        }
        await notesRef.add({
          title: n.title || "",
          content: n.content || "",
          color: n.color || 1,
          folder: n.folder || "Geral",
          order: state.allNotes.length + salvos,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        salvos++;
      }
      showToast(`Notas importadas: ${salvos} salvas (${ignorados} duplicadas ignoradas).`, "success");
    } catch (err) {
      console.error(err);
      showToast("Erro ao importar arquivo de notas.", "error");
    }
  };
  reader.readAsText(file);
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType + ";charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ==================== TAMANHO DOS CARDS ====================
const LINK_SIZE_LABELS = {
  small: { label: "S", title: "Pequeno" },
  medium: { label: "M", title: "Médio" },
  large: { label: "G", title: "Grande" }
};
const LINK_SIZE_ORDER = ["small", "medium", "large"];

function applyLinkSize() {
  const grid = document.getElementById("linksGrid");
  if (grid) {
    grid.classList.remove("size-small", "size-medium", "size-large");
    grid.classList.add(`size-${state.linkSize}`);
  }
  const btn = document.getElementById("linkSizeBtn");
  if (btn) {
    const info = LINK_SIZE_LABELS[state.linkSize];
    btn.title = `Tamanho: ${info.title}`;
    btn.innerHTML = `<i class="fa-solid fa-expand-alt"></i><span>${info.label}</span>`;
  }
}

function cycleLinkSize() {
  const idx = LINK_SIZE_ORDER.indexOf(state.linkSize);
  state.linkSize = LINK_SIZE_ORDER[(idx + 1) % LINK_SIZE_ORDER.length];
  localStorage.setItem(CACHE_KEYS.linkSize, state.linkSize);
  applyLinkSize();
  showToast(`Cards: ${LINK_SIZE_LABELS[state.linkSize].title}`, "success");
}

// ==================== LINKS ====================
function subscribeLinks() {
  return linksRef.orderBy("category").onSnapshot(
    { includeMetadataChanges: false },
    (snapshot) => {
      const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllLinks(links);
      state.firestoreReady = true;
      setBadge(true);
      renderAll();
    },
    (error) => {
      console.error("Erro no Firebase:", error);
      if (state.allLinks.length > 0) {
        setBadge(false);
        showToast("Usando dados do cache local.", "error");
      } else {
        showToast("Erro ao conectar com o banco de dados.", "error");
      }
    }
  );
}

async function addLink(linkData) {
  try {
    await linksRef.add({ ...linkData, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
    showToast("Link salvo!");
  } catch (error) {
    console.error("Erro ao adicionar link:", error);
    showToast("Erro ao salvar link.", "error");
    throw error;
  }
}

async function deleteLink(linkId) {
  try {
    await linksRef.doc(linkId).delete();
    showToast("Link excluído!");
  } catch (error) {
    console.error("Erro ao excluir link:", error);
    showToast("Erro ao excluir o link.", "error");
  }
}

async function changeLinkCategory(linkId, newCategory) {
  try {
    await linksRef.doc(linkId).update({ category: newCategory });
    showToast("Categoria atualizada!");
  } catch (error) {
    console.error("Erro ao mudar categoria:", error);
    showToast("Erro ao atualizar categoria.", "error");
  }
}

function renderCategories() {
  const nav = document.getElementById("catNav");
  const select = document.getElementById("catSelect");
  if (!nav || !select) return;

  const categoryCount = {};
  state.allLinks.forEach(l => {
    categoryCount[l.category] = (categoryCount[l.category] || 0) + 1;
  });

  const categories = ["Todos", ...new Set(state.allLinks.map(l => l.category))].sort();
  nav.innerHTML = "";
  select.innerHTML = "";

  categories.forEach(cat => {
    const count = cat === "Todos" ? state.allLinks.length : (categoryCount[cat] || 0);
    const btn = document.createElement("button");
    btn.className = `cat-tab ${state.activeCategory === cat ? 'active' : ''}`;
    btn.innerText = `${cat} (${count})`;
    btn.onclick = () => { state.activeCategory = cat; renderAll(); };
    nav.appendChild(btn);

    if (cat !== "Todos") {
      const opt = document.createElement("option");
      opt.value = cat; opt.innerText = cat;
      select.appendChild(opt);
    }
  });
  select.innerHTML += `<option value="new">+ Nova Categoria...</option>`;
}

function renderGroups() {
  const groupsView = document.getElementById("groupsView");
  const groupsGrid = document.getElementById("groupsGrid");
  if (!groupsView || !groupsGrid) return;

  const categoryCount = {};
  state.allLinks.forEach(l => {
    const cat = l.category || "Sem Categoria";
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });

  const categories = [...new Set(state.allLinks.map(l => l.category || "Sem Categoria"))].sort();

  groupsGrid.innerHTML = "";

  if (categories.length === 0) {
    groupsGrid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>Nenhum grupo encontrado.</p></div>';
    return;
  }

  categories.forEach(cat => {
    const count = categoryCount[cat] || 0;
    const categoryLinks = state.allLinks.filter(l => (l.category || "Sem Categoria") === cat).slice(0, 4);

    const card = document.createElement("div");
    card.className = "group-card";
    card.onclick = () => {
      state.activeView = 'links';
      state.activeCategory = cat;
      updateUILayout();
      renderAll();
    };

    let previewHtml = '';
    if (categoryLinks.length > 0) {
      previewHtml = '<div class="group-preview">';
      categoryLinks.forEach(link => {
        const domain = getMainDomain(link.url);
        previewHtml += `
          <div class="group-preview-item" title="${escapeHtml(link.title)}">
            <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" 
                 onerror="this.src='https://cdn-icons-png.flaticon.com/512/1006/1006771.png'">
          </div>
        `;
      });
      if (count > 4) {
        previewHtml += `<div class="group-preview-more">+${count - 4}</div>`;
      }
      previewHtml += '</div>';
    }

    card.innerHTML = `
      <i class="fa-solid fa-folder"></i>
      <span class="group-name">${escapeHtml(cat)}</span>
      <span class="group-count">${count} link${count !== 1 ? 's' : ''}</span>
      ${previewHtml}
    `;

    groupsGrid.appendChild(card);
  });
  if (typeof applyGroupSize === 'function') applyGroupSize();
}

function renderLinks() {
  const grid = document.getElementById("linksGrid");
  const empty = document.getElementById("linksEmpty");
  const skeleton = document.getElementById("linksSkeleton");
  if (!grid || !empty || !skeleton) return;

  const filtered = state.allLinks
    .filter(l => {
      const matchCat = state.activeCategory === "Todos" || l.category === state.activeCategory;
      const matchSearch = l.title.toLowerCase().includes(state.searchTerm.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));

  skeleton.style.display = "none";
  grid.style.display = "grid";
  grid.innerHTML = "";
  applyLinkSize();

  if (filtered.length === 0) {
    empty.style.display = "flex";
    grid.style.display = "none";
    return;
  }
  empty.style.display = "none";

  filtered.forEach(link => {
    const domain = getMainDomain(link.url);

    const card = document.createElement("div");
    card.className = "link-card";

    card.onclick = (e) => {
      if (e.target.closest(".link-del") || e.target.closest(".edit-cat-icon")) return;
      window.open(link.url, "_blank", "noopener,noreferrer");
    };

    card.innerHTML = `
      <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64"
           onerror="this.src='https://cdn-icons-png.flaticon.com/512/1006/1006771.png'">
      <span class="link-title">${escapeHtml(link.title)}</span>
      <span class="link-cat-badge">${escapeHtml(link.category)}</span>
      <button class="link-del" aria-label="Deletar"><i class="fa-solid fa-trash"></i></button>
    `;

    card.querySelector(".link-del").onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`Excluir "${link.title}"?`)) await deleteLink(link.id);
    };

    grid.appendChild(card);
  });
}

// ==================== PASTAS & NOTAS ====================
let dragSrc = null;

function subscribeFolders() {
  return foldersRef.onSnapshot(
    { includeMetadataChanges: false },
    (snapshot) => {
      state.allFolders = snapshot.docs.map(doc => doc.id);
      cacheWrite(CACHE_KEYS.folders, state.allFolders);
      renderAll();
    },
    (error) => { console.error("Erro ao carregar pastas:", error); }
  );
}

function subscribeNotes() {
  return notesRef.orderBy("order", "asc").onSnapshot(
    { includeMetadataChanges: false },
    (snapshot) => {
      const notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllNotes(notes);
      renderAll();
    },
    (error) => {
      console.error("Erro ao carregar notas:", error);
      showToast("Erro ao carregar notas.", "error");
    }
  );
}

async function addFolder(folderName) {
  try {
    await foldersRef.doc(folderName).set({ name: folderName, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast(`Pasta "${folderName}" criada!`);
  } catch (e) {
    console.error(e);
  }
}

async function deleteFolder(folderName) {
  try {
    const notesInFolder = state.allNotes.filter(n => (n.folder || "Geral") === folderName);
    await Promise.all(notesInFolder.map(n => updateNote(n.id, { folder: "Geral" })));
    await foldersRef.doc(folderName).delete();
    showToast(`Pasta "${folderName}" excluída. Notas movidas para "Geral".`);
  } catch (e) {
    console.error(e);
    showToast("Erro ao excluir pasta.", "error");
  }
}

async function handleNewFolderClick() {
  const folderName = prompt("Nome da nova pasta:")?.trim();
  if (!folderName) return;

  if (state.allFolders.includes(folderName)) {
    showToast(`Pasta "${folderName}" já existe!`, "error");
    return;
  }

  await addFolder(folderName);
}

async function addNote() {
  const targetFolder = (state.activeFolder === "Todas") ? "Geral" : state.activeFolder;
  try {
    await notesRef.add({
      title: "",
      content: "",
      color: Math.floor(Math.random() * 6) + 1,
      order: state.allNotes.length,
      folder: targetFolder,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast(`Nota criada em "${targetFolder}"`);
  } catch (e) {
    console.error(e);
    showToast("Erro ao criar nota.", "error");
  }
}

async function deleteNote(noteId) {
  try {
    await notesRef.doc(noteId).delete();
    showToast("Nota excluída");
  } catch (e) {
    console.error(e);
    showToast("Erro ao excluir nota.", "error");
  }
}

async function updateNote(noteId, updates) {
  try {
    await notesRef.doc(noteId).update(updates);
  } catch (e) {
    console.error(e);
    showToast("Erro ao atualizar nota.", "error");
  }
}

async function updateNoteOrder(sourceId, targetId) {
  const si = state.allNotes.findIndex(n => n.id === sourceId);
  const ti = state.allNotes.findIndex(n => n.id === targetId);
  if (si === -1 || ti === -1) return;

  const newNotes = [...state.allNotes];
  const [removed] = newNotes.splice(si, 1);
  newNotes.splice(ti, 0, removed);

  const start = Math.min(si, ti);
  const end = Math.max(si, ti);

  try {
    await Promise.all(
      newNotes.slice(start, end + 1).map((n, i) =>
        notesRef.doc(n.id).update({ order: start + i })
      )
    );
  } catch (e) {
    console.error(e);
    showToast("Erro ao reordenar notas.", "error");
  }
}

function renderNotes() {
  const grid = document.getElementById("notesGrid");
  const empty = document.getElementById("notesEmpty");
  if (!grid || !empty) return;

  const folderStrip = document.getElementById("folderStrip");
  if (folderStrip) {
    folderStrip.innerHTML = "";
    ["Todas", ...state.allFolders].forEach(f => {
      const btn = document.createElement("button");
      btn.className = `ftab ${state.activeFolder === f ? 'on' : ''}`;
      const count = f === "Todas"
        ? state.allNotes.length
        : state.allNotes.filter(n => (n.folder || "Geral") === f).length;
      btn.innerHTML = `<span>${f}</span> <span class="ftab-count">(${count})</span>`;

      if (f !== "Todas") {
        const del = document.createElement("span");
        del.className = "ftab-del";
        del.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        del.onclick = (e) => {
          e.stopPropagation();
          if (confirm(`Excluir pasta "${f}"? As notas serão movidas para "Geral".`)) deleteFolder(f);
        };
        btn.appendChild(del);
      }
      btn.onclick = () => { state.activeFolder = f; renderAll(); };
      folderStrip.appendChild(btn);
    });
  }

  const notesToShow = state.activeFolder === "Todas"
    ? state.allNotes
    : state.allNotes.filter(n => (n.folder || "Geral") === state.activeFolder);

  if (notesToShow.length === 0) {
    empty.style.display = "flex";
    grid.style.display = "none";
    return;
  }
  empty.style.display = "none";
  grid.style.display = "grid";
  grid.innerHTML = "";

  const noteColorsList = null;

  notesToShow.forEach(note => {
    const card = document.createElement("div");
    card.className = `note-card nc${note.color || 1}`;
    card.draggable = true;
    card.dataset.id = note.id;

    const date = note.timestamp
      ? new Date(note.timestamp.seconds * 1000).toLocaleString("pt-BR")
      : "Agora";

    const colorDotsHtml = noteColorsList.map(c =>
      `<div class="cdot" data-color="${c}" style="background:${getColorCode(c)}"></div>`
    ).join('');

    card.innerHTML = `
      <div class="note-topbar">
        <div class="note-tbl">
          <div class="note-drag"><i class="fa-solid fa-grip-vertical"></i></div>
          ${colorDotsHtml}
        </div>
        <div class="note-tbr">
          <button class="note-btn expand-note" title="Expandir"><i class="fa-solid fa-expand"></i></button>
          <button class="note-btn danger delete-note" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="note-title-wrap">
        <input class="note-title-input" type="text" placeholder="Título" value="${escapeHtml(note.title || '')}">
      </div>
      <textarea class="note-body" placeholder="Escreva algo...">${escapeHtml(note.content || '')}</textarea>
      <div class="note-footer">
        <span class="note-ts">${date}</span>
        <select class="note-folder-sel">
          <option value="Geral">Geral</option>
          ${state.allFolders.map(f =>
            `<option value="${f}" ${(note.folder || "Geral") === f ? 'selected' : ''}>${f}</option>`
          ).join('')}
        </select>
        <span class="note-chars">${(note.content || '').length} car.</span>
      </div>
    `;

    card.addEventListener('dragstart', (e) => { card.classList.add('dragging'); dragSrc = card; e.dataTransfer.effectAllowed = 'move'; });
    card.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    card.addEventListener('drop', (e) => { e.preventDefault(); if (dragSrc !== card) updateNoteOrder(dragSrc.dataset.id, card.dataset.id); });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); });

    card.querySelectorAll('.cdot').forEach(dot =>
      dot.addEventListener('click', (e) => { e.stopPropagation(); updateNote(note.id, { color: parseInt(dot.dataset.color) }); })
    );

    const titleInput = card.querySelector('.note-title-input');
    let titleTimer;
    titleInput.addEventListener('input', () => {
      clearTimeout(titleTimer);
      titleTimer = setTimeout(() => updateNote(note.id, { title: titleInput.value }), 600);
    });

    const bodyText = card.querySelector('.note-body');
    let bodyTimer;
    bodyText.addEventListener('input', () => {
      clearTimeout(bodyTimer);
      bodyTimer = setTimeout(() => {
        updateNote(note.id, { content: bodyText.value });
        card.querySelector('.note-chars').innerText = `${bodyText.value.length} car.`;
      }, 600);
    });

    const folderSel = card.querySelector('.note-folder-sel');
    folderSel.addEventListener('change', () => updateNote(note.id, { folder: folderSel.value }));

    card.querySelector('.expand-note').addEventListener('click', (e) => { e.stopPropagation(); openExpandNote(note.id); });
    card.querySelector('.delete-note').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm("Excluir esta nota?")) await deleteNote(note.id);
    });

    grid.appendChild(card);
  });
}

function openExpandNote(noteId) {
  const note = state.allNotes.find(n => n.id === noteId);
  if (!note) return;

  const overlay = document.getElementById("expandOverlay");
  const titleInput = document.getElementById("expTitle");
  const body = document.getElementById("expBody");
  const folderSel = document.getElementById("expFolder");
  const tsSpan = document.getElementById("expTs");
  const charsSpan = document.getElementById("expChars");
  if (!overlay || !titleInput || !body) return;

  titleInput.value = note.title || "";
  body.value = note.content || "";
  tsSpan.innerText = note.timestamp
    ? new Date(note.timestamp.seconds * 1000).toLocaleString("pt-BR") : "Agora";
  charsSpan.innerText = `${(note.content || '').length} car.`;

  folderSel.innerHTML = ["Geral", ...state.allFolders].map(f =>
    `<option value="${f}" ${(note.folder || "Geral") === f ? 'selected' : ''}>${f}</option>`
  ).join('');

  overlay.classList.add("open");

  let timer;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      updateNote(noteId, { title: titleInput.value, content: body.value, folder: folderSel.value });
      charsSpan.innerText = `${body.value.length} car.`;
    }, 600);
  };
  titleInput.oninput = save;
  body.oninput = save;
  folderSel.onchange = save;
}

// ==================== TROCA DE VISUALIZAÇÃO ====================
function toggleView() {
  const views = ['groups', 'links', 'notes'];
  const currentIdx = views.indexOf(state.activeView);
  state.activeView = views[(currentIdx + 1) % views.length];

  updateUILayout();
  renderAll();
}

function updateUILayout() {
  const catScroll = document.getElementById("catScroll");
  const linkSizeWrap = document.getElementById("linkSizeWrap");
  const exportWrap = document.getElementById("exportWrap");
  const searchWrap = document.getElementById("searchWrap");
  const sortWrap = document.getElementById("sortWrap");
  const addLinkBtn = document.getElementById("addLinkBtn");
  const addNoteBtn = document.getElementById("addNoteBtn");
  const toggleBtn = document.getElementById("toggleBtn");

  const linksView = document.getElementById("linksView");
  const groupsView = document.getElementById("groupsView");
  const notesView = document.getElementById("notesView");

  if (!catScroll || !linkSizeWrap || !exportWrap || !searchWrap || !sortWrap || !addLinkBtn || !addNoteBtn || !toggleBtn) return;

  if (linksView) linksView.style.display = "none";
  if (groupsView) groupsView.style.display = "none";
  if (notesView) notesView.style.display = "none";

  catScroll.style.display = "flex";
  linkSizeWrap.style.display = "block";
  exportWrap.style.display = "block";
  searchWrap.style.display = "block";
  sortWrap.style.display = "block";
  addLinkBtn.classList.remove("hide");
  addNoteBtn.classList.add("hide");

  if (state.activeView === 'groups') {
    if (groupsView) groupsView.style.display = "block";
    catScroll.style.display = "none";
    linkSizeWrap.style.display = "none";
    exportWrap.style.display = "none";
    searchWrap.style.display = "none";
    sortWrap.style.display = "none";
    toggleBtn.innerHTML = '<i class="fa-solid fa-link"></i><span>Links</span>';
  } else if (state.activeView === 'notes') {
    if (notesView) notesView.style.display = "block";
    catScroll.style.display = "none";
    linkSizeWrap.style.display = "none";
    exportWrap.style.display = "none";
    searchWrap.style.display = "none";
    sortWrap.style.display = "none";
    addLinkBtn.classList.add("hide");
    addNoteBtn.classList.remove("hide");
    toggleBtn.innerHTML = '<i class="fa-solid fa-layer-group"></i><span>Grupos</span>';
  } else {
    if (linksView) linksView.style.display = "block";
    toggleBtn.innerHTML = '<i class="fa-solid fa-note-sticky"></i><span>Notas</span>';
  }
}

// ==================== SENHA E MODAIS ====================
function openChangePasswordModal() {
  const modal = document.getElementById("changePasswordModal");
  if (modal) modal.style.display = "flex";
  ["newPassword", "confirmPassword"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("newPassword")?.focus();
}

function closeChangePasswordModal() {
  const modal = document.getElementById("changePasswordModal");
  if (modal) modal.style.display = "none";
}

async function saveNewPassword() {
  const user = auth.currentUser;
  if (!user) {
    showToast("Nenhum usuário logado!", "error");
    return;
  }

  const newPwd = document.getElementById("newPassword")?.value;
  const confirmPwd = document.getElementById("confirmPassword")?.value;

  if (!newPwd || !confirmPwd) {
    showToast("Preencha a nova senha e a confirmação!", "error");
    return;
  }
  if (newPwd !== confirmPwd) {
    showToast("As senhas não coincidem!", "error");
    return;
  }
  if (newPwd.length < 6) {
    showToast("A senha deve ter no mínimo 6 caracteres!", "error");
    return;
  }

  try {
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, newPwd);
    await user.linkWithCredential(credential);
    showToast("Senha definida com sucesso! Agora você pode logar por e-mail/senha.", "success");
    closeChangePasswordModal();
  } catch (err) {
    if (err.code === "auth/provider-already-linked" || err.code === "auth/credential-already-in-use") {
      try {
        await user.updatePassword(newPwd);
        showToast("Senha atualizada com sucesso!", "success");
        closeChangePasswordModal();
      } catch (updateErr) {
        showToast("Erro ao atualizar senha: " + updateErr.message, "error");
      }
    } else {
      showToast("Erro ao definir senha: " + err.message, "error");
    }
  }
}

// ==================== INICIALIZAÇÃO E EVENTOS ====================
function initDashboard() {
  document.getElementById("dashboard").style.display = "block";
  updateUILayout();
  document.getElementById("loginOverlay").style.display = "none";

  if (typeof initTheme === 'function') initTheme();
  if (typeof applyGroupSize === 'function') applyGroupSize();

  if (state.allLinks.length > 0 || state.allNotes.length > 0) {
    renderAll();
    setBadge(false);
  }

  subscribeLinks();
  subscribeNotes();
  subscribeFolders();

  // ---- Eventos de Importação e Exportação ----
  document.getElementById("importLinksBtn")?.addEventListener("click", () => {
    document.getElementById("linkFileInput")?.click();
  });
  document.getElementById("linkFileInput")?.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleLinkFileImport(e.target.files[0]);
      e.target.value = "";
    }
  });

  document.getElementById("exportNotesBtn")?.addEventListener("click", exportNotesAsJSON);
  document.getElementById("importNotesBtn")?.addEventListener("click", () => {
    document.getElementById("noteFileInput")?.click();
  });
  document.getElementById("noteFileInput")?.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleNoteFileImport(e.target.files[0]);
      e.target.value = "";
    }
  });

  // ---- Botoes do Dashboard ----
  document.getElementById("addLinkBtn")?.addEventListener("click", () => {
    document.getElementById("linkModal").style.display = "flex";
  });
  document.getElementById("modalClose")?.addEventListener("click", () => {
    document.getElementById("linkModal").style.display = "none";
  });
  document.getElementById("modalCancel")?.addEventListener("click", () => {
    document.getElementById("linkModal").style.display = "none";
  });
  document.getElementById("addNoteBtn")?.addEventListener("click", addNote);
  document.getElementById("newFolderBtn")?.addEventListener("click", handleNewFolderClick);

  const expandOverlay = document.getElementById("expandOverlay");
  document.getElementById("expandClose")?.addEventListener("click", () => expandOverlay?.classList.remove("open"));

  document.getElementById("toggleBtn")?.addEventListener("click", toggleView);
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("changePasswordBtn")?.addEventListener("click", openChangePasswordModal);
  document.getElementById("changePasswordClose")?.addEventListener("click", closeChangePasswordModal);
  document.getElementById("changePasswordCancel")?.addEventListener("click", closeChangePasswordModal);
  document.getElementById("saveNewPassword")?.addEventListener("click", saveNewPassword);

  document.getElementById("linkSizeBtn")?.addEventListener("click", cycleLinkSize);
  document.getElementById("exportLinksBtn")?.addEventListener("click", exportLinksAsJSON);
  document.getElementById("searchInput")?.addEventListener("input", e => {
    state.searchTerm = e.target.value; renderAll();
  });
}

// ==================== AUTENTICAÇÃO FIREBASE AUTH ====================
auth.onAuthStateChanged((user) => {
  if (user) {
    setCollectionRefs(user.uid);
    state.user = user;
    document.getElementById("loginOverlay").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    initDashboard();
  } else {
    document.getElementById("dashboard").style.display = "none";
    document.getElementById("loginOverlay").style.display = "flex";
  }
});

document.getElementById("googleLoginBtn")?.addEventListener("click", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((err) => {
    const errDiv = document.getElementById("loginError");
    if (errDiv) errDiv.innerText = "Erro Google Sign-In: " + err.message;
  });
});

document.getElementById("loginBtn")?.addEventListener("click", () => {
  const email = document.getElementById("loginEmail")?.value?.trim();
  const pwd = document.getElementById("loginPassword")?.value;
  if (!email || !pwd) {
    const errDiv = document.getElementById("loginError");
    if (errDiv) errDiv.innerText = "Informe e-mail e senha.";
    return;
  }
  auth.signInWithEmailAndPassword(email, pwd).catch((err) => {
    const errDiv = document.getElementById("loginError");
    if (errDiv) errDiv.innerText = "Erro de Login: " + err.message;
  });
});

document.getElementById("registerBtn")?.addEventListener("click", () => {
  const email = document.getElementById("loginEmail")?.value?.trim();
  const pwd = document.getElementById("loginPassword")?.value;
  if (!email || !pwd) {
    const errDiv = document.getElementById("loginError");
    if (errDiv) errDiv.innerText = "Informe e-mail e senha para cadastro.";
    return;
  }
  auth.createUserWithEmailAndPassword(email, pwd).then(() => {
    showToast("Conta criada com sucesso!", "success");
  }).catch((err) => {
    const errDiv = document.getElementById("loginError");
    if (errDiv) errDiv.innerText = "Erro ao cadastrar: " + err.message;
  });
});

function logout() {
  auth.signOut().then(() => window.location.reload());
}

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }
  if (e.key === "Escape") {
    const linkModal = document.getElementById("linkModal");
    if (linkModal) linkModal.style.display = "none";
    const expandOverlay = document.getElementById("expandOverlay");
    if (expandOverlay) expandOverlay.classList.remove("open");
    closeChangePasswordModal();
  }
});