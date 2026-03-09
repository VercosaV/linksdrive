const generateId = () => Math.random().toString(36).substr(2, 9);

// Links iniciais
const defaultLinks = [
    { id: generateId(), title: "ChatGPT", url: "https://chatgpt.com/", category: "IA" },
    { id: generateId(), title: "Gemini AI", url: "https://gemini.google.com/app", category: "IA" },
    { id: generateId(), title: "GitHub", url: "https://github.com/", category: "Dev" },
    { id: generateId(), title: "Vercel", url: "https://vercel.com/", category: "Dev" },
    { id: generateId(), title: "Alura", url: "https://cursos.alura.com.br/loginForm", category: "Cursos" },
    { id: generateId(), title: "LinkedIn", url: "https://www.linkedin.com/", category: "Networking" }
];

// --- GESTÃO DE DADOS ---
let allLinks = JSON.parse(localStorage.getItem("myLinks"));

if (!allLinks || allLinks.length === 0) {
    allLinks = defaultLinks;
    localStorage.setItem("myLinks", JSON.stringify(allLinks));
}

let activeCategory = "Todos"; 
const container = document.getElementById("linksContainer");
const navContainer = document.getElementById("categoryNav");
const modal = document.getElementById("modal");

function saveStorage() { 
    localStorage.setItem("myLinks", JSON.stringify(allLinks)); 
}

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
        // Importante: classe específica para detecção
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
            <button class="delete-btn" onclick="deleteLink('${link.id}')"><i class="fa-solid fa-trash"></i></button>
        `;
        container.appendChild(card);
    });
}

// --- DRAG AND DROP LÓGICA (CORRIGIDA) ---

new Sortable(container, {
    animation: 150,
    // ESSENCIAL: Desativa o drag nativo do HTML5 e usa elementos DOM reais
    forceFallback: true, 
    fallbackClass: "sortable-fallback", // Usa nossa classe CSS tunada
    ghostClass: "sortable-ghost",
    
    onMove: function (evt) {
        // Limpa destaques anteriores
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('drag-hover'));
        
        // Pega o evento original do mouse/toque
        const originalEvent = evt.originalEvent;
        
        // Suporte para Mouse e Touch
        const clientX = originalEvent.touches ? originalEvent.touches[0].clientX : originalEvent.clientX;
        const clientY = originalEvent.touches ? originalEvent.touches[0].clientY : originalEvent.clientY;

        // Procura o elemento EMBAIXO do mouse (graças ao pointer-events: none no CSS)
        const elUnder = document.elementFromPoint(clientX, clientY);
        
        if (elUnder) {
            // Verifica se é o botão ou está dentro do botão
            const btn = elUnder.closest('.drop-target');
            if (btn) {
                const targetCat = btn.getAttribute("data-target-cat");
                if (targetCat && targetCat !== "Todos") {
                    btn.classList.add('drag-hover');
                }
            }
        }
    },

    onEnd: function (evt) {
        // Limpa visual
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('drag-hover'));

        // Mesma lógica de detecção para o momento de soltar
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
                    const linkIndex = allLinks.findIndex(l => l.id === linkId);
                    
                    if (linkIndex > -1 && allLinks[linkIndex].category !== newCategory) {
                        // Confirmação visual (opcional) ou ação direta
                        allLinks[linkIndex].category = newCategory;
                        saveStorage();
                        
                        // Força refresh para mover o item visualmente
                        activeCategory = "Todos"; // Opcional: mantém em todos ou vai para a nova
                        renderCategories();
                        renderLinks();
                        return;
                    }
                }
            }
        }
        
        // Se soltou no nada, renderiza de volta para corrigir posição
        renderLinks(); 
    }
});

// --- FUNÇÕES CRUD ---

function addLink() {
    const title = document.getElementById("titleInput").value;
    let url = document.getElementById("urlInput").value;
    let category = document.getElementById("categorySelect").value;
    if (category === "new") category = document.getElementById("newCategoryInput").value;

    if (!title || !url || !category) return alert("Preencha tudo");
    if (!url.startsWith("http")) url = `https://${url}`;

    allLinks.push({ id: generateId(), title, url, category });
    saveStorage();
    closeModalFunc();
    activeCategory = category;
    renderCategories();
    renderLinks();
}

function deleteLink(id) {
    setTimeout(() => { 
        if(confirm("Excluir este link?")) {
            allLinks = allLinks.filter(l => l.id !== id);
            saveStorage();
            renderCategories();
            renderLinks();
        }
    }, 10);
}

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
document.getElementById("saveLink").onclick = addLink;
document.getElementById("search").addEventListener("input", renderLinks);
window.onclick = (e) => { if(e.target == modal) closeModalFunc(); }

renderCategories();
renderLinks();