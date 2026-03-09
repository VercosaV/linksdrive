// Função auxiliar para gerar IDs únicos
const generateId = () => Math.random().toString(36).substr(2, 9);

const defaultLinks = [
    // --- IA ---
    { id: generateId(), title: "ChatGPT", url: "https://chatgpt.com/", category: "IA" },
    { id: generateId(), title: "Gemini", url: "https://gemini.google.com/app", category: "IA" },
    { id: generateId(), title: "DeepSeek", url: "https://chat.deepseek.com/sign_in", category: "IA" },
    { id: generateId(), title: "Manus", url: "https://manus.im/app", category: "IA" },

    // --- Dev / Trabalho ---
    { id: generateId(), title: "GitHub", url: "https://github.com/", category: "Dev" },
    { id: generateId(), title: "Vercel Projects", url: "https://vercel.com/victors-projects-9d919fd2", category: "Dev" },
    { id: generateId(), title: "Supabase", url: "https://supabase.com/dashboard/sign-in", category: "Dev" },
    { id: generateId(), title: "AWS Console", url: "https://us-east-1.signin.aws/platform/d-9067642ac7/login", category: "Dev" },
    { id: generateId(), title: "JSON Formatter", url: "https://jsonformatter.curiousconcept.com/", category: "Dev Tools" },
    { id: generateId(), title: "Diagrams.net", url: "https://app.diagrams.net/", category: "Dev Tools" },

    // --- Faculdade ---
    { id: generateId(), title: "Teams", url: "https://teams.microsoft.com/v2/", category: "Faculdade" },
    { id: generateId(), title: "SIGA Aluno", url: "https://siga.cps.sp.gov.br/sigaaluno/applogin.aspx", category: "Faculdade" },

    // --- Cursos ---
    { id: generateId(), title: "Alura Dashboard", url: "https://cursos.alura.com.br/loginForm?urlAfterLogin=%5BaHR0cHM6Ly9jdXJzb3MuYWx1cmEuY29tLmJyL2Rhc2hib2FyZA%5D", category: "Cursos" },
    { id: generateId(), title: "DIO", url: "https://web.dio.me/home", category: "Cursos" },
    { id: generateId(), title: "Estudar Na Prática", url: "https://ead.estudar.org.br/users/sign_in", category: "Cursos" },
    { id: generateId(), title: "Danki Unity", url: "https://cursos.dankicode.com/unity?ref=U77942400J", category: "Cursos" },
    { id: generateId(), title: "Curso Laravel", url: "https://www.cursou.com.br/informatica/programacao/php/laravel-framework-php-desenvolvimento-web/", category: "Cursos" },
    { id: generateId(), title: "Circle Login", url: "https://login.circle.so/sign_in", category: "Cursos" },

    // --- Networking ---
    { id: generateId(), title: "LinkedIn", url: "https://www.linkedin.com/feed/", category: "Networking" },
    { id: generateId(), title: "Aspire Leaders", url: "https://engage.aspireleaders.org/profile", category: "Networking" },

    // --- Música ---
    { id: generateId(), title: "Song BPM", url: "https://getsongbpm.com/", category: "Música" },
    { id: generateId(), title: "Canal Violinistas", url: "https://canalparaviolinistas.com/downloads/", category: "Música" },

    // --- Jogos ---
    { id: generateId(), title: "Guia Monster Hunter", url: "https://guiadomh.carrd.co/", category: "Jogos" },
    { id: generateId(), title: "WarriorJS", url: "https://warriorjs.com/", category: "Jogos" },
    { id: generateId(), title: "Nexus Mods", url: "https://www.nexusmods.com/skyrim/mods/116605", category: "Jogos" },
    { id: generateId(), title: "RetroGames", url: "https://www.retrogames.onl/", category: "Jogos" }
];

// Carrega links customizados do LocalStorage
let customLinks = JSON.parse(localStorage.getItem("myLinks")) || [];
const container = document.getElementById("linksContainer");
const modal = document.getElementById("modal");

function getAllLinks() {
    return [...defaultLinks, ...customLinks];
}

function saveStorage() {
    localStorage.setItem("myLinks", JSON.stringify(customLinks));
}

function renderLinks(filterText = "") {
    container.innerHTML = "";
    const links = getAllLinks();

    // Filtra os links baseado na busca
    const filteredLinks = links.filter(l => 
        l.title.toLowerCase().includes(filterText.toLowerCase()) || 
        l.category.toLowerCase().includes(filterText.toLowerCase())
    );

    // Agrupa por categoria
    const categories = [...new Set(filteredLinks.map(l => l.category))];

    if (filteredLinks.length === 0) {
        container.innerHTML = `<p style="text-align:center; color: #94a3b8;">Nenhum link encontrado.</p>`;
        return;
    }

    categories.forEach(cat => {
        // Cria a seção da categoria
        const section = document.createElement("section");
        section.className = "category-section";

        // Título da categoria
        const title = document.createElement("h2");
        title.className = "category-title";
        title.innerHTML = `<i class="fa-solid fa-folder"></i> ${cat}`;
        section.appendChild(title);

        // Grid de cards
        const grid = document.createElement("div");
        grid.className = "grid";

        // Adiciona os links desta categoria
        filteredLinks
            .filter(l => l.category === cat)
            .forEach(link => {
                const card = document.createElement("a");
                card.className = "card";
                card.href = link.url;
                card.target = "_blank";
                card.rel = "noopener noreferrer"; // Segurança

                // Ícone de alta resolução (64px)
                const domain = new URL(link.url).hostname;
                const iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

                // Verifica se é um link customizado para mostrar botão de excluir
                const isCustom = customLinks.some(cl => cl.id === link.id);
                const deleteBtnHTML = isCustom 
                    ? `<button class="delete-btn" onclick="event.preventDefault(); deleteLink('${link.id}')"><i class="fa-solid fa-trash"></i></button>` 
                    : '';

                card.innerHTML = `
                    ${deleteBtnHTML}
                    <img src="${iconUrl}" alt="${link.title}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1006/1006771.png'">
                    <span>${link.title}</span>
                `;

                grid.appendChild(card);
            });

        section.appendChild(grid);
        container.appendChild(section);
    });
}

function addLink() {
    const title = document.getElementById("titleInput").value;
    const url = document.getElementById("urlInput").value;
    const category = document.getElementById("categoryInput").value;

    if (!title || !url || !category) {
        alert("Preencha todos os campos!");
        return;
    }

    const newLink = {
        id: generateId(),
        title,
        url: url.startsWith("http") ? url : `https://${url}`,
        category
    };

    customLinks.push(newLink);
    saveStorage();
    closeModalFunc();
    renderLinks();
}

function deleteLink(id) {
    if(confirm("Tem certeza que deseja remover este link?")) {
        customLinks = customLinks.filter(l => l.id !== id);
        saveStorage();
        renderLinks(document.getElementById("search").value);
    }
}

// Modal Logic
const openModal = () => {
    modal.style.display = "flex";
    document.getElementById("titleInput").focus();
};

const closeModalFunc = () => {
    modal.style.display = "none";
    // Limpa os inputs
    document.getElementById("titleInput").value = "";
    document.getElementById("urlInput").value = "";
    document.getElementById("categoryInput").value = "";
};

// Event Listeners
document.getElementById("addBtn").onclick = openModal;
document.getElementById("closeModal").onclick = closeModalFunc;
document.getElementById("saveLink").onclick = addLink;

// Fecha modal ao clicar fora
window.onclick = (event) => {
    if (event.target == modal) closeModalFunc();
}

// Busca em tempo real
document.getElementById("search").addEventListener("input", (e) => {
    renderLinks(e.target.value);
});

// Inicializa
renderLinks();