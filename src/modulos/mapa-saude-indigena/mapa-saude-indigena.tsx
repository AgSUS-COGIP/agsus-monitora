import type {
  PropsDoMapaSaudeIndigena,
  DseiDoMapa,
} from "../../lib/mapas/mapa-saude-indigena/tipos.ts";
import {
  casaisNacionaisDoMapa,
  configuracaoDoMapa,
} from "../../lib/mapas/mapa-saude-indigena/dados-do-mapa.ts";
import { leafletDoMapa } from "./tipos-do-leaflet.ts";
import { useCallback, useMemo, useRef } from "react";
import { usarTemaEscuro } from "../../app/tema.ts";
import { chaveDoDsei } from "../../lib/mapas/mapa-saude-indigena/chaves.ts";
import {
  bolhasDosDsei,
  casaisNacionais,
  enquadramentoNacional,
  territoriosPorVagas,
} from "../../lib/mapas/mapa-saude-indigena/mapa-nacional.ts";
import { contarPorDsei } from "../../lib/mapas/mapa-saude-indigena/contagem-por-dsei.ts";
import {
  registrosDoDsei,
  resumoDaRede,
} from "../../lib/mapas/mapa-saude-indigena/mapa-do-dsei.ts";
import { classes } from "../../ui/index.ts";
import { obterLeaflet } from "./leaflet.ts";
import { MapaDoDsei } from "./mapa-do-dsei.tsx";
import { MapaNacional } from "./mapa-nacional.tsx";
import { ProcessosDoDsei } from "./processos-do-dsei.tsx";
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
  aoAbrirNaVisaoGeral,
}: PropsDoMapaSaudeIndigena) {
  const escuroDoApp = usarTemaEscuro();
  const escuro = tema ? tema === "escuro" : escuroDoApp;
  const L = leafletDoMapa(obterLeaflet());
  const configuracao = useMemo(() => configuracaoDoMapa(lmap), [lmap]);
  const nac = useMemo(
    () => casaisNacionaisDoMapa(casaisDoSigepsi),
    [casaisDoSigepsi],
  );
  // Na aba Mapa o mapa é a página: não se recolhe (o de Projetos, na Visão geral, sim).
  const [telaCheia, botaoDeTelaCheia] = usarTelaCheia();
  const acoes = botaoDeTelaCheia;
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
  const totais = useMemo(() => {
    let editais = 0;
    let vagas = 0;
    for (const valor of contagens.values()) {
      editais += valor.editais;
      vagas += valor.vagas;
    }
    return {
      distritos: dseis.length,
      casais: nac.length,
      unidades: dseis.reduce(
        (total, item) => total + (item.polos?.length ?? 0),
        0,
      ),
      editais,
      vagas,
    };
  }, [dseis, nac, contagens]);
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
      )}
      aria-label="Mapas da rede de saúde indígena"
      role="region"
    >
      {!telaCheia ? (
        <section className="mapa-si-resumo" aria-label="Consulta territorial">
          <div className="mapa-si-resumo__introducao">
            <div>
              <h2>Consulta territorial</h2>
              <p>Selecione um DSEI para ver suas unidades.</p>
            </div>
            <label className="mapa-si-resumo__seletor">
              <span>DSEI</span>
              <select
                aria-label="Selecionar DSEI no mapa"
                value={dsei?.k ?? ""}
                onChange={(evento) => {
                  const escolhido = dseis.find(
                    (item) => item.k === evento.target.value,
                  );
                  if (escolhido) aoEscolherDsei?.(escolhido);
                  else if (dsei) voltarAoBrasil();
                }}
              >
                <option value="">Todos os DSEIs</option>
                {[...dseis]
                  .sort((a, b) => a.n.localeCompare(b.n, "pt-BR"))
                  .map((item) => (
                    <option key={item.k} value={item.k}>
                      {item.n}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div
            className="mapa-si-resumo__indicadores"
            aria-label="Indicadores do mapa"
          >
            <div>
              <strong>{totais.distritos.toLocaleString("pt-BR")}</strong>
              <span>DSEIs mapeados</span>
            </div>
            <div>
              <strong>{totais.casais.toLocaleString("pt-BR")}</strong>
              <span>CASAIs nacionais</span>
            </div>
            <div>
              <strong>{totais.unidades.toLocaleString("pt-BR")}</strong>
              <span>Pontos de unidades</span>
            </div>
            <div>
              <strong>{totais.editais.toLocaleString("pt-BR")}</strong>
              <span>Editais acompanhados</span>
            </div>
            <div>
              <strong>{totais.vagas.toLocaleString("pt-BR")}</strong>
              <span>Vagas acompanhadas</span>
            </div>
          </div>
          <p className="mapa-si-resumo__fonte">
            Unidades: SIGEPSI. Editais e vagas: Monitora.
          </p>
        </section>
      ) : null}
      {dsei && !telaCheia ? (
        <ProcessosDoDsei
          dsei={dsei}
          linhas={linhas}
          aoAbrirNaVisaoGeral={aoAbrirNaVisaoGeral}
        />
      ) : null}
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
