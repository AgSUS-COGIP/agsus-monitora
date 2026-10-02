import { useCallback, useMemo, useRef } from "react";
import { usarTemaEscuro } from "../../app/tema.js";
import { chaveDoDsei } from "../../lib/mapa-saude-indigena/chaves.js";
import {
  bolhasDosDsei,
  casaisNacionais,
  contarPorDsei,
  enquadramentoNacional,
  territoriosPorVagas,
} from "../../lib/mapa-saude-indigena/mapa-nacional.js";
import {
  registrosDoDsei,
  resumoDaRede,
} from "../../lib/mapa-saude-indigena/mapa-do-dsei.js";
import { classes } from "../../ui/index.js";
import { obterLeaflet } from "./leaflet.js";
import { MapaDoDsei } from "./mapa-do-dsei.jsx";
import { MapaNacional } from "./mapa-nacional.jsx";
import { usarTelaCheia } from "./tela-cheia.jsx";
import { usarEscParaVoltar, usarVoltaDoDsei } from "./volta-ao-brasil.js";

/*
  MAPA DA SAÚDE INDÍGENA (React)

  Um mapa principal de cada vez: a visão nacional (bolhas dos DSEIs, CASAIs
  nacionais e "Territórios por vagas") ou, com um DSEI escolhido, o mapa do
  distrito (unidades, filtros por tipo, Terras Indígenas e povos). O DSEI
  escolhido é controlado pelo pai: o clique pede (`aoEscolherDsei`) e o pai,
  que recorta a página pelo DSEI, devolve em `dseiSelecionado`.

  Não busca dados: recebe o `lmap` e o `rede_cnes` (TB_CONFIG_MAPA_SAUDE_INDIG,
  já com as Lotações) e os editais do recorte. Contrato em README.md.
*/
export function MapaSaudeIndigena({
  lmap,
  redeCnes,
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
  perfil,
  supabase,
  aoAtualizarMapa,
}) {
  const escuroDoApp = usarTemaEscuro();
  const escuro = tema ? tema === "escuro" : escuroDoApp;
  const L = obterLeaflet();
  const [telaCheia, botaoDeTelaCheia] = usarTelaCheia();
  const regiao = useRef(null);

  const dseis = useMemo(
    () => (Array.isArray(lmap?.dsei) ? lmap.dsei : []),
    [lmap],
  );
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
    () => casaisNacionais({ nac: redeCnes?.nac, contagens, filtroAtivo }),
    [redeCnes, contagens, filtroAtivo],
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
  const resumos = useMemo(() => new Map(), [dseis, redeCnes]);
  const resumoDaRedeDoDsei = useCallback(
    (d) => {
      if (!resumos.has(d.k))
        resumos.set(d.k, resumoDaRede(d, registrosDoDsei(d, redeCnes)));
      return resumos.get(d.k);
    },
    [resumos, redeCnes],
  );

  return (
    <div
      ref={regiao}
      className={classes(
        "mapa-si",
        escuro && "mapa-si--escuro",
        telaCheia && "mapa-si--tela-cheia",
      )}
      aria-label="Mapas da rede de saúde indígena"
      role="region"
    >
      <MapaNacional
        lmap={lmap}
        redeCnes={redeCnes}
        perfil={perfil}
        supabase={supabase}
        aoAtualizarMapa={aoAtualizarMapa}
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
        acoes={botaoDeTelaCheia}
      />
      {dsei ? (
        <MapaDoDsei
          lmap={lmap}
          perfil={perfil}
          supabase={supabase}
          aoAtualizarMapa={aoAtualizarMapa}
          key={dsei.k}
          L={L}
          idDoMapa={idDoMapaDoDsei}
          dsei={dsei}
          redeCnes={redeCnes}
          telaCheia={telaCheia}
          aoVoltarAoBrasil={voltarAoBrasil}
          aoEscolherUnidade={aoEscolherUnidade}
          acoes={botaoDeTelaCheia}
        />
      ) : null}
    </div>
  );
}
