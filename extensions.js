// ==================== EXTENSÕES DE TEMA E GRUPOS ====================
// Este arquivo adiciona novas funcionalidades sem modificar o script.js principal

// Tema padrão - deve ser carregado antes do script.js principal
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

// Constantes para tamanho de grupos
const GROUP_SIZE_LABELS = {
  small: { label: "S", title: "Pequeno" },
  medium: { label: "M", title: "Médio" },
  large: { label: "G", title: "Grande" }
};
const GROUP_SIZE_ORDER = ["small", "medium", "large"];

// Função para inicializar estado extendido
function initExtendedState(state) {
  // Adiciona propriedades ao estado global
  state.groupSize = localStorage.getItem(CACHE_KEYS.groupSize) || "small";
  state.theme = localStorage.getItem(CACHE_KEYS.theme) ?
    JSON.parse(localStorage.getItem(CACHE_KEYS.theme)) :
    DEFAULT_THEME;

  return state;
}

// Função para aplicar tamanho dos grupos
function applyGroupSize() {
  const grid = document.getElementById("groupsGrid");
  if (!grid || !state.groupSize) return; // state pode não estar disponível em alguns contextos

  grid.classList.remove("size-small", "size-medium", "size-large");
  grid.classList.add(`size-${state.groupSize}`);

  const btn = document.getElementById("groupSizeBtn");
  if (btn) {
    const info = GROUP_SIZE_LABELS[state.groupSize];
    btn.title = `Tamanho: ${info.title}`;
    btn.innerHTML = `<i class="fa-solid fa-th"></i><span>${info.label}</span>`;
  }
}

// Função para ciclar tamanho dos grupos
function cycleGroupSize() {
  if (!state || !state.groupSize) return;

  const idx = GROUP_SIZE_ORDER.indexOf(state.groupSize);
  state.groupSize = GROUP_SIZE_ORDER[(idx + 1) % GROUP_SIZE_ORDER.length];
  localStorage.setItem(CACHE_KEYS.groupSize, state.groupSize);

  applyGroupSize();

  if (typeof renderGroups === 'function') {
    renderGroups();
  }

  if (typeof showToast === 'function') {
    showToast(`Grupos: ${GROUP_SIZE_LABELS[state.groupSize].title}`, "success");
  }
}

// ==================== FUNÇÕES DE TEMA ====================

// Função para aplicar tema
function applyTheme(theme) {
  const activeTheme = theme || (window.state && window.state.theme) || DEFAULT_THEME;
  const root = document.documentElement;
  const colors = activeTheme.colors;

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
  if (colors.noteColors) {
    colors.noteColors.forEach((color, i) => {
      root.style.setProperty(`--note-bg-${i+1}`, color.bg);
      root.style.setProperty(`--note-text-${i+1}`, color.text);
    });
  }

  // Salvar no localStorage
  if (window.CACHE_KEYS) {
    localStorage.setItem(CACHE_KEYS.theme, JSON.stringify(activeTheme));
  }

  return activeTheme;
}

// Função para carregar tema do localStorage
function loadTheme() {
  if (!window.CACHE_KEYS) return DEFAULT_THEME;

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

// Tornar as funções disponíveis globalmente
window.DEFAULT_THEME = DEFAULT_THEME;
window.GROUP_SIZE_LABELS = GROUP_SIZE_LABELS;
window.GROUP_SIZE_ORDER = GROUP_SIZE_ORDER;
window.initExtendedState = initExtendedState;
window.applyGroupSize = applyGroupSize;
window.cycleGroupSize = cycleGroupSize;
window.applyTheme = applyTheme;
window.loadTheme = loadTheme;