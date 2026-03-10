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
    });
}

function renderUI() {
    renderCategories();
    renderLinks();
}

function renderCategories() {
    const nav = document.getElementById("categoryNav");
    const select = document.getElementById("categorySelect");
    const categories = ["Todos", ...new Set(allLinks.map(l => l.category))].sort();

    nav.innerHTML = "";
    select.innerHTML = "";

    categories.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = `nav-item ${activeCategory === cat ? 'active' : ''}`;
        btn.innerText = cat;
        btn.onclick = () => { activeCategory = cat; renderUI(); };
        nav.appendChild(btn);

        if (cat !== "Todos") {
            const opt = document.createElement("option");
            opt.value = cat; opt.innerText = cat;
            select.appendChild(opt);
        }
    });
    select.innerHTML += `<option value="new">+ Nova Categoria...</option>`;
}

function renderLinks() {
    const container = document.getElementById("linksContainer");
    const search = document.getElementById("search").value.toLowerCase();
    container.innerHTML = "";

    allLinks.filter(l => {
        const matchCat = activeCategory === "Todos" || l.category === activeCategory;
        const matchSearch = l.title.toLowerCase().includes(search);
        return matchCat && matchSearch;
    }).forEach(link => {
        const domain = new URL(link.url).hostname;
        const card = document.createElement("a");
        card.className = "card"; card.href = link.url; card.target = "_blank";
        card.innerHTML = `
            <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32">
            <span>${link.title}</span>
            <button class="delete-btn" onclick="event.preventDefault(); window.deleteLink('${link.id}')">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        container.appendChild(card);
    });
}

window.deleteLink = async (id) => {
    if (confirm("Apagar link permanentemente?")) await deleteDoc(doc(db, "links", id));
};

document.getElementById("saveLink").onclick = async () => {
    const title = document.getElementById("titleInput").value;
    let url = document.getElementById("urlInput").value;
    let category = document.getElementById("categorySelect").value;
    if (category === "new") category = document.getElementById("newCategoryInput").value;

    if(!title || !url) return alert("Preencha os campos!");

    await addDoc(linksRef, { title, url, category, timestamp: new Date() });
    document.getElementById("modal").style.display = "none";