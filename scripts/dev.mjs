/*
  FRONT E SERVIDOR JUNTOS, NUM COMANDO SÓ

      npm run dev

  Roda `vite build --watch` e o servidor TypeScript (`server/servidor.ts`) lado a
  lado. A cada edição o Vite recompila para `dist/`, e o servidor — que lê as
  páginas do disco a cada requisição — já entrega a versão nova no próximo F5
  em http://127.0.0.1:8000. É o build de produção, com os cabeçalhos de produção.

  Não recarrega o navegador sozinho e não roda as checagens do `npm run build`.
  Para recarga instantânea (HMR), use `npm run dev:frontend` (porta 5173).

  Ctrl+C encerra os dois processos.
*/
import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const vite = fileURLToPath(
  new URL("../node_modules/vite/bin/vite.js", import.meta.url),
);
const paginaPrincipal = fileURLToPath(
  new URL("../dist/index.html", import.meta.url),
);

const filhos = [];

function iniciar(nome, args) {
  const filho = spawn(process.execPath, args, { cwd: raiz, stdio: "inherit" });
  filho.on("exit", (codigo) => {
    if (encerrando) return;
    console.error(`[dev] ${nome} terminou (código ${codigo}); encerrando.`);
    encerrar(codigo ?? 1);
  });
  filhos.push(filho);
  return filho;
}

let encerrando = false;
function encerrar(codigo = 0) {
  encerrando = true;
  for (const filho of filhos) filho.kill();
  process.exit(codigo);
}
process.on("SIGINT", () => encerrar(0));
process.on("SIGTERM", () => encerrar(0));

// Sem isto, o servidor subiria servindo um dist antigo até o primeiro build terminar.
rmSync(fileURLToPath(new URL("../dist", import.meta.url)), {
  recursive: true,
  force: true,
});

iniciar("vite build --watch", [vite, "build", "--watch"]);

const inicio = Date.now();
const espera = setInterval(() => {
  if (existsSync(paginaPrincipal)) {
    clearInterval(espera);
    iniciar("servidor", ["server/servidor.ts"]);
  } else if (Date.now() - inicio > 120_000) {
    clearInterval(espera);
    console.error("[dev] o primeiro build não terminou em 2 minutos.");
    encerrar(1);
  }
}, 300);
