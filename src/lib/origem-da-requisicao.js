/*
  Proteção dos proxies públicos da Funai contra uso por terceiros.

  POR QUE NÃO É AUTENTICAÇÃO DE SESSÃO

  O proxy de WMS é consumido por `L.tileLayer.wms`, ou seja, o navegador pede
  cada ladrilho como `<img src="...">`. Não há como anexar cabeçalho de
  autorização a uma tag de imagem. Exigir sessão Supabase ali quebraria o mapa
  para todo mundo.

  O QUE ESTÁ EM JOGO, DE FATO

  Os dados servidos são públicos: geodata do GeoServer da Funai. Não há segredo
  nem dado pessoal em risco. O que se quer evitar é que um site de terceiros
  aponte para o nosso proxy e use o MONITORA como relé gratuito — o custo cai
  na banda da Vercel e, pior, a Funai pode passar a limitar ou bloquear os IPs
  de saída, derrubando o mapa para os usuários reais.

  A REGRA, E POR QUE ELA É FROUXA DE PROPÓSITO

  Recusa apenas quando a requisição declara uma origem e essa origem é outra.
  Requisição sem `Origin` nem `Referer` passa.

  Isso bloqueia o vetor real — um terceiro embutindo o nosso endereço, caso em
  que o navegador dele envia a origem dele — e nunca quebra um usuário legítimo
  cujo navegador ou política de privacidade tenha removido o cabeçalho. Entre
  deixar passar um abuso ocasional e derrubar o mapa de quem precisa dele, a
  escolha é clara.

  A comparação é com o próprio `Host` da requisição, não com uma lista fixa:
  assim vale igual em produção, em preview da Vercel e em desenvolvimento, sem
  ninguém precisar manter domínio em código.
*/

function hostDe(valor) {
  const texto = String(valor || "").trim();
  if (!texto) return "";
  try {
    return new URL(texto).host.toLowerCase();
  } catch {
    return "";
  }
}

export function origemDeTerceiro(req) {
  const proprio = String(req?.headers?.host || "")
    .trim()
    .toLowerCase();
  if (!proprio) return false;

  // `Origin` é o mais confiável quando existe; `Referer` cobre o caso das
  // imagens de ladrilho, que não mandam `Origin` em requisição simples.
  const declarada =
    hostDe(req?.headers?.origin) || hostDe(req?.headers?.referer);
  if (!declarada) return false;

  return declarada !== proprio;
}
