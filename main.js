import { state, setAllLinks, setAllNotes, setRenderAll } from "./state.js";
import { showToast } from "./ui.js";
// ... outros imports

setRenderAll(renderAll);

function renderAll() {
  if (state.isNotesView) {
    renderNotes();
  } else {
    renderCategories();
    renderLinks();
  }
}

function toggleView() {
  state.isNotesView = !state.isNotesView;
  const linksView = document.getElementById("linksView");
  const notesView = document.getElementById("notesView");
  const addLinkBtn = document.getElementById("addLinkBtn");
  const addNoteBtn = document.getElementById("addNoteBtn");
  const searchWrap = document.getElementById("searchWrap");
  const sortWrap = document.getElementById("sortWrap");
  const toggleBtn = document.getElementById("toggleBtn");

  if (state.isNotesView) {
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

function initDashboard() {
  // ...
  document.getElementById("searchInput").oninput = (e) => { state.searchTerm = e.target.value; renderAll(); };
  document.getElementById("sortSelect").onchange = (e) => { state.sortValue = e.target.value; renderAll(); };
  // ...
  document.getElementById("newFolderBtn").onclick = async () => {
    const folderName = prompt("Nome da nova pasta:");
    if (!folderName || !folderName.trim()) return;
    const trimmed = folderName.trim();
    await addNote(); // isso cria uma nota vazia com pasta "Geral"
    setTimeout(() => {
      const lastNote = state.allNotes[state.allNotes.length - 1];
      if (lastNote) {
        updateNote(lastNote.id, { folder: trimmed, title: `📁 ${trimmed}`, content: "Pasta criada automaticamente" });
      }
    }, 100);
    showToast(`Pasta "${trimmed}" criada.`, "success");
  };
  // ...
}

// Utilitários globais
window.importarLinksEmLote = async (linksArray) => {
  const { addLink } = await import("./links.js");
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
  const { deleteLink } = await import("./links.js");
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