import { db, linksRef } from "./firebase.js";
import { addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { showToast, escapeHtml } from "./ui.js";
import { allLinks, activeCategory, searchTerm, sortValue, setAllLinks, renderAll } from "./state.js";
import { query, orderBy, onSnapshot } from "firebase/firestore";

// Inscrição nos links do Firestore
export function subscribeLinks() {
  const q = query(linksRef, orderBy("category"));
  return onSnapshot(q, (snapshot) => {
    const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setAllLinks(links);
    renderAll(); // força rerender
  }, (error) => {
    console.error("Erro no Firebase:", error);
    showToast("Erro ao conectar com o banco de dados.", "error");
  });
}

export async function addLink(linkData) {
  try {
    await addDoc(linksRef, { ...linkData, timestamp: serverTimestamp() });
    showToast("Link salvo com sucesso!");
  } catch (error) {
    console.error("Erro ao adicionar link:", error);
    showToast("Erro ao salvar link.", "error");
    throw error;
  }
}

export async function deleteLink(linkId) {
  try {
    await deleteDoc(doc(db, "links", linkId));
    showToast("Link excluído com sucesso!");
  } catch (error) {
    console.error("Erro ao excluir link:", error);
    showToast("Erro ao excluir o link.", "error");
  }
}

// Renderiza as categorias (abas e select do modal)
export function renderCategories() {
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

// Renderiza os links no grid
export function renderLinks() {
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

// Modal de adicionar link
export function openLinkModal() {
  const modal = document.getElementById("linkModal");
  modal.style.display = "flex";
  document.getElementById("urlInput").focus();
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

export function closeLinkModal() {
  document.getElementById("linkModal").style.display = "none";
  document.getElementById("urlInput").value = "";
  document.getElementById("titleInput").value = "";
  document.getElementById("newCatInput").style.display = "none";
  document.getElementById("newCatInput").value = "";
}

export async function saveLinkHandler() {
  let title = document.getElementById("titleInput").value.trim();
  let url = document.getElementById("urlInput").value.trim();
  let category = document.getElementById("catSelect").value;
  if (category === "new") category = document.getElementById("newCatInput").value.trim();

  if (!title || !url || !category) {
    showToast("Preencha todos os campos!", "error");
    return;
  }
  if (!url.startsWith("http")) url = `https://${url}`;

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