// Dados principais
export let allLinks = [];
export let allNotes = [];

// Estado da UI
export let activeCategory = "Todos";
export let searchTerm = "";
export let sortValue = "manual";
export let isNotesView = false;
export let activeFolder = "Todas";

// Funções para atualizar os dados (chamadas pelos listeners)
export function setAllLinks(links) {
  allLinks = links;
}

export function setAllNotes(notes) {
  allNotes = notes;
}

// Re-renderização global – será sobrescrita pelo main.js
export let renderAll = () => {};

export function setRenderAll(fn) {
  renderAll = fn;
}