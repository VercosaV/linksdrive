import { state, setAllNotes, renderAll } from "./state.js";
// ...

export function subscribeNotes() {
  const q = query(notesRef, orderBy("order", "asc"));
  return onSnapshot(q, (snapshot) => {
    const notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setAllNotes(notes);
    renderAll();
  }, (error) => {
    console.error("Erro ao carregar notas:", error);
    showToast("Erro ao carregar notas.", "error");
  });
}

export async function addNote() {
  try {
    const color = Math.floor(Math.random() * 6) + 1;
    const order = state.allNotes.length;
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

export async function updateNoteOrder(sourceId, targetId) {
  const sourceIndex = state.allNotes.findIndex(n => n.id === sourceId);
  const targetIndex = state.allNotes.findIndex(n => n.id === targetId);
  // ...
}

export function renderNotes() {
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
        // ... código do botão excluir pasta
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
  // ... renderizar cards
}

export function openExpandNote(noteId) {
  const note = state.allNotes.find(n => n.id === noteId);
  // ...
}