/*
  O sw.js publicado leva a versão do build no nome do cache (vite.config.js,
  na cópia dos arquivos do PWA). Antes, o nome era um "v17" trocado à mão: sem
  trocar, o cache de uma versão seguia para a outra. Com a versão no nome,
  cada publicação abre um cache novo e o `activate` apaga os antigos.
*/
export function swComVersao(fonte, versao) {
  return String(fonte).replace(
    /const CACHE_VERSION = "[^"]*";/,
    `const CACHE_VERSION = "agsus-monitora-${versao}";`,
  );
}
