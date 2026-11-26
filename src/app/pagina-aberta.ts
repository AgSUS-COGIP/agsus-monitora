import { pedirLinhasDoMonitoramento } from "../componentes/dados-do-monitoramento.ts";
import { telaUsaAsLinhas } from "../lib/navegacao/telas-com-linhas.ts";
import { estadoDaVisaoGeral } from "../modulos/visao-geral/estado.ts";

/*
  O que a página aberta pede ao banco.

  Em 19/10/2026 o Supabase NANO saturou com ~10 avaliadores na Avaliação
  documental: todo navegador lia as linhas do monitoramento na entrada e a
  cada mudança de edital (Realtime), e a Visão geral, montada escondida desde
  o início, pedia o acompanhamento da área a cada releitura — em qualquer
  página. Agora a página aberta é quem diz:

  - as linhas do monitoramento são pedidas enquanto está aberta uma página que
    as usa (src/lib/navegacao/telas-com-linhas.ts); sem pedido, a carga não as lê
    (src/app/carga.ts);
  - a Visão geral sabe se está aberta (`definirAberta`): fechada, não pede o
    acompanhamento da área; ao voltar, pede o que ficou para trás. O Mapa
    (Saúde Indígena) lê o mesmo estado, e com ele aberto o estado também
    calcula e pede (`definirLidaPeloMapa`);
  - o mapa da Saúde Indígena (`lmap`) é pedido quando o Mapa abre
    (`pedirMapa`, src/app/carga.ts); antes era lido em toda entrada.

  Acompanha a navegação (src/app/navegacao.ts): `abertura` abriu uma página;
  `aviso` quer dizer que no lugar dela ficou um aviso (desligada, manutenção,
  sem acesso) — nada aberto.
*/

type EventoDaNavegacao = { tipo: string; view?: string };

export interface DependenciasDaPaginaAberta {
  navegacao: {
    assinar: (ouvinte: (evento: EventoDaNavegacao) => void) => () => void;
  };
  pedirLinhas?: () => () => void;
  /** O Mapa abriu: a carga lê o mapa (uma vez na sessão). */
  pedirMapa?: () => void;
  visaoGeral?: {
    definirAberta: (aberta: boolean) => void;
    definirLidaPeloMapa?: (lida: boolean) => void;
  };
}

/** Liga a página aberta ao que se carrega. Devolve o cancelamento. */
export function acompanharPaginaAberta({
  navegacao,
  pedirLinhas = pedirLinhasDoMonitoramento,
  pedirMapa = () => {},
  visaoGeral = estadoDaVisaoGeral,
}: DependenciasDaPaginaAberta) {
  let devolverLinhas: (() => void) | null = null;

  function abrir(view: string | null) {
    if (telaUsaAsLinhas(view)) devolverLinhas ??= pedirLinhas();
    else {
      devolverLinhas?.();
      devolverLinhas = null;
    }
    visaoGeral.definirAberta(view === "dashboard");
    visaoGeral.definirLidaPeloMapa?.(view === "mapa");
    if (view === "mapa") pedirMapa();
  }

  const parar = navegacao.assinar((evento) => {
    if (evento.tipo === "abertura") abrir(evento.view ?? null);
    else if (evento.tipo === "aviso") abrir(null);
  });
  return () => {
    parar();
    abrir(null);
  };
}
