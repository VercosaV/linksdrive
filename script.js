import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBc3ryOJEFBQlJIUpy835Anej0OulZqHEQ",
  authDomain: "linksdrive-4012c.firebaseapp.com",
  projectId: "linksdrive-4012c",
  storageBucket: "linksdrive-4012c.firebasestorage.app",
  messagingSenderId: "91948654259",
  appId: "1:91948654259:web:2b596baed6d1ab78cc5ac6",
  measurementId: "G-V1EZDLJQ2K"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const linksRef = collection(db, "links");

let allLinks = [];
let activeCategory = "Todos";

function startApp() {
    const q = query(linksRef, orderBy("category"));
    onSnapshot(q, (snapshot) => {
        allLinks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderUI();
    }, (error) => {
        console.error("Erro no Firebase:", error);
        showToast("Erro ao conectar com o banco de dados.", "error");
    });
}

function renderUI() {
    renderCategories();
    renderLinks();
}

function renderCategories() {
    const nav = document.getElementById("categoryNav");
    const select = document.getElementById("categorySelect");
    
    // Obtém categorias únicas e ordena alfabeticamente
    const categories = ["Todos", ...new Set(allLinks.map(l => l.category))].sort();

    nav.innerHTML = "";
    select.innerHTML = "";

    // Renderiza abas de navegação
    categories.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = `nav-item ${activeCategory === cat ? 'active' : ''}`;
        btn.innerText = cat;
        btn.onclick = () => { activeCategory = cat; renderUI(); };
        nav.appendChild(btn);

        // Preenche o Select do Modal
        if (cat !== "Todos") {
            const opt = document.createElement("option");
            opt.value = cat; 
            opt.innerText = cat;
            select.appendChild(opt);
        }
    });
    
    // Opção para criar nova categoria
    select.innerHTML += `<option value="new">+ Nova Categoria...</option>`;
}

function renderLinks() {
    const container = document.getElementById("linksContainer");
    const emptyState = document.getElementById("emptyState");
    const search = document.getElementById("search").value.toLowerCase();
    
    container.innerHTML = "";

    const filteredLinks = allLinks.filter(l => {
        const matchCat = activeCategory === "Todos" || l.category === activeCategory;
        const matchSearch = l.title.toLowerCase().includes(search);
        return matchCat && matchSearch;
    });

    if (filteredLinks.length === 0) {
        emptyState.style.display = "flex";
    } else {
        emptyState.style.display = "none";
        
        filteredLinks.forEach(link => {
            // Obter ícone (favicon) do site
            let domain = "google.com";
            try { domain = new URL(link.url).hostname; } catch (e) {}

            // Criar o card como DIV para evitar bugs de clique no botão deletar
            const card = document.createElement("div");
            card.className = "card";
            card.onclick = (e) => {
                // Se o clique NÃO foi no botão de deletar, abre o link
                if (!e.target.closest('.delete-btn')) {
                    window.open(link.url, '_blank');
                }
            };

            card.innerHTML = `
                <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1006/1006771.png'">
                <span>${link.title}</span>
                <button class="delete-btn" aria-label="Deletar link">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;

            // Adiciona evento específico para o botão deletar
            const deleteBtn = card.querySelector('.delete-btn');
            deleteBtn.onclick = async (e) => {
                e.stopPropagation(); // Impede que o card seja clicado
                if (confirm(`Deseja excluir "${link.title}" permanentemente?`)) {
                    try {
                        await deleteDoc(doc(db, "links", link.id));
                        showToast("Link excluído com sucesso!");
                    } catch (error) {
                        showToast("Erro ao excluir o link.", "error");
                    }
                }
            };

            container.appendChild(card);
        });
    }
}

// --- Funções do Modal ---
const modal = document.getElementById("modal");

const openModal = () => {
    modal.style.display = "flex";
    document.getElementById("urlInput").focus();
};

const closeModal = () => {
    modal.style.display = "none";
    document.getElementById("urlInput").value = "";
    document.getElementById("titleInput").value = "";
    document.getElementById("newCategoryInput").style.display = "none";
    document.getElementById("newCategoryInput").value = "";
};

document.getElementById("categorySelect").onchange = (e) => {
    document.getElementById("newCategoryInput").style.display = e.target.value === "new" ? "block" : "none";
};

// --- Salvar no Firebase ---
document.getElementById("saveLink").onclick = async () => {
    const title = document.getElementById("titleInput").value.trim();
    let url = document.getElementById("urlInput").value.trim();
    let category = document.getElementById("categorySelect").value;
    
    if (category === "new") category = document.getElementById("newCategoryInput").value.trim();

    if(!title || !url || !category) return showToast("Preencha todos os campos!", "error");
    
    // Garante que a URL tem http:// ou https://
    if (!url.startsWith("http")) url = `https://${url}`;

    const saveBtn = document.getElementById("saveLink");
    saveBtn.innerText = "Salvando...";
    saveBtn.disabled = true;

    try {
        await addDoc(linksRef, { title, url, category, timestamp: new Date() });
        showToast("Link salvo com sucesso!");
        closeModal();
        activeCategory = category; // Muda para a aba da categoria salva
    } catch (error) {
        showToast("Erro ao salvar link.", "error");
    } finally {
        saveBtn.innerText = "Salvar";
        saveBtn.disabled = false;
    }
};

// --- Sistema de Toast (Avisos na tela) ---
function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i> ${message}`;
    
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "fadeOut 0.3s ease-out forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Event Listeners Globais
document.getElementById("addBtn").onclick = openModal;
document.getElementById("closeModal").onclick = closeModal;
document.getElementById("closeModalIcon").onclick = closeModal;
document.getElementById("search").oninput = renderLinks;

// Fecha modal clicando fora dele
window.onclick = (e) => { if (e.target === modal) closeModal(); }

// Tentar auto-preencher o título com base na URL inserida
document.getElementById("urlInput").addEventListener("blur", (e) => {
    const val = e.target.value;
    const titleInput = document.getElementById("titleInput");
    if(val.length > 8 && titleInput.value === ""){
        try {
            let host = new URL(val.startsWith("http") ? val : `https://${val}`).hostname;
            let name = host.replace("www.","").split(".")[0];
            titleInput.value = name.charAt(0).toUpperCase() + name.slice(1);
        } catch(err){}
    }
});

// Inicializa a aplicação
startApp();

// Função para importar em lote no console (OPCIONAL)
window.importarLinksEmLote = async (linksArray) => {
    for (const link of linksArray) {
        await addDoc(linksRef, { ...link, timestamp: new Date() });
        console.log(`Salvo: ${link.title}`);
    }
    console.log("Importação concluída!");
};