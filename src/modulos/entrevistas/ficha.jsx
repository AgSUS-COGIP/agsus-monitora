import { useEffect, useMemo, useRef, useState } from "react";
import {
  aspectosDoRoteiro,
  aspectosIncompletos,
  avaliacoesDoMapa,
  avaliadoresDaFicha,
  bancasDoEdital,
  calcularEntrevista,
  chaveDaNota,
  mapaDasAvaliacoes,
  mediaDosAspectos,
  motivosDoParecer,
  nomeDoCargo,
  notasAlteradas,
  podeLancarPor,
  rotuloDoLancamento,
} from "../../lib/conducao-de-entrevista.js";
import { textoDaEscala } from "../../lib/digitacao-de-notas.ts";
import {
  lerNumero,
  maximoDaCompetencia,
  minimoEmPontos,
  notaNaEscala,
  opcoesDaEscala,
  pontuacaoMaxima,
  rotuloDoPeso,
} from "../../lib/roteiro-de-entrevista.js";
import { Aviso, classes, Segmentado } from "../../ui/index.js";
import { Popover } from "../../ui/popover.tsx";
import { AbasDaFicha } from "./abas-da-ficha.tsx";
import { CabecalhoDaFicha } from "./cabecalho-da-ficha.tsx";
import { nivelDaNota } from "./campo-de-nota.tsx";
import { MatrizDeNotas } from "./matriz-de-notas.tsx";
import { numeroBR, ResultadoDaFicha } from "./resultado-da-ficha.tsx";

/*
  Ficha de notas de um convocado, em MODO DE ANÁLISE: ocupa a área de conteúdo
  (só o menu lateral do sistema fica), no desenho da ficha da Avaliação
  documental — cabeçalho enxuto e preso (cabecalho-da-ficha.tsx), a matriz
  de notas à esquerda, o resultado vivo numa lateral (resultado-da-ficha.tsx)
  e um rodapé mínimo preso embaixo (acima do menu inferior no celular).

  Componente independente: recebe o payload do edital (`dados`: roteiro,
  banca, permissões), o convocado, a lista para anterior/próximo
  (`convocados`) e as ações (`aoSalvar`, `aoAbrir`, `aoFechar`); não depende
  da tela em volta.

  O lançamento normal é a secretaria passando a limpo a folha de cada
  avaliador: o modo padrão é POR AVALIADOR — uma aba por avaliador e, nela,
  a matriz competências × aspectos (ou uma coluna "Nota" sem aspectos), com
  o fluxo de planilha da matriz-de-notas.tsx. Completo um avaliador, a ficha
  passa sozinha ao próximo (o check aparece na aba); com todos completos, o
  foco vai ao botão principal. "Por competência" (para lançar ao vivo) troca
  as abas pelas competências e as linhas pelos avaliadores; a escolha fica no
  navegador (só conveniência). Digitar a primeira nota marca "Compareceu" se
  o comparecimento ainda não foi informado. Com "Faltou", a matriz some e
  fica a confirmação com o efeito no parecer.

  A prévia (calcularEntrevista, as mesmas regras do banco) muda na hora;
  depois de salvar vale o que o banco devolveu.

  Lançamento "Cada avaliador lança a sua": só as notas do membro ligado ao
  perfil ficam abertas (o administrador global lança por todos).

  Teclado: dígitos lançam e avançam; Enter/setas andam; Ctrl+Enter salva;
  Esc volta à lista. Celular: um avaliador por vez, uma competência por
  linha com as células grandes e o teclado numérico.
*/

const CHAVE_DO_MODO = "monitora.entrevistas.ficha-de-notas.modo";
const MODOS = [
  { valor: "avaliador", rotulo: "Por avaliador" },
  { valor: "competencia", rotulo: "Por competência" },
];

function lerModo() {
  try {
    return globalThis.localStorage?.getItem(CHAVE_DO_MODO) === "competencia"
      ? "competencia"
      : "avaliador";
  } catch {
    return "avaliador";
  }
}
function guardarModo(modo) {
  try {
    globalThis.localStorage?.setItem(CHAVE_DO_MODO, modo);
  } catch {
    /* sem armazenamento: vale só nesta abertura */
  }
}

function estadoInicial(dados, convocado, aspectos) {
  const bancas = bancasDoEdital(dados.avaliadores);
  const mapa = mapaDasAvaliacoes(convocado.avaliacoes, aspectos);
  return {
    compareceu: convocado.compareceu || null,
    banca: convocado.banca ?? (bancas.length === 1 ? bancas[0] : null),
    original: mapa,
    mapa,
  };
}

const vazio = (valor) => (valor ?? "") === "";
const horaCurta = (data) =>
  data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/*
  Os motivos do parecer para a lateral, curtos: com falta, só o da falta (as
  competências sem nota não importam); várias competências sem nota viram
  uma frase só.
*/
function motivosCurtos(motivos, compareceu) {
  if (compareceu === "N") return motivos.slice(0, 1);
  const semNota = motivos.filter((m) => m.startsWith("Sem nota em "));
  if (semNota.length < 2) return motivos;
  const primeiro = motivos.indexOf(semNota[0]);
  const resto = motivos.filter((m) => !semNota.includes(m));
  resto.splice(primeiro, 0, `Sem nota em ${semNota.length} competências.`);
  return resto;
}

function LegendaDaEscala({ niveis, destaque }) {
  if (!niveis.length) return null;
  return (
    <p className="entrevistas-legenda" aria-label="Níveis da escala">
      {niveis.map((n) => (
        <span
          key={n.valor}
          className={classes(destaque === n.valor && "is-destaque")}
          title={n.descricao || undefined}
        >
          <b>{numeroBR(n.valor)}</b> {n.rotulo}
        </span>
      ))}
    </p>
  );
}

function Atalhos() {
  const linhas = [
    ["0–5", "lança e passa à próxima"],
    ["Enter · setas", "andam pela matriz"],
    ["Tab · Shift+Tab", "próxima · anterior"],
    ["Backspace", "apaga; vazia, volta"],
    ["Ctrl+Enter", "salva"],
    ["Esc", "volta à lista"],
  ];
  return (
    <Popover
      rotulo="Atalhos do teclado"
      gatilho="?"
      className="entrevistas-popover-acima"
      acao="atalhos-da-ficha"
    >
      <dl className="entrevistas-atalhos">
        {linhas.map(([tecla, efeito]) => (
          <div key={tecla}>
            <dt>
              <kbd>{tecla}</kbd>
            </dt>
            <dd>{efeito}</dd>
          </div>
        ))}
      </dl>
    </Popover>
  );
}

export function FichaDoCandidato({
  dados,
  convocado,
  convocados,
  salvando,
  aoSalvar,
  aoAbrir,
  aoFechar,
}) {
  const roteiro = dados.configuracao?.roteiro || null;
  const aspectos = useMemo(() => aspectosDoRoteiro(roteiro), [roteiro]);
  const [f, setF] = useState(() => estadoInicial(dados, convocado, aspectos));
  const [erro, setErro] = useState("");
  const [modo, setModo] = useState(lerModo);
  const [aba, setAba] = useState(null);
  const [emFoco, setEmFoco] = useState(null);
  const [salvoEm, setSalvoEm] = useState(null);
  const [pedidoDeAvanco, setPedidoDeAvanco] = useState(0);
  const [focarNaAba, setFocarNaAba] = useState(null);
  const principal = useRef(null);

  /* O payload novo (depois de salvar ou recarregar) é a verdade: a ficha recomeça dele. */
  useEffect(() => {
    setF(estadoInicial(dados, convocado, aspectos));
  }, [dados, convocado, aspectos]);
  useEffect(() => {
    globalThis.scrollTo?.({ top: 0 });
  }, [convocado.id]);

  const competencias = useMemo(
    () =>
      (roteiro?.competencias || [])
        .slice()
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    [roteiro],
  );
  const bancas = bancasDoEdital(dados.avaliadores);
  const avaliadores = avaliadoresDaFicha(dados.avaliadores, convocado, f.banca);
  const resultado = useMemo(
    () =>
      calcularEntrevista({
        roteiro,
        compareceu: f.compareceu,
        avaliacoes: avaliacoesDoMapa(f.mapa, aspectos),
      }),
    [roteiro, f.compareceu, f.mapa, aspectos],
  );
  const motivos = motivosCurtos(
    motivosDoParecer(resultado, f.compareceu, roteiro),
    f.compareceu,
  );
  const alteradas = notasAlteradas(f.original, f.mapa, aspectos);
  // Para o rodapé: as células mudadas (com aspectos, uma nota do banco são vários aspectos).
  const celulasAlteradas = [
    ...new Set([...Object.keys(f.original), ...Object.keys(f.mapa)]),
  ].filter(
    (chave) => lerNumero(f.original[chave]) !== lerNumero(f.mapa[chave]),
  ).length;
  const incompletas = aspectosIncompletos(f.mapa, aspectos);
  const mudouComparecimento =
    f.compareceu && f.compareceu !== (convocado.compareceu || null);
  const mudouBanca =
    f.banca !== null && Number(f.banca) !== Number(convocado.banca ?? NaN);
  const invalidas = Object.entries(f.mapa).filter(([chave, valor]) => {
    if (vazio(valor)) return false;
    const competencia = competencias.find((c) => c.id === chave.split("|")[0]);
    return competencia && !notaNaEscala(roteiro, competencia, valor);
  }).length;
  const algumEditavel = avaliadores.some((a) => podeLancarPor(dados, a));
  const lista = convocados?.length ? convocados : dados.convocados || [];
  const posicao = lista.findIndex((c) => c.id === convocado.id);
  const anterior = posicao > 0 ? lista[posicao - 1] : null;
  const proximo = posicao >= 0 ? lista[posicao + 1] || null : null;
  const maxima = pontuacaoMaxima(competencias);
  const modoAvaliador = dados.configuracao?.lancamento === "AVALIADOR";
  const sujo = alteradas.length > 0 || mudouComparecimento || mudouBanca;
  const faltou = f.compareceu === "N";
  const mostrarBanca =
    bancas.length > 1 ||
    (convocado.banca !== null &&
      convocado.banca !== undefined &&
      !bancas.includes(Number(convocado.banca)));

  /* As células de uma competência × avaliador (uma por aspecto, ou uma só). */
  const chavesDe = (c, a) =>
    aspectos.length
      ? aspectos.map((x) => ({
          chave: chaveDaNota(c.id, a.id, x.id),
          nome: x.nome,
        }))
      : [{ chave: chaveDaNota(c.id, a.id), nome: "" }];
  const valida = (c, chave) =>
    !vazio(f.mapa[chave]) && notaNaEscala(roteiro, c, f.mapa[chave]);
  const escalaDe = useMemo(() => {
    const porMaximo = new Map();
    return (c) => {
      const chave = String(c.nota_maxima);
      if (!porMaximo.has(chave)) {
        const opcoes = opcoesDaEscala(roteiro, c.nota_maxima);
        porMaximo.set(chave, {
          opcoes,
          escala: textoDaEscala(opcoes.map((o) => o.valor)),
          decimal: opcoes.some((o) => !Number.isInteger(o.valor)),
        });
      }
      return porMaximo.get(chave);
    };
  }, [roteiro]);

  const contar = (pares) => ({
    preenchidas: pares.filter(([c, chave]) => valida(c, chave)).length,
    total: pares.length,
  });
  const paresDoAvaliador = (a) =>
    competencias.flatMap((c) => chavesDe(c, a).map((x) => [c, x.chave]));
  const paresDaCompetencia = (c) =>
    avaliadores.flatMap((a) => chavesDe(c, a).map((x) => [c, x.chave]));
  const progresso = contar(avaliadores.flatMap(paresDoAvaliador));

  const abas =
    modo === "avaliador"
      ? avaliadores.map((a) => ({
          id: a.id,
          titulo: a.nome,
          detalhe: [a.origem, a.ativo === false ? "saiu da banca" : ""]
            .filter(Boolean)
            .join(" · "),
          ...contar(paresDoAvaliador(a)),
          pendente: incompletas.some((x) => x.avaliador === a.id),
          editavel: podeLancarPor(dados, a),
        }))
      : competencias.map((c, i) => ({
          id: c.id,
          titulo: `${i + 1}. ${c.nome}`,
          ...contar(paresDaCompetencia(c)),
          pendente: incompletas.some((x) => x.competencia === c.id),
          editavel: avaliadores.some((a) => podeLancarPor(dados, a)),
        }));
  const abaPadrao =
    abas.find((x) => x.editavel && x.preenchidas < x.total) ||
    abas.find((x) => x.editavel) ||
    abas[0];
  const ativa = abas.find((x) => x.id === aba) || abaPadrao || null;
  /* A aba padrão fica fixa ao abrir (e ao trocar o modo): completar não a troca por baixo. */
  const abriu = useRef(false);
  useEffect(() => {
    if (ativa && ativa.id !== aba) setAba(ativa.id);
    // Ao abrir (com teclado), o foco já vai para a primeira célula vazia.
    if (ativa && !abriu.current) {
      abriu.current = true;
      if (globalThis.matchMedia?.("(pointer: coarse)").matches !== true)
        setFocarNaAba(ativa.id);
    }
  }, [ativa?.id, aba]);
  const abasRef = useRef(abas);
  abasRef.current = abas;

  /* Fim da matriz: com a aba completa, passa à próxima incompleta (ou ao botão principal). */
  useEffect(() => {
    if (!pedidoDeAvanco) return undefined;
    const atuais = abasRef.current;
    const i = atuais.findIndex((x) => x.id === ativa?.id);
    const atual = atuais[i];
    if (!atual || atual.preenchidas < atual.total) return undefined;
    const falta = (x) => x.editavel && x.preenchidas < x.total;
    const seguinte =
      atuais.slice(i + 1).find(falta) || atuais.slice(0, i).find(falta);
    const t = setTimeout(() => {
      if (seguinte) {
        setFocarNaAba(seguinte.id);
        setAba(seguinte.id);
      } else principal.current?.focus();
    }, 380);
    return () => clearTimeout(t);
    // Só a cada pedido: o resto é lido no momento.
  }, [pedidoDeAvanco]);

  const linhas = !ativa
    ? []
    : modo === "avaliador"
      ? competencias.map((c, i) => {
          const a = avaliadores.find((x) => x.id === ativa.id);
          return linhaDaMatriz({
            id: c.id,
            titulo: `${i + 1}. ${c.nome}`,
            detalhe: detalheDaCompetencia(c),
            descricao: c.descricao || undefined,
            c,
            a,
          });
        })
      : avaliadores.map((a) => {
          const c = competencias.find((x) => x.id === ativa.id);
          return linhaDaMatriz({
            id: a.id,
            titulo: a.nome,
            detalhe: [a.origem, a.ativo === false ? "saiu da banca" : ""]
              .filter(Boolean)
              .join(" · "),
            c,
            a,
          });
        });

  function detalheDaCompetencia(c) {
    const minimo = minimoEmPontos(c);
    const peso = rotuloDoPeso(c.peso);
    return [
      minimo !== null ? `mín. ${numeroBR(minimo)}` : "",
      peso ? `peso ${peso}` : "",
      c.avaliacao === "GRUPO" ? "em grupo" : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function linhaDaMatriz({ id, titulo, detalhe, descricao, c, a }) {
    const editavel = podeLancarPor(dados, a);
    const campos = chavesDe(c, a);
    const media = aspectos.length
      ? mediaDosAspectos(
          aspectos,
          Object.fromEntries(
            aspectos.map((x) => [x.id, f.mapa[chaveDaNota(c.id, a.id, x.id)]]),
          ),
        )
      : null;
    const minimo = minimoEmPontos(c);
    const peso = lerNumero(c.peso) ?? 1;
    return {
      id,
      titulo,
      detalhe,
      descricao,
      ...escalaDe(c),
      media,
      abaixoDoMinimo:
        media !== null && minimo !== null && media * peso < minimo,
      incompleta: incompletas.some(
        (x) => x.competencia === c.id && x.avaliador === a.id,
      ),
      celulas: campos.map((campo) => {
        const valor = f.mapa[campo.chave] ?? "";
        return {
          chave: campo.chave,
          valor,
          rotulo: `Nota de ${a.nome} em ${c.nome}${campo.nome ? ` · ${campo.nome}` : ""}`,
          editavel,
          invalida:
            valor !== "" &&
            !valor.endsWith(",") &&
            !notaNaEscala(roteiro, c, valor),
        };
      }),
    };
  }

  const mudarNota = (chave, valor) =>
    setF((atual) => ({
      ...atual,
      compareceu: atual.compareceu || (vazio(valor) ? null : "S"),
      mapa: { ...atual.mapa, [chave]: valor },
    }));

  function trocarModo(novo) {
    setModo(novo);
    setAba(null);
    guardarModo(novo);
  }

  function podeSair() {
    if (!sujo) return true;
    return (
      globalThis.confirm?.("Sair sem salvar as notas desta ficha?") === true
    );
  }
  const voltar = () => {
    if (podeSair()) aoFechar();
  };
  const ir = (alvo) => {
    if (alvo && podeSair()) aoAbrir(alvo.id);
  };
  const voltarRef = useRef(voltar);
  voltarRef.current = voltar;
  useEffect(() => {
    const aoTeclar = (ev) => {
      if (ev.key !== "Escape" || ev.defaultPrevented) return;
      if (document.querySelector(".modal.show, .ui-gaveta")) return;
      ev.preventDefault();
      voltarRef.current();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  async function salvar({ abrirProximo = false } = {}) {
    setErro("");
    if (invalidas) {
      setErro("Há notas fora da escala do roteiro; corrija antes de salvar.");
      return;
    }
    if (incompletas.length && !faltou) {
      const c = competencias.find((x) => x.id === incompletas[0].competencia);
      const a = avaliadores.find((x) => x.id === incompletas[0].avaliador);
      setAba(modo === "avaliador" ? a?.id : c?.id);
      setErro(
        `Complete os ${aspectos.length} aspectos de ${a?.nome || "um avaliador"} em “${c?.nome || ""}” (ou apague todos).`,
      );
      return;
    }
    if (!sujo) {
      if (abrirProximo && proximo) aoAbrir(proximo.id);
      else setErro("Nada mudou nesta ficha.");
      return;
    }
    const p = { notas: alteradas };
    if (mudouComparecimento || mudouBanca) {
      if (f.compareceu) p.compareceu = f.compareceu;
      if (f.banca !== null) p.banca = Number(f.banca);
    }
    const resposta = await aoSalvar(p);
    if (resposta?.erro) {
      setErro(resposta.erro);
      return;
    }
    setSalvoEm(new Date());
    if (abrirProximo && proximo) aoAbrir(proximo.id);
  }

  const niveis =
    roteiro?.escala === "NIVEIS" && competencias[0]
      ? escalaDe(competencias[0]).opcoes.filter((o) => o.rotulo)
      : [];
  const valorEmFoco = emFoco ? f.mapa[emFoco] : undefined;
  const destaque =
    valorEmFoco !== undefined && valorEmFoco !== ""
      ? nivelDaNota(niveis, valorEmFoco)?.valor
      : undefined;
  const competenciaAtiva =
    modo === "competencia" && ativa
      ? resultado.competencias.find((x) => x.id === ativa.id)
      : null;
  // Parecer definitivo só com tudo lançado; antes, a lateral é uma prévia neutra.
  const faltamNotas = progresso.total - progresso.preenchidas;
  const pendencia = faltou
    ? ""
    : faltamNotas > 0
      ? faltamNotas === 1
        ? "falta 1 nota"
        : `faltam ${faltamNotas} notas`
      : f.compareceu !== "S"
        ? "falta o comparecimento"
        : "";
  const tom = pendencia
    ? "neutro"
    : resultado.parecer === "APTO"
      ? "ok"
      : resultado.parecer === "INAPTO"
        ? "reprova"
        : "neutro";
  const estadoDaGravacao = salvando
    ? { tom: "salvando", texto: "Salvando…" }
    : sujo
      ? {
          tom: "pendente",
          texto: celulasAlteradas
            ? `${celulasAlteradas} ${celulasAlteradas === 1 ? "nota alterada" : "notas alteradas"}, sem salvar`
            : "Alterações sem salvar",
        }
      : salvoEm
        ? { tom: "salvo", texto: `Salvo às ${horaCurta(salvoEm)}` }
        : { tom: "salvo", texto: "Sem alterações" };

  return (
    <section
      className="entrevistas-analise"
      id="entrevistasFichaDoCandidato"
      aria-labelledby="entrevistasFichaTitulo"
      data-tour="entrevistas-ficha"
    >
      <CabecalhoDaFicha
        candidato={convocado.candidato}
        codigo={convocado.codigo}
        vaga={convocado.vaga}
        cargo={nomeDoCargo(convocado.cargo)}
        modalidade={convocado.modalidade}
        notaDaAnalise={convocado.nota_analise}
        roteiro={roteiro}
        aspectos={aspectos.length}
        lancamento={rotuloDoLancamento(dados.configuracao?.lancamento)}
        gravado={{ nota: convocado.nota ?? null, parecer: convocado.parecer }}
        compareceu={f.compareceu}
        podeEditar={Boolean(dados.pode_editar)}
        salvando={salvando}
        aoMudarComparecimento={(compareceu) =>
          setF((atual) => ({ ...atual, compareceu }))
        }
        bancas={bancas}
        banca={f.banca}
        mostrarBanca={mostrarBanca}
        aoMudarBanca={(banca) => setF((atual) => ({ ...atual, banca }))}
        posicao={posicao}
        total={lista.length}
        anterior={anterior}
        proximo={proximo}
        aoAnterior={() => ir(anterior)}
        aoProximo={() => ir(proximo)}
        aoVoltar={voltar}
      />

      <form
        className="entrevistas-analise-formulario"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
          e.preventDefault();
          if (dados.pode_editar && !salvando) void salvar();
        }}
      >
        <div className="entrevistas-analise-grade">
          <div className="entrevistas-analise-principal">
            {!roteiro ? (
              <Aviso tom="warning">
                Configure a entrevista do edital antes de lançar notas.
              </Aviso>
            ) : null}

            {roteiro && faltou ? (
              <div className="entrevistas-falta" role="status">
                <i className="fa-solid fa-user-xmark" aria-hidden="true" />
                <div>
                  <strong>Faltou à entrevista</strong>
                  <p>
                    {roteiro.ausencia_elimina !== false
                      ? "A ausência elimina neste roteiro: parecer Inapto, total 0."
                      : "Neste roteiro a ausência não elimina; o total fica 0."}
                  </p>
                </div>
              </div>
            ) : null}

            {roteiro && !faltou && avaliadores.length ? (
              <div className="entrevistas-folha">
                <div className="entrevistas-folha-topo">
                  <AbasDaFicha
                    rotulo={
                      modo === "avaliador" ? "Avaliadores" : "Competências"
                    }
                    abas={abas}
                    ativa={ativa?.id || ""}
                    idDoPainel="entrevistasFichaPainel"
                    modo={modo}
                    aoEscolher={(id) => {
                      setFocarNaAba(null);
                      setAba(id);
                    }}
                  />
                  <Segmentado
                    rotulo="Lançar"
                    className="entrevistas-modo-da-ficha"
                    tour="entrevistas-ficha-modo"
                    opcoes={MODOS}
                    valor={modo}
                    aoMudar={trocarModo}
                  />
                </div>
                {modoAvaliador && dados.pode_editar && !dados.admin_global ? (
                  <p className="entrevistas-folha-nota">
                    Você lança só as suas notas.
                    {algumEditavel
                      ? ""
                      : " Nenhum membro desta banca está ligado ao seu perfil."}
                  </p>
                ) : null}
                <div
                  id="entrevistasFichaPainel"
                  role="tabpanel"
                  className="entrevistas-folha-corpo"
                >
                  {competenciaAtiva ? (
                    <div className="entrevistas-folha-titulo">
                      <h3>{ativa.titulo}</h3>
                      <p className="entrevistas-folha-resumo">
                        {[
                          detalheDaCompetencia(
                            competencias.find((c) => c.id === ativa.id),
                          ),
                          `média da banca ${numeroBR(competenciaAtiva.media)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  ) : null}
                  <MatrizDeNotas
                    key={`${modo}:${ativa?.id}:${f.banca}`}
                    rotulo={`Notas · ${ativa?.titulo || ""}`}
                    colunas={
                      aspectos.length
                        ? aspectos.map((x) => ({ id: x.id, nome: x.nome }))
                        : [{ id: "nota", nome: "Nota" }]
                    }
                    linhas={linhas}
                    mostrarMedia={aspectos.length > 0}
                    desabilitado={salvando}
                    focarAoMontar={Boolean(ativa) && focarNaAba === ativa.id}
                    aoMudar={mudarNota}
                    aoFim={() => setPedidoDeAvanco((n) => n + 1)}
                    aoFocar={setEmFoco}
                  />
                  <LegendaDaEscala niveis={niveis} destaque={destaque} />
                </div>
              </div>
            ) : roteiro && !faltou ? (
              <Aviso tom="warning">
                Nenhum membro na banca {f.banca ?? ""}. Cadastre a banca na
                configuração.
              </Aviso>
            ) : null}
          </div>
          {roteiro ? (
            <ResultadoDaFicha
              parecer={resultado.parecer}
              total={resultado.total}
              maxima={maxima}
              minimoTotal={resultado.minimoTotal}
              abaixoDoMinimoTotal={resultado.abaixoDoMinimoTotal}
              competencias={competencias.map((c) => {
                const linha = resultado.competencias.find((x) => x.id === c.id);
                return {
                  id: c.id,
                  nome: c.nome,
                  nota: linha?.nota ?? null,
                  maximo: maximoDaCompetencia(c) ?? 0,
                  minimo: linha?.minimo ?? null,
                  abaixoDoMinimo: Boolean(linha?.abaixoDoMinimo),
                  eliminatoria: Boolean(linha?.eliminatoria),
                };
              })}
              motivos={motivos}
              lancadas={progresso.preenchidas}
              esperadas={progresso.total}
              faltou={faltou}
              pendencia={pendencia}
            />
          ) : null}
        </div>

        {dados.pode_editar && roteiro ? (
          <div className="entrevistas-analise-barra">
            <span
              className="entrevistas-gravacao"
              data-estado={estadoDaGravacao.tom}
              role="status"
            >
              {estadoDaGravacao.texto}
            </span>
            <span className="entrevistas-rodape-resultado" data-tom={tom}>
              {numeroBR(resultado.total)} / {numeroBR(maxima)}
            </span>
            {erro ? (
              <span className="entrevistas-analise-erro" role="alert">
                {erro}
              </span>
            ) : null}
            <Atalhos />
            <button
              type="submit"
              ref={proximo ? undefined : principal}
              className={proximo ? "btn secondary" : "btn"}
              disabled={salvando}
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
            {proximo ? (
              <button
                type="button"
                ref={principal}
                className="btn"
                disabled={salvando}
                onClick={() => void salvar({ abrirProximo: true })}
              >
                <span>
                  Salvar e{" "}
                  <span className="entrevistas-so-largo">abrir o </span>
                  próximo
                </span>
                <i className="fa-solid fa-arrow-right" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}
      </form>
    </section>
  );
}
