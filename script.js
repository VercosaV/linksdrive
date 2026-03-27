import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBc3ryOJEFBQlJIUpy835Anej0OulZqHEQ",
  authDomain: "linksdrive-4012c.firebaseapp.com",
  projectId: "linksdrive-4012c",
  storageBucket: "linksdrive-4012c.firebasestorage.app",
  messagingSenderId: "91948654259",
  appId: "1:91948654259:web:2b596baed6d1ab78cc5ac6",
  measurementId: "G-V1EZDLJQ2K"
};

// Inicialização
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const linksRef = collection(db, "links");
const notesRef = collection(db, "notes");

// Estado global
let allLinks = [];
let allNotes = [];
let isNotesView = false;
let activeCategory = "Todos";
let searchTerm = "";
let sortValue = "manual";
let activeFolder = "Todas";
let currentEditNoteId = null;

// --- Gerenciamento de senha (localStorage) ---
const PASSWORD_KEY = 'dashboard_password';
const DEFAULT_PASSWORD = 'admin123';

// Inicializa a senha no localStorage se não existir
if (!localStorage.getItem(PASSWORD_KEY)) {
  localStorage.setItem(PASSWORD_KEY, DEFAULT_PASSWORD);
}

function getStoredPassword() {
  return localStorage.getItem(PASSWORD_KEY);
}

function checkPassword(inputPassword) {
  return inputPassword === getStoredPassword();
}

function updatePassword(newPassword) {
  localStorage.setItem(PASSWORD_KEY, newPassword);
  showToast("Senha alterada com sucesso!", "success");
}

// Helper: Toast
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

// --- LINKS ---
function subscribeLinks(callback) {
  const q = query(linksRef, orderBy("category"));
  return onSnapshot(q, (snapshot) => {
    allLinks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(allLinks);
  }, (error) => {
    console.error("Erro no Firebase:", error);
    showToast("Erro ao conectar com o banco de dados.", "error");
  });
}

async function addLink(linkData) {
  try {
    await addDoc(linksRef, { ...linkData, timestamp: serverTimestamp() });
    showToast("Link salvo com sucesso!");
  } catch (error) {
    console.error("Erro ao adicionar link:", error);
    showToast("Erro ao salvar link.", "error");
    throw error;
  }
}

async function deleteLink(linkId) {
  try {
    await deleteDoc(doc(db, "links", linkId));
    showToast("Link excluído com sucesso!");
  } catch (error) {
    console.error("Erro ao excluir link:", error);
    showToast("Erro ao excluir o link.", "error");
  }
}

// --- NOTAS ---
function subscribeNotes(callback) {
  const q = query(notesRef, orderBy("order", "asc"));
  return onSnapshot(q, (snapshot) => {
    allNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(allNotes);
  }, (error) => {
    console.error("Erro ao carregar notas:", error);
    showToast("Erro ao carregar notas.", "error");
  });
}

async function addNote() {
  try {
    const color = Math.floor(Math.random() * 6) + 1;
    const order = allNotes.length;
    await addDoc(notesRef, {
      content: "",
      color: color,
      order: order,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Erro ao criar nota:", error);
    showToast("Erro ao criar nota.", "error");
  }
}

async function deleteNote(noteId) {
  try {
    await deleteDoc(doc(db, "notes", noteId));
    showToast("Nota excluída");
  } catch (error) {
    console.error("Erro ao excluir nota:", error);
    showToast("Erro ao excluir nota.", "error");
  }
}

async function updateNote(noteId, updates) {
  try {
    await updateDoc(doc(db, "notes", noteId), updates);
  } catch (error) {
    console.error("Erro ao atualizar nota:", error);
    showToast("Erro ao atualizar nota.", "error");
  }
}

async function updateNoteOrder(sourceId, targetId) {
  const sourceIndex = allNotes.findIndex(n => n.id === sourceId);
  const targetIndex = allNotes.findIndex(n => n.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;

  const newNotes = [...allNotes];
  const [removed] = newNotes.splice(sourceIndex, 1);
  newNotes.splice(targetIndex, 0, removed);

  const start = Math.min(sourceIndex, targetIndex);
  const end = Math.max(sourceIndex, targetIndex);

  try {
    const updates = [];
    for (let i = start; i <= end; i++) {
      updates.push(updateDoc(doc(db, "notes", newNotes[i].id), { order: i }));
    }
    await Promise.all(updates);
  } catch (error) {
    console.error("Erro ao atualizar ordem das notas:", error);
    showToast("Erro ao reordenar notas.", "error");
  }
}

// --- UI: Links ---
function renderCategories() {
  const nav = document.getElementById("catNav");
  const select = document.getElementById("catSelect");
  if (!nav || !select) return;

  const categories = ["Todos", ...new Set(allLinks.map(l => l.category))].sort();
  nav.innerHTML = "";
  select.innerHTML = "";

  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = `cat-tab ${activeCategory === cat ? 'active' : ''}`;
    btn.innerText = cat;
    btn.onclick = () => {
      activeCategory = cat;
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

  let filtered = allLinks.filter(link => {
    const matchCat = activeCategory === "Todos" || link.category === activeCategory;
    const matchSearch = link.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  // Ordenação
  switch (sortValue) {
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

// --- UI: Notas ---
function renderNotes() {
  const grid = document.getElementById("notesGrid");
  const empty = document.getElementById("notesEmpty");
  if (!grid || !empty) return;

  // Atualizar pasta strip
  const folders = ["Todas", ...new Set(allNotes.map(n => n.folder || "Geral"))];
  const folderStrip = document.getElementById("folderStrip");
  if (folderStrip) {
    folderStrip.innerHTML = "";
    folders.forEach(f => {
      const btn = document.createElement("button");
      btn.className = `ftab ${activeFolder === f ? 'on' : ''}`;
      btn.innerHTML = `<span>${f}</span> <span class="ftab-count">(${allNotes.filter(n => (n.folder || "Geral") === f).length})</span>`;
      if (f !== "Todas") {
        const del = document.createElement("span");
        del.className = "ftab-del";
        del.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        del.onclick = (e) => {
          e.stopPropagation();
          if (confirm(`Excluir pasta "${f}" e mover notas para "Geral"?`)) {
            allNotes.forEach(n => {
              if ((n.folder || "Geral") === f) {
                updateNote(n.id, { folder: "Geral" });
              }
            });
          }
        };
        btn.appendChild(del);
      }
      btn.onclick = () => {
        activeFolder = f;
        renderAll();
      };
      folderStrip.appendChild(btn);
    });
  }

  let notesToShow = allNotes.filter(n => {
    if (activeFolder === "Todas") return true;
    return (n.folder || "Geral") === activeFolder;
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
          ${[...new Set(allNotes.map(n => n.folder || "Geral"))].filter(f => f !== "Geral").map(f => `<option value="${f}" ${(note.folder || "Geral") === f ? 'selected' : ''}>${f}</option>`).join('')}
        </select>
        <span class="note-chars">${(note.content || '').length} car.</span>
      </div>
    `;

    // Eventos de drag & drop
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

    // Troca de cor
    card.querySelectorAll('.cdot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        updateNote(note.id, { color: parseInt(dot.dataset.color) });
      });
    });

    // Título
    const titleInput = card.querySelector('.note-title-input');
    let titleTimeout;
    titleInput.addEventListener('input', () => {
      clearTimeout(titleTimeout);
      titleTimeout = setTimeout(() => {
        updateNote(note.id, { title: titleInput.value });
      }, 500);
    });

    // Conteúdo
    const bodyText = card.querySelector('.note-body');
    let bodyTimeout;
    bodyText.addEventListener('input', () => {
      clearTimeout(bodyTimeout);
      bodyTimeout = setTimeout(() => {
        updateNote(note.id, { content: bodyText.value });
        card.querySelector('.note-chars').innerText = `${bodyText.value.length} car.`;
      }, 500);
    });

    // Pasta
    const folderSel = card.querySelector('.note-folder-sel');
    folderSel.addEventListener('change', () => {
      updateNote(note.id, { folder: folderSel.value });
    });

    // Expandir
    card.querySelector('.expand-note').addEventListener('click', (e) => {
      e.stopPropagation();
      openExpandNote(note.id);
    });

    // Excluir
    card.querySelector('.delete-note').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm("Excluir esta nota?")) await deleteNote(note.id);
    });

    grid.appendChild(card);
  });
}

function openExpandNote(noteId) {
  const note = allNotes.find(n => n.id === noteId);
  if (!note) return;
  currentEditNoteId = noteId;
  const overlay = document.getElementById("expandOverlay");
  const titleInput = document.getElementById("expTitle");
  const body = document.getElementById("expBody");
  const folderSel = document.getElementById("expFolder");
  const tsSpan = document.getElementById("expTs");
  const charsSpan = document.getElementById("expChars");

  titleInput.value = note.title || "";
  body.value = note.content || "";
  const date = note.timestamp ? new Date(note.timestamp.seconds * 1000).toLocaleString() : "Agora";
  tsSpan.innerText = date;
  charsSpan.innerText = `${(note.content || '').length} car.`;

  // Preencher pastas
  const folders = ["Geral", ...new Set(allNotes.map(n => n.folder || "Geral"))];
  folderSel.innerHTML = folders.map(f => `<option value="${f}" ${(note.folder || "Geral") === f ? 'selected' : ''}>${f}</option>`).join('');

  overlay.classList.add("open");

  // Salvamento automático
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

// --- UI Geral ---
function renderAll() {
  if (isNotesView) {
    renderNotes();
  } else {
    renderCategories();
    renderLinks();
  }
}

// --- MODAL DE LINK ---
function openLinkModal() {
  const modal = document.getElementById("linkModal");
  modal.style.display = "flex";
  document.getElementById("urlInput").focus();
  // Atualizar select de categorias
  const select = document.getElementById("catSelect");
  const categories = ["Todos", ...new Set(allLinks.map(l => l.category))].sort();
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
  document.getElementById("linkModal").style.display = "none";
  document.getElementById("urlInput").value = "";
  document.getElementById("titleInput").value = "";
  document.getElementById("newCatInput").style.display = "none";
  document.getElementById("newCatInput").value = "";
}

async function saveLinkHandler() {
  let title = document.getElementById("titleInput").value.trim();
  let url = document.getElementById("urlInput").value.trim();
  let category = document.getElementById("catSelect").value;
  if (category === "new") category = document.getElementById("newCatInput").value.trim();

  if (!title || !url || !category) {
    showToast("Preencha todos os campos!", "error");
    return;
  }
  if (!url.startsWith("http")) url = `https://${url}`;

  // Verificar duplicata
  if (allLinks.some(l => l.url.toLowerCase() === url.toLowerCase())) {
    showToast("Este link já existe!", "error");
    return;
  }

  try {
    await addLink({ title, url, category });
    closeLinkModal();
    activeCategory = category;
    renderAll();
  } catch (err) {
    showToast("Erro ao salvar link", "error");
  }
}

// --- MODAL ALTERAR SENHA ---
function openChangePasswordModal() {
  const modal = document.getElementById("changePasswordModal");
  modal.style.display = "flex";
  document.getElementById("currentPassword").value = "";
  document.getElementById("newPassword").value = "";
  document.getElementById("confirmPassword").value = "";
  document.getElementById("currentPassword").focus();
}

function closeChangePasswordModal() {
  document.getElementById("changePasswordModal").style.display = "none";
}

async function saveNewPassword() {
  const current = document.getElementById("currentPassword").value;
  const newPwd = document.getElementById("newPassword").value;
  const confirm = document.getElementById("confirmPassword").value;

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

  // Verifica senha atual
  if (!checkPassword(current)) {
    showToast("Senha atual incorreta!", "error");
    return;
  }

  // Atualiza senha
  updatePassword(newPwd);
  closeChangePasswordModal();
}

// --- TOGGLE VIEW ---
function toggleView() {
  isNotesView = !isNotesView;
  const linksView = document.getElementById("linksView");
  const notesView = document.getElementById("notesView");
  const addLinkBtn = document.getElementById("addLinkBtn");
  const addNoteBtn = document.getElementById("addNoteBtn");
  const searchWrap = document.getElementById("searchWrap");
  const sortWrap = document.getElementById("sortWrap");
  const toggleBtn = document.getElementById("toggleBtn");

  if (isNotesView) {
    linksView.style.display = "none";
    notesView.style.display = "block";
    addLinkBtn.classList.add("hide");
    addNoteBtn.classList.remove("hide");
    searchWrap.classList.add("hide");
    sortWrap.classList.add("hide");
    toggleBtn.innerHTML = `<i class="fa-solid fa-link"></i><span>Links</span>`;
    renderAll();
  } else {
    linksView.style.display = "block";
    notesView.style.display = "none";
    addLinkBtn.classList.remove("hide");
    addNoteBtn.classList.add("hide");
    searchWrap.classList.remove("hide");
    sortWrap.classList.remove("hide");
    toggleBtn.innerHTML = `<i class="fa-solid fa-pen-to-square"></i><span>Notas</span>`;
    renderAll();
  }
}

// --- AUTENTICAÇÃO ---
const AUTH_KEY = 'dashboard_auth';

function checkAuth() {
  return localStorage.getItem(AUTH_KEY) === 'true';
}

function login(password) {
  if (checkPassword(password)) {
    localStorage.setItem(AUTH_KEY, 'true');
    return true;
  }
  return false;
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.reload();
}

// --- INICIALIZAÇÃO APÓS LOGIN ---
function initDashboard() {
  document.getElementById("dashboard").style.display = "block";
  document.getElementById("loginOverlay").style.display = "none";

  // Event listeners
  document.getElementById("addLinkBtn").onclick = openLinkModal;
  document.getElementById("addNoteBtn").onclick = addNote;
  document.getElementById("toggleBtn").onclick = toggleView;
  document.getElementById("logoutBtn").onclick = logout;
  document.getElementById("changePasswordBtn").onclick = openChangePasswordModal;
  document.getElementById("searchInput").oninput = (e) => { searchTerm = e.target.value; renderAll(); };
  document.getElementById("sortSelect").onchange = (e) => { sortValue = e.target.value; renderAll(); };
  document.getElementById("saveLink").onclick = saveLinkHandler;
  document.getElementById("modalClose").onclick = closeLinkModal;
  document.getElementById("modalCancel").onclick = closeLinkModal;
  document.getElementById("catSelect").onchange = (e) => {
    document.getElementById("newCatInput").style.display = e.target.value === "new" ? "block" : "none";
  };

  // Expand overlay close
  const expandOverlay = document.getElementById("expandOverlay");
  document.getElementById("expandClose").onclick = () => expandOverlay.classList.remove("open");
  expandOverlay.addEventListener("click", (e) => {
    if (e.target === expandOverlay) expandOverlay.classList.remove("open");
  });

  // Modal de alterar senha
  const changePwdModal = document.getElementById("changePasswordModal");
  document.getElementById("changePasswordClose").onclick = closeChangePasswordModal;
  document.getElementById("changePasswordCancel").onclick = closeChangePasswordModal;
  document.getElementById("saveNewPassword").onclick = saveNewPassword;
  changePwdModal.addEventListener("click", (e) => {
    if (e.target === changePwdModal) closeChangePasswordModal();
  });

  // Nova pasta (apenas para interface, pois as pastas são criadas dinamicamente)
  document.getElementById("newFolderBtn").onclick = () => {
    const folderName = prompt("Nome da nova pasta:");
    if (folderName && folderName.trim()) {
      showToast(`Pasta "${folderName}" disponível para notas.`);
      renderAll(); // re-renderiza para atualizar selects
    }
  };

  // Carregar dados
  subscribeLinks(() => renderAll());
  subscribeNotes(() => renderAll());
}

// --- EVENTO DE LOGIN ---
document.getElementById("loginBtn").onclick = () => {
  const pwd = document.getElementById("loginPassword").value;
  if (login(pwd)) {
    initDashboard();
  } else {
    document.getElementById("loginError").innerText = "Senha incorreta!";
  }
};

// Verificar autenticação inicial
if (checkAuth()) {
  initDashboard();
} else {
  document.getElementById("loginOverlay").style.display = "flex";
}

// --- FUNÇÕES UTILITÁRIAS (console) ---
window.importarLinksEmLote = async (linksArray) => {
  let salvos = 0;
  let naoSalvos = 0;
  for (const link of linksArray) {
    if (allLinks.some(l => l.url.toLowerCase() === link.url.toLowerCase())) {
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
  for (const link of allLinks) {
    if (seen.has(link.url)) {
      await deleteLink(link.id);
      removidos++;
    } else {
      seen.add(link.url);
    }
  }
  alert(`Limpeza concluída! ${removidos} links duplicados removidos.`);
};

// Helper de escape
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

let dragSrc = null; // para drag & drop de notas