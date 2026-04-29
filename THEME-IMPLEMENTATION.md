# Sistema de Temas - Instruções de Implementação

## Objetivo
Adicionar suporte completo a temas de cores ao projeto LinksDrive, permitindo que os usuários:
1. Alterem o tamanho dos cards de grupos (pequeno, médio, grande)
2. Personalizem as cores de todos os componentes (
   - backdrop
   - notas
   - grupos
   - acentos
   - texto
   - bordas)

## Arquivos Criados

### 1. `theme-system.css`
Arquivo completo de variáveis CSS que define:
- Paleta de cores base (bg, surface, borders, text, accents)
- Cores específicas por componente (grupos, links, notas, modais, login)
- Temas pré-definidos (dark, purple, green, orange)
- Placeholder para tema customizado

## Próximos Passos de Implementação

### Passo 2: Atualizar `index.html`

Adicionar no `<head>`:
```html
<link rel="stylesheet" href="theme-system.css">
```

Adicionar botões de controle no header:
```html
<!-- Botão de tamanho dos grupos -->
<div id="groupSizeWrap">
  <button class="btn btn-ghost" id="groupSizeBtn" title="Tamanho dos grupos">
    <i class="fa-solid fa-th-large"></i>
    <span>S</span>
  </button>
</div>

<!-- Botão de temas -->
<button class="btn btn-ghost" id="themeBtn" title="Alterar tema">
  <i class="fa-solid fa-palette"></i>
  <span>Tema</span>
</button>
```

### Passo 3: Atualizar `script.js`

#### 3.1 Adicionar ao objeto CACHE_KEYS:
```javascript
const CACHE_KEYS = {
  links: "cache_links_v1",
  notes: "cache_notes_v1",
  folders: "cache_folders_v1",
  linkSize: "linkCardSize",
  groupSize: "groupCardSize", // 🆕
  theme: "dashboardTheme", // 🆕
  auth: "dashboard_auth",
  salt: "dashboard_salt",
  hash: "dashboard_hash",
};
```

#### 3.2 Adicionar ao estado global:
```javascript
const state = {
  allLinks: cacheRead(CACHE_KEYS.links) || [],
  allNotes: cacheRead(CACHE_KEYS.notes) || [],
  allFolders: cacheRead(CACHE_KEYS.folders) || [],
  activeCategory: "Todos",
  searchTerm: "",
  activeView: "groups",
  activeGroup: null,
  sortValue: "manual",
  isNotesView: false,
  activeFolder: "Todas",
  linkSize: localStorage.getItem(CACHE_KEYS.linkSize) || "small",
  groupSize: localStorage.getItem(CACHE_KEYS.groupSize) || "small", // 🆕
  theme: loadTheme(), // 🆕
  firestoreReady: false,
};
```

#### 3.3 Adicionar sistema de temas:
```javascript
// ==================== SISTEMA DE TEMAS ====================
const DEFAULT_THEME = {
  name: "padrão",
  colors: {
    bgPrimary: "#f8fafc",
    bgSecondary: "#ffffff",
    surfacePrimary: "#ffffff",
    surfaceSecondary: "#f1f5f9",
    borderPrimary: "#e2e8f0",
    borderSecondary: "#cbd5e1",
    textPrimary: "#0f172a",
    textSecondary: "#334155",
    textTertiary: "#64748b",
    accentPrimary: "#3b82f6",
    accentPrimaryHover: "#2563eb",
    danger: "#ef4444",
    success: "#22c55e",
    noteColors: [
      { bg: "#FFF5E6", text: "#8B5A2B" },
      { bg: "#E6F3FF", text: "#1E4A76" },
      { bg: "#E8F5E9", text: "#2E7D32" },
      { bg: "#FFF0E6", text: "#C45C1E" },
      { bg: "#F3E5F5", text: "#6A1B9A" },
      { bg: "#FFE4E6", text: "#B91C2C" }
    ]
  }
};

function loadTheme() {
  const saved = localStorage.getItem(CACHE_KEYS.theme);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch(e) {
      console.warn("Tema salvo inválido, usando padrão");
    }
  }
  return DEFAULT_THEME;
}

function applyTheme(theme = state.theme) {
  const root = document.documentElement;
  const colors = theme.colors;
  
  // Cores principais
  root.style.setProperty('--bg-primary', colors.bgPrimary);
  root.style.setProperty('--bg-secondary', colors.bgSecondary);
  root.style.setProperty('--surface-primary', colors.surfacePrimary);
  root.style.setProperty('--surface-secondary', colors.surfaceSecondary);
  root.style.setProperty('--border-primary', colors.borderPrimary);
  root.style.setProperty('--border-secondary', colors.borderSecondary);
  root.style.setProperty('--text-primary', colors.textPrimary);
  root.style.setProperty('--text-secondary', colors.textSecondary);
  root.style.setProperty('--text-tertiary', colors.textTertiary);
  root.style.setProperty('--accent-primary', colors.accentPrimary);
  root.style.setProperty('--accent-primary-hover', colors.accentPrimaryHover);
  root.style.setProperty('--danger', colors.danger);
  root.style.setProperty('--success', colors.success);
  
  // Cores das notas
  colors.noteColors.forEach((color, i) => {
    root.style.setProperty(`--note-bg-${i+1}`, color.bg);
    root.style.setProperty(`--note-text-${i+1}`, color.text);
  });
  
  // Salvar no localStorage
  localStorage.setItem(CACHE_KEYS.theme, JSON.stringify(theme));
}

function saveTheme(theme) {
  state.theme = theme;
  applyTheme();
}
```

#### 3.4 Adicionar tamanho de grupos (copiar estrutura de links):
```javascript
// ==================== TAMANHO DOS CARDS DE GRUPO ====================
const GROUP_SIZE_LABELS = {
  small: { label: "S", title: "Pequeno" },
  medium: { label: "M", title: "Médio" },
  large: { label: "G", title: "Grande" }
};
const GROUP_SIZE_ORDER = ["small", "medium", "large"];

function applyGroupSize() {
  const grid = document.getElementById("groupsGrid");
  if (grid) {
    grid.classList.remove("size-small", "size-medium", "size-large");
    grid.classList.add(`size-${state.groupSize}`);
  }
  const btn = document.getElementById("groupSizeBtn");
  if (btn) {
    const info = GROUP_SIZE_LABELS[state.groupSize];
    btn.title = `Tamanho: ${info.title}`;
    btn.innerHTML = `<i class="fa-solid fa-th-large"></i><span>${info.label}</span>`;
  }
}

function cycleGroupSize() {
  const idx = GROUP_SIZE_ORDER.indexOf(state.groupSize);
  state.groupSize = GROUP_SIZE_ORDER[(idx + 1) % GROUP_SIZE_ORDER.length];
  localStorage.setItem(CACHE_KEYS.groupSize, state.groupSize);
  applyGroupSize();
  renderGroups();
  showToast(`Grupos: ${GROUP_SIZE_LABELS[state.groupSize].title}`, "success");
}
```

#### 3.5 Atualizar renderGroups para aplicar o tema:
```javascript
function renderGroups() {
  const groupsView = document.getElementById("groupsView");
  const groupsGrid = document.getElementById("groupsGrid");
  if (!groupsView || !groupsGrid) return;

  // Contagem de links por categoria
  const categoryCount = {};
  state.allLinks.forEach(l => {
    const cat = l.category || "Sem Categoria";
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });

  // Criar array de categorias únicas
  const categories = [...new Set(state.allLinks.map(l => l.category || "Sem Categoria"))].sort();

  groupsGrid.innerHTML = "";

  if (categories.length === 0) {
    groupsGrid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>Nenhum grupo encontrado.</p></div>';
    return;
  }

  categories.forEach(cat => {
    const count = categoryCount[cat] || 0;

    // Pegar os primeiros 4 links da categoria para prévia
    const categoryLinks = state.allLinks.filter(l => (l.category || "Sem Categoria") === cat).slice(0, 4);

    const card = document.createElement("div");
    card.className = "group-card";
    card.onclick = () => {
      // Navegar para a view de links com a categoria selecionada
      state.activeView = 'links';
      state.activeCategory = cat;
      updateUILayout();
      renderAll();
    };

    // Gerar HTML da prévia de links
    let previewHtml = '';
    if (categoryLinks.length > 0) {
      previewHtml = '<div class="group-preview">';
      categoryLinks.forEach(link => {
        let domain = "google.com";
        try { domain = new URL(link.url).hostname; } catch(e) {}
        previewHtml += `
          <div class="group-preview-item" title="${escapeHtml(link.title)}">
            <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32"
                 onerror="this.parentElement.style.display='none'">
          </div>
        `;
      });
      if (count > 4) {
        previewHtml += `<div class="group-preview-more">+${count - 4}</div>`;
      }
      previewHtml += '</div>';
    }

    card.innerHTML = `
      <i class="fa-solid fa-folder"></i>
      <span class="group-name">${escapeHtml(cat)}</span>
      <span class="group-count">${count} link${count !== 1 ? 's' : ''}</span>
      ${previewHtml}
    `;

    groupsGrid.appendChild(card);
  });

  applyGroupSize();
}
```

#### 3.6 Adicionar modal de configuração de temas:
```javascript
// ==================== MODAL: CONFIGURAÇÃO DE TEMAS ====================

function openThemeModal() {
  const modal = document.getElementById("themeModal");
  if (!modal) return;

  // Preencher cores atuais
  const colors = state.theme.colors;
  document.getElementById("bgPrimary") && (document.getElementById("bgPrimary").value = colors.bgPrimary);
  document.getElementById("bgSecondary") && (document.getElementById("bgSecondary").value = colors.bgSecondary);
  document.getElementById("surfacePrimary") && (document.getElementById("surfacePrimary").value = colors.surfacePrimary);
  document.getElementById("surfaceSecondary") && (document.getElementById("surfaceSecondary").value = colors.surfaceSecondary);
  document.getElementById("borderPrimary") && (document.getElementById("borderPrimary").value = colors.borderPrimary);
  document.getElementById("borderSecondary") && (document.getElementById("borderSecondary").value = colors.borderSecondary);
  document.getElementById("textPrimary") && (document.getElementById("textPrimary").value = colors.textPrimary);
  document.getElementById("textSecondary") && (document.getElementById("textSecondary").value = colors.textSecondary);
  document.getElementById("textTertiary") && (document.getElementById("textTertiary").value = colors.textTertiary);
  document.getElementById("accentPrimary") && (document.getElementById("accentPrimary").value = colors.accentPrimary);
  document.getElementById("accentPrimaryHover") && (document.getElementById("accentPrimaryHover").value = colors.accentPrimaryHover);
  document.getElementById("danger") && (document.getElementById("danger").value = colors.danger);
  document.getElementById("success") && (document.getElementById("success").value = colors.success);

  // Seletores de tema rápido
  const quickSelect = document.getElementById("quickThemeSelect");
  if (quickSelect) {
    quickSelect.innerHTML = `
      <option value="default">Padrão</option>
      <option value="dark">Escuro</option>
      <option value="purple">Roxo</option>
      <option value="green">Verde</option>
      <option value="orange">Laranja</option>
      <option value="custom">Customizado...</option>
    `;
    quickSelect.value = state.theme.name || "default";
  }

  modal.style.display = "flex";
}

function closeThemeModal() {
  document.getElementById("themeModal").style.display = "none";
}

function saveThemeFromModal() {
  const theme = {
    name: "custom",
    colors: {
      bgPrimary: document.getElementById("bgPrimary")?.value || "#f8fafc",
      bgSecondary: document.getElementById("bgSecondary")?.value || "#ffffff",
      surfacePrimary: document.getElementById("surfacePrimary")?.value || "#ffffff",
      surfaceSecondary: document.getElementById("surfaceSecondary")?.value || "#f1f5f9",
      borderPrimary: document.getElementById("borderPrimary")?.value || "#e2e8f0",
      borderSecondary: document.getElementById("borderSecondary")?.value || "#cbd5e1",
      textPrimary: document.getElementById("textPrimary")?.value || "#0f172a",
      textSecondary: document.getElementById("textSecondary")?.value || "#334155",
      textTertiary: document.getElementById("textTertiary")?.value || "#64748b",
      accentPrimary: document.getElementById("accentPrimary")?.value || "#3b82f6",
      accentPrimaryHover: document.getElementById("accentPrimaryHover")?.value || "#2563eb",
      danger: document.getElementById("danger")?.value || "#ef4444",
      success: document.getElementById("success")?.value || "#22c55e",
      noteColors: state.theme.colors.noteColors || DEFAULT_THEME.colors.noteColors
    }
  };

  saveTheme(theme);
  closeThemeModal();
  showToast("Tema aplicado com sucesso!", "success");
}

function applyQuickTheme(preset) {
  const presets = {
    default: DEFAULT_THEME,
    dark: {
      name: "dark",
      colors: {
        ...DEFAULT_THEME.colors,
        bgPrimary: "#0f172a",
        bgSecondary: "#1e293b",
        surfacePrimary: "#1e293b",
        surfaceSecondary: "#334155",
        borderPrimary: "#334155",
        borderSecondary: "#475569",
        textPrimary: "#f8fafc",
        textSecondary: "#e2e8f0",
        textTertiary: "#94a3b8",
        accentPrimary: "#60a5fa",
        accentPrimaryHover: "#3b82f6"
      }
    },
    purple: {
      name: "purple",
      colors: {
        ...DEFAULT_THEME.colors,
        accentPrimary: "#8b5cf6",
        accentPrimaryHover: "#7c3aed"
      }
    },
    green: {
      name: "green",
      colors: {
        ...DEFAULT_THEME.colors,
        accentPrimary: "#10b981",
        accentPrimaryHover: "#059669",
        success: "#10b981"
      }
    },
    orange: {
      name: "orange",
      colors: {
        ...DEFAULT_THEME.colors,
        accentPrimary: "#f97316",
        accentPrimaryHover: "#ea580c",
        warning: "#f97316"
      }
    }
  };

  if (presets[preset]) {
    saveTheme(presets[preset]);
    closeThemeModal();
    showToast(`Tema ${presets[preset].name} aplicado!`, "success");
  }
}
```

#### 3.7 Atualizar initDashboard:
```javascript
function initDashboard() {
  document.getElementById("dashboard").style.display = "block";
  updateUILayout();
  document.getElementById("loginOverlay").style.display = "none";

  // 🆕 Aplicar tema salvo
  applyTheme();
  
  // 🆕 Aplicar tamanho de grupo
  applyGroupSize();

  // Se temos dados em cache, renderiza imediatamente antes do Firestore responder
  if (state.allLinks.length > 0 || state.allNotes.length > 0) {
    renderAll();
    setBadge(false);
  }

  // Inscreve para receber atualizações em tempo real do Firestore
  subscribeLinks();
  subscribeNotes();
  subscribeFolders();

  // Event listeners — links
  document.getElementById("addLinkBtn")?.addEventListener("click", openLinkModal);
  document.getElementById("saveLink")?.addEventListener("click", saveLinkHandler);
  document.getElementById("modalClose")?.addEventListener("click", closeLinkModal);
  document.getElementById("modalCancel")?.addEventListener("click", closeLinkModal);
  document.getElementById("linkModal")?.addEventListener("click", e => { if (e.target.id === "linkModal") closeLinkModal(); });

  const catSelect = document.getElementById("catSelect");
  catSelect?.addEventListener("change", e => {
    const nc = document.getElementById("newCatInput");
    if (nc) nc.style.display = e.target.value === "new" ? "block" : "none";
  });
  
  // 🆕 Event listeners — tamanho de grupo
  document.getElementById("groupSizeBtn")?.addEventListener("click", cycleGroupSize);
  
  // 🆕 Event listeners — temas
  document.getElementById("themeBtn")?.addEventListener("click", openThemeModal);

  // Resto da inicialização...
}
```

### Passo 4: Atualizar `style.css` - Adicionar estilos para tamanho de grupo

Adicionar no final do arquivo:

```css
/* ==================== TAMANHOS DOS GRUPOS ==================== */

.groups-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  margin-top: 16px;
}

.groups-grid.size-small {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.groups-grid.size-medium {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.groups-grid.size-large {
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

@media(max-width: 768px) {
  .groups-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }
  
  .groups-grid.size-small {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }
  
  .groups-grid.size-medium {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }
  
  .groups-grid.size-large {
    grid-template-columns: 1fr;
    gap: 14px;
  }
}

/* Ajustes de conteúdo para diferentes tamanhos */
.groups-grid.size-small .group-card {
  padding: 16px;
  gap: 10px;
}

.groups-grid.size-small .group-card i {
  font-size: 1.5rem;
}

.groups-grid.size-small .group-name {
  font-size: 0.9rem;
}

.groups-grid.size-small .group-count {
  font-size: 0.7rem;
  padding: 3px 10px;
}

.groups-grid.size-large .group-card {
  padding: 24px;
  gap: 16px;
}

.groups-grid.size-large .group-card i {
  font-size: 2.5rem;
}

.groups-grid.size-large .group-name {
  font-size: 1.1rem;
}

.groups-grid.size-large .group-count {
  font-size: 0.85rem;
  padding: 6px 16px;
}

/* Esconder wraps quando não aplicável */
#groupSizeWrap {
  display: block;
}

body[data-view="links"] #groupSizeWrap {
  display: none;
}

body[data-view="notes"] #groupSizeWrap {
  display: none;
}
```

### Passo 5: Áreas que precisam de ajustes manuais

1. **Função updateUILayout** - Adicionar classes de visão ao body
2. **HTML do Modal de Temas** - Criar modal de configuração
3. **CSS de cores dinâmicas** - Atualizar seletores para usar variáveis

### Classes CSS antigas que precisam ser substituídas

No arquivo principal style.css, substitua:
- Cor de fundo fixa por `var(--bg-primary)`
- `var(--surface)` por `var(--surface-primary)` ou `var(--surface-secondary)`
- Cores de texto fixas por `var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`

### Observações Importantes

1. Mantemos COMPATIBILIDADE RETROATIVA - se não houver tema salvo, usa o padrão
2. As cores das notas agora são FULLY CUSTOMIZÁVEIS
3. O sistema suporta temas pré-definidos e customizados
4. Toda a configuração persiste no localStorage
5. A aplicação das cores é INSTANTÂNEA e reativa

## Próximos Passos

1. Faça backup dos arquivos atuais
2. Aplique as mudanças progressivamente, testando cada funcionalidade
3. Verifique que todas as variáveis CSS estão sendo aplicadas corretamente
4. Teste os temas pré-definidos
5. Crie temas adicionais (ex: high contrast, colorful, etc)
6. Considere adicionar exportação/importação de temas

## Divisão das Tarefas

Para implementar de forma segura:

**Fase 1 (Básica):** Tamanho dos grupos
- Adiciona apenas o sistema de tamanho
- Testa e valida

**Fase 2 (Visual):** Sistema de temas
- Adiciona variáveis CSS
- Atualiza todas as cores
- Testa e valida

**Fase 3 (UI):** Personalização
- Adiciona modal de configuração
- Implementa seleção de cores
- Testa e valida
