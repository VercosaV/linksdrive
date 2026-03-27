import { subscribeLinks } from "./links.js";
import { subscribeNotes } from "./notes.js";
import { renderLinks, renderCategories, openLinkModal, closeLinkModal, saveLinkHandler } from "./links.js";
import { renderNotes, addNote, openExpandNote } from "./notes.js";
import { login, logout, checkAuth, openChangePasswordModal, closeChangePasswordModal, saveNewPassword } from "./auth.js";
import { showToast } from "./ui.js";
import {
  allLinks, allNotes,
  activeCategory, searchTerm, sortValue, isNotesView, activeFolder,
  setAllLinks, setAllNotes, setRenderAll
} from "./state.js";

import { updateNote } from "./notes.js";
import { createFolder } from "./notes.js";

// Dentro de initDashboard
document.getElementById("newFolderBtn").onclick = async () => {
  const folderName = prompt("Nome da nova pasta:");
  if (folderName && folderName.trim()) {
    await createFolder(folderName.trim());
  }
};

// Injeção da função renderAll
setRenderAll(renderAll);

function renderAll() {
  if (isNotesView) {
    renderNotes();
  } else {
    renderCategories();
    renderLinks();
  }
}

// Toggle entre Links e Notas
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

// Inicialização após login
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

  // Nova pasta
  document.getElementById("newFolderBtn").onclick = async () => {
    const folderName = prompt("Nome da nova pasta:");
    if (!folderName || !folderName.trim()) return;
    const trimmed = folderName.trim();
    
    // Cria uma nota temporária com essa pasta
    const { addNote } = await import("./notes.js");
    await addNote();
    // Após criar, a nota terá pasta "Geral" por padrão. Precisamos atualizá-la.
    // Como a nota é criada assincronamente e pode não estar em allNotes ainda,
    // usamos um pequeno delay ou observamos a mudança. Uma forma simples:
    setTimeout(() => {
      const lastNote = allNotes[allNotes.length - 1];
      if (lastNote) {
        updateNote(lastNote.id, { folder: trimmed, title: `📁 ${trimmed}`, content: "Pasta criada automaticamente" });
      }
    }, 100);
    showToast(`Pasta "${trimmed}" criada.`, "success");
  };

  // Carregar dados do Firebase
  subscribeLinks();
  subscribeNotes();
}

// Login com Enter
document.getElementById("loginPassword")?.addEventListener("keypress", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    await attemptLogin();
  }
});

async function attemptLogin() {
  const pwd = document.getElementById("loginPassword").value;
  if (await login(pwd)) {
    initDashboard();
  } else {
    document.getElementById("loginError").innerText = "Senha incorreta!";
  }
}

document.getElementById("loginBtn").onclick = attemptLogin;

// Verificar autenticação inicial
if (checkAuth()) {
  initDashboard();
} else {
  document.getElementById("loginOverlay").style.display = "flex";
}

// Utilitários expostos globalmente (console)
window.importarLinksEmLote = async (linksArray) => {
  const { addLink } = await import("./links.js");
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
  const { deleteLink } = await import("./links.js");
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