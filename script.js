// Importações do Firebase (via CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-database.js";

// COLOQUE SUAS CREDENCIAIS AQUI (Você acha isso nas configurações do projeto no Firebase)
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_MESSAGING_ID",
  appId: "SEU_APP_ID"
};

// Inicializa Firebase e Database
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const linksRef = ref(db, 'links');

let allLinks = [];
let activeCategory = "Todos"; 
const container = document.getElementById("linksContainer");
const navContainer = document.getElementById("categoryNav");
const modal = document.getElementById("modal");

// --- ESCUTA O FIREBASE EM TEMPO REAL ---
onValue(linksRef, (snapshot) => {
    allLinks = [];
    snapshot.forEach((childSnapshot) => {
        // Pega a chave única gerada pelo Firebase e os dados do link
        allLinks.push({ id: childSnapshot.key, ...childSnapshot.val() });
    });
    renderCategories();
    renderLinks();
});

// --- RENDERIZAÇÃO ---
function renderCategories() {
    const categories = ["Todos", ...new Set(allLinks.map(l => l.category))].sort();
    
    navContainer.innerHTML = "";
    const select = document.getElementById("categorySelect");
    select.innerHTML = "";

    categories.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = `nav-item ${activeCategory === cat ? 'active' : ''}`;
        btn.innerText = cat;
        btn.classList.add("drop-target"); 
        btn.setAttribute("data-target-cat", cat); 
        
        btn.onclick = () => {
            activeCategory = cat;
            renderCategories();
            renderLinks();
        };
        navContainer.appendChild(btn);
    });

    categories.filter(c => c !== "Todos").forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.innerText = c;
        select.appendChild(opt);
    });
    const newOpt = document.createElement("option");
    newOpt.value = "new";
    newOpt.innerText = "+ Nova...";
    select.appendChild(newOpt);
}

function renderLinks() {
    container.innerHTML = "";
    const searchTerm = document.getElementById("search").value.toLowerCase();
    
    const filteredLinks = allLinks.filter(l => {
        const matchesCategory = activeCategory === "Todos" ? true : l.category === activeCategory;
        const matchesSearch = l.title.toLowerCase().includes(searchTerm);
        return matchesCategory && matchesSearch;
    });

    filteredLinks.forEach(link => {
        const card = document.createElement("div");
        card.className = "card";
        card.setAttribute("data-id", link.id);
        
        card.onclick = (e) => {
            if(!e.target.closest('.delete-btn')) {
                window.open(link.url, '_blank');
            }
        };
        
        const domain = new URL(link.url).hostname;
        const iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

        card.innerHTML = `
            <img src="${iconUrl}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1006/1006771.png'">
            <span>${link.title}</span>
            <button class="delete-btn" onclick="window.deleteLink('${link.id}')"><i class="fa-solid fa-trash"></i></button>
        `;
        container.appendChild(card);
    });
}

// --- DRAG AND DROP LÓGICA ---
new Sortable(container, {
    animation: 150,
    forceFallback: true, 
    fallbackClass: "sortable-fallback", 
    ghostClass: "sortable-ghost",
    
    onMove: function (evt) {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('drag-hover'));
        const originalEvent = evt.originalEvent;
        const clientX = originalEvent.touches ? originalEvent.touches[0].clientX : originalEvent.clientX;
        const clientY = originalEvent.touches ? originalEvent.touches[0].clientY : originalEvent.clientY;
        const elUnder = document.elementFromPoint(clientX, clientY);
        
        if (elUnder) {
            const btn = elUnder.closest('.drop-target');
            if (btn) {
                const targetCat = btn.getAttribute("data-target-cat");
                if (targetCat && targetCat !== "Todos") btn.classList.add('drag-hover');
            }
        }
    },

    onEnd: function (evt) {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('drag-hover'));
        const originalEvent = evt.originalEvent;
        const clientX = originalEvent.changedTouches ? originalEvent.changedTouches[0].clientX : originalEvent.clientX;
        const clientY = originalEvent.changedTouches ? originalEvent.changedTouches[0].clientY : originalEvent.clientY;
        const elUnder = document.elementFromPoint(clientX, clientY);
        
        if (elUnder) {
            const btn = elUnder.closest('.drop-target');
            if (btn) {
                const newCategory = btn.getAttribute("data-target-cat");
                const linkId = evt.item.getAttribute("data-id");

                if (newCategory && newCategory !== "Todos") {
                    // Atualiza a categoria diretamente no Firebase
                    const linkRef = ref(db, 'links/' + linkId);
                    update(linkRef, { category: newCategory });
                    return;
                }
            }
        }
        renderLinks(); 
    }
});

// --- FUNÇÕES CRUD FIREBASE ---

// Precisamos atrelar ao window pois usamos type="module" e onclick no HTML
window.addLink = function() {
    const title = document.getElementById("titleInput").value;
    let url = document.getElementById("urlInput").value;
    let category = document.getElementById("categorySelect").value;
    if (category === "new") category = document.getElementById("newCategoryInput").value;

    if (!title || !url || !category) return alert("Preencha tudo");
    if (!url.startsWith("http")) url = `https://${url}`;

    // Cria um novo registro no Firebase
    const newLinkRef = push(linksRef);
    set(newLinkRef, { title, url, category }).then(() => {
        closeModalFunc();
        activeCategory = category;
    });
};

window.deleteLink = function(id) {
    setTimeout(() => { 
        if(confirm("Excluir este link?")) {
            // Remove do Firebase
            remove(ref(db, 'links/' + id));
        }
    }, 10);
};

// Eventos
const closeModalFunc = () => {
    modal.style.display = "none";
    document.getElementById("urlInput").value = "";
    document.getElementById("titleInput").value = "";
    document.getElementById("newCategoryInput").style.display = "none";
};

document.getElementById("urlInput").addEventListener("input", (e) => {
    const val = e.target.value;
    const titleInput = document.getElementById("titleInput");
    if(val.length > 8 && titleInput.value === ""){
        try {
            let host = new URL(val.startsWith("http") ? val : `https://${val}`).hostname;
            let name = host.replace("www.","").split(".")[0];
            titleInput.value = name.charAt(0).toUpperCase() + name.slice(1);
        } catch(e){}
    }
});

document.getElementById("categorySelect").addEventListener("change", (e) => {
    document.getElementById("newCategoryInput").style.display = e.target.value === "new" ? "block" : "none";
});

document.getElementById("addBtn").onclick = () => { modal.style.display = "flex"; document.getElementById("urlInput").focus(); };
document.getElementById("closeModal").onclick = closeModalFunc;
document.getElementById("saveLink").onclick = window.addLink;
document.getElementById("search").addEventListener("input", renderLinks);
window.onclick = (e) => { if(e.target == modal) closeModalFunc(); }

// Torna a função de importar global para você rodar no console
window.importarLinksDoArquivo = importarLinksDoArquivo;

// Função auxiliar para importar seu TXT de uma vez só!
function importarLinksDoArquivo() {
    const meusFavoritosTxt = [
        { title: "ChatGPT", url: "https://chatgpt.com/", category: "IAs" },
        { title: "Gemini", url: "https://gemini.google.com/app", category: "IAs" },
        { title: "Manus Im", url: "https://manus.im/app", category: "IAs" },
        { title: "Vercel", url: "https://vercel.com/victors-projects-9d919fd2", category: "Dev" },
        { title: "Supabase", url: "https://supabase.com/dashboard/sign-in?returnTo=%2Forganizations", category: "Dev" },
        { title: "AWS", url: "https://us-east-1.signin.aws/platform/d-9067642ac7/login", category: "Dev" },
        { title: "DeepSeek", url: "https://chat.deepseek.com/sign_in", category: "IAs" },
        { title: "JSON Formatter", url: "https://jsonformatter.curiousconcept.com/#", category: "Ferramentas" },
        { title: "Teams (Faculdade)", url: "https://teams.microsoft.com/v2/", category: "Faculdade" },
        { title: "Siga (Faculdade)", url: "https://siga.cps.sp.gov.br/sigaaluno/applogin.aspx", category: "Faculdade" },
        { title: "DIO", url: "https://auth.dio.me/...", category: "Cursos" },
        { title: "Alura", url: "https://cursos.alura.com.br/", category: "Cursos" },
        { title: "Circle", url: "https://login.circle.so/sign_in", category: "Cursos" },
        { title: "Estudar.org", url: "https://ead.estudar.org.br/users/sign_in", category: "Cursos" },
        { title: "Unity", url: "https://cursos.dankicode.com/unity?ref=U77942400J", category: "Dev" },
        { title: "Laravel", url: "https://www.cursou.com.br/informatica/programacao/php/laravel-framework-php-desenvolvimento-web/", category: "Dev" },
        { title: "Diagramas", url: "https://app.diagrams.net/", category: "Ferramentas" },
        { title: "Song BPM", url: "https://getsongbpm.com/", category: "Música" },
        { title: "Aspire Leaders", url: "https://engage.aspireleaders.org/profile", category: "Networking" },
        { title: "Retro Games", url: "https://www.retrogames.onl/", category: "Jogos" },
        { title: "Game3RB", url: "https://game3rb.com/category/games-online/", category: "Jogos" },
        { title: "Nexus Mods (Skyrim)", url: "https://www.nexusmods.com/skyrim/mods/116605", category: "Jogos" },
        { title: "WarriorJS", url: "https://warriorjs.com/", category: "Jogos" },
        { title: "Repertório Violino", url: "https://canalparaviolinistas.com/downloads/", category: "Música" },
        { title: "GitHub", url: "https://github.com/", category: "Dev" },
        { title: "LinkedIn", url: "https://www.linkedin.com/", category: "Networking" },
        { title: "Guia Monster Hunter", url: "https://guiadomh.carrd.co/", category: "Jogos" }
    ];

    meusFavoritosTxt.forEach(link => {
        const newRef = push(linksRef); // Usa o linksRef criado no topo do arquivo
        set(newRef, link);
    });

    console.log("Todos os links do TXT foram importados para o Firebase com sucesso!");
}