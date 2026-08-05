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

// ==================== BACKUP DE LINKS ====================
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

// ==================== TAMANHO DOS CARDS DE LINK ====================
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
        let domain = "google.com";
        try { domain = new URL(link.url).hostname; } catch (e) { }
        previewHtml += `
          <div class="group-preview-item" title="${escapeHtml(link.title)}">
            <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" 
                 onerror="this.parentElement.style.display='none'">
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
    let domain = "google.com";
    try { domain = new URL(link.url).hostname; } catch (e) { }

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

  document.getElementById("addLinkBtn")?.addEventListener("click", () => {
    document.getElementById("linkModal").style.display = "flex";
  });
  document.getElementById("modalClose")?.addEventListener("click", () => {
    document.getElementById("linkModal").style.display = "none";
  });
  document.getElementById("modalCancel")?.addEventListener("click", () => {
    document.getElementById("linkModal").style.display = "none";
  });
  document.getElementById("toggleBtn")?.addEventListener("click", toggleView);
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
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
  }
});