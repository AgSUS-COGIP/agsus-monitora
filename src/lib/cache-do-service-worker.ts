/*
  O sw.js publicado leva a versão do build no nome do cache (vite.config.js,
  na cópia dos arquivos do PWA). Antes, o nome era um "v17" trocado à mão: sem
  trocar, o cache de uma versão seguia para a outra. Com a versão no nome,
  cada publicação abre um cache novo e o `activate` apaga os antigos.

  O build também grava no sw.js a lista dos arquivos publicados (`PRECACHE`),
  que o service worker guarda na instalação: sem ela, o pedaço de uma tela só
  entrava no cache quando a tela era aberta, e uma tela nunca visitada não
  abria sem rede.
*/

/* Código, estilo, fonte e imagem: o que a tela precisa para abrir. */
const EXTENSOES_GUARDADAS = /\.(?:js|css|woff2?|svg|webp|png|jpe?g|gif|ico)$/i;

/*
  Fora da lista: os JSON de `/data/` (3,5 MB de contornos de terras e DSEIs,
  que o mapa só desenha com os mosaicos da internet), mapas de código e as
  páginas (o index.html já está na casca, `APP_SHELL`).
*/
const PASTAS_DE_FORA = ["/data/"];

/**
 * Os caminhos do build (relativos à pasta publicada) que o service worker
 * guarda na instalação: com "/" na frente, sem repetição e em ordem.
 */
export function arquivosParaGuardar(caminhos: Iterable<string>): string[] {
  const lista = new Set<string>();
  for (const caminho of caminhos) {
    const url = `/${String(caminho).replace(/\\/g, "/").replace(/^\/+/, "")}`;
    if (!EXTENSOES_GUARDADAS.test(url)) continue;
    if (PASTAS_DE_FORA.some((pasta) => url.startsWith(pasta))) continue;
    lista.add(url);
  }
  return [...lista].sort();
}

export function swComVersao(
  fonte: unknown,
  versao: string,
  arquivos: readonly string[] = [],
): string {
  return String(fonte)
    .replace(
      /const CACHE_VERSION = "[^"]*";/,
      `const CACHE_VERSION = "agsus-monitora-${versao}";`,
    )
    .replace(
      /const PRECACHE = \[\];/,
      `const PRECACHE = ${JSON.stringify(arquivos)};`,
    );
}
