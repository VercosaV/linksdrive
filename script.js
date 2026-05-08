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

/*
  OTIMIZAÇÃO PRINCIPAL: persistência offline do Firestore.

  O Firestore tem um sistema de cache embutido. Com enablePersistence(),
  ele salva os documentos no IndexedDB do navegador (como um banco de dados
  local no disco do usuário). Isso significa:

  1. Na PRIMEIRA abertura: busca tudo do servidor (leituras normais).
  2. Nas aberturas SEGUINTES: serve os dados do cache LOCAL sem consumir
     nenhuma leitura do Firestore — só sincroniza o delta (o que mudou).
  3. Se o Firestore já está em cache, onSnapshot() dispara imediatamente
     com os dados locais e depois atualiza se houver mudanças no servidor.

  Sem isso, cada vez que você abre o dashboard = N leituras completas.
  Com isso, cada abertura = 0 leituras (se nada mudou no servidor).

  Por que isso importa para o Spark plan (gratuito)?
  → O limite são 50.000 leituras/dia. Com 3 coleções (links, notes, folders)
    e onSnapshot ativo, cada abertura do app consomia todos os documentos
    de cada coleção. Com persistência, você abre 1000 vezes por dia
    sem gastar uma leitura sequer.
*/
db.enablePersistence({ synchronizeTabs: true })
  .catch(err => {
    // Pode falhar em modo privado (sem IndexedDB) ou se outra aba já tiver
    // ativado. Não é fatal — o app funciona normalmente, só sem cache local.
    if (err.code === 'failed-precondition') {
      console.warn('Cache offline desativado: múltiplas abas abertas.');
    } else if (err.code === 'unimplemented') {
      console.warn('Cache offline não suportado neste navegador.');
    }
  });

const linksRef = db.collection("links");
const notesRef = db.collection("notes");
const foldersRef = db.collection("folders");

// ==================== CACHE KEYS (localStorage) ====================
/*
  Além do cache do Firestore (IndexedDB), mantemos um cache manual no
  localStorage para duas finalidades específicas:

  1. BACKUP DE LINKS: toda vez que os links mudam, salvamos um JSON completo
     em localStorage. Se o Firestore falhar ou a conta for excluída, os dados
     ainda existem localmente.

  2. SNAPSHOT LOCAL RÁPIDO: na inicialização, carregamos os dados do
     localStorage ANTES do Firestore responder. O usuário vê os dados
     instantaneamente, sem esqueleto de loading.

  Importante: o localStorage tem limite de ~5MB por domínio. Para links e
  pastas isso é mais do que suficiente. Notas com muito conteúdo poderiam
  extrapolar, então só fazemos backup de links (o mais crítico).
*/
const CACHE_KEYS = {
  links: "cache_links_v1",
  notes: "cache_notes_v1",
  folders: "cache_folders_v1",
  linkSize: "linkCardSize",
  groupSize: "groupCardSize",
  theme: "dashboardTheme",
  auth: "dashboard_auth",
  salt: "dashboard_salt",
  hash: "dashboard_hash",
};

function cacheWrite(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    // QuotaExceededError: localStorage cheio. Silenciamos — não é crítico.
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
  /*
    firestoreReady: flag que indica se o Firestore já sincronizou pelo menos
    uma vez. Usamos para mostrar o badge "Cache" vs badge online.
  */
  firestoreReady: false,
};

let renderAll = () => { };

function setAllLinks(links) {
  state.allLinks = links;
  // Toda vez que os links mudam, persiste no localStorage como backup
  cacheWrite(CACHE_KEYS.links, links);
  // Também atualiza o backup em JSON para download
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
    // Some o badge após 3s quando online — só interessa mostrar se offline
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
/*
  Sistema de backup duplo para os links:

  CAMADA 1 — localStorage (automático):
    Atualizado a cada mudança via setAllLinks(). Zero cliques do usuário.
    Sobrevive a falhas de rede e erros do Firestore.
    Limite: ~5MB. Para links (texto puro), aguenta milhares deles.

  CAMADA 2 — Download de arquivo (manual):
    O usuário clica em "Exportar Links" e faz download de um arquivo JSON.
    Esse arquivo pode ser guardado no computador, Google Drive, etc.
    Formato JSON escolhido por ser: legível, importável pelo importarLinksEmLote(),
    e por representar fielmente a estrutura dos dados (título + url + categoria).

  Por que JSON e não TXT?
  → TXT seria mais legível para humanos, mas perderia a categoria e seria
    mais difícil de reimportar. Com JSON, um único comando no console restaura
    tudo: importarLinksEmLote(data).
    Ainda assim, geramos também um .txt legível no mesmo download (ver abaixo).

  Metadata de backup: guardamos no localStorage quando foi o último backup
  para informar o usuário no botão.
*/
const BACKUP_META_KEY = "links_backup_meta";

function updateLinkBackupMeta() {
  // Apenas atualiza o contador de links no metadata — não faz I/O pesado
  const existing = cacheRead(BACKUP_META_KEY) || {};
  cacheWrite(BACKUP_META_KEY, {
    ...existing,
    count: state.allLinks.length,
    lastAutoSave: new Date().toISOString(),
  });
  // Atualiza o texto do botão de backup se ele existir
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
  /*
    Gera e faz download de dois arquivos:
    1. links_backup.json  — reimportável via importarLinksEmLote()
    2. links_backup.txt   — legível por humanos, organizado por categoria

    Usamos a técnica de criar um <a> temporário com blob URL para disparar
    o download sem servidor — tudo no front-end.
  */
  if (state.allLinks.length === 0) {
    showToast("Nenhum link para exportar.", "error");
    return;
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // "2025-04-09"

  // — ARQUIVO 1: JSON estruturado —
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

  // — ARQUIVO 2: TXT legível por categoria —
  // Agrupamos os links por categoria antes de gerar o texto
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
    // Ordena os links da categoria alfabeticamente
    byCategory[cat]
      .sort((a, b) => a.title.localeCompare(b.title))
      .forEach(l => {
        txt += `  ${l.title}\n  ${l.url}\n\n`;
      });
  });

  // Pequeno delay para o browser não bloquear dois downloads simultâneos
  setTimeout(() => {
    downloadBlob(txt, `links_backup_${dateStr}.txt`, "text/plain");
  }, 300);

  // Atualiza metadata do backup manual
  cacheWrite(BACKUP_META_KEY, {
    count: state.allLinks.length,
    lastAutoSave: new Date().toISOString(),
    lastManualDate: now.toISOString(),
  });

  showToast(`${state.allLinks.length} links exportados (JSON + TXT)!`, "success");
}

function downloadBlob(content, filename, mimeType) {
  /*
    Cria um Blob (objeto binário em memória) com o conteúdo,
    gera uma URL temporária para ele e simula um clique num link <a>.
    Depois revoga a URL para liberar memória.
  */
  const blob = new Blob([content], { type: mimeType + ";charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Libera a URL do blob da memória após o download iniciar
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

// ==================== AUTENTICAÇÃO (PBKDF2) ====================
const DEFAULT_PASSWORD = "admin123";

async function generateSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...salt));
}

async function hashPassword(password, saltBase64) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0)), iterations: 100000, hash: "SHA-256" },
    keyMaterial, 256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

async function verifyPassword(password) {
  const salt = localStorage.getItem(CACHE_KEYS.salt);
  const storedHash = localStorage.getItem(CACHE_KEYS.hash);

  // Primeira execução: aceita apenas senha padrão e cria credenciais
  if (!salt || !storedHash) {
    if (password !== DEFAULT_PASSWORD) {
      return false; // Recusa senhas não-padrão na primeira execução
    }
    await setPassword(DEFAULT_PASSWORD);
    return true;
  }

  return (await hashPassword(password, salt)) === storedHash;
}

async function setPassword(newPassword) {
  const salt = await generateSalt();
  const hash = await hashPassword(newPassword, salt);
  localStorage.setItem(CACHE_KEYS.salt, salt);
  localStorage.setItem(CACHE_KEYS.hash, hash);
  localStorage.setItem(CACHE_KEYS.auth, "true");
  showToast("Senha alterada com sucesso!");
}

async function login(password) {
  if (await verifyPassword(password)) {
    localStorage.setItem(CACHE_KEYS.auth, "true");
    return true;
  }
  return false;
}

function logout() { localStorage.removeItem(CACHE_KEYS.auth); window.location.reload(); }
function checkAuth() { return localStorage.getItem(CACHE_KEYS.auth) === "true"; }

function openChangePasswordModal() {
  document.getElementById("changePasswordModal").style.display = "flex";
  ["currentPassword", "newPassword", "confirmPassword"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  document.getElementById("currentPassword")?.focus();
}
function closeChangePasswordModal() {
  document.getElementById("changePasswordModal").style.display = "none";
}

async function saveNewPassword() {
  const current = document.getElementById("currentPassword")?.value;
  const newPwd = document.getElementById("newPassword")?.value;
  const confirm = document.getElementById("confirmPassword")?.value;
  if (!current || !newPwd || !confirm) { showToast("Preencha todos os campos!", "error"); return; }
  if (newPwd !== confirm) { showToast("As senhas não coincidem!", "error"); return; }
  if (newPwd.length < 4) { showToast("Mínimo 4 caracteres!", "error"); return; }
  if (!await verifyPassword(current)) { showToast("Senha atual incorreta!", "error"); return; }
  await setPassword(newPwd);
  closeChangePasswordModal();
}

// ==================== LINKS ====================
/*
  POR QUE CONTINUAR USANDO onSnapshot() COM PERSISTÊNCIA ATIVA?

  O onSnapshot() com persistência é a combinação mais eficiente possível:
  - Dispara imediatamente com dados do CACHE (custo: 0 leituras)
  - Recebe apenas o DIFF do servidor quando algo muda (custo: só os docs alterados)
  - Sem persistência, cada snapshot = todos os documentos relidos do servidor

  Alternativa descartada: substituir por get() + polling.
  → get() com cache ainda consome 1 leitura por documento na primeira vez.
  → Polling (setInterval) forçaria leituras mesmo sem mudanças.
  → onSnapshot com persistência é superior em todos os eixos.

  NOTA sobre o limite Spark:
  50.000 leituras/dia. Com persistência, cada documento só é "lido" quando
  muda no servidor. Se você não editar nada, pode abrir o app 10.000 vezes
  no dia sem gastar uma única leitura adicional.
*/
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
      // Se falhar mas temos cache, continuamos funcionando
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
    await db.collection("links").doc(linkId).delete();
    showToast("Link excluído!");
  } catch (error) {
    console.error("Erro ao excluir link:", error);
    showToast("Erro ao excluir o link.", "error");
  }
}

async function changeLinkCategory(linkId, newCategory) {
  try {
    await db.collection("links").doc(linkId).update({ category: newCategory });
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

  // Contagem de links por categoria
  const categoryCount = {};
  state.allLinks.forEach(l => {
    const cat = l.category || "Sem Categoria";
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });

  // Criar array de categorias únicas
  const categories = [...new Set(state.allLinks.map(l => l.category || "Sem Categoria"))].sort();

  groupsGrid.innerHTML = "";

  if (categories.length === 0) {
    groupsGrid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>Nenhum grupo encontrado.</p></div>';
    return;
  }

  categories.forEach(cat => {
    const count = categoryCount[cat] || 0;

    // Pegar os primeiros 4 links da categoria para prévia
    const categoryLinks = state.allLinks.filter(l => (l.category || "Sem Categoria") === cat).slice(0, 4);

    const card = document.createElement("div");
    card.className = "group-card";
    card.onclick = () => {
      // Navegar para a view de links com a categoria selecionada
      state.activeView = 'links';
      state.activeCategory = cat;
      updateUILayout();
      renderAll();
    };

    // Gerar HTML da prévia de links
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
    // Se protegido, adiciona classe extra para estilização (cadeado, borda diferente)
    card.className = `link-card${link.protected ? " is-protected" : ""}`;
 
    // MUDANÇA PRINCIPAL: verifica proteção antes de abrir
    card.onclick = (e) => {
      // Ignora cliques nos botões internos (deletar, editar categoria)
      if (e.target.closest(".link-del") || e.target.closest(".edit-cat-icon")) return;
 
      if (link.protected) {
        // Link protegido → abre modal de senha
        openLinkPasswordModal(link);
      } else {
        // Link normal → abre diretamente
        window.open(link.url, "_blank");
      }
    };
 
    card.innerHTML = `
      <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64"
           onerror="this.src='https://cdn-icons-png.flaticon.com/512/1006/1006771.png'">
      <span class="link-title">${escapeHtml(link.title)}</span>
      <span class="link-cat-badge">${escapeHtml(link.category)}</span>
      ${link.protected ? '<span class="link-lock" title="Link protegido com senha"><i class="fa-solid fa-lock"></i></span>' : ""}
      <button class="link-del" aria-label="Deletar"><i class="fa-solid fa-trash"></i></button>
    `;
 
    card.querySelector(".link-del").onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`Excluir "${link.title}"?`)) await deleteLink(link.id);
    };
 
    const catSpan = card.querySelector(".link-cat-badge");
    const editIcon = document.createElement("i");
    editIcon.className = "fa-solid fa-pencil edit-cat-icon";
    editIcon.onclick = (e) => {
      e.stopPropagation();
      openEditCatModal(link.id, link.category);
    };
    catSpan.appendChild(editIcon);
 
    grid.appendChild(card);
  });
}



// ==================== MODAL EDITAR CATEGORIA ====================
let currentEditLinkId = null;
let currentProtectedLink = null; // Guarda referência ao link em processo de verificação
let dragSrc = null;

function openEditCatModal(linkId, currentCat) {
  currentEditLinkId = linkId;
  const modal = document.getElementById("editCatModal");
  const select = document.getElementById("editCatSelect");
  const newCatInput = document.getElementById("editNewCatInput");
  if (!modal || !select) return;

  const categories = [...new Set(state.allLinks.map(l => l.category))].sort();
  select.innerHTML = categories.map(cat =>
    `<option value="${cat}" ${cat === currentCat ? 'selected' : ''}>${cat}</option>`
  ).join('') + `<option value="new">+ Nova Categoria...</option>`;

  if (newCatInput) newCatInput.style.display = "none";
  modal.style.display = "flex";
}

function closeEditCatModal() {
  document.getElementById("editCatModal").style.display = "none";
  currentEditLinkId = null;
}

function openLinkPasswordModal(link) {
  // Guarda o link para uso posterior na verificação
  currentProtectedLink = link;
 
  const modal = document.getElementById("linkPasswordModal");
  const urlDisplay = document.getElementById("linkPasswordUrl");
  const pwdInput = document.getElementById("linkPasswordInput");
 
  // Mostra a URL mas não a senha — apenas informativo
  if (urlDisplay) urlDisplay.value = link.url;
  if (pwdInput) pwdInput.value = ""; // Limpa campo anterior
 
  if (modal) modal.style.display = "flex";
 
  // Foca no campo de senha após a animação do modal terminar
  // O timeout de 100ms é necessário porque o display:flex
  // precisa de um ciclo de render antes do focus funcionar
  setTimeout(() => pwdInput?.focus(), 100);
}
 
function closeLinkPasswordModal() {
  document.getElementById("linkPasswordModal").style.display = "none";
  document.getElementById("linkPasswordInput").value = "";
  currentProtectedLink = null; // Limpa referência — segurança
}
// Verifica a senha e abre o link se correta
// É async porque hashPassword usa Web Crypto API (assíncrona)

async function verifyAndOpenLink() {
  if (!currentProtectedLink) return;
 
  const inputPwd = document.getElementById("linkPasswordInput")?.value;
  if (!inputPwd) {
    showToast("Digite a senha!", "error");
    return;
  }
 
  try {
    // Recalcula o hash com o mesmo salt que foi usado ao salvar
    // Se os hashes baterem, a senha está correta
    // IMPORTANTE: nunca comparamos senhas em texto puro — sempre hashes
    const computedHash = await hashPassword(inputPwd, currentProtectedLink.passwordSalt);
 
    if (computedHash === currentProtectedLink.passwordHash) {
      // Senha correta — abre o link e fecha o modal
      window.open(currentProtectedLink.url, "_blank");
      closeLinkPasswordModal();
      showToast("Link aberto!", "success");
    } else {
      // Senha errada — seleciona o campo para redigitar facilmente
      showToast("Senha incorreta!", "error");
      document.getElementById("linkPasswordInput")?.select();
    }
  } catch (err) {
    console.error("Erro ao verificar senha do link:", err);
    showToast("Erro ao verificar senha.", "error");
  }
}


async function saveEditCategory() {
  if (!currentEditLinkId) return;
  let cat = document.getElementById("editCatSelect")?.value;
  if (cat === "new") cat = document.getElementById("editNewCatInput")?.value.trim();
  if (!cat) { showToast("Digite o nome da categoria!", "error"); return; }
  await changeLinkCategory(currentEditLinkId, cat);
  closeEditCatModal();
}

// ==================== PASTAS ====================
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

async function addFolder(folderName) {
  try {
    await foldersRef.doc(folderName).set({ name: folderName, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast(`Pasta "${folderName}" criada!`);
  } catch (e) {
    console.error(e);
    showToast("Erro ao criar pasta.", "error");
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

// ==================== NOTAS ====================


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

async function addNote() {
  /*
    CORREÇÃO: usa state.activeFolder para criar a nota na pasta certa.
    "Todas" não é uma pasta real — usamos "Geral" como fallback.
  */
  const targetFolder = (state.activeFolder === "Todas") ? "Geral" : state.activeFolder;
  try {
    await notesRef.add({
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
    await db.collection("notes").doc(noteId).delete();
    showToast("Nota excluída");
  } catch (e) {
    console.error(e);
    showToast("Erro ao excluir nota.", "error");
  }
}

async function updateNote(noteId, updates) {
  try {
    await db.collection("notes").doc(noteId).update(updates);
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
        db.collection("notes").doc(n.id).update({ order: start + i })
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

  notesToShow.forEach(note => {
    const card = document.createElement("div");
    card.className = `note-card nc${note.color || 1}`;
    card.draggable = true;
    card.dataset.id = note.id;
    if (note.width) card.style.width = note.width;
    if (note.height) card.style.height = note.height;

    const date = note.timestamp
      ? new Date(note.timestamp.seconds * 1000).toLocaleString("pt-BR")
      : "Agora";

    card.innerHTML = `
      <div class="note-topbar">
        <div class="note-tbl">
          <div class="note-drag"><i class="fa-solid fa-grip-vertical"></i></div>
          ${[1, 2, 3, 4, 5, 6].map(c =>
      `<div class="cdot" data-color="${c}" style="background:${getColorCode(c)}"></div>`
    ).join('')}
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

    // Drag & drop
    card.addEventListener('dragstart', (e) => { card.classList.add('dragging'); dragSrc = card; e.dataTransfer.effectAllowed = 'move'; });
    card.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    card.addEventListener('drop', (e) => { e.preventDefault(); if (dragSrc !== card) updateNoteOrder(dragSrc.dataset.id, card.dataset.id); });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); });

    // Cor
    card.querySelectorAll('.cdot').forEach(dot =>
      dot.addEventListener('click', (e) => { e.stopPropagation(); updateNote(note.id, { color: parseInt(dot.dataset.color) }); })
    );

    // Título com debounce
    const titleInput = card.querySelector('.note-title-input');
    let titleTimer;
    titleInput.addEventListener('input', () => {
      clearTimeout(titleTimer);
      titleTimer = setTimeout(() => updateNote(note.id, { title: titleInput.value }), 600);
    });

    // Conteúdo com debounce
    const bodyText = card.querySelector('.note-body');
    let bodyTimer;
    bodyText.addEventListener('input', () => {
      clearTimeout(bodyTimer);
      bodyTimer = setTimeout(() => {
        updateNote(note.id, { content: bodyText.value });
        card.querySelector('.note-chars').innerText = `${bodyText.value.length} car.`;
      }, 600);
    });

    // Pasta
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

// ==================== TOGGLE VIEW ====================
function toggleView() {
  // Alterna entre: groups -> links -> notes -> groups
  const views = ['groups', 'links', 'notes'];
  const currentIdx = views.indexOf(state.activeView);
  state.activeView = views[(currentIdx + 1) % views.length];

  updateUILayout();
  renderAll();
}

// ==================== MODAL ADICIONAR LINK ====================
function openLinkModal() {
  const modal = document.getElementById("linkModal");
  if (!modal) return;
  modal.style.display = "flex";
  document.getElementById("urlInput")?.focus();

  const select = document.getElementById("catSelect");
  const categories = [...new Set(state.allLinks.map(l => l.category))].sort();
  select.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('')
    + `<option value="new">+ Nova Categoria...</option>`;
}

function closeLinkModal() {
  document.getElementById("linkModal").style.display = "none";
  ["urlInput", "titleInput", "linkPasswordField"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
 
  // Desmarca o checkbox e esconde o campo de senha
  const checkbox = document.getElementById("protectWithPassword");
  if (checkbox) checkbox.checked = false;
  const pwdField = document.getElementById("linkPasswordField");
  if (pwdField) pwdField.style.display = "none";
 
  const nc = document.getElementById("newCatInput");
  if (nc) { nc.style.display = "none"; nc.value = ""; }
}


async function saveLinkHandler() {
  let title = document.getElementById("titleInput")?.value.trim();
  let url = document.getElementById("urlInput")?.value.trim();
  let category = document.getElementById("catSelect")?.value;
  if (category === "new") category = document.getElementById("newCatInput")?.value.trim();
 
  // Validações básicas
  if (!title || !url || !category) {
    showToast("Preencha todos os campos!", "error");
    return;
  }
  if (!url.startsWith("http")) url = `https://${url}`;
  if (state.allLinks.some(l => l.url.toLowerCase() === url.toLowerCase())) {
    showToast("Este link já existe!", "error");
    return;
  }
 
  // Lê os campos de proteção com senha
  const protectWithPwd = document.getElementById("protectWithPassword")?.checked;
  const linkPwd = document.getElementById("linkPasswordField")?.value?.trim();
 
  // Objeto base do link
  let linkData = { title, url, category };
 
  // Se proteção ativada E senha preenchida, gera credenciais
  if (protectWithPwd && linkPwd) {
    if (linkPwd.length < 3) {
      showToast("Senha do link deve ter ao menos 3 caracteres!", "error");
      return;
    }
    // generateSalt() e hashPassword() já existem no código (usadas na autenticação do dashboard)
    // Reutilizamos a mesma infraestrutura PBKDF2 para consistência
    const salt = await generateSalt();
    const hash = await hashPassword(linkPwd, salt);
 
    linkData.protected = true;      // Flag booleana para verificação rápida
    linkData.passwordSalt = salt;   // Salt único por link (evita rainbow tables)
    linkData.passwordHash = hash;   // Hash derivado via PBKDF2-SHA256
  }
 
  try {
    await addLink(linkData);
    closeLinkModal();
    state.activeCategory = category;
    renderAll();
  } catch (err) {
    showToast("Erro ao salvar link", "error");
  }
}



// ==================== INICIALIZAÇÃO ====================
// Mostra/oculta elementos da UI baseado na view atual
function updateUILayout() {
  const catScroll = document.getElementById("catScroll");
  const linkSizeWrap = document.getElementById("linkSizeWrap");
  const exportWrap = document.getElementById("exportWrap");
  const searchWrap = document.getElementById("searchWrap");
  const sortWrap = document.getElementById("sortWrap");
  const addLinkBtn = document.getElementById("addLinkBtn");
  const addNoteBtn = document.getElementById("addNoteBtn");
  const toggleBtn = document.getElementById("toggleBtn");

  // Views
  const linksView = document.getElementById("linksView");
  const groupsView = document.getElementById("groupsView");
  const notesView = document.getElementById("notesView");

  if (!catScroll || !linkSizeWrap || !exportWrap || !searchWrap || !sortWrap || !addLinkBtn || !addNoteBtn || !toggleBtn) return;

  // Reset - oculta todas as views primeiro
  if (linksView) linksView.style.display = "none";
  if (groupsView) groupsView.style.display = "none";
  if (notesView) notesView.style.display = "none";

  // Reset
  catScroll.style.display = "flex";
  linkSizeWrap.style.display = "block";
  exportWrap.style.display = "block";
  searchWrap.style.display = "block";
  sortWrap.style.display = "block";
  addLinkBtn.classList.remove("hide");
  addNoteBtn.classList.add("hide");
  toggleBtn.innerHTML = '<i class="fa-solid fa-layer-group"></i><span>Grupos</span>';

  if (state.activeView === 'groups') {
    // Exibir view de grupos
    if (groupsView) groupsView.style.display = "block";
    // Ocultar elementos desnecessários na view de grupos
    catScroll.style.display = "none";
    linkSizeWrap.style.display = "none";
    exportWrap.style.display = "none";
    searchWrap.style.display = "none";
    sortWrap.style.display = "none";
  } else if (state.activeView === 'notes') {
    // Exibir view de notas
    if (notesView) notesView.style.display = "block";
    catScroll.style.display = "none";
    linkSizeWrap.style.display = "none";
    exportWrap.style.display = "none";
    searchWrap.style.display = "none";
    sortWrap.style.display = "none";
    addLinkBtn.classList.add("hide");
    addNoteBtn.classList.remove("hide");
    toggleBtn.innerHTML = '<i class="fa-solid fa-link"></i><span>Links</span>';
  } else {
    // View de links (padrão)
    if (linksView) linksView.style.display = "block";
  }
}

function initDashboard() {
  document.getElementById("dashboard").style.display = "block";
  updateUILayout();
  document.getElementById("loginOverlay").style.display = "none";

  // Inicializar tema
  if (typeof initTheme === 'function') initTheme();

  // Aplicar tamanho de grupo
  if (typeof applyGroupSize === 'function') applyGroupSize();

  // Se temos dados em cache, renderiza imediatamente antes do Firestore responder
  // Isso dá a sensação de carregamento instantâneo ao usuário
  if (state.allLinks.length > 0 || state.allNotes.length > 0) {
    renderAll();
    setBadge(false); // mostra "cache" até confirmar que Firestore respondeu
  }

  // Inscreve para receber atualizações em tempo real do Firestore
  subscribeLinks();
  subscribeNotes();
  subscribeFolders();

  // Event listeners — links
  document.getElementById("addLinkBtn")?.addEventListener("click", openLinkModal);
  document.getElementById("saveLink")?.addEventListener("click", saveLinkHandler);
  document.getElementById("modalClose")?.addEventListener("click", closeLinkModal);
  document.getElementById("modalCancel")?.addEventListener("click", closeLinkModal);
  document.getElementById("linkModal")?.addEventListener("click", e => { if (e.target.id === "linkModal") closeLinkModal(); });
  document.getElementById("newFolderBtn")?.addEventListener("click", () => {
  // Por simplicidade usamos prompt() — substitua por um modal se preferir
  const folderName = prompt("Nome da nova pasta:")?.trim();
  if (!folderName) return;
 
  // Valida duplicata antes de chamar o Firestore
  if (state.allFolders.includes(folderName)) {
    showToast(`Pasta "${folderName}" já existe!`, "error");
    return;
  }
 
  // Valida caracteres especiais básicos
  if (folderName.length < 1 || folderName.length > 40) {
    showToast("Nome deve ter entre 1 e 40 caracteres!", "error");
    return;
  }
 
  addFolder(folderName);
});

  // Checkbox "Proteger com senha" — mostra/esconde o campo de senha
document.getElementById("protectWithPassword")?.addEventListener("change", (e) => {
  const pwdField = document.getElementById("linkPasswordField");
  if (pwdField) {
    pwdField.style.display = e.target.checked ? "block" : "none";
    if (e.target.checked) pwdField.focus();
    else pwdField.value = "";
  }
});

  document.getElementById("linkPasswordClose")?.addEventListener("click", closeLinkPasswordModal);
document.getElementById("linkPasswordCancel")?.addEventListener("click", closeLinkPasswordModal);
document.getElementById("linkPasswordSubmit")?.addEventListener("click", verifyAndOpenLink);
document.getElementById("linkPasswordModal")?.addEventListener("click", e => {
  if (e.target.id === "linkPasswordModal") closeLinkPasswordModal();
});

  // Permite confirmar senha com Enter
document.getElementById("linkPasswordInput")?.addEventListener("keypress", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    await verifyAndOpenLink();
  }
});

  

  

  const catSelect = document.getElementById("catSelect");
  catSelect?.addEventListener("change", e => {
    const nc = document.getElementById("newCatInput");
    if (nc) nc.style.display = e.target.value === "new" ? "block" : "none";
  });
}
// Event listeners — notas
document.getElementById("addNoteBtn")?.addEventListener("click", addNote);
// Botão "Nova pasta" — abre prompt e cria a pasta via `addFolder`
document.getElementById("newFolderBtn")?.addEventListener("click", async () => {
  const name = prompt("Nome da nova pasta:");
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  if (state.allFolders && state.allFolders.includes(trimmed)) { showToast("Já existe uma pasta com esse nome.", "error"); return; }
  await addFolder(trimmed);
});

// Event listeners — tamanho
document.getElementById("linkSizeBtn")?.addEventListener("click", cycleLinkSize);
applyLinkSize();

// Event listeners — exportar links
document.getElementById("exportLinksBtn")?.addEventListener("click", exportLinksAsJSON);
refreshBackupBtnLabel();

// Event listeners — navegação
document.getElementById("toggleBtn")?.addEventListener("click", toggleView);
document.getElementById("logoutBtn")?.addEventListener("click", logout);
document.getElementById("changePasswordBtn")?.addEventListener("click", openChangePasswordModal);

// Busca
document.getElementById("searchInput")?.addEventListener("input", e => {
  state.searchTerm = e.target.value; renderAll();
});

// Editar categoria
document.getElementById("editCatClose")?.addEventListener("click", closeEditCatModal);
document.getElementById("editCatCancel")?.addEventListener("click", closeEditCatModal);
document.getElementById("saveEditCat")?.addEventListener("click", saveEditCategory);
document.getElementById("editCatSelect")?.addEventListener("change", e => {
  const ni = document.getElementById("editNewCatInput");
  if (ni) ni.style.display = e.target.value === "new" ? "block" : "none";
});
document.getElementById("editCatModal")?.addEventListener("click", e => {
  if (e.target.id === "editCatModal") closeEditCatModal();
});

// Expandir nota
const expandOverlay = document.getElementById("expandOverlay");
document.getElementById("expandClose")?.addEventListener("click", () => expandOverlay?.classList.remove("open"));
expandOverlay?.addEventListener("click", e => { if (e.target === expandOverlay) expandOverlay.classList.remove("open"); });

// Senha
document.getElementById("changePasswordClose")?.addEventListener("click", closeChangePasswordModal);
document.getElementById("changePasswordCancel")?.addEventListener("click", closeChangePasswordModal);
document.getElementById("saveNewPassword")?.addEventListener("click", saveNewPassword);
document.getElementById("changePasswordModal")?.addEventListener("click", e => { })

// Mostra/oculta elementos da UI baseado na view atual

// ==================== LOGIN ====================
async function attemptLogin() {
  const pwd = document.getElementById("loginPassword")?.value;
  if (!pwd) return;
  if (await login(pwd)) {
    initDashboard();
  } else {
    const err = document.getElementById("loginError");
    if (err) err.innerText = "Senha incorreta!";
  }
}

document.getElementById("loginBtn")?.addEventListener("click", attemptLogin);
document.getElementById("loginPassword")?.addEventListener("keypress", async e => {
  if (e.key === "Enter") { e.preventDefault(); await attemptLogin(); }
});

// ==================== EVENT LISTENERS - NOVAS FUNCIONALIDADES ====================

  // Tamanho dos grupos (se função existir)
  document.getElementById("groupSizeBtn")?.addEventListener("click",
    typeof cycleGroupSize === 'function' ? cycleGroupSize : function() {
      console.warn("cycleGroupSize não foi carregada do extensions.js");
    }
  );

  // Temas
  document.getElementById("themeBtn")?.addEventListener("click",
    typeof openThemeModal === 'function' ? openThemeModal : function() {
      console.warn("openThemeModal não foi carregada do extensions.js");
    }
  );

  document.getElementById("themeClose")?.addEventListener("click",
    typeof closeThemeModal === 'function' ? closeThemeModal : function() {
      this.closest('.modal-overlay').style.display = 'none';
    }
  );

  document.getElementById("themeCancel")?.addEventListener("click",
    typeof closeThemeModal === 'function' ? closeThemeModal : function() {
      this.closest('.modal-overlay').style.display = 'none';
    }
  );

  document.getElementById("themeSave")?.addEventListener("click",
    typeof saveThemeFromModal === 'function' ? saveThemeFromModal : function() {
      console.warn("saveThemeFromModal não foi carregada do extensions.js");
    }
  );

  // Seletor rápido de tema
  document.getElementById("quickThemeSelect")?.addEventListener("change", (e) => {
    if (e.target.value === "custom") {
      document.getElementById("customColorsSection").style.display = "block";
    } else {
      document.getElementById("customColorsSection").style.display = "none";
      if (typeof applyQuickTheme === 'function') {
        applyQuickTheme(e.target.value);
      }
    }
  });

renderAll = function () {
  if (state.activeView === 'groups') {
    renderGroups();
  } else if (state.activeView === 'notes') {
    renderNotes();
  } else { // 'links'
    renderCategories();
    renderLinks();
  }
};

// Inicialização: carrega o dashboard se já autenticado, senão mostra login
if (checkAuth()) {
  initDashboard();
} else {
  document.getElementById("loginOverlay").style.display = "flex";
}

// ==================== UTILITÁRIOS GLOBAIS (console) ====================
window.importarLinksEmLote = async (linksArray) => {
  let salvos = 0, naoSalvos = 0;
  for (const link of linksArray) {
    if (state.allLinks.some(l => l.url.toLowerCase() === link.url.toLowerCase())) {
      console.warn(`❌ Já existe: ${link.title}`); naoSalvos++; continue;
    }
    try { await addLink(link); salvos++; }
    catch { naoSalvos++; }
  }
  alert(`✅ Importados: ${salvos}\n❌ Ignorados: ${naoSalvos}`);
};

window.removerDuplicatas = async () => {
  const seen = new Set(); let removidos = 0;
  for (const link of state.allLinks) {
    if (seen.has(link.url)) { await deleteLink(link.id); removidos++; }
    else seen.add(link.url);
  }
  alert(`${removidos} duplicatas removidas.`);
};

window.resetSenha = async () => {
  await setPassword("admin123");
  showToast("Senha resetada para admin123");
};

/*
  UTILITÁRIO EXTRA: restaurar links a partir do cache local
  Caso o Firestore esteja vazio mas o localStorage tenha dados, use:
  window.restaurarLinksDoCache()
*/
window.restaurarLinksDoCache = async () => {
  const cached = cacheRead(CACHE_KEYS.links);
  if (!cached || cached.length === 0) { alert("Cache vazio."); return; }
  if (!confirm(`Reimportar ${cached.length} links do cache local para o Firestore?`)) return;
  await window.importarLinksEmLote(cached);
}

