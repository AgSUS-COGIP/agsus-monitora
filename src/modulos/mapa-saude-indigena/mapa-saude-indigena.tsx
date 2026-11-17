import type {
  PropsDoMapaSaudeIndigena,
  DseiDoMapa,
} from "../../lib/mapa-saude-indigena/tipos.ts";
import {
  casaisNacionaisDoMapa,
  configuracaoDoMapa,
} from "../../lib/mapa-saude-indigena/dados-do-mapa.ts";
import { leafletDoMapa } from "./tipos-do-leaflet.ts";
import { useCallback, useMemo, useRef } from "react";
import { usarTemaEscuro } from "../../app/tema.ts";
import { chaveDoDsei } from "../../lib/mapa-saude-indigena/chaves.ts";
import {
  bolhasDosDsei,
  casaisNacionais,
  contarPorDsei,
  enquadramentoNacional,
  territoriosPorVagas,
} from "../../lib/mapa-saude-indigena/mapa-nacional.ts";
import {
  registrosDoDsei,
  resumoDaRede,
} from "../../lib/mapa-saude-indigena/mapa-do-dsei.ts";
import { classes } from "../../ui/index.ts";
import { obterLeaflet } from "./leaflet.ts";
import { MapaDoDsei } from "./mapa-do-dsei.tsx";
import { MapaNacional } from "./mapa-nacional.tsx";
import { usarMapaRecolhido } from "./recolher.tsx";
import { usarTelaCheia } from "./tela-cheia.tsx";
import { usarEscParaVoltar, usarVoltaDoDsei } from "./volta-ao-brasil.ts";

/*
  MAPA DA SAÚDE INDÍGENA (React)

  Um mapa principal de cada vez: a visão nacional (bolhas dos DSEIs, CASAIs
  nacionais e "Territórios por vagas") ou, com um DSEI escolhido, o mapa do
  distrito (unidades, filtros por tipo, Terras Indígenas e povos). O DSEI
  escolhido é controlado pelo pai: o clique pede (`aoEscolherDsei`) e o pai,
  que recorta a página pelo DSEI, devolve em `dseiSelecionado`.

  Não busca dados: recebe os DSEIs (`lmap`, já montado com o SIGEPSI por
  `aplicarLocalizacoes`), as CASAIs nacionais do SIGEPSI e os editais do
  recorte. Contrato em docs/biblioteca/modulo-mapa-saude-indigena.md.
*/
export function MapaSaudeIndigena({
  lmap,
  casaisNacionais: casaisDoSigepsi,
  linhas = [],
  filtroAtivo = false,
  dseiSelecionado = null,
  carregando = false,
  tema,
  idDoMapaNacional = "map",
  idDoMapaDoDsei = "detailMap",
  aoEscolherDsei,
  aoSairDoDsei,
  aoFiltrarPorBusca,
  aoEscolherUnidade,
}: PropsDoMapaSaudeIndigena) {
  const escuroDoApp = usarTemaEscuro();
  const escuro = tema ? tema === "escuro" : escuroDoApp;
  const L = leafletDoMapa(obterLeaflet());
  const configuracao = useMemo(() => configuracaoDoMapa(lmap), [lmap]);
  const nac = useMemo(
    () => casaisNacionaisDoMapa(casaisDoSigepsi),
    [casaisDoSigepsi],
  );
  const [telaCheia, botaoDeTelaCheia] = usarTelaCheia();
  const [recolhido, botaoDeRecolher] = usarMapaRecolhido();
  /*
    Em tela cheia não se recolhe; recolhido, não se amplia. Os dois lugares
    ficam sempre na mesma posição, para o React não recriar o botão (e o foco
    não se perder) ao ligar e desligar.
  */
  const acoes = (
    <>
      {telaCheia ? null : botaoDeRecolher}
      {recolhido && !telaCheia ? null : botaoDeTelaCheia}
    </>
  );
  const regiao = useRef<HTMLDivElement | null>(null);

  const dseis = useMemo(() => configuracao.dsei, [configuracao]);
  const dsei = useMemo(() => {
    const chave = chaveDoDsei(dseiSelecionado);
    return chave ? dseis.find((d) => chaveDoDsei(d.k) === chave) || null : null;
  }, [dseis, dseiSelecionado]);

  const [voltaDoDsei, pedirVolta] = usarVoltaDoDsei(dsei);
  const voltarAoBrasil = () => {
    pedirVolta();
    aoSairDoDsei?.();
  };
  usarEscParaVoltar({
    ativo: Boolean(dsei),
    regiao,
    telaCheia,
    aoVoltar: voltarAoBrasil,
  });

  const contagens = useMemo(() => contarPorDsei(linhas), [linhas]);
  const bolhas = useMemo(
    () => bolhasDosDsei({ dseis, contagens, filtroAtivo }),
    [dseis, contagens, filtroAtivo],
  );
  const casais = useMemo(
    () => casaisNacionais({ nac, contagens, filtroAtivo }),
    [nac, contagens, filtroAtivo],
  );
  const territorios = useMemo(() => territoriosPorVagas(bolhas), [bolhas]);
  const enquadramento = useMemo(
    () => enquadramentoNacional({ bolhas, casais, filtroAtivo }),
    [bolhas, casais, filtroAtivo],
  );

  /*
    O resumo da dica conta o que o mapa do DSEI desenha (mesma função): fica
    guardado por DSEI até chegarem dados novos (11 ms para os 34, medido).
  */
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `dseis` só zera o guardado quando chegam dados novos.
  const resumos = useMemo(() => new Map<string, string[]>(), [dseis]);
  const resumoDaRedeDoDsei = useCallback(
    (d: DseiDoMapa) => {
      if (!resumos.has(d.k))
        resumos.set(d.k, resumoDaRede(d, registrosDoDsei(d)));
      return resumos.get(d.k) || [];
    },
    [resumos],
  );

  return (
    <div
      ref={regiao}
      className={classes(
        "mapa-si",
        escuro && "mapa-si--escuro",
        telaCheia && "mapa-si--tela-cheia",
        recolhido && !telaCheia && "mapa-si--recolhido",
      )}
      aria-label="Mapas da rede de saúde indígena"
      role="region"
    >
      <MapaNacional
        L={L}
        idDoMapa={idDoMapaNacional}
        visivel={!dsei}
        telaCheia={telaCheia}
        bolhas={bolhas}
        casais={casais}
        territorios={territorios}
        enquadramento={enquadramento}
        voltaDoDsei={voltaDoDsei}
        resumoDaRede={resumoDaRedeDoDsei}
        carregando={carregando}
        aoEscolherDsei={aoEscolherDsei}
        aoFiltrarPorBusca={aoFiltrarPorBusca}
        acoes={acoes}
      />
      {dsei ? (
        <MapaDoDsei
          key={dsei.k}
          L={L}
          idDoMapa={idDoMapaDoDsei}
          dsei={dsei}
          telaCheia={telaCheia}
          aoVoltarAoBrasil={voltarAoBrasil}
          aoEscolherUnidade={aoEscolherUnidade}
          acoes={acoes}
        />
      ) : null}
    </div>
  );
}
