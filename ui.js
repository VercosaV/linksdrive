export function showToast(message, type = "success") {
    const container = document.getElementById("toastWrap");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type === "error" ? "err" : "ok"}`;
    const icon = type === "error" ? "fa-circle-exclamation" : "fa-check-circle";
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = "fadeOut 0.3s ease-out forwards";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
  
  export function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }
  
  export function getColorCode(colorNum) {
    const colors = {
      1: '#FFD600', 2: '#1E90FF', 3: '#00C853', 4: '#FF6B00', 5: '#9C27B0', 6: '#F50057'
    };
    return colors[colorNum] || '#FFD600';
  }