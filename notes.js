import { db, notesRef } from "./firebase.js";
import { addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { showToast, escapeHtml, getColorCode } from "./ui.js";
import { allNotes, activeFolder, setAllNotes, renderAll } from "./state.js";
import { query, orderBy, onSnapshot } from "firebase/firestore";

let dragSrc = null;

// Inscrição nas notas
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

export async function deleteNote(noteId) {
  try {
    await deleteDoc(doc(db, "notes", noteId));
    showToast("Nota excluída");
  } catch (error) {
    console.error("Erro ao excluir nota:", error);
    showToast("Erro ao excluir nota.", "error");
  }
}

export async function updateNote(noteId, updates) {
  try {
    await updateDoc(doc(db, "notes", noteId), updates);
  } catch (error) {
    console.error("Erro ao atualizar nota:", error);
    showToast("Erro ao atualizar nota.", "error");
  }
}

export async function updateNoteOrder(sourceId, targetId) {
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

// Renderiza as notas
export function renderNotes() {
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

// Expandir nota (modal grande)
let currentEditNoteId = null;

export function openExpandNote(noteId) {
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

  const folders = ["Geral", ...new Set(allNotes.map(n => n.folder || "Geral"))];
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