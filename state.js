// state.js
export const state = {
  allLinks: [],
  allNotes: [],
  activeCategory: "Todos",
  searchTerm: "",
  sortValue: "manual",
  isNotesView: false,
  activeFolder: "Todas"
};

export function setAllLinks(links) {
  state.allLinks = links;
}
export function setAllNotes(notes) {
  state.allNotes = notes;
}

export let renderAll = () => {};
export function setRenderAll(fn) {
  renderAll = fn;
}