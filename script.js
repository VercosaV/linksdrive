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

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const linksRef = db.collection("links");
const notesRef = db.collection("notes");

// ==================== ESTADO GLOBAL ====================
const state = {
  allLinks: [],
  allNotes: [],
  activeCategory: "Todos",
  searchTerm: "",
  sortValue: "manual",
  isNotesView: false,
  activeFolder: "Todas"
};

let renderAll = () => {};

function setAllLinks(links) { state.allLinks = links; }
function setAllNotes(notes) { state.allNotes = notes; }

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
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function getColorCode(colorNum) {
  const colors = {
    1: '#FFD600', 2: '#1E90FF', 3: '#00C853', 4: '#FF6B00', 5: '#9C27B0', 6: '#F50057'
  };
  return colors[colorNum] || '#FFD600';
}

// ==================== AUTENTICAÇÃO ====================
const SALT_KEY = "dashboard_salt";
const HASH_KEY = "dashboard_hash";
const AUTH_KEY = "dashboard_auth";
const DEFAULT_PASSWORD = "admin123";

async function generateSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...salt));
}

async function hashPassword(password, saltBase64) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBuffer, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashArray = new Uint8Array(derivedBits);
  return btoa(String.fromCharCode(...hashArray));
}

async function verifyPassword(password) {
  const salt = localStorage.getItem(SALT_KEY);
  const storedHash = localStorage.getItem(HASH_KEY);
  if (!salt || !storedHash) {
    await setPassword(DEFAULT_PASSWORD);
    return await verifyPassword(password);
  }
  const hash = await hashPassword(password, salt);
  return hash === storedHash;
}

async function setPassword(newPassword) {
  const newSalt = await generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);
  localStorage.setItem(SALT_KEY, newSalt);
  localStorage.setItem(HASH_KEY, newHash);
  localStorage.setItem(AUTH_KEY, "true");
  showToast("Senha alterada com sucesso!", "success");
}

async function login(password) {
  const isValid = await verifyPassword(password);
  if (isValid) {
    localStorage.setItem(AUTH_KEY, "true");
    return true;
  }
  return false;
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.reload();
}

function checkAuth() {
  return localStorage.getItem(AUTH_KEY) === "true";
}

function openChangePasswordModal() {
  const modal = document.getElementById("changePasswordModal");
  if (!modal) return;
  modal.style.display = "flex";
  const currentPwd = document.getElementById("currentPassword");
  const newPwd = document.getElementById("newPassword");
  const confirmPwd = document.getElementById("confirmPassword");
  if (currentPwd) currentPwd.value = "";
  if (newPwd) newPwd.value = "";
  if (confirmPwd) confirmPwd.value = "";
  if (currentPwd) currentPwd.focus();
}

function closeChangePasswordModal() {
  const modal = document.getElementById("changePasswordModal");
  if (modal) modal.style.display = "none";
}

async function saveNewPassword() {
  const current = document.getElementById("currentPassword")?.value;
  const newPwd = document.getElementById("newPassword")?.value;
  const confirm = document.getElementById("confirmPassword")?.value;

  if (!current || !newPwd || !confirm) {
    showToast("Preencha todos os campos!", "error");
    return;
  }
  if (newPwd !== confirm) {
    showToast("As senhas não coincidem!", "error");
    return;
  }
  if (newPwd.length < 4) {
    showToast("A nova senha deve ter pelo menos 4 caracteres!", "error");
    return;
  }

  const isValidCurrent = await verifyPassword(current);
  if (!isValidCurrent) {
    showToast("Senha atual incorreta!", "error");
    return;
  }

  await setPassword(newPwd);
  closeChangePasswordModal();
}

// ==================== LINKS ====================
function subscribeLinks() {
  const q = linksRef.orderBy("category");
  return q.onSnapshot((snapshot) => {
    const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setAllLinks(links);
    renderAll();
  }, (error) => {
    console.error("Erro no Firebase:", error);
    showToast("Erro ao conectar com o banco de dados.", "error");
  });
}

async function addLink(linkData) {
  try {
    await linksRef.add({ ...linkData, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
    showToast("Link salvo com sucesso!");
  } catch (error) {
    console.error("Erro ao adicionar link:", error);
    showToast("Erro ao salvar link.", "error");
    throw error;
  }
}

async function deleteLink(linkId) {
  try {
    await db.collection("links").doc(linkId).delete();
    showToast("Link excluído com sucesso!");
  } catch (error) {
    console.error("Erro ao excluir link:", error);
    showToast("Erro ao excluir o link.", "error");
  }
}

function renderCategories() {
  const nav = document.getElementById("catNav");
  const select = document.getElementById("catSelect");
  if (!nav || !select) return;

  const categories = ["Todos", ...new Set(state.allLinks.map(l => l.category))].sort();
  nav.innerHTML = "";
  select.innerHTML = "";

  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = `cat-tab ${state.activeCategory === cat ? 'active' : ''}`;
    btn.innerText = cat;
    btn.onclick = () => {
      state.activeCategory = cat;
      renderAll();
    };
    nav.appendChild(btn);

    if (cat !== "Todos") {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.innerText = cat;
      select.appendChild(opt);
    }
  });
  select.innerHTML += `<option value="new">+ Nova Categoria...</option>`;
}

function renderLinks() {
  const grid = document.getElementById("linksGrid");
  const empty = document.getElementById("linksEmpty");
  const skeleton = document.getElementById("linksSkeleton");
  if (!grid || !empty || !skeleton) return;

  let filtered = state.allLinks.filter(link => {
    const matchCat = state.activeCategory === "Todos" || link.category === state.activeCategory;
    const matchSearch = link.title.toLowerCase().includes(state.searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  switch (state.sortValue) {
    case "cat_asc": filtered.sort((a,b) => a.category.localeCompare(b.category)); break;
    case "cat_desc": filtered.sort((a,b) => b.category.localeCompare(a.category)); break;
    case "title_asc": filtered.sort((a,b) => a.title.localeCompare(b.title)); break;
    case "title_desc": filtered.sort((a,b) => b.title.localeCompare(a.title)); break;
    case "date_desc": filtered.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)); break;
    case "date_asc": filtered.sort((a,b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)); break;
    default: break;
  }

  skeleton.style.display = "none";
  grid.style.display = "grid";
  grid.innerHTML = "";

  if (filtered.length === 0) {
    empty.style.display = "flex";
    grid.style.display = "none";
    return;
  }
  empty.style.display = "none";

  filtered.forEach(link => {
    let domain = "google.com";
    try { domain = new URL(link.url).hostname; } catch(e) {}
    const card = document.createElement("div");
    card.className = "link-card";
    card.onclick = (e) => {
      if (!e.target.closest('.link-del')) window.open(link.url, '_blank');
    };
    card.innerHTML = `
      <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1006/1006771.png'">
      <span class="link-title">${escapeHtml(link.title)}</span>
      <span class="link-cat-badge">${escapeHtml(link.category)}</span>
      <button class="link-del" aria-label="Deletar"><i class="fa-solid fa-trash"></i></button>
    `;
    const delBtn = card.querySelector('.link-del');
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`Excluir "${link.title}"?`)) {
        await deleteLink(link.id);
      }
    };
    grid.appendChild(card);
  });
}

function openLinkModal() {
  const modal = document.getElementById("linkModal");
  if (!modal) return;
  modal.style.display = "flex";
  const urlInput = document.getElementById("urlInput");
  if (urlInput) urlInput.focus();
  const select = document.getElementById("catSelect");
  if (!select) return;
  const categories = ["Todos", ...new Set(state.allLinks.map(l => l.category))].sort();
  select.innerHTML = "";
  categories.forEach(cat => {
    if (cat !== "Todos") {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.innerText = cat;
      select.appendChild(opt);
    }
  });
  select.innerHTML += `<option value="new">+ Nova Categoria...</option>`;
}

function closeLinkModal() {
  const modal = document.getElementById("linkModal");
  if (modal) modal.style.display = "none";
  const urlInput = document.getElementById("urlInput");
  const titleInput = document.getElementById("titleInput");
  const newCatInput = document.getElementById("newCatInput");
  if (urlInput) urlInput.value = "";
  if (titleInput) titleInput.value = "";
  if (newCatInput) {
    newCatInput.style.display = "none";
    newCatInput.value = "";
  }
}

async function saveLinkHandler() {
  let title = document.getElementById("titleInput")?.value.trim();
  let url = document.getElementById("urlInput")?.value.trim();
  let category = document.getElementById("catSelect")?.value;
  if (category === "new") category = document.getElementById("newCatInput")?.value.trim();

  if (!title || !url || !category) {
    showToast("Preencha todos os campos!", "error");
    return;
  }
  if (!url.startsWith("http")) url = `https://${url}`;

  if (state.allLinks.some(l => l.url.toLowerCase() === url.toLowerCase())) {
    showToast("Este link já existe!", "error");
    return;
  }

  try {
    await addLink({ title, url, category });
    closeLinkModal();
    state.activeCategory = category;
    renderAll();
  } catch (err) {
    showToast("Erro ao salvar link", "error");
  }
}

// ==================== NOTAS ====================
let dragSrc = null;

function subscribeNotes() {
  const q = notesRef.orderBy("order", "asc");
  return q.onSnapshot((snapshot) => {
    const notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setAllNotes(notes);
    renderAll();
  }, (error) => {
    console.error("Erro ao carregar notas:", error);
    showToast("Erro ao carregar notas.", "error");
  });
}

async function addNote() {
  try {
    const color = Math.floor(Math.random() * 6) + 1;
    const order = state.allNotes.length;
    await notesRef.add({
      content: "",
      color: color,
      order: order,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Erro ao criar nota:", error);
    showToast("Erro ao criar nota.", "error");
  }
}

async function deleteNote(noteId) {
  try {
    await db.collection("notes").doc(noteId).delete();
    showToast("Nota excluída");
  } catch (error) {
    console.error("Erro ao excluir nota:", error);
    showToast("Erro ao excluir nota.", "error");
  }
}

async function updateNote(noteId, updates) {
  try {
    await db.collection("notes").doc(noteId).update(updates);
  } catch (error) {
    console.error("Erro ao atualizar nota:", error);
    showToast("Erro ao atualizar nota.", "error");
  }
}

async function updateNoteOrder(sourceId, targetId) {
  const sourceIndex = state.allNotes.findIndex(n => n.id === sourceId);
  const targetIndex = state.allNotes.findIndex(n => n.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;

  const newNotes = [...state.allNotes];
  const [removed] = newNotes.splice(sourceIndex, 1);
  newNotes.splice(targetIndex, 0, removed);

  const start = Math.min(sourceIndex, targetIndex);
  const end = Math.max(sourceIndex, targetIndex);

  try {
    const updates = [];
    for (let i = start; i <= end; i++) {
      updates.push(db.collection("notes").doc(newNotes[i].id).update({ order: i }));
    }
    await Promise.all(updates);
  } catch (error) {
    console.error("Erro ao atualizar ordem das notas:", error);
    showToast("Erro ao reordenar notas.", "error");
  }
}

function renderNotes() {
  const grid = document.getElementById("notesGrid");
  const empty = document.getElementById("notesEmpty");
  if (!grid || !empty) return;

  const folders = ["Todas", ...new Set(state.allNotes.map(n => n.folder || "Geral"))];
  const folderStrip = document.getElementById("folderStrip");
  if (folderStrip) {
    folderStrip.innerHTML = "";
    folders.forEach(f => {
      const btn = document.createElement("button");
      btn.className = `ftab ${state.activeFolder === f ? 'on' : ''}`;
      btn.innerHTML = `<span>${f}</span> <span class="ftab-count">(${state.allNotes.filter(n => (n.folder || "Geral") === f).length})</span>`;
      if (f !== "Todas") {
        const del = document.createElement("span");
        del.className = "ftab-del";
        del.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        del.onclick = (e) => {
          e.stopPropagation();
          if (confirm(`Excluir pasta "${f}" e mover notas para "Geral"?`)) {
            state.allNotes.forEach(n => {
              if ((n.folder || "Geral") === f) {
                updateNote(n.id, { folder: "Geral" });
              }
            });
          }
        };
        btn.appendChild(del);
      }
      btn.onclick = () => {
        state.activeFolder = f;
        renderAll();
      };
      folderStrip.appendChild(btn);
    });
  }

  let notesToShow = state.allNotes.filter(n => {
    if (state.activeFolder === "Todas") return true;
    return (n.folder || "Geral") === state.activeFolder;
  });

  if (notesToShow.length === 0) {
    empty.style.display = "flex";
    grid.style.display = "none";
    return;
  }
  empty.style.display = "none";
  grid.style.display = "grid";
  grid.innerHTML = "";

  notesToShow.forEach(note => {
    const card = document.createElement("div");
    card.className = `note-card nc${note.color || 1}`;
    card.draggable = true;
    card.dataset.id = note.id;
    if (note.width) card.style.width = note.width;
    if (note.height) card.style.height = note.height;

    const date = note.timestamp ? new Date(note.timestamp.seconds * 1000).toLocaleString() : "Agora";

    card.innerHTML = `
      <div class="note-topbar">
        <div class="note-tbl">
          <div class="note-drag"><i class="fa-solid fa-grip-vertical"></i></div>
          ${[1,2,3,4,5,6].map(c => `<div class="cdot" data-color="${c}" style="background:${getColorCode(c)}"></div>`).join('')}
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
          ${[...new Set(state.allNotes.map(n => n.folder || "Geral"))].filter(f => f !== "Geral").map(f => `<option value="${f}" ${(note.folder || "Geral") === f ? 'selected' : ''}>${f}</option>`).join('')}
        </select>
        <span class="note-chars">${(note.content || '').length} car.</span>
      </div>
    `;

    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      dragSrc = card;
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragSrc !== card) {
        updateNoteOrder(dragSrc.dataset.id, card.dataset.id);
      }
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });

    card.querySelectorAll('.cdot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        updateNote(note.id, { color: parseInt(dot.dataset.color) });
      });
    });

    const titleInput = card.querySelector('.note-title-input');
    let titleTimeout;
    titleInput.addEventListener('input', () => {
      clearTimeout(titleTimeout);
      titleTimeout = setTimeout(() => {
        updateNote(note.id, { title: titleInput.value });
      }, 500);
    });

    const bodyText = card.querySelector('.note-body');
    let bodyTimeout;
    bodyText.addEventListener('input', () => {
      clearTimeout(bodyTimeout);
      bodyTimeout = setTimeout(() => {
        updateNote(note.id, { content: bodyText.value });
        card.querySelector('.note-chars').innerText = `${bodyText.value.length} car.`;
      }, 500);
    });

    const folderSel = card.querySelector('.note-folder-sel');
    folderSel.addEventListener('change', () => {
      updateNote(note.id, { folder: folderSel.value });
    });

    card.querySelector('.expand-note').addEventListener('click', (e) => {
      e.stopPropagation();
      openExpandNote(note.id);
    });

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

  if (!overlay || !titleInput || !body || !folderSel || !tsSpan || !charsSpan) return;

  titleInput.value = note.title || "";
  body.value = note.content || "";
  const date = note.timestamp ? new Date(note.timestamp.seconds * 1000).toLocaleString() : "Agora";
  tsSpan.innerText = date;
  charsSpan.innerText = `${(note.content || '').length} car.`;

  const folders = ["Geral", ...new Set(state.allNotes.map(n => n.folder || "Geral"))];
  folderSel.innerHTML = folders.map(f => `<option value="${f}" ${(note.folder || "Geral") === f ? 'selected' : ''}>${f}</option>`).join('');

  overlay.classList.add("open");

  let timeout;
  const save = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      updateNote(noteId, {
        title: titleInput.value,
        content: body.value,
        folder: folderSel.value
      });
      charsSpan.innerText = `${body.value.length} car.`;
    }, 500);
  };
  titleInput.oninput = save;
  body.oninput = save;
  folderSel.onchange = save;
}

async function createFolder(folderName) {
  try {
    const color = Math.floor(Math.random() * 6) + 1;
    const order = state.allNotes.length;
    await notesRef.add({
      title: `📁 ${folderName}`,
      content: "Pasta criada automaticamente",
      folder: folderName,
      color: color,
      order: order,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast(`Pasta "${folderName}" criada!`, "success");
  } catch (error) {
    console.error("Erro ao criar pasta:", error);
    showToast("Erro ao criar pasta.", "error");
  }
}

// ==================== TOGGLE VIEW ====================
function toggleView() {
  state.isNotesView = !state.isNotesView;
  const linksView = document.getElementById("linksView");
  const notesView = document.getElementById("notesView");
  const addLinkBtn = document.getElementById("addLinkBtn");
  const addNoteBtn = document.getElementById("addNoteBtn");
  const searchWrap = document.getElementById("searchWrap");
  const sortWrap = document.getElementById("sortWrap");
  const toggleBtn = document.getElementById("toggleBtn");

  if (!linksView || !notesView) return;

  if (state.isNotesView) {
    linksView.style.display = "none";
    notesView.style.display = "block";
    if (addLinkBtn) addLinkBtn.classList.add("hide");
    if (addNoteBtn) addNoteBtn.classList.remove("hide");
    if (searchWrap) searchWrap.classList.add("hide");
    if (sortWrap) sortWrap.classList.add("hide");
    if (toggleBtn) toggleBtn.innerHTML = `<i class="fa-solid fa-link"></i><span>Links</span>`;
    renderAll();
  } else {
    linksView.style.display = "block";
    notesView.style.display = "none";
    if (addLinkBtn) addLinkBtn.classList.remove("hide");
    if (addNoteBtn) addNoteBtn.classList.add("hide");
    if (searchWrap) searchWrap.classList.remove("hide");
    if (sortWrap) sortWrap.classList.remove("hide");
    if (toggleBtn) toggleBtn.innerHTML = `<i class="fa-solid fa-pen-to-square"></i><span>Notas</span>`;
    renderAll();
  }
}

// ==================== INICIALIZAÇÃO ====================
function initDashboard() {
  const dashboard = document.getElementById("dashboard");
  const loginOverlay = document.getElementById("loginOverlay");
  if (dashboard) dashboard.style.display = "block";
  if (loginOverlay) loginOverlay.style.display = "none";

  // Event listeners com verificação de existência
  const addLinkBtn = document.getElementById("addLinkBtn");
  if (addLinkBtn) addLinkBtn.onclick = openLinkModal;
  
  const addNoteBtn = document.getElementById("addNoteBtn");
  if (addNoteBtn) addNoteBtn.onclick = addNote;
  
  const toggleBtn = document.getElementById("toggleBtn");
  if (toggleBtn) toggleBtn.onclick = toggleView;
  
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = logout;
  
  const changePasswordBtn = document.getElementById("changePasswordBtn");
  if (changePasswordBtn) changePasswordBtn.onclick = openChangePasswordModal;
  
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.oninput = (e) => { state.searchTerm = e.target.value; renderAll(); };
  
  const sortSelect = document.getElementById("sortSelect");
  if (sortSelect) sortSelect.onchange = (e) => { state.sortValue = e.target.value; renderAll(); };
  
  const saveLink = document.getElementById("saveLink");
  if (saveLink) saveLink.onclick = saveLinkHandler;
  
  const modalClose = document.getElementById("modalClose");
  if (modalClose) modalClose.onclick = closeLinkModal;
  
  const modalCancel = document.getElementById("modalCancel");
  if (modalCancel) modalCancel.onclick = closeLinkModal;
  
  const catSelect = document.getElementById("catSelect");
  if (catSelect) catSelect.onchange = (e) => {
    const newCatInput = document.getElementById("newCatInput");
    if (newCatInput) newCatInput.style.display = e.target.value === "new" ? "block" : "none";
  };

  const expandOverlay = document.getElementById("expandOverlay");
  const expandClose = document.getElementById("expandClose");
  if (expandClose) expandClose.onclick = () => expandOverlay?.classList.remove("open");
  if (expandOverlay) expandOverlay.addEventListener("click", (e) => {
    if (e.target === expandOverlay) expandOverlay.classList.remove("open");
  });

  const changePasswordClose = document.getElementById("changePasswordClose");
  if (changePasswordClose) changePasswordClose.onclick = closeChangePasswordModal;
  
  const changePasswordCancel = document.getElementById("changePasswordCancel");
  if (changePasswordCancel) changePasswordCancel.onclick = closeChangePasswordModal;
  
  const saveNewPassword = document.getElementById("saveNewPassword");
  if (saveNewPassword) saveNewPassword.onclick = saveNewPassword;
  
  const changePwdModal = document.getElementById("changePasswordModal");
  if (changePwdModal) changePwdModal.addEventListener("click", (e) => {
    if (e.target === changePwdModal) closeChangePasswordModal();
  });

  const newFolderBtn = document.getElementById("newFolderBtn");
  if (newFolderBtn) newFolderBtn.onclick = async () => {
    const folderName = prompt("Nome da nova pasta:");
    if (!folderName || !folderName.trim()) return;
    await createFolder(folderName.trim());
  };

  subscribeLinks();
  subscribeNotes();
}

// ==================== LOGIN ====================
async function attemptLogin() {
  const pwd = document.getElementById("loginPassword")?.value;
  if (!pwd) return;
  if (await login(pwd)) {
    initDashboard();
  } else {
    const loginError = document.getElementById("loginError");
    if (loginError) loginError.innerText = "Senha incorreta!";
  }
}

const loginBtn = document.getElementById("loginBtn");
if (loginBtn) loginBtn.onclick = attemptLogin;

const loginPassword = document.getElementById("loginPassword");
if (loginPassword) loginPassword.addEventListener("keypress", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    await attemptLogin();
  }
});

// Definir renderAll
renderAll = function() {
  if (state.isNotesView) {
    renderNotes();
  } else {
    renderCategories();
    renderLinks();
  }
};

// Inicialização
if (checkAuth()) {
  initDashboard();
} else {
  const loginOverlay = document.getElementById("loginOverlay");
  if (loginOverlay) loginOverlay.style.display = "flex";
}

// ==================== UTILITÁRIOS GLOBAIS ====================
window.importarLinksEmLote = async (linksArray) => {
  let salvos = 0;
  let naoSalvos = 0;
  for (const link of linksArray) {
    if (state.allLinks.some(l => l.url.toLowerCase() === link.url.toLowerCase())) {
      console.warn(`❌ NÃO SALVO (Já existe): ${link.title}`);
      naoSalvos++;
      continue;
    }
    try {
      await addLink(link);
      salvos++;
    } catch (error) {
      console.error(`❌ Erro ao salvar: ${link.title}`, error);
      naoSalvos++;
    }
  }
  alert(`Importação concluída!\n✅ Sucessos: ${salvos}\n❌ Não salvos: ${naoSalvos}`);
};

window.removerDuplicatas = async () => {
  const seen = new Set();
  let removidos = 0;
  for (const link of state.allLinks) {
    if (seen.has(link.url)) {
      await deleteLink(link.id);
      removidos++;
    } else {
      seen.add(link.url);
    }
  }
  alert(`Limpeza concluída! ${removidos} links duplicados removidos.`);
};

window.resetSenha = async () => {
  await setPassword("admin123");
  showToast("Senha resetada para admin123", "success");
};