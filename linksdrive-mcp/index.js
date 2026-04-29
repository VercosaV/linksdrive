import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Configuração para resolver o diretório atual no Windows
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Inicialização do Firebase Admin com CAMINHO ABSOLUTO
// Ele vai procurar a chave na mesma pasta deste arquivo index.js
const keyPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 2. Configuração do Servidor MCP
const server = new Server(
  {
    name: "linksdrive-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 3. Definindo as "Tools" (Ferramentas que a IA pode usar)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_links",
        description: "Recupera os links produtivos salvos no LinksDrive.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Filtra os links por uma categoria específica (opcional)",
            },
          },
        },
      },
      {
        name: "add_link",
        description: "Adiciona um novo link produtivo ao LinksDrive.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Título do link" },
            url: { type: "string", description: "A URL do link" },
            category: { type: "string", description: "Categoria ou tag" },
          },
          required: ["title", "url"],
        },
      }
    ],
  };
});

// 4. Executando a lógica das Tools (Conectando ao Firebase)
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_links") {
    const { category } = request.params.arguments || {};
    
    let query = db.collection('links');
    if (category) {
      query = query.where('category', '==', category);
    }
    
    const snapshot = await query.get();
    const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(links, null, 2),
        },
      ],
    };
  }

  if (request.params.name === "add_link") {
    const { title, url, category } = request.params.arguments;
    
    const newLink = {
      title,
      url,
      category: category || "geral",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('links').add(newLink);

    return {
      content: [
        {
          type: "text",
          text: `Link salvo com sucesso com o ID: ${docRef.id}`,
        },
      ],
    };
  }

  throw new Error("Ferramenta não encontrada");
});

// 5. Inicializando o transporte de dados (Stdio)
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LinksDrive MCP Server rodando...");
}

main().catch(console.error);