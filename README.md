# 🚀 MyDashboard — VideoGet + MyLinks

Aplicação web local que combina duas ferramentas em uma só interface:

- 🎬 **VideoGet** — Baixador de vídeos (YouTube, Alura, qualquer URL direta .mp4)
- 🔗 **MyLinks** — Dashboard de links e notas adesivas com Firebase

---

## ⚡ Instalação

### Pré-requisitos
- Python 3.10+
- `ffmpeg` instalado ([ffmpeg.org](https://ffmpeg.org/download.html))

```bash
pip install -r requirements.txt
python app.py
```

Acesse: **http://localhost:5000**

---

## 🎬 VideoGet — Downloads em paralelo

- Cole várias URLs de uma vez, uma por linha
- Dê um nome personalizado a cada arquivo
- Suporte a YouTube, Vimeo, TikTok e 1000+ sites via yt-dlp
- Download direto de URLs `.mp4` (ideal para Alura)
- Qualidades: Melhor / 1080p / 720p / 480p / Só áudio (MP3)

### Alura
1. Abra a aula → F12 → aba Network → filtre por `mp4`
2. Copie a Request URL completa
3. Cole no campo de URL e inicie o download imediatamente (token expira em ~10 min)

---

## 🔗 MyLinks — Dashboard de Links

- Links organizados por categorias com ícones automáticos (favicon)
- Busca em tempo real
- Notas adesivas coloridas com drag & drop e auto-save
- Sincronização via Firebase Firestore

### Funções utilitárias (console do navegador)
```js
// Importar links em lote
importarLinksEmLote([
  { title: "GitHub", url: "https://github.com", category: "Dev" }
])

// Remover links duplicados
removerDuplicatas()
```

---

## 📁 Estrutura
```
├── app.py          # Backend Flask (VideoGet API)
├── index.html      # Frontend unificado
├── requirements.txt
└── downloads/      # Vídeos baixados (criado automaticamente)
```