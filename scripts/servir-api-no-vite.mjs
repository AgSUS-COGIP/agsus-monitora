/*
  AS FUNÇÕES DE `api/` NO `npm run dev:frontend`

  Na Vercel, cada `api/<nome>.ts` é a rota `/api/<nome>`. Fora dela essas
  rotas não existiam (404), e o mapa da Saúde Indígena, que só lê o SIGEPSI
  por `/api/dseis`, não abria no localhost. Este plugin (só no servidor de
  desenvolvimento do Vite) carrega a função pelo próprio Vite — que entende
  TypeScript e os imports `.js` que apontam para `.ts` — e entrega a ela o
  pedido e a resposta do Node com o `status()` e o `query` que a Vercel
  acrescenta.

  As variáveis vêm do `.env`/`.env.local` (todas, não só as `VITE_`) e ficam
  no processo do servidor: o navegador só recebe as `VITE_`, como sempre.
  Funções em Python (`.py`) continuam só na Vercel.
*/
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "vite";

const NOME_DA_ROTA = /^\/api\/([a-z0-9-]+)\/?(?:\?|$)/i;

export function apiLocalNoVite() {
  let raiz = process.cwd();
  return {
    name: "agsus-api-local",
    apply: "serve",
    configResolved(config) {
      raiz = config.root;
      const variaveis = loadEnv(config.mode, config.envDir || raiz, "");
      for (const [nome, valor] of Object.entries(variaveis)) {
        if (process.env[nome] === undefined) process.env[nome] = valor;
      }
    },
    configureServer(servidor) {
      servidor.middlewares.use(async (req, res, seguir) => {
        const achado = NOME_DA_ROTA.exec(req.url || "");
        const nome = achado?.[1];
        const arquivo = nome && resolve(raiz, "api", `${nome}.ts`);
        if (!nome || nome.startsWith("_") || !arquivo || !existsSync(arquivo))
          return seguir();
        try {
          const modulo = await servidor.ssrLoadModule(arquivo);
          const url = new URL(req.url || "/", "http://localhost");
          req.query = Object.fromEntries(url.searchParams);
          res.status = (codigo) => {
            res.statusCode = codigo;
            return res;
          };
          await modulo.default(req, res);
        } catch (falha) {
          console.error(`[api local] ${nome}:`, falha);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
          }
          if (!res.writableEnded)
            res.end(JSON.stringify({ erro: "falha_na_funcao_local" }));
        }
      });
    },
  };
}
