/*
  Apoio de `troca-de-versao.spec.js`: o dist/ servido como a Vercel o serve, e
  uma "publicação" que troca a versão no meio do teste.

  Como a Vercel (conferido em produção, 18/11/2026):
  - `/index.html` e `/<nome>.html` respondem 308 para o endereço sem `.html`
    (`cleanUrls`); `/` e `/<nome>` entregam o arquivo;
  - as rotas das telas (`rewrites` do vercel.json) entregam o index.html;
  - arquivo que não existe na versão publicada: 404 em texto. A versão
    anterior não fica no ar (sem "skew protection" no plano Hobby);
  - tudo com `Cache-Control: public, max-age=0, must-revalidate`.

  A publicação copia o build e troca o hash de todos os arquivos de
  `/assets/` (e a versão do build): é a versão nova em que nenhum pedaço da
  anterior existe mais, o pior caso para a aba que ficou aberta.
*/
import { createServer } from "node:http";
import {
  cp,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const TEXTO = new Set([
  ".html",
  ".js",
  ".css",
  ".json",
  ".webmanifest",
  ".svg",
]);
const ROTA_DA_TELA =
  /^\/(?:(?:saude-indigena|sede|projetos|paineis|administracao)(?:\/.*)?|sem-acesso)$/;

async function existe(caminho) {
  try {
    return (await stat(caminho)).isFile();
  } catch {
    return false;
  }
}

/**
 * Sobe o servidor sobre uma cópia de `dist`. Devolve `{ endereco, publicar,
 * pedidos, fechar }`: `publicar()` põe no ar a versão nova (todos os hashes
 * trocados) e devolve a versão; `pedidos` guarda o caminho e o status de cada
 * resposta, para o teste conferir o que a aba antiga pediu.
 */
export async function subirVercelSimulada(dist = resolve("dist")) {
  const pasta = await mkdtemp(join(tmpdir(), "yeende-vercel-"));
  let raiz = join(pasta, "v1");
  await cp(dist, raiz, { recursive: true });
  const pedidos = [];

  const servidor = createServer(async (pedido, resposta) => {
    const { pathname } = new URL(pedido.url, "http://local");
    const responder = (status, corpo = "", cabecalhos = {}) => {
      pedidos.push({ caminho: pathname, status });
      resposta.writeHead(status, {
        "Cache-Control": "public, max-age=0, must-revalidate",
        ...cabecalhos,
      });
      resposta.end(corpo);
    };
    if (pathname.endsWith(".html")) {
      const limpo = pathname.replace(/(?:index)?\.html$/, "") || "/";
      return responder(308, "Redirecting...", {
        Location: limpo,
        "Content-Type": "text/plain",
      });
    }
    const relativo = normalize(decodeURIComponent(pathname)).replace(
      /^[/\\]+/,
      "",
    );
    const candidatos = ROTA_DA_TELA.test(pathname)
      ? ["index.html"]
      : [relativo, `${relativo}.html`, join(relativo, "index.html")];
    for (const candidato of candidatos) {
      const arquivo = join(raiz, candidato);
      if (!arquivo.startsWith(raiz) || !(await existe(arquivo))) continue;
      return responder(200, await readFile(arquivo), {
        "Content-Type": TIPOS[extname(arquivo)] || "application/octet-stream",
      });
    }
    return responder(404, "The page could not be found\n\nNOT_FOUND\n", {
      "Content-Type": "text/plain; charset=utf-8",
    });
  });
  await new Promise((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  const { port } = servidor.address();

  let publicacoes = 0;
  async function publicar() {
    publicacoes += 1;
    const nova = join(pasta, `v${publicacoes + 1}`);
    await cp(raiz, nova, { recursive: true });
    const assets = join(nova, "assets");
    const nomes = await readdir(assets);
    // "telas-Ab3_x9Zq.js" -> "telas-Ab3_x9Z0.js": outro hash, o mesmo tamanho
    // (um dígito: no Windows "Q" e "q" são o mesmo arquivo).
    const trocas = new Map();
    for (const nome of nomes) {
      const partes = nome.match(/^(.+-)([\w-]{8})(\.[a-z0-9]+)$/i);
      if (!partes) continue;
      const [, inicio, hash, fim] = partes;
      const novo = `${inicio}${hash.slice(0, 7)}${hash[7] === "0" ? "1" : "0"}${fim}`;
      trocas.set(nome, novo);
    }
    const versao = (await readFile(join(nova, "versao.json"), "utf8")).match(
      /"versao":"([^"]+)"/,
    )[1];
    const versaoNova = `${versao}-p${publicacoes}`;
    const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const citado = new RegExp(
      [...trocas.keys(), versao].map(escapar).join("|"),
      "g",
    );
    const trocar = (achado) => trocas.get(achado) ?? versaoNova;
    // Só quem cita pedaços: os de assets/ e os da raiz (os JSON de data/ não).
    const arquivos = [
      ...(await readdir(nova, { withFileTypes: true })),
      ...(await readdir(assets, { withFileTypes: true })),
      ...(await readdir(join(nova, "auth"), { withFileTypes: true }).catch(
        () => [],
      )),
    ];
    for (const entrada of arquivos) {
      if (!entrada.isFile() || !TEXTO.has(extname(entrada.name))) continue;
      const caminho = join(entrada.parentPath, entrada.name);
      const original = await readFile(caminho, "utf8");
      const texto = original.replace(citado, trocar);
      if (texto !== original) await writeFile(caminho, texto);
    }
    for (const [antigo, novo] of trocas)
      await cp(join(assets, antigo), join(assets, novo));
    for (const antigo of trocas.keys()) await rm(join(assets, antigo));
    raiz = nova;
    return versaoNova;
  }

  return {
    endereco: `http://127.0.0.1:${port}`,
    publicar,
    pedidos,
    async fechar() {
      await new Promise((pronto) => servidor.close(pronto));
      await rm(pasta, { recursive: true, force: true });
    },
  };
}
