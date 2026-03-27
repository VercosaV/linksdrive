import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getFirestore, enableIndexedDbPersistence,
  collection, addDoc, deleteDoc, doc,
  query, orderBy, onSnapshot, getDocs,
  serverTimestamp, updateDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

/* ── Config ── */
const fbApp = initializeApp({
  apiKey:            "AIzaSyBc3ryOJEFBQlJIUpy835Anej0OulZqHEQ",
  authDomain:        "linksdrive-4012c.firebaseapp.com",
  projectId:         "linksdrive-4012c",
  storageBucket:     "linksdrive-4012c.firebasestorage.app",
  messagingSenderId: "91948654259",
  appId:             "1:91948654259:web:2b596baed6d1ab78cc5ac6"
});
const db = getFirestore(fbApp);

/*
  enableIndexedDbPersistence:
  Ativa o cache offline do Firestore no IndexedDB do browser.
  Na próxima abertura os dados aparecem ANTES de ir à rede.
  failed-precondition → múltiplas abas abertas (só 1 suporta cache).
  unimplemented       → browser não suporta IndexedDB.
*/
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition')
    console.warn('Cache offline: múltiplas abas abertas. Funciona apenas na aba principal.');
  else if (err.code === 'unimplemented')
    console.warn('Cache offline não suportado neste browser.');
});

const linksRef   = collection(db, "links");
const notesRef   = collection(db, "notes");
const foldersRef = collection(db, "note_folders");

/* ─────────────────────────────────────────────
   ESTADO
   Maps para lookup O(1) — mais eficiente que arrays com find/filter.
───────────────────────────────────────────── */
const linksMap   = new Map(); // id → { id, title, url, category, order, timestamp }
const notesMap   = new Map(); // id → { id, content, title, color, order, folder, ... }
const foldersMap = new Map(); // id → { id, name }
let notesOrder   = [];        // IDs na ordem do campo 'order' (notas)
let linksOrder   = [];        // IDs na ordem do campo 'order' (links)

let isNotes       = false;
let activeCat     = "Todos";
let activeFolder  = "all";
let currentSort   = "cat_asc";
let expandNoteId  = null;
let linksLoaded   = false;
let dragSrcLinkId = null;

/* Maps de DOM — referências vivas aos elementos criados, evitam recriar o DOM */
const linkDomMap = new Map(); // id → .link-card element
const noteDomMap = new Map(); // id → .note-card element

/*
  COLOR_MAP: cor de fundo de cada opção de nota (índice 1–6)
  TEXT_MAP:  cor do texto correspondente para garantir contraste legível
  O amarelo (#FFD600) usa texto escuro porque é claro demais para branco.
*/
const COLOR_MAP = { 1:'#FFD600',2:'#1E90FF',3:'#00C853',4:'#FF6B00',5:'#9C27B0',6:'#F50057' };
const TEXT_MAP  = { 1:'#3D2E00',2:'#ffffff',3:'#ffffff',4:'#ffffff',5:'#ffffff',6:'#ffffff' };

/* ─────────────────────────────────────────────
   MONITOR DE CONEXÃO
───────────────────────────────────────────── */
const offlineBadge = document.getElementById('offlineBadge');
const offlineLabel = document.getElementById('offlineLabel');
function setConnectionBadge(online) {
  offlineBadge.classList.add('visible');
  offlineBadge.classList.toggle('online', online);
  offlineLabel.textContent = online ? 'Online' : 'Offline — cache local';
  if (online) setTimeout(() => offlineBadge.classList.remove('visible'), 3000);
}
window.addEventListener('online',  () => setConnectionBadge(true));
window.addEventListener('offline', () => setConnectionBadge(false));
if (!navigator.onLine) setConnectionBadge(false);

/* ─────────────────────────────────────────────
   UTILITÁRIOS
───────────────────────────────────────────── */
function toast(msg, type = '') {
  const w = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' '+type : '');
  const icon = type==='err' ? 'fa-circle-exclamation' : type==='ok' ? 'fa-check-circle' : 'fa-circle-info';
  t.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
  w.appendChild(t);
  setTimeout(() => { t.style.animation='fadeOut .28s forwards'; setTimeout(()=>t.remove(),280); }, 3000);
}

function fmtDate(ts) {
  if (!ts) return 'Agora';
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'})
       + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}

/*
  debounce(fn, ms) — atrasa a execução de fn em ms milissegundos.
  Se chamada de novo antes do prazo, reinicia o contador.
  Usado para salvar no Firestore só após o usuário parar de digitar.
*/
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function sortLinks(arr) {
  const list = [...arr];
  switch(currentSort) {
    case 'cat_asc':   return list.sort((a,b)=>a.category.localeCompare(b.category));
    case 'cat_desc':  return list.sort((a,b)=>b.category.localeCompare(a.category));
    case 'title_asc': return list.sort((a,b)=>a.title.localeCompare(b.title));
    case 'title_desc':return list.sort((a,b)=>b.title.localeCompare(a.title));
    case 'date_desc': return list.sort((a,b)=>(b.timestamp?.seconds||0)-(a.timestamp?.seconds||0));
    case 'date_asc':  return list.sort((a,b)=>(a.timestamp?.seconds||0)-(b.timestamp?.seconds||0));
    default: return list;
  }
}

/* ══════════════════════════════════════════
   LINKS
══════════════════════════════════════════ */

/*
  startLinks — 2 passos:
  1. getDocs() sem orderBy busca TODOS os docs (mesmo sem campo 'order').
     O orderBy exclui silenciosamente docs sem o campo — esse era o bug original.
  2. Se algum doc não tem 'order', grava em todos via writeBatch (transação atômica).
  3. Só então liga o onSnapshot com orderBy — agora todos têm o campo.
*/
async function startLinks() {
  const allSnap = await getDocs(linksRef);
  const allDocs = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const needsMigration = allDocs.some(l => l.order === undefined);
  if (needsMigration) {
    const sorted = [...allDocs].sort((a,b) =>
      (a.category||'').localeCompare(b.category||'')
    );
    const batch = writeBatch(db);
    sorted.forEach((l, i) => {
      if (l.order === undefined)
        batch.update(doc(db,'links',l.id), { order: i });
    });
    await batch.commit();
  }

  onSnapshot(
    query(linksRef, orderBy("order", "asc")),
    snap => {
      /*
        docChanges() retorna apenas os documentos que mudaram ('added', 'modified', 'removed').
        Isso evita reprocessar todos os 200 docs quando só 1 mudou.
      */
      snap.docChanges().forEach(change => {
        if (change.type === 'removed') linksMap.delete(change.doc.id);
        else linksMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
      });
      linksOrder = [...linksMap.values()]
        .sort((a,b) => (a.order ?? 0) - (b.order ?? 0))
        .map(l => l.id);
      linksLoaded = true;
      reconcileLinks();
      reconcileCats();
    },
    () => toast("Erro Firebase — verifique a conexão.", "err")
  );
}

/*
  reconcileLinks — diff entre estado desejado e DOM atual.
  Em vez de innerHTML = '', faz patch cirúrgico:
  - Remove do DOM apenas os cards que saíram da lista filtrada
  - Cria cards novos apenas para IDs que não existem no DOM
  - Patcha cards existentes (só toca o que mudou)
  - Reordena via appendChild (move sem recriar o elemento)
*/
function reconcileLinks() {
  if (!linksLoaded) return;
  const skeleton = document.getElementById('linksSkeleton');
  const grid     = document.getElementById('linksGrid');
  const empty    = document.getElementById('linksEmpty');
  const q        = document.getElementById('searchInput').value.toLowerCase();

  if (skeleton.style.display !== 'none') {
    skeleton.style.display = 'none';
    grid.style.display     = 'grid';
  }

  let filtered;
  if (currentSort === 'manual') {
    filtered = linksOrder
      .map(id => linksMap.get(id))
      .filter(l => l
        && (activeCat === 'Todos' || l.category === activeCat)
        && (l.title.toLowerCase().includes(q) || l.category.toLowerCase().includes(q))
      );
  } else {
    filtered = [...linksMap.values()].filter(l =>
      (activeCat === 'Todos' || l.category === activeCat)
      && (l.title.toLowerCase().includes(q) || l.category.toLowerCase().includes(q))
    );
    filtered = sortLinks(filtered);
  }

  if (!filtered.length) {
    empty.style.display = 'flex'; grid.style.display = 'none';
    linkDomMap.forEach((el,id) => { el.remove(); linkDomMap.delete(id); });
    return;
  }
  empty.style.display = 'none'; grid.style.display = 'grid';

  const visibleIds = new Set(filtered.map(l => l.id));
  linkDomMap.forEach((el,id) => { if (!visibleIds.has(id)) { el.remove(); linkDomMap.delete(id); } });

  filtered.forEach(link => {
    let card = linkDomMap.get(link.id);
    if (!card) { card = createLinkCard(link); linkDomMap.set(link.id, card); }
    else patchLinkCard(card, link);
    grid.appendChild(card); // move sem recriar se já existe
  });
}

function createLinkCard(link) {
  let dom = 'google.com';
  try { dom = new URL(link.url).hostname; } catch {}
  const card = document.createElement('div');
  card.className = 'link-card';
  card.draggable = true;
  card.dataset.id = link.id;

  /*
    O clique abre o link em nova aba, exceto quando:
    - clique no .link-del (excluir)
    - clique no .link-drag (handle de arraste)
  */
  card.onclick = e => {
    if (!e.target.closest('.link-del') && !e.target.closest('.link-drag'))
      window.open(link.url, '_blank');
  };

  card.innerHTML = `
    <span class="link-drag" title="Arrastar"><i class="fa-solid fa-grip-vertical"></i></span>
    <img data-dom="${dom}" src="https://www.google.com/s2/favicons?domain=${dom}&sz=64"
         onerror="this.src='https://cdn-icons-png.flaticon.com/512/1006/1006771.png'">
    <span class="link-title">${link.title}</span>
    <span class="link-cat-badge" style="${activeCat!=='Todos'?'display:none':''}">${link.category}</span>
    <button class="link-del" title="Excluir"><i class="fa-solid fa-trash"></i></button>`;

  /* Drag & Drop */
  card.addEventListener('dragstart', e => {
    dragSrcLinkId = link.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragover', e => {
    e.preventDefault(); // necessário para aceitar o drop
    card.classList.add('drag-over');
  });
  card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
  card.addEventListener('drop', e => {
    e.stopPropagation();
    card.classList.remove('drag-over');
    if (dragSrcLinkId && dragSrcLinkId !== link.id)
      reorderLinks(dragSrcLinkId, link.id);
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    document.querySelectorAll('.link-card.drag-over')
      .forEach(el => el.classList.remove('drag-over'));
  });

  card.querySelector('.link-del').onclick = async e => {
    e.stopPropagation();
    if (confirm(`Excluir "${link.title}"?`)) {
      // Remoção otimista: atualiza UI antes da confirmação do Firestore
      linksMap.delete(link.id);
      linksOrder = linksOrder.filter(id => id !== link.id);
      card.remove(); linkDomMap.delete(link.id);
      reconcileCats();
      try { await deleteDoc(doc(db,'links',link.id)); toast('Link excluído!','ok'); }
      catch { toast('Erro ao excluir.','err'); }
    }
  };
  return card;
}

/*
  reorderLinks — ao arrastar:
  1. Atualiza linksOrder em memória imediatamente (otimista)
  2. Muda sort para 'manual' e redesenha o DOM via appendChild
  3. Persiste só o range afetado [min(si,ti)..max(si,ti)] no Firestore
     — O(delta) em vez de O(n) para não escrever todos os docs
*/
async function reorderLinks(srcId, tgtId) {
  const si = linksOrder.indexOf(srcId);
  const ti = linksOrder.indexOf(tgtId);
  if (si < 0 || ti < 0) return;

  const arr = [...linksOrder];
  const [rm] = arr.splice(si, 1);
  arr.splice(ti, 0, rm);
  linksOrder = arr;

  currentSort = 'manual';
  document.getElementById('sortSelect').value = 'manual';
  reconcileLinks();

  const s = Math.min(si, ti), e = Math.max(si, ti);
  await Promise.all(
    Array.from({ length: e - s + 1 }, (_, i) =>
      updateDoc(doc(db,'links', arr[s + i]), { order: s + i })
    )
  );
}

/*
  patchLinkCard — atualiza apenas o que mudou no DOM.
  Evita reflow desnecessário comparando antes de escrever.
*/
function patchLinkCard(card, link) {
  const t = card.querySelector('.link-title');
  if (t.textContent !== link.title) t.textContent = link.title;
  const b = card.querySelector('.link-cat-badge');
  if (b.textContent !== link.category) b.textContent = link.category;
  b.style.display = activeCat !== 'Todos' ? 'none' : '';
  const img = card.querySelector('img');
  let dom = 'google.com';
  try { dom = new URL(link.url).hostname; } catch {}
  if (img.dataset.dom !== dom) { img.dataset.dom = dom; img.src = `https://www.google.com/s2/favicons?domain=${dom}&sz=64`; }
}

function reconcileCats() {
  const nav = document.getElementById('catNav');
  const sel = document.getElementById('catSelect');
  const all = [...linksMap.values()];
  const cats = ["Todos", ...new Set(all.map(l=>l.category))].sort((a,b)=>
    a==='Todos'?-1:b==='Todos'?1:a.localeCompare(b)
  );
  nav.innerHTML = ''; sel.innerHTML = '';
  cats.forEach(c => {
    const count = c==='Todos' ? all.length : all.filter(l=>l.category===c).length;
    const b = document.createElement('button');
    b.className = 'cat-tab'+(activeCat===c?' active':'');
    b.innerHTML = `${c}<span class="cat-count">${count}</span>`;
    b.onclick = () => {
      activeCat=c;
      reconcileLinks();
      reconcileCats();
      linkDomMap.forEach((card) => {
        const badge=card.querySelector('.link-cat-badge');
        if(badge) badge.style.display=activeCat!=='Todos'?'none':'';
      });
    };
    nav.appendChild(b);
    if (c!=='Todos') {
      const o=document.createElement('option');
      o.value=c; o.textContent=c;
      sel.appendChild(o);
    }
  });
  sel.innerHTML += `<option value="new">＋ Nova Categoria…</option>`;
}

/* Listeners de UI */
document.getElementById('sortSelect').onchange = e => { currentSort=e.target.value; reconcileLinks(); };
document.getElementById('searchInput').oninput  = () => reconcileLinks();

const linkModal = document.getElementById('linkModal');
const openModal  = () => { linkModal.style.display='flex'; document.getElementById('urlInput').focus(); };
const closeModal = () => {
  linkModal.style.display='none';
  ['urlInput','titleInput','newCatInput'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('newCatInput').style.display='none';
};
document.getElementById('addLinkBtn').onclick  = openModal;
document.getElementById('modalClose').onclick  = closeModal;
document.getElementById('modalCancel').onclick = closeModal;
window.addEventListener('click', e=>{ if(e.target===linkModal) closeModal(); });
document.getElementById('catSelect').onchange  = e =>
  document.getElementById('newCatInput').style.display=e.target.value==='new'?'block':'none';

document.getElementById('urlInput').addEventListener('blur', e=>{
  const v=e.target.value, ti=document.getElementById('titleInput');
  if(v.length>8&&ti.value===''){
    try{
      let h=new URL(v.startsWith('http')?v:`https://${v}`).hostname;
      let n=h.replace('www.','').split('.')[0];
      ti.value=n.charAt(0).toUpperCase()+n.slice(1);
    }catch{}
  }
});

document.getElementById('saveLink').onclick = async () => {
  const title = document.getElementById('titleInput').value.trim();
  let url     = document.getElementById('urlInput').value.trim();
  let cat     = document.getElementById('catSelect').value;
  if(cat==='new') cat=document.getElementById('newCatInput').value.trim();
  if(!title||!url||!cat) return toast('Preencha todos os campos!','err');
  if(!url.startsWith('http')) url='https://'+url;
  for(const l of linksMap.values())
    if(l.url.toLowerCase()===url.toLowerCase()) return toast(`"${title}" já existe!`,'err');
  const btn=document.getElementById('saveLink');
  btn.textContent='Salvando…'; btn.disabled=true;
  try{
    await addDoc(linksRef,{title,url,category:cat,timestamp:new Date(),order:linksMap.size});
    toast('Link salvo!','ok'); closeModal(); activeCat=cat; reconcileCats();
  }catch{ toast('Falha ao salvar.','err'); }
  finally{ btn.textContent='Salvar'; btn.disabled=false; }
};

/* ══════════════════════════════════════════
   TOGGLE LINKS ↔ NOTAS
══════════════════════════════════════════ */
const toggleBtn  = document.getElementById('toggleBtn');
const addNoteBtn = document.getElementById('addNoteBtn');
const linksView  = document.getElementById('linksView');
const notesView  = document.getElementById('notesView');
const catScroll  = document.getElementById('catScroll');
const addLinkBtn = document.getElementById('addLinkBtn');
const searchWrap = document.getElementById('searchWrap');
const sortWrap   = document.getElementById('sortWrap');

toggleBtn.onclick = () => {
  isNotes=!isNotes;
  linksView.style.display=isNotes?'none':'block';
  notesView.style.display=isNotes?'block':'none';
  [catScroll,addLinkBtn,searchWrap,sortWrap].forEach(el=>el.classList.toggle('hide',isNotes));
  addNoteBtn.classList.toggle('hide',!isNotes);
  toggleBtn.innerHTML=isNotes
    ?'<i class="fa-solid fa-link"></i><span> Links</span>'
    :'<i class="fa-solid fa-pen-to-square"></i><span> Notas</span>';
  if(isNotes) startNotes();
};

/* ══════════════════════════════════════════
   NOTAS
══════════════════════════════════════════ */
let notesStarted = false;

function startNotes() {
  /*
    Guard flag — registra os listeners uma única vez.
    Na segunda vez que o usuário abre Notas, apenas reconcilia o DOM.
  */
  if (notesStarted) { reconcileNotes(); return; }
  notesStarted = true;

  onSnapshot(query(foldersRef, orderBy("name")), snap => {
    snap.docChanges().forEach(c => {
      if(c.type==='removed') foldersMap.delete(c.doc.id);
      else foldersMap.set(c.doc.id,{id:c.doc.id,...c.doc.data()});
    });
    reconcileFolderTabs();
  });

  onSnapshot(query(notesRef, orderBy("order","asc")), snap => {
    snap.docChanges().forEach(c => {
      if(c.type==='removed') notesMap.delete(c.doc.id);
      else notesMap.set(c.doc.id,{id:c.doc.id,...c.doc.data()});
    });
    notesOrder=[...notesMap.values()].sort((a,b)=>(a.order??0)-(b.order??0)).map(n=>n.id);
    const noOrder=[...notesMap.values()].filter(n=>n.order===undefined);
    if(noOrder.length){ fixOrders(); return; }
    reconcileNotes();
    reconcileFolderTabs();
  });
}

async function fixOrders() {
  const sorted=[...notesMap.values()].sort((a,b)=>(a.order??Infinity)-(b.order??Infinity));
  for(let i=0;i<sorted.length;i++)
    if(sorted[i].order===undefined)
      await updateDoc(doc(db,'notes',sorted[i].id),{order:i});
}

function reconcileFolderTabs() {
  const strip=document.getElementById('folderStrip');
  strip.innerHTML='';
  const all=document.createElement('button');
  all.className='ftab'+(activeFolder==='all'?' on':'');
  all.innerHTML=`Todas <span class="ftab-count">${notesMap.size}</span>`;
  all.onclick=()=>{ activeFolder='all'; reconcileFolderTabs(); reconcileNotes(); };
  strip.appendChild(all);
  [...foldersMap.values()].forEach(f=>{
    const cnt=[...notesMap.values()].filter(n=>n.folder===f.id).length;
    const b=document.createElement('button');
    b.className='ftab'+(activeFolder===f.id?' on':'');
    b.innerHTML=`<i class="fa-solid fa-folder" style="font-size:.72rem"></i> ${f.name} <span class="ftab-count">${cnt}</span><button class="ftab-del">✕</button>`;
    b.onclick=e=>{ if(e.target.classList.contains('ftab-del')) return; activeFolder=f.id; reconcileFolderTabs(); reconcileNotes(); };
    b.querySelector('.ftab-del').onclick=async e=>{
      e.stopPropagation();
      if(!confirm(`Excluir pasta "${f.name}"? As notas ficam sem pasta.`)) return;
      const batch=writeBatch(db);
      notesMap.forEach(n=>{ if(n.folder===f.id) batch.update(doc(db,'notes',n.id),{folder:''}); });
      batch.delete(doc(db,'note_folders',f.id));
      await batch.commit();
      if(activeFolder===f.id) activeFolder='all';
    };
    strip.appendChild(b);
  });
}

document.getElementById('newFolderBtn').onclick = async () => {
  const name=prompt('Nome da nova pasta:');
  if(!name?.trim()) return;
  await addDoc(foldersRef,{name:name.trim(),created:serverTimestamp()});
  toast('Pasta criada!','ok');
};

/*
  reconcileNotes — diff + patch cirúrgico.
  notesOrder é a fonte da verdade para ordenação.
  appendChild move elementos existentes sem recriar.
*/
function reconcileNotes() {
  const grid=document.getElementById('notesGrid');
  const empty=document.getElementById('notesEmpty');
  const visible=notesOrder.filter(id=>{
    const n=notesMap.get(id);
    return n&&(activeFolder==='all'||n.folder===activeFolder);
  });
  if(!visible.length){
    empty.style.display='flex';
    noteDomMap.forEach((el,id)=>{ el.remove(); noteDomMap.delete(id); });
    return;
  }
  empty.style.display='none';
  const visSet=new Set(visible);
  noteDomMap.forEach((el,id)=>{ if(!visSet.has(id)){ el.remove(); noteDomMap.delete(id); } });
  visible.forEach(id=>{
    const note=notesMap.get(id);
    let card=noteDomMap.get(id);
    if(!card){ card=createNoteCard(note); noteDomMap.set(id,card); }
    else patchNoteCard(card,note);
    grid.appendChild(card);
  });
}

function createNoteCard(note) {
  const card=document.createElement('div');
  card.className=`note-card nc${note.color||1}`;
  card.draggable=true;
  card.dataset.id=note.id;
  if(note.width)  card.style.width=note.width;
  if(note.height) card.style.height=note.height;

  card.innerHTML=`
    <div class="note-topbar">
      <div class="note-tbl">
        <span class="note-drag"><i class="fa-solid fa-grip-vertical"></i></span>
        ${[1,2,3,4,5,6].map(c=>`<span class="cdot" style="background:${COLOR_MAP[c]}" data-c="${c}"></span>`).join('')}
      </div>
      <div class="note-tbr">
        <button class="note-btn nexpand" title="Expandir"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></button>
        <button class="note-btn danger ndel" title="Excluir"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
    <div class="note-title-wrap">
      <input class="note-title-input" type="text" placeholder="Título da nota…" value="${(note.title||'').replace(/"/g,'&quot;')}"/>
    </div>
    <textarea class="note-body" placeholder="Escreva algo…">${note.content||''}</textarea>
    <div class="note-footer">
      <span class="note-ts">${fmtDate(note.createdAt||note.timestamp)}</span>
      <span class="note-chars">${(note.content||'').length} car.</span>
      <select class="note-folder-sel">
        <option value="">Sem pasta</option>
        ${[...foldersMap.values()].map(f=>`<option value="${f.id}" ${note.folder===f.id?'selected':''}>${f.name}</option>`).join('')}
      </select>
    </div>`;

  card.addEventListener('dragstart', onDragStart);
  card.addEventListener('dragover',  onDragOver);
  card.addEventListener('dragleave', onDragLeave);
  card.addEventListener('drop',      onDrop);
  card.addEventListener('dragend',   onDragEnd);

  /*
    ResizeObserver com debounce 400ms — salva largura/altura só após
    o usuário parar de redimensionar, evitando rafaga de escritas no Firestore.
  */
  const saveSize=debounce((w,h)=>{
    updateDoc(doc(db,'notes',note.id),{width:w,height:h});
    const n=notesMap.get(note.id); if(n){ n.width=w; n.height=h; }
  },400);
  new ResizeObserver(()=>{
    const w=card.style.width, h=card.style.height;
    const n=notesMap.get(note.id);
    if(n&&(w!==n.width||h!==n.height)) saveSize(w,h);
  }).observe(card);

  /* Cor — atualização otimista: muda localmente antes do Firestore confirmar */
  card.querySelectorAll('.cdot').forEach(d=>d.onclick=()=>{
    const c=parseInt(d.dataset.c);
    updateDoc(doc(db,'notes',note.id),{color:c});
    const n=notesMap.get(note.id); if(n) n.color=c;
    card.className=`note-card nc${c}`;
    if(expandNoteId===note.id) applyExpandColor(c);
  });

  const titleInput=card.querySelector('.note-title-input');
  const saveTitle=debounce(v=>{
    updateDoc(doc(db,'notes',note.id),{title:v});
    const n=notesMap.get(note.id); if(n) n.title=v;
    if(expandNoteId===note.id) document.getElementById('expTitle').value=v;
  },900);
  titleInput.oninput=()=>saveTitle(titleInput.value);

  const ta=card.querySelector('.note-body');
  const charEl=card.querySelector('.note-chars');
  const saveContent=debounce(v=>{
    updateDoc(doc(db,'notes',note.id),{content:v});
    const n=notesMap.get(note.id); if(n) n.content=v;
    if(expandNoteId===note.id){
      document.getElementById('expBody').value=v;
      document.getElementById('expChars').textContent=v.length+' car.';
    }
  },900);
  ta.oninput=()=>{ charEl.textContent=ta.value.length+' car.'; saveContent(ta.value); };

  card.querySelector('.ndel').onclick=async()=>{
    if(confirm('Excluir nota?')){
      notesMap.delete(note.id);
      notesOrder=notesOrder.filter(id=>id!==note.id);
      card.remove(); noteDomMap.delete(note.id);
      reconcileFolderTabs();
      await deleteDoc(doc(db,'notes',note.id));
    }
  };

  card.querySelector('.note-folder-sel').onchange=e=>{
    updateDoc(doc(db,'notes',note.id),{folder:e.target.value});
    const n=notesMap.get(note.id); if(n) n.folder=e.target.value;
  };

  card.querySelector('.nexpand').onclick=()=>openExpandModal(note.id);

  return card;
}

/*
  patchNoteCard — regra de ouro: se o elemento está focado, não mexemos no valor.
  Isso protege o usuário que está digitando de perder o cursor ou o foco.
*/
function patchNoteCard(card, note) {
  const colorClass=`nc${note.color||1}`;
  if(!card.classList.contains(colorClass)) card.className=`note-card ${colorClass}`;

  const titleInput=card.querySelector('.note-title-input');
  if(document.activeElement!==titleInput && titleInput.value!==(note.title||''))
    titleInput.value=note.title||'';

  const ta=card.querySelector('.note-body');
  if(document.activeElement!==ta && ta.value!==(note.content||''))
    ta.value=note.content||'';

  const charEl=card.querySelector('.note-chars');
  const cs=(note.content||'').length+' car.';
  if(charEl.textContent!==cs) charEl.textContent=cs;

  if(note.width  && card.style.width!==note.width)   card.style.width=note.width;
  if(note.height && card.style.height!==note.height) card.style.height=note.height;

  const fsel=card.querySelector('.note-folder-sel');
  if(fsel.value!==(note.folder||'')) fsel.value=note.folder||'';
}

/* ── Modal expandir nota ── */
function applyExpandColor(c){
  const box=document.getElementById('expandBox');
  box.style.background=COLOR_MAP[c];
  box.style.color=TEXT_MAP[c];
}

function openExpandModal(noteId){
  const note=notesMap.get(noteId); if(!note) return;
  expandNoteId=noteId;
  const taExp=document.getElementById('expBody');
  const titleExp=document.getElementById('expTitle');
  applyExpandColor(note.color||1);
  titleExp.value=note.title||'';
  taExp.value=note.content||'';
  document.getElementById('expTs').textContent=fmtDate(note.createdAt||note.timestamp);
  document.getElementById('expChars').textContent=(note.content||'').length+' car.';

  const dotsWrap=document.getElementById('expDots');
  dotsWrap.innerHTML='';
  [1,2,3,4,5,6].forEach(c=>{
    const d=document.createElement('span'); d.className='cdot'; d.style.background=COLOR_MAP[c];
    d.onclick=()=>{
      updateDoc(doc(db,'notes',noteId),{color:c});
      const n=notesMap.get(noteId); if(n) n.color=c;
      applyExpandColor(c);
      const card=noteDomMap.get(noteId); if(card) card.className=`note-card nc${c}`;
    };
    dotsWrap.appendChild(d);
  });

  const fsel=document.getElementById('expFolder');
  fsel.innerHTML=`<option value="">Sem pasta</option>`
    +[...foldersMap.values()].map(f=>`<option value="${f.id}" ${note.folder===f.id?'selected':''}>${f.name}</option>`).join('');
  fsel.onchange=e=>{
    updateDoc(doc(db,'notes',noteId),{folder:e.target.value});
    const n=notesMap.get(noteId); if(n) n.folder=e.target.value;
  };

  const saveTitle=debounce(v=>{
    updateDoc(doc(db,'notes',noteId),{title:v});
    const n=notesMap.get(noteId); if(n) n.title=v;
    const card=noteDomMap.get(noteId);
    if(card){ const inp=card.querySelector('.note-title-input'); if(inp&&document.activeElement!==inp) inp.value=v; }
  },900);
  const saveContent=debounce(v=>{
    updateDoc(doc(db,'notes',noteId),{content:v});
    const n=notesMap.get(noteId); if(n) n.content=v;
    const card=noteDomMap.get(noteId);
    if(card){
      const ta=card.querySelector('.note-body');
      const ch=card.querySelector('.note-chars');
      if(ta&&document.activeElement!==ta) ta.value=v;
      if(ch) ch.textContent=v.length+' car.';
    }
  },900);
  titleExp.oninput=()=>saveTitle(titleExp.value);
  taExp.oninput=()=>{
    document.getElementById('expChars').textContent=taExp.value.length+' car.';
    saveContent(taExp.value);
  };

  document.getElementById('expandOverlay').classList.add('open');
  taExp.focus();
}

function closeExpandModal(){
  document.getElementById('expandOverlay').classList.remove('open');
  expandNoteId=null;
}
document.getElementById('expandClose').onclick=closeExpandModal;
document.getElementById('expandOverlay').addEventListener('click',e=>{
  if(e.target===document.getElementById('expandOverlay')) closeExpandModal();
});

/* ── Drag & Drop notas ── */
let dragSrcId=null;
function onDragStart(e){ dragSrcId=this.dataset.id; this.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; }
function onDragOver(e) { e.preventDefault(); this.classList.add('drag-over'); return false; }
function onDragLeave()  { this.classList.remove('drag-over'); }
function onDrop(e)      { e.stopPropagation(); this.classList.remove('drag-over'); if(dragSrcId&&dragSrcId!==this.dataset.id) reorderNotes(dragSrcId,this.dataset.id); return false; }
function onDragEnd()    { this.classList.remove('dragging'); document.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over')); }

async function reorderNotes(srcId, tgtId){
  const si=notesOrder.indexOf(srcId), ti=notesOrder.indexOf(tgtId);
  if(si<0||ti<0) return;
  const arr=[...notesOrder];
  const[rm]=arr.splice(si,1);
  arr.splice(ti,0,rm);
  notesOrder=arr;
  reconcileNotes();
  const s=Math.min(si,ti), e=Math.max(si,ti);
  await Promise.all(
    Array.from({length:e-s+1},(_,i)=>
      updateDoc(doc(db,'notes',arr[s+i]),{order:s+i})
    )
  );
}

addNoteBtn.onclick=async()=>{
  await addDoc(notesRef,{
    content:'', title:'',
    color:Math.floor(Math.random()*6)+1,
    order:notesOrder.length,
    folder:activeFolder==='all'?'':activeFolder,
    createdAt:serverTimestamp(),
    timestamp:serverTimestamp()
  });
};

/* ── Helpers de console ── */
window.importarLinksEmLote=async arr=>{
  let ok=0,nok=0;
  for(const l of arr){
    let dup=false;
    for(const x of linksMap.values())
      if(x.url.toLowerCase()===l.url.toLowerCase()){dup=true;break;}
    if(dup){nok++;continue;}
    try{await addDoc(linksRef,{...l,timestamp:new Date()});ok++;}catch{nok++;}
  }
  alert(`Importação: ✅ ${ok}  ❌ ${nok}`);
};

window.removerDuplicatas=async()=>{
  const seen=new Set(); let n=0;
  for(const l of linksMap.values()){
    if(seen.has(l.url)){
      await deleteDoc(doc(db,'links',l.id));
      n++;
    } else {
      seen.add(l.url);
    }
  }
  alert(`${n} duplicatas removidas.`);
};

/* Inicializa */
startLinks();