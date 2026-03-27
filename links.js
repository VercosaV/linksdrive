import { state, setAllLinks, renderAll } from "./state.js";
import { showToast, escapeHtml } from "./ui.js";
// ...

export function subscribeLinks() {
  const q = query(linksRef, orderBy("category"));
  return onSnapshot(q, (snapshot) => {
    const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setAllLinks(links);
    renderAll();
  }, (error) => {
    console.error("Erro no Firebase:", error);
    showToast("Erro ao conectar com o banco de dados.", "error");
  });
}

export function renderCategories() {
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

export function renderLinks() {
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
    // ... resto do código igual, usando link.url, link.title, etc.
  });
}

export function openLinkModal() {
  // ...
  const select = document.getElementById("catSelect");
  const categories = ["Todos", ...new Set(state.allLinks.map(l => l.category))].sort();
  // ...
}

export async function saveLinkHandler() {
  // ...
  if (state.allLinks.some(l => l.url.toLowerCase() === url.toLowerCase())) {
    showToast("Este link já existe!", "error");
    return;
  }
  // ...
  state.activeCategory = category;
  renderAll();
}