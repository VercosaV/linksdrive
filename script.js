const generateId = () => Math.random().toString(36).substr(2, 9);

const defaultLinks = [
    // IA
    { id: generateId(), title: "ChatGPT", url: "https://chatgpt.com/", category: "IA" },
    { id: generateId(), title: "Gemini AI", url: "https://gemini.google.com/app", category: "IA" },
    { id: generateId(), title: "Manus", url: "https://manus.im/app", category: "IA" },
    { id: generateId(), title: "DeepSeek", url: "https://chat.deepseek.com/sign_in", category: "IA" },
    
    // Dev & Tools
    { id: generateId(), title: "GitHub", url: "https://github.com/", category: "Dev" },
    { id: generateId(), title: "Vercel", url: "https://vercel.com/victors-projects-9d919fd2", category: "Dev" },
    { id: generateId(), title: "Supabase", url: "https://supabase.com/dashboard/sign-in", category: "Dev" },
    { id: generateId(), title: "AWS Console", url: "https://us-east-1.signin.aws/platform/d-9067642ac7/login", category: "Dev" },
    { id: generateId(), title: "JSON Formatter", url: "https://jsonformatter.curiousconcept.com/", category: "Dev" },
    { id: generateId(), title: "Diagrams.net", url: "https://app.diagrams.net/", category: "Dev" },

    // Faculdade
    { id: generateId(), title: "Microsoft Teams", url: "https://teams.microsoft.com/v2/", category: "Faculdade" },
    { id: generateId(), title: "SIGA Aluno", url: "https://siga.cps.sp.gov.br/sigaaluno/applogin.aspx", category: "Faculdade" },

    // Cursos
    { id: generateId(), title: "Alura", url: "https://cursos.alura.com.br/loginForm", category: "Cursos" },
    { id: generateId(), title: "DIO", url: "https://web.dio.me/home", category: "Cursos" },
    { id: generateId(), title: "Circle.so", url: "https://login.circle.so/sign_in", category: "Cursos" },
    { id: generateId(), title: "Estudar Na Prática", url: "https://ead.estudar.org.br/users/sign_in", category: "Cursos" },
    { id: generateId(), title: "Danki Unity", url: "https://cursos.dankicode.com/unity?ref=U77942400J", category: "Cursos" },
    { id: generateId(), title: "Curso Laravel", url: "https://www.cursou.com.br/informatica/programacao/php/laravel-framework-php-desenvolvimento-web/", category: "Cursos" },

    // Música
    { id: generateId(), title: "Song BPM", url: "https://getsongbpm.com/", category: "Música" },
    { id: generateId(), title: "Violino Downloads", url: "https://canalparaviolinistas.com/downloads/", category: "Música" },

    // Networking
    { id: generateId(), title: "LinkedIn", url: "https://www.linkedin.com/feed/", category: "Networking" },
    { id: generateId(), title: "Aspire Leaders", url: "https://engage.aspireleaders.org/profile", category: "Networking" },

    // Jogos
    { id: generateId(), title: "RetroGames", url: "https://www.retrogames.onl/", category: "Jogos" },
    { id: generateId(), title: "Game3rb", url: "https://game3rb.com/category/games-online", category: "Jogos" },
    { id: generateId(), title: "Nexus Mods", url: "https://www.nexusmods.com/skyrim/mods/116605", category: "Jogos" },
    { id: generateId(), title: "WarriorJS", url: "https://warriorjs.com/", category: "Jogos" },
    { id: generateId(), title: "Guia Monster Hunter", url: "https://guiadomh.carrd.co/", category: "Jogos" }
];

let customLinks = JSON.parse(localStorage.getItem("myLinks")) || [];
let activeCategory = "Todos"; 

const container = document.getElementById("linksContainer");
const navContainer = document.getElementById("categoryNav");
const modal = document.getElementById("modal");

function getAllLinks() { return [...defaultLinks, ...customLinks]; }
function saveStorage() { localStorage.setItem("myLinks", JSON.stringify(customLinks)); }

function renderCategories() {
    const links = getAllLinks();
    const categories = ["Todos", ...new Set(links.map(l => l.category))].sort();
    
    navContainer.innerHTML = "";
    const select = document.getElementById("categorySelect");
    select.innerHTML = "";

    categories.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = `nav-item ${activeCategory === cat ? 'active' : ''}`;
        btn.innerText = cat;
        btn.onclick = () => {
            activeCategory = cat;
            renderCategories();
            renderLinks();
        };
        navContainer.appendChild(btn);
    });

    // Select do Modal
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
    
    const filteredLinks = getAllLinks().filter(l => {
        const matchesCategory = activeCategory === "Todos" ? true : l.category === activeCategory;
        const matchesSearch = l.title.toLowerCase().includes(searchTerm);
        return matchesCategory && matchesSearch;
    });

    filteredLinks.forEach(link => {
        const card = document.createElement("a");
        card.className = "card";
        card.href = link.url;
        card.target = "_blank";
        card.rel = "noopener noreferrer";

        const domain = new URL(link.url).hostname;
        // Ícone pequeno (32px) para carregar rápido e ficar clean
        const iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

        const isCustom = customLinks.some(cl => cl.id === link.id);
        const deleteBtn = isCustom 
            ? `<button class="delete-btn" onclick="event.preventDefault(); deleteLink('${link.id}')"><i class="fa-solid fa-trash"></i></button>`
            : '';

        card.innerHTML = `
            <img src="${iconUrl}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1006/1006771.png'">
            <span>${link.title}</span>
            ${deleteBtn}
        `;
        container.appendChild(card);
    });
}

function addLink() {
    const title = document.getElementById("titleInput").value;
    let url = document.getElementById("urlInput").value;
    let category = document.getElementById("categorySelect").value;
    if (category === "new") category = document.getElementById("newCategoryInput").value;

    if (!title || !url || !category) return alert("Preencha tudo");
    if (!url.startsWith("http")) url = `https://${url}`;

    customLinks.push({ id: generateId(), title, url, category });
    saveStorage();
    closeModalFunc();
    activeCategory = category;
    renderCategories();
    renderLinks();
}

function deleteLink(id) {
    if(confirm("Excluir?")) {
        customLinks = customLinks.filter(l => l.id !== id);
        saveStorage();
        renderLinks();
    }
}

// Eventos e Modal
const closeModalFunc = () => {
    modal.style.display = "none";
    document.getElementById("urlInput").value = "";
    document.getElementById("titleInput").value = "";
    document.getElementById("newCategoryInput").style.display = "none";
};

document.getElementById("urlInput").addEventListener("input", (e) => {
    // Auto-preencher título ao colar URL
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

new Sortable(container, {
    animation: 150,
    ghostClass: "dragging",
    onEnd: function (evt) {

        const links = getAllLinks();
        const movedItem = links.splice(evt.oldIndex, 1)[0];
        links.splice(evt.newIndex, 0, movedItem);

        // salvar nova ordem apenas dos customLinks
        customLinks = links.filter(l => 
            customLinks.some(cl => cl.id === l.id)
        );

        saveStorage();
        renderLinks();
    }
});