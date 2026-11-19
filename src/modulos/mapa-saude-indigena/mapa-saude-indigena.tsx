import type {
  PropsDoMapaSaudeIndigena,
  DseiDoMapa,
} from "../../lib/mapas/mapa-saude-indigena/tipos.ts";
import {
  casaisNacionaisDoMapa,
  configuracaoDoMapa,
} from "../../lib/mapas/mapa-saude-indigena/dados-do-mapa.ts";
import { leafletDoMapa } from "./tipos-do-leaflet.ts";
import { useCallback, useMemo, useRef, useState } from "react";
import { usarTemaEscuro } from "../../app/tema.ts";
import {
  chaveDoDsei,
  formatarNumero,
  plural,
} from "../../lib/mapas/mapa-saude-indigena/chaves.ts";
import {
  indicadoresDoRecorte,
  redePorTipo,
  situacaoDoPreenchimento,
} from "../../lib/mapas/mapa-saude-indigena/indicadores-do-recorte.ts";
import {
  bolhasDosDsei,
  casaisNacionais,
  chaveDosEditaisDaCasai,
  enquadramentoNacional,
  territoriosPorVagas,
} from "../../lib/mapas/mapa-saude-indigena/mapa-nacional.ts";
import { contarPorDsei } from "../../lib/mapas/mapa-saude-indigena/contagem-por-dsei.ts";
import {
  classificarRegistros,
  registrosDoDsei,
  resumoDaRede,
} from "../../lib/mapas/mapa-saude-indigena/mapa-do-dsei.ts";
import {
  FILTRO_DE_ACESSO_VAZIO,
  chaveDaUnidade,
  cruzarComOciosas,
  filtrarUnidades,
  porDseiDoMapa,
  situacaoDaFonte,
  temAcessoNosPontos,
  territorioPorChaveDoMapa,
  textoDosMeios,
  unidadesComAcesso,
} from "../../lib/mapas/mapa-saude-indigena/territorio-na-tela.ts";
import type {
  FiltroDeAcesso,
  SituacaoDaFonte,
  UnidadeComAcesso,
} from "../../lib/mapas/mapa-saude-indigena/territorio-na-tela.ts";
import { classes } from "../../ui/index.ts";
import { obterLeaflet } from "./leaflet.ts";
import { Forma } from "./legenda.tsx";
import { MapaDoDsei } from "./mapa-do-dsei.tsx";
import { MapaNacional } from "./mapa-nacional.tsx";
import { ProcessosDoDsei } from "./processos-do-dsei.tsx";
import {
  AcessoNoBrasil,
  CartaoDoTerritorio,
  UnidadesDoDsei,
} from "./territorio-do-dsei.tsx";
import { usarTelaCheia } from "./tela-cheia.tsx";
import { usarEscParaVoltar, usarVoltaDoDsei } from "./volta-ao-brasil.ts";

/* O valor da CASAI nacional no seletor (o do DSEI é a chave dele). */
const PREFIXO_DA_OPCAO_CASAI = "casai:";

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
  casaiSelecionada = null,
  aoEscolherCasai,
  territorio,
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
  const bolhas = useMemo(
    () => bolhasDosDsei({ dseis, contagens, filtroAtivo }),
    [dseis, contagens, filtroAtivo],
  );
  const casais = useMemo(
    () => casaisNacionais({ nac, contagens, filtroAtivo }),
    [nac, contagens, filtroAtivo],
  );
  const territorios = useMemo(() => territoriosPorVagas(bolhas), [bolhas]);
  /*
    A CASAI nacional escolhida (no seletor ou no endereço): o mapa nacional
    enquadra nela e o painel dela mostra município, UF e os processos.
  */
  const casai = useMemo(() => {
    const chave = chaveDoDsei(casaiSelecionada);
    return !dsei && chave
      ? casais.find((c) => chaveDoDsei(c.nome) === chave) || null
      : null;
  }, [casais, casaiSelecionada, dsei]);

  // Os números do topo seguem o seletor (Brasil, DSEI ou CASAI), como no SIGEPSI.
  const recorte = useMemo(
    () => indicadoresDoRecorte({ dseis, casais, contagens, dsei, casai }),
    [dseis, casais, contagens, dsei, casai],
  );
  // A rede de saúde indígena por tipo do recorte (a CASAI nacional é um ponto só).
  const rede = useMemo(
    () => (casai ? null : redePorTipo(dsei ? [dsei] : dseis)),
    [casai, dsei, dseis],
  );

  /*
    Acesso, território e CNES do SIGEPSI. O acesso das unidades vem nos
    próprios pontos (a `/todas`, `temAcessoNosPontos`); território e CNES, da
    função /api/territorio-dos-dseis (`territorio`), cada fonte por si. Sem
    acesso nos pontos e sem a prop (os testes antigos do mapa), nada disso
    aparece.
  */
  const [filtroDeAcesso, definirFiltroDeAcesso] = useState<FiltroDeAcesso>(
    FILTRO_DE_ACESSO_VAZIO,
  );
  const comAcesso = useMemo(() => temAcessoNosPontos(dseis), [dseis]);
  const fontes = useMemo(() => {
    if (!territorio && !comAcesso) return null;
    const falhou = !territorio || territorio.estado === "indisponivel";
    const r = territorio?.resposta ?? null;
    const acesso: SituacaoDaFonte<true> = comAcesso
      ? { tipo: "pronta", dados: true }
      : carregando
        ? { tipo: "carregando" }
        : {
            tipo: "indisponivel",
            motivo: "o SIGEPSI não trouxe o acesso das unidades",
          };
    return {
      territorio: situacaoDaFonte(r, "territorio", { falhou }),
      acesso,
      cnes: situacaoDaFonte(r, "cnes", { falhou }),
    };
  }, [territorio, comAcesso, carregando]);
  const doTerritorio = useMemo(() => {
    if (!fontes) return null;
    const chaves = dseis.map((d) => d.k);
    const { cnes: c, territorio: t } = fontes;
    const cnes = porDseiDoMapa(c.tipo === "pronta" ? c.dados : null, chaves);
    const unidades = new Map<
      string,
      { dsei: DseiDoMapa; unidades: UnidadeComAcesso[] }
    >();
    for (const d of dseis)
      unidades.set(d.k, {
        dsei: d,
        unidades: unidadesComAcesso({
          registros: classificarRegistros(registrosDoDsei(d), d),
          comAcesso,
          cnes: cnes ? (cnes.get(d.k) ?? []) : null,
        }),
      });
    return {
      territorio:
        t.tipo === "pronta" ? territorioPorChaveDoMapa(t.dados, chaves) : null,
      unidades,
    };
  }, [fontes, dseis, comAcesso]);
  const cruzamento = useMemo(
    () =>
      doTerritorio && comAcesso
        ? cruzarComOciosas(doTerritorio.unidades, contagens, filtroDeAcesso)
        : [],
    [doTerritorio, comAcesso, contagens, filtroDeAcesso],
  );
  const unidadesDoDsei = useMemo(
    () => (dsei ? doTerritorio?.unidades.get(dsei.k)?.unidades || [] : []),
    [doTerritorio, dsei],
  );
  const detalhesDasUnidades = useMemo(
    () =>
      new Map(
        unidadesDoDsei.map((u) => [
          u.chave,
          [
            u.meios?.length ? textoDosMeios(u.meios) : "",
            u.cnes ? `CNES ${u.cnes}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
        ]),
      ),
    [unidadesDoDsei],
  );
  const enquadramento = useMemo(
    () =>
      casai
        ? enquadramentoNacional({ casais: [casai], filtroAtivo: true })
        : enquadramentoNacional({ bolhas, casais, filtroAtivo }),
    [bolhas, casais, filtroAtivo, casai],
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
              <span>DSEI / CASAI</span>
              <select
                aria-label="Selecionar DSEI ou CASAI no mapa"
                value={
                  dsei
                    ? dsei.k
                    : casai
                      ? `${PREFIXO_DA_OPCAO_CASAI}${casai.chave}`
                      : ""
                }
                onChange={(evento) => {
                  const valor = evento.target.value;
                  const escolhido = dseis.find((item) => item.k === valor);
                  const daCasai = casais.find(
                    (c) => `${PREFIXO_DA_OPCAO_CASAI}${c.chave}` === valor,
                  );
                  if (escolhido) aoEscolherDsei?.(escolhido);
                  else if (daCasai) aoEscolherCasai?.(daCasai);
                  else if (dsei) voltarAoBrasil();
                  else aoSairDoDsei?.();
                }}
              >
                <option value="">Todos os DSEIs</option>
                <optgroup label="DSEIs">
                  {[...dseis]
                    .sort((a, b) => a.n.localeCompare(b.n, "pt-BR"))
                    .map((item) => (
                      <option key={item.k} value={item.k}>
                        {item.n}
                      </option>
                    ))}
                </optgroup>
                {casais.length ? (
                  <optgroup label="CASAIs nacionais">
                    {casais.map((c) => (
                      <option
                        key={c.chave}
                        value={`${PREFIXO_DA_OPCAO_CASAI}${c.chave}`}
                      >
                        {c.nome}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </label>
          </div>
          <h3 className="mapa-si-resumo__recorte">{recorte.titulo}</h3>
          <div
            className="mapa-si-resumo__indicadores"
            aria-label={`Indicadores do mapa: ${recorte.titulo}`}
          >
            {recorte.indicadores.map((item) => (
              <div key={item.chave} data-indicador={item.chave}>
                <strong>{item.valor.toLocaleString("pt-BR")}</strong>
                <span>{item.rotulo}</span>
              </div>
            ))}
          </div>
          {rede?.total ? (
            <div className="mapa-si-resumo__rede">
              <span className="mapa-si-resumo__rede-titulo">
                Rede de saúde indígena
              </span>
              <ul
                aria-label={`Rede de saúde indígena por tipo: ${recorte.titulo}`}
              >
                {rede.tipos.map(({ tipo, quantidade }) => (
                  <li key={tipo.key} data-tipo={tipo.key}>
                    <Forma tipo={tipo.key} tamanho={14} />
                    <b>{formatarNumero(quantidade)}</b> {tipo.label}
                  </li>
                ))}
                <li data-tipo="total">
                  <b>{formatarNumero(rede.total)}</b> no total
                </li>
              </ul>
            </div>
          ) : null}
          {recorte.vagas ? (
            <div
              className="mapa-si-resumo__preenchimento"
              data-situacao={situacaoDoPreenchimento(recorte.preenchidas)}
            >
              <div className="mapa-si-resumo__preenchimento-topo">
                <strong>{recorte.preenchidas}%</strong>
                <span>das vagas preenchidas</span>
              </div>
              <span className="mapa-si-territorio__barra" aria-hidden="true">
                <i style={{ width: `${recorte.preenchidas}%` }} />
              </span>
              <div className="mapa-si-resumo__preenchimento-base">
                <span>
                  {formatarNumero(Math.min(recorte.contratadas, recorte.vagas))}{" "}
                  de {formatarNumero(recorte.vagas)} vagas preenchidas
                </span>
                <span>{plural(recorte.ociosas, "ociosa", "ociosas")}</span>
              </div>
            </div>
          ) : null}
          <p className="mapa-si-resumo__fonte">
            Unidades: SIGEPSI. Editais e vagas: Monitora.
          </p>
        </section>
      ) : null}
      {dsei && !telaCheia ? (
        <div className="mapa-si-dsei-cartoes">
          {fontes ? (
            <CartaoDoTerritorio
              situacao={fontes.territorio}
              territorio={doTerritorio?.territorio?.get(dsei.k) ?? null}
            />
          ) : null}
          <ProcessosDoDsei
            dsei={dsei}
            linhas={linhas}
            aoAbrirNaVisaoGeral={aoAbrirNaVisaoGeral}
          />
        </div>
      ) : null}
      {casai && !telaCheia ? (
        <div className="mapa-si-dsei-cartoes">
          <section
            className="mapa-si-resumo mapa-si-casai"
            aria-labelledby="mapa-si-casai-titulo"
          >
            <div className="mapa-si-resumo__introducao">
              <div>
                <h2 id="mapa-si-casai-titulo">{casai.nome}</h2>
                <p>
                  {[casai.cidade, casai.uf].filter(Boolean).join(" · ") ||
                    "Município não informado"}
                </p>
              </div>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => aoSairDoDsei?.()}
              >
                <span aria-hidden="true">←</span> Voltar ao Brasil
              </button>
            </div>
          </section>
          <ProcessosDoDsei
            dsei={{
              k: chaveDosEditaisDaCasai(casai, contagens),
              n: casai.nome,
            }}
            linhas={linhas}
            aoAbrirNaVisaoGeral={aoAbrirNaVisaoGeral}
          />
        </div>
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
          detalhesDasUnidades={detalhesDasUnidades}
        />
      ) : null}
      {fontes && !telaCheia ? (
        dsei ? (
          <UnidadesDoDsei
            dsei={dsei}
            unidades={
              comAcesso
                ? filtrarUnidades(unidadesDoDsei, filtroDeAcesso)
                : unidadesDoDsei
            }
            todas={unidadesDoDsei.length}
            acesso={fontes.acesso}
            cnes={fontes.cnes}
            filtro={filtroDeAcesso}
            aoMudarFiltro={definirFiltroDeAcesso}
          />
        ) : (
          <AcessoNoBrasil
            linhas={cruzamento}
            acesso={fontes.acesso}
            filtro={filtroDeAcesso}
            aoMudarFiltro={definirFiltroDeAcesso}
            aoEscolher={(k) => {
              const escolhido = dseis.find((d) => d.k === k);
              if (escolhido) aoEscolherDsei?.(escolhido);
            }}
          />
        )
      ) : null}
    </div>
  );
}
