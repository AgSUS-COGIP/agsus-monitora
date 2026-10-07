import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ordinal } from "../../lib/classificacao/numeros.js";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  acoesDaSelecao,
  agruparPorVaga,
  andamentoDaFila,
  COLUNAS_DA_FILA,
  colunasDaEtapa,
  contadoresDaFila,
  ETAPAS_DA_FILA,
  fichaPeloCodigo,
  filtrarFila,
  filtroEhInicial,
  FILTRO_INICIAL,
  loteDaFila,
  ordenarFila,
  planoDeDistribuicao,
  proximaOrdem,
  reservaVigente,
  resumoDaVagaNaFila,
  SITUACOES_DA_FICHA,
  textoDaColuna,
  textoDaReserva,
  textoDaSituacaoNaFila,
  textoDoAndamento,
} from "../../lib/avaliacao-documental/fila.js";
import { tomDoResultado } from "../../lib/avaliacao-documental/ficha.js";
import {
  DICA_DA_ART,
  nota,
  podeIncluirPorDecisao,
  ROTULO_DA_ART,
  textoDoLote,
} from "../../lib/avaliacao-documental/tela-da-pre-classificacao.js";
import {
  Abas,
  Aviso,
  Campo,
  Gaveta,
  MenuDeAcoes,
  Selo,
  TabelaInfinita,
} from "../../ui/index.js";
import {
  IncluirPorDecisao,
  RevogarDecisao,
  SeloDaDecisao,
} from "./decisao-do-lote.jsx";
import { ConteudoDaFicha } from "./ficha/ficha.jsx";

/*
  Aba Fila (fase F3): o resumo do andamento (edital e cada vaga, clicável
  como filtro), as etapas com contadores (clicáveis como filtro), os filtros
  compactos numa linha com os filtros salvos, "Pegar próximo" e "Minhas
  fichas" para o analista, o menu "Ações da coordenação" (distribuir,
  redistribuir, liberar reservas, mandar para revisão, abrir fichas do lote e
  incluir por decisão, com confirmação e motivo), a tabela agrupada por vaga
  quando a vaga é "Todas", a inclusão no
  lote por decisão da coordenação (selo "Decisão: …" na lista e no topo da
  ficha, com "Revogar decisão": decisao-do-lote.jsx) e a ficha aberta
  com a reserva; o conteúdo da análise (F4) é ficha/ficha.jsx. Explicações:
  docs/aya/regras-da-avaliacao-documental.md.
*/

function SituacaoDaLinha({ c }) {
  return (
    <>
      <SituacaoNaFila c={c} /> <SeloDaDecisao c={c} />
    </>
  );
}

function SituacaoNaFila({ c }) {
  const texto = textoDaSituacaoNaFila(c);
  if (c.ficha?.situacao === "CONCLUIDA" && c.ficha.resultado)
    return <Selo tom={tomDoResultado(c.ficha.resultado)}>{texto}</Selo>;
  if (c.ficha)
    return (
      <Selo
        tom={SITUACOES_DA_FICHA[c.ficha.situacao]?.tom}
        titulo={c.ficha.motivo_saida || undefined}
      >
        {texto}
      </Selo>
    );
  return (
    <Selo
      tom={c.situacao_pre === "ELIMINADO" ? "reprovado" : "neutro"}
      titulo={c.motivo_eliminacao || undefined}
    >
      {texto}
    </Selo>
  );
}

function FiltrosSalvos({ fila, f, filtros }) {
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [escolhido, setEscolhido] = useState("");
  return (
    <div
      className="avd-fila-filtros-salvos"
      data-tour="avd-fila-filtros-salvos"
    >
      <Campo rotulo="Filtros salvos">
        <select
          value={escolhido}
          onChange={(ev) => {
            setEscolhido(ev.target.value);
            const salvo = filtros.find((x) => x.id === ev.target.value);
            if (salvo) fila.mudarFiltro({ ...FILTRO_INICIAL, ...salvo.filtro });
          }}
        >
          <option value="">{filtros.length ? "Escolha…" : "Nenhum"}</option>
          {filtros.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
      </Campo>
      {escolhido ? (
        <button
          type="button"
          className="avd-link-discreto"
          onClick={async () => {
            if (await fila.excluirFiltro(escolhido)) setEscolhido("");
          }}
        >
          Excluir
        </button>
      ) : null}
      {salvando ? (
        <form
          className="avd-inline"
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (nome.trim() && (await fila.salvarFiltro(nome.trim()))) {
              setSalvando(false);
              setNome("");
            }
          }}
        >
          <Campo rotulo="Nome do filtro">
            <input
              value={nome}
              maxLength={60}
              autoFocus
              onChange={(ev) => setNome(ev.target.value)}
            />
          </Campo>
          <button type="submit" className="btn small" disabled={!nome.trim()}>
            Salvar
          </button>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => setSalvando(false)}
          >
            Cancelar
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="avd-link-discreto"
          disabled={filtroEhInicial(f)}
          onClick={() => setSalvando(true)}
        >
          Salvar filtro
        </button>
      )}
    </div>
  );
}

const TITULOS_DA_ACAO = {
  distribuir: "Distribuir fichas",
  liberar: "Liberar reservas",
  revisao: "Mandar para revisão",
};

function AcaoEmLote({ fila, acao, dados, aoFechar }) {
  const [para, setPara] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const st = useSyncExternalStore(fila.assinar, fila.obter);
  const analistas = dados.analistas || [];
  const plano = useMemo(
    () =>
      acao.tipo === "distribuir"
        ? planoDeDistribuicao(acao.fichas, analistas, dados.distribuicao, para)
        : null,
    [acao, analistas, dados.distribuicao, para],
  );
  const deOutros =
    acao.tipo === "liberar" &&
    acao.fichas.some((c) => c.ficha.reserva?.usuario !== dados.eu);
  const exigeMotivo =
    acao.tipo === "revisao" ||
    deOutros ||
    (acao.tipo === "distribuir" && (plano.redistribui || para === "fila"));
  const motivoOk = !exigeMotivo || motivo.trim().length >= 10;
  const vazio =
    acao.tipo === "distribuir"
      ? !plano.atribuicoes.length
      : !acao.fichas.length;

  async function confirmar() {
    setErro("");
    let r;
    if (acao.tipo === "distribuir")
      r = await fila.distribuir(
        plano.atribuicoes.map(({ ficha, versao, usuario }) => ({
          ficha,
          versao,
          usuario,
        })),
        motivo.trim(),
      );
    else if (acao.tipo === "liberar")
      r = await fila.liberarReservas(
        acao.fichas.map((c) => c.ficha.id),
        motivo.trim(),
      );
    else
      r = await fila.mandarParaRevisao(
        acao.fichas.map((c) => ({ ficha: c.ficha.id, versao: c.ficha.versao })),
        motivo.trim(),
      );
    if (r.ok) aoFechar(true);
    else setErro(r.erro);
  }

  return (
    <Gaveta
      tituloId="avdAcaoTitulo"
      titulo={TITULOS_DA_ACAO[acao.tipo]}
      resumo={`${acao.fichas.length} ficha(s)`}
      aoFechar={() => aoFechar(false)}
      fecharAoClicarFora={false}
      tour="avd-fila-confirmar"
    >
      <div className="avd-gaveta-corpo">
        {acao.tipo === "distribuir" ? (
          <>
            <Campo rotulo="Para">
              <select value={para} onChange={(ev) => setPara(ev.target.value)}>
                <option value="">
                  Entre a equipe (
                  {dados.distribuicao?.criterio === "LIMITE"
                    ? "até o limite"
                    : "partes iguais"}
                  )
                </option>
                {analistas.map((a) => (
                  <option key={a.usuario} value={a.usuario}>
                    {a.nome}
                  </option>
                ))}
                <option value="fila">Devolver à fila (sem responsável)</option>
              </select>
            </Campo>
            {plano.resumo.length ? (
              <table className="avd-tabela" aria-label="Prévia da distribuição">
                <thead>
                  <tr>
                    <th scope="col">Analista</th>
                    <th scope="col">Recebe</th>
                    <th scope="col">Fica com</th>
                  </tr>
                </thead>
                <tbody>
                  {plano.resumo.map((r) => (
                    <tr key={r.usuario}>
                      <td>{r.nome}</td>
                      <td>{r.novas}</td>
                      <td>{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {plano.sobra.length ? (
              <Aviso tom="warning">
                {plano.sobra.length} ficha(s) sem analista que possa recebê-las
                (vaga ou limite): continuam na fila.
              </Aviso>
            ) : null}
          </>
        ) : null}
        {exigeMotivo ? (
          <Campo
            rotulo="Motivo"
            obrigatorio
            erro={motivo && !motivoOk ? "De 10 a 2.000 caracteres." : undefined}
          >
            <textarea
              rows={3}
              maxLength={2000}
              value={motivo}
              onChange={(ev) => setMotivo(ev.target.value)}
            />
          </Campo>
        ) : null}
        {erro ? (
          <Aviso tom="danger" papel="alert">
            {erro}
          </Aviso>
        ) : null}
        <div className="ui-acoes">
          <button
            type="button"
            className="btn secondary"
            onClick={() => aoFechar(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            data-acao={`confirmar-${acao.tipo}`}
            disabled={vazio || !motivoOk || Boolean(st.acao)}
            onClick={confirmar}
          >
            Confirmar
          </button>
        </div>
      </div>
    </Gaveta>
  );
}

/*
  O modo de análise: a ficha aberta ocupa a área de conteúdo (a lista some;
  fica só o menu lateral). Daqui saem os dados do cabeçalho (candidato, vaga,
  chips, o "i" com situação, responsável, reserva e regra, Anterior /
  Próxima entre as fichas da lista filtrada, salvando antes), que a ficha
  desenha preso ao alto com o stepper (ficha/ficha.jsx), e os avisos logo
  abaixo dele. Esc também volta à fila.
*/
function ModoDeAnalise({
  fila,
  aberta,
  abrindo,
  dados,
  filtroVaga,
  navegaveis,
}) {
  const f = aberta?.ficha;
  const raiz = useRef(null);
  // O conteúdo da ficha salva o que falta (e confirma) antes de sair dela.
  const antesDeSair = useRef(null);
  const registrarAntesDeFechar = useCallback((fn) => {
    antesDeSair.current = fn;
  }, []);
  const podeSair = async () =>
    !antesDeSair.current || (await antesDeSair.current());
  const voltar = async () => {
    if (!(await podeSair())) return;
    await fila.fechar({ esquecer: true });
  };
  const ir = async (fichaId) => {
    if (!fichaId || !(await podeSair())) return;
    await fila.abrir(fichaId);
  };
  const voltarRef = useRef(voltar);
  voltarRef.current = voltar;

  useEffect(() => {
    // Abre no alto da tela (vinha rolada na lista).
    globalThis.scrollTo?.({ top: 0 });
  }, [f?.id]);
  useEffect(() => {
    const aoTeclar = (ev) => {
      if (ev.key !== "Escape" || ev.defaultPrevented) return;
      if (document.querySelector(".modal.show")) return;
      ev.preventDefault();
      void voltarRef.current();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);
  /*
    Recuos das partes fixas: o topo da ficha fica logo abaixo do cabeçalho do
    app (também fixo, de altura variável; só se lê a altura dele) e a lateral,
    abaixo dos dois.
  */
  useEffect(() => {
    const topo = raiz.current?.querySelector(".avd-analise-topo");
    if (!topo || typeof ResizeObserver !== "function") return undefined;
    const cabecalho = document.querySelector("#conteudoPrincipal > .top");
    // Só recua se o cabeçalho do app ficar preso no alto (sticky ou fixed).
    const preso = (el) =>
      el && ["sticky", "fixed"].includes(getComputedStyle(el).position);
    const medir = () => {
      const altura = (el) =>
        el ? `${Math.ceil(el.getBoundingClientRect().height)}px` : "0px";
      raiz.current?.style.setProperty(
        "--avd-recuo-do-cabecalho",
        altura(preso(cabecalho) ? cabecalho : null),
      );
      raiz.current?.style.setProperty("--avd-altura-do-topo", altura(topo));
    };
    const observador = new ResizeObserver(medir);
    observador.observe(topo);
    if (cabecalho) observador.observe(cabecalho);
    medir();
    return () => observador.disconnect();
  }, [f?.id]);

  const [liberando, setLiberando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");

  if (!f)
    return (
      <div className="avd-analise" aria-busy={abrindo ? "true" : undefined}>
        <div className="ui-card">
          <div className="ui-esqueleto-linha" />
          <div className="ui-esqueleto-linha" />
        </div>
      </div>
    );

  const situacao = SITUACOES_DA_FICHA[f.situacao] || {};
  // O inscrito da fila (entrada no lote e a decisão da coordenação).
  const inscrito = (dados.candidatos || []).find((c) => c.ficha?.id === f.id);
  const reservaDeOutro =
    reservaVigente(f.reserva) && f.reserva.usuario !== dados.eu;
  const posicao = navegaveis.findIndex((c) => c.ficha.id === f.id);
  const anterior = posicao > 0 ? navegaveis[posicao - 1] : null;
  const proxima =
    posicao >= 0 && posicao < navegaveis.length - 1
      ? navegaveis[posicao + 1]
      : null;
  const meu = reservaVigente(f.reserva) && f.reserva.usuario === dados.eu;
  // O cabeçalho é desenhado pela ficha (ficha/cabecalho-da-ficha.tsx), com o nível que ela calcula.
  const topo = {
    codigo: String(f.codigo ?? ""),
    nome: f.nome,
    vaga: f.vaga,
    cargo: f.cargo,
    declarada: f.art === null || f.art === undefined ? null : nota(f.art),
    dicaDaDeclarada: DICA_DA_ART,
    posicao: f.posicao ? ordinal(f.posicao) : null,
    modalidade: f.modalidade || null,
    informacoes: [
      {
        rotulo: "Situação",
        valor: <Selo tom={situacao.tom}>{situacao.rotulo || f.situacao}</Selo>,
      },
      { rotulo: "Responsável", valor: f.responsavel_nome || "—" },
      { rotulo: "Reserva", valor: textoDaReserva(f.reserva, dados.eu) || "—" },
      { rotulo: ROTULO_DA_ART, valor: nota(f.art) },
      ...(f.versao_regra
        ? [{ rotulo: "Regra", valor: `v${f.versao_regra}` }]
        : []),
      ...(f.motivo_saida
        ? [{ rotulo: "Saiu do lote", valor: f.motivo_saida }]
        : []),
    ],
    fimDaMinhaReserva: meu ? f.reserva.expira : null,
    decisao: inscrito ? (
      <span className="avd-inline avd-analise-decisao">
        <SeloDaDecisao c={inscrito} />
        {dados.pode_coordenar ? (
          <RevogarDecisao
            c={inscrito}
            aoRevogar={async (motivo) => {
              const r = await fila.revogarDecisao([inscrito], motivo);
              if (r.ok) await fila.abrir(f.id);
              return r;
            }}
          />
        ) : null}
      </span>
    ) : null,
    voltar,
    navegacao: {
      posicao,
      total: navegaveis.length,
      anterior: anterior
        ? { id: anterior.ficha.id, codigo: anterior.codigo }
        : null,
      proxima: proxima
        ? { id: proxima.ficha.id, codigo: proxima.codigo }
        : null,
      abrindo,
      ir: (id) => void ir(id),
    },
  };
  return (
    <section
      className="avd-analise"
      ref={raiz}
      aria-labelledby="avdFichaTitulo"
      data-tour="avd-ficha"
    >
      <ConteudoDaFicha
        key={f.id}
        fila={fila}
        aberta={aberta}
        filtroVaga={filtroVaga}
        aoFechar={voltar}
        registrarAntesDeFechar={registrarAntesDeFechar}
        topo={topo}
      >
        {aberta.somente_leitura && aberta.motivo ? (
          <Aviso tom="warning">Só leitura: {aberta.motivo}</Aviso>
        ) : null}
        {dados.pode_coordenar && reservaDeOutro ? (
          liberando ? (
            <div className="avd-inline">
              <Campo rotulo="Motivo para liberar a reserva" obrigatorio>
                <input
                  value={motivo}
                  maxLength={2000}
                  onChange={(ev) => setMotivo(ev.target.value)}
                />
              </Campo>
              <button
                type="button"
                className="btn small"
                disabled={motivo.trim().length < 10}
                onClick={async () => {
                  const r = await fila.liberarReservas([f.id], motivo.trim());
                  if (r.ok) await fila.abrir(f.id);
                  else setErro(r.erro);
                }}
              >
                Liberar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn secondary avd-analise-liberar"
              data-tour="avd-ficha-liberar"
              onClick={() => setLiberando(true)}
            >
              Liberar a reserva
            </button>
          )
        ) : null}
        {erro ? (
          <Aviso tom="danger" papel="alert">
            {erro}
          </Aviso>
        ) : null}
      </ConteudoDaFicha>
    </section>
  );
}

/* A busca já vem aplicada por filtrarFila (o filtro "busca" é salvo com os outros). */
const jaFiltrado = (itens) => itens;

/* O conteúdo de cada coluna; o resto é o texto de textoDaColuna ("—" sem valor). */
function Celula({ c, chave, eu }) {
  if (chave === "situacao" || chave === "resultado")
    return <SituacaoDaLinha c={c} />;
  if (chave === "posicao") return c.posicao ? ordinal(c.posicao) : "—";
  if (chave === "art") return nota(c.art);
  return textoDaColuna(c, chave, eu) || "—";
}

/*
  A tabela da aba (TabelaInfinita, src/ui/): as colunas que fazem sentido na
  etapa (Eliminados: motivo e ART; Concluídas: nota, resultado, responsável e
  data; Pendentes e Em análise: posição, ART, responsável e reserva), ordem
  por coluna, "N de M", carregamento contínuo, o grupo por vaga (código,
  cargo, lote e linha de corte; recolhível) e "Exportar CSV" da aba, na ordem
  da coluna e sem agrupar. A busca por código ou nome fica nos filtros.
*/
function TabelaDaFila({
  st,
  fila,
  dados,
  linhas,
  ordenadas,
  exibidas,
  ordem,
  setOrdem,
  total,
  semPreClassificacao,
  coordena,
  selecao,
  marcar,
  limparSelecao,
  grupo,
}) {
  const etapa = st.filtro.etapa;
  const chaves = colunasDaEtapa(etapa);
  const comFicha = linhas.filter((c) => c.ficha);
  const comCaixa = coordena && comFicha.length > 0;
  const comAbrir = comFicha.length > 0;
  const todasMarcadas =
    comFicha.length > 0 && comFicha.every((c) => selecao.has(c.id));
  const rotuloDaEtapa =
    ETAPAS_DA_FILA.find((e) => e.valor === etapa)?.rotulo || "Inscritos";

  const colunas = [
    ...(comCaixa
      ? [
          {
            chave: "selecionar",
            rotulo: "Selecionar",
            largura: "2.75rem",
            cabecalho: (
              <input
                type="checkbox"
                aria-label="Selecionar as fichas da lista"
                checked={todasMarcadas}
                onChange={(ev) => {
                  for (const c of comFicha) marcar(c.id, ev.target.checked);
                }}
              />
            ),
          },
        ]
      : []),
    ...chaves.map((chave) => ({
      chave,
      rotulo:
        COLUNAS_DA_FILA[chave].rotuloCurto ?? COLUNAS_DA_FILA[chave].rotulo,
      dica: COLUNAS_DA_FILA[chave].dica,
      numero: COLUNAS_DA_FILA[chave].numero,
      ordem: ordem.chave === chave ? ordem.sentido : "",
      aoOrdenar: () => setOrdem((atual) => proximaOrdem(atual, chave)),
    })),
    ...(comAbrir
      ? [
          {
            chave: "abrir",
            rotulo: "Ficha",
            cabecalho: <span className="sr-only">Ficha</span>,
          },
        ]
      : []),
  ];

  return (
    <TabelaInfinita
      tour="avd-fila-tabela"
      className="avd-fila-tabela"
      idDoTitulo="avdFilaTitulo"
      titulo={rotuloDaEtapa}
      carregado
      itens={exibidas}
      filtrarPelaBusca={jaFiltrado}
      colunas={colunas}
      classeDaTabela="avd-fila-lista"
      total={total}
      vazio={
        semPreClassificacao
          ? "O edital ainda não tem pré-classificação."
          : "Nenhum inscrito nesta etapa."
      }
      informacao={(quantos) =>
        quantos === null
          ? ""
          : quantos === total
            ? `${formatNumberBR(total)} ${total === 1 ? "inscrito" : "inscritos"}`
            : `${formatNumberBR(quantos)} de ${formatNumberBR(total)}`
      }
      grupo={grupo}
      ferramentas={
        <>
          {coordena && selecao.size ? (
            <span className="avd-inline" data-tour="avd-fila-acoes-lote">
              <span className="ui-texto-secundario">
                {selecao.size} selecionada(s)
              </span>
              <button
                type="button"
                className="avd-link-discreto"
                onClick={limparSelecao}
              >
                Limpar seleção
              </button>
            </span>
          ) : null}
          <button
            type="button"
            className="btn secondary small"
            data-acao="exportar-csv"
            disabled={!ordenadas.length}
            onClick={() => fila.exportarCsv(ordenadas, etapa)}
          >
            <i className="fa-solid fa-download" aria-hidden="true" /> Exportar
            CSV
          </button>
        </>
      }
      linha={(c) => (
        <tr key={c.id} data-candidato={c.codigo}>
          {comCaixa ? (
            <td>
              {c.ficha ? (
                <input
                  type="checkbox"
                  aria-label={`Selecionar ${c.codigo}`}
                  checked={selecao.has(c.id)}
                  onChange={(ev) => marcar(c.id, ev.target.checked)}
                />
              ) : null}
            </td>
          ) : null}
          {chaves.map((chave) => (
            <td
              key={chave}
              className={COLUNAS_DA_FILA[chave].numero ? "num" : undefined}
              data-coluna={chave}
            >
              <Celula c={c} chave={chave} eu={dados.eu} />
            </td>
          ))}
          {comAbrir ? (
            <td>
              {c.ficha ? (
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={st.abrindo}
                  onClick={() => void fila.abrir(c.ficha.id)}
                >
                  Abrir
                </button>
              ) : null}
            </td>
          ) : null}
        </tr>
      )}
    />
  );
}

/* A barra do andamento: concluídas, em análise e em revisão, na cor de cada uma; o resto é pendente. */
function BarraDoAndamento({ a }) {
  const parte = (n) => `${a.lote ? (n / a.lote) * 100 : 0}%`;
  return (
    <span
      className="avd-andamento-barra"
      role="progressbar"
      aria-label="Fichas concluídas"
      aria-valuemin={0}
      aria-valuemax={a.lote}
      aria-valuenow={a.concluidas}
    >
      <span data-parte="concluidas" style={{ width: parte(a.concluidas) }} />
      <span data-parte="em_analise" style={{ width: parte(a.em_analise) }} />
      <span data-parte="revisao" style={{ width: parte(a.revisao) }} />
    </span>
  );
}

/*
  O resumo do andamento no alto da Fila: o edital e cada vaga ("cargo ·
  concluídas X de N · em análise Y · pendentes Z") com a barra; clicar na
  vaga filtra (de novo, tira o filtro). Contado com a lista já carregada
  (obter_fila_avaliacao), sem consulta nova.
*/
function ResumoDoAndamento({ andamento, lote, vaga, aoEscolherVaga }) {
  const t = andamento.total;
  return (
    <section
      className="ui-card avd-andamento"
      aria-label="Andamento da avaliação"
      data-tour="avd-fila-andamento"
    >
      <div className="avd-andamento-total">
        <strong>Edital</strong>
        <span>
          {textoDoAndamento({ ...t, cargo: "" })}
          {lote.pelaRegra || lote.porDecisao ? (
            <span className="ui-texto-secundario">
              {" · "}
              <span data-lote-da-fila>
                {textoDoLote(lote.pelaRegra, lote.porDecisao)}
              </span>
            </span>
          ) : null}
        </span>
        <BarraDoAndamento a={t} />
      </div>
      {andamento.vagas.length > 1 || vaga ? (
        <ul className="avd-andamento-vagas">
          {andamento.vagas.map((v) => (
            <li key={v.codigo}>
              <button
                type="button"
                data-vaga={v.codigo}
                aria-pressed={vaga === v.codigo}
                title={
                  vaga === v.codigo
                    ? "Mostrar todas as vagas"
                    : `Mostrar só a vaga ${v.codigo}`
                }
                onClick={() =>
                  aoEscolherVaga(vaga === v.codigo ? "" : v.codigo)
                }
              >
                <span className="avd-andamento-texto">
                  <strong>{v.codigo}</strong> {v.cargo}
                </span>
                <span className="avd-andamento-contas">
                  {textoDoAndamento({ ...v, cargo: "" })}
                </span>
                <BarraDoAndamento a={v} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/* O cabeçalho do grupo da vaga na tabela: cargo, o lote e a linha de corte. */
function textoDoGrupo(cargo, resumo, quantos) {
  const lote = resumo.porDecisao
    ? `lote ${resumo.total} (${resumo.pelaRegra} pela regra + ${resumo.porDecisao} por decisão)`
    : `lote ${resumo.total}`;
  return [
    cargo,
    resumo.total ? lote : "",
    resumo.corte !== null ? `linha de corte ${nota(resumo.corte)}` : "",
    `${quantos} nesta lista`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function Fila({ e, fila }) {
  const st = useSyncExternalStore(fila.assinar, fila.obter);
  const [selecao, setSelecao] = useState(() => new Set());
  const [acao, setAcao] = useState(null);
  const [incluindo, setIncluindo] = useState(false);
  const [busca, setBusca] = useState(st.filtro.busca);
  const [recolhidos, setRecolhidos] = useState(() => new Set());
  // A ordem da tabela fica aqui: Anterior / Próxima da ficha seguem a mesma.
  const [ordem, setOrdem] = useState({ chave: "", sentido: "" });
  const etapa = st.filtro.etapa;
  useEffect(() => setOrdem({ chave: "", sentido: "" }), [etapa]);

  useEffect(() => {
    if (fila.obter().editalId !== e.editalId) void fila.carregar(e.editalId);
  }, [fila, e.editalId]);
  useEffect(() => {
    // Ao sair da página, a reserva é liberada mas a ficha fica lembrada (recarregar volta a ela).
    const aoSairDaPagina = () => void fila.fechar();
    globalThis.addEventListener?.("pagehide", aoSairDaPagina);
    return () => {
      globalThis.removeEventListener?.("pagehide", aoSairDaPagina);
      void fila.fechar();
    };
  }, [fila]);

  const dados = st.dados;
  const candidatos = useMemo(() => dados?.candidatos || [], [dados]);
  const contadores = useMemo(() => contadoresDaFila(candidatos), [candidatos]);
  const andamento = useMemo(
    () => andamentoDaFila(candidatos, dados?.vagas),
    [candidatos, dados?.vagas],
  );
  const linhas = useMemo(
    () => filtrarFila(candidatos, st.filtro, dados?.eu),
    [candidatos, st.filtro, dados?.eu],
  );
  const ordenadas = useMemo(() => ordenarFila(linhas, ordem), [linhas, ordem]);
  // Todas as vagas: a tabela agrupa por vaga (o CSV sai sem agrupar, na ordem da coluna).
  const agrupada = !st.filtro.vaga;
  const exibidas = useMemo(
    () => (agrupada ? agruparPorVaga(ordenadas, dados?.vagas) : ordenadas),
    [agrupada, ordenadas, dados?.vagas],
  );
  const navegaveis = useMemo(
    () => exibidas.filter((c) => c.ficha?.id),
    [exibidas],
  );
  const modalidades = useMemo(
    () =>
      [...new Set(candidatos.map((c) => c.modalidade).filter(Boolean))].sort(),
    [candidatos],
  );
  const selecionados = candidatos.filter((c) => selecao.has(c.id));
  const acoes = acoesDaSelecao(selecionados);
  const coordena = Boolean(dados?.pode_coordenar);
  const livres = candidatos.filter(
    (c) => c.ficha?.situacao === "PENDENTE" && !c.ficha.responsavel,
  );
  const lote = loteDaFila(candidatos, st.filtro.vaga);
  const foraDoLote = candidatos
    .filter(
      (c) =>
        (!st.filtro.vaga || c.vaga === st.filtro.vaga) &&
        podeIncluirPorDecisao(c),
    )
    .map((c) => ({
      ...c,
      situacao: c.situacao_pre,
      motivo: c.motivo_eliminacao,
    }));

  if (st.erro && !dados)
    return (
      <Aviso tom="danger" papel="alert">
        Não foi possível carregar a fila: {st.erro}{" "}
        <button
          type="button"
          className="btn secondary small"
          onClick={() => void fila.carregar(e.editalId)}
        >
          Tentar novamente
        </button>
      </Aviso>
    );
  if (!dados)
    return (
      <div className="ui-card" aria-busy="true">
        <div className="ui-esqueleto-linha" />
        <div className="ui-esqueleto-linha" />
      </div>
    );

  const marcar = (id, sim) =>
    setSelecao((atual) => {
      const nova = new Set(atual);
      if (sim) nova.add(id);
      else nova.delete(id);
      return nova;
    });
  const minhas = st.filtro.responsavel === "eu";
  const cargoDaVaga = Object.fromEntries(
    (dados.vagas || []).map((v) => [String(v.codigo), v.cargo]),
  );
  const grupo = agrupada
    ? {
        chave: (c) => String(c.vaga ?? ""),
        cabecalho: (vaga, quantos) => (
          <>
            <strong>{vaga}</strong>
            <span className="ui-texto-secundario">
              {textoDoGrupo(
                cargoDaVaga[vaga],
                resumoDaVagaNaFila(candidatos, vaga),
                quantos,
              )}
            </span>
          </>
        ),
        recolhidos,
        aoAlternar: (vaga) =>
          setRecolhidos((atual) => {
            const novo = new Set(atual);
            if (novo.has(vaga)) novo.delete(vaga);
            else novo.add(vaga);
            return novo;
          }),
      }
    : null;

  // As ações da coordenação num menu só (quem não coordena não vê o menu).
  const acoesDaCoordenacao = [
    {
      id: "incluir",
      rotulo: "Incluir por decisão da coordenação",
      icone: "fa-user-plus",
      desabilitado: !foraDoLote.length || Boolean(st.acao),
      aoEscolher: () => setIncluindo(true),
      dados: {
        "data-acao": "incluir-por-decisao",
        "data-tour": "avd-fila-incluir-por-decisao",
      },
    },
    {
      id: "distribuir-livres",
      rotulo: `Distribuir as livres (${livres.length})`,
      icone: "fa-user-group",
      desabilitado: !livres.length,
      aoEscolher: () => setAcao({ tipo: "distribuir", fichas: livres }),
      dados: { "data-tour": "avd-fila-distribuir-livres" },
    },
    {
      id: "distribuir",
      rotulo: `Distribuir as selecionadas (${acoes.distribuir.length})`,
      icone: "fa-users",
      desabilitado: !acoes.distribuir.length,
      aoEscolher: () =>
        setAcao({ tipo: "distribuir", fichas: acoes.distribuir }),
      dados: { "data-acao": "distribuir-selecionadas" },
    },
    {
      id: "liberar",
      rotulo: `Liberar reservas (${acoes.liberar.length})`,
      icone: "fa-lock",
      desabilitado: !acoes.liberar.length,
      aoEscolher: () => setAcao({ tipo: "liberar", fichas: acoes.liberar }),
      dados: { "data-acao": "liberar-reservas" },
    },
    {
      id: "revisao",
      rotulo: `Mandar para revisão (${acoes.revisao.length})`,
      icone: "fa-rotate-left",
      desabilitado: !acoes.revisao.length,
      aoEscolher: () => setAcao({ tipo: "revisao", fichas: acoes.revisao }),
      dados: { "data-acao": "mandar-para-revisao" },
    },
    ...(dados.sem_ficha
      ? [
          {
            id: "abrir-fichas",
            rotulo: `Abrir fichas do lote (${dados.sem_ficha})`,
            icone: "fa-folder-open",
            desabilitado: Boolean(st.acao),
            aoEscolher: () => void fila.abrirFichasDoLote(),
            dados: { "data-tour": "avd-fila-abrir-fichas" },
          },
        ]
      : []),
  ];

  if (st.aberta?.ficha || st.abrindo)
    return (
      <ModoDeAnalise
        key={st.aberta?.ficha?.id || "abrindo"}
        fila={fila}
        aberta={st.aberta}
        abrindo={st.abrindo}
        dados={dados}
        filtroVaga={st.filtro.vaga}
        navegaveis={navegaveis}
      />
    );

  return (
    <div className="avd-fila" data-tour="avd-fila">
      {andamento.vagas.length ? (
        <ResumoDoAndamento
          andamento={andamento}
          lote={lote}
          vaga={st.filtro.vaga}
          aoEscolherVaga={(vaga) => fila.mudarFiltro({ vaga })}
        />
      ) : null}

      <Abas
        rotulo="Etapas da fila"
        tour="avd-fila-etapas"
        abas={ETAPAS_DA_FILA.map((et) => ({
          id: et.valor,
          rotulo: et.rotulo,
          contagem: contadores[et.valor],
          dados: { "data-valor": et.valor },
        }))}
        ativa={st.filtro.etapa}
        aoEscolher={(etapa) => fila.mudarFiltro({ etapa })}
      />

      <section className="ui-card avd-fila-barra" aria-label="Filtros da fila">
        <div className="avd-fila-filtros" data-tour="avd-fila-filtros">
          <Campo rotulo="Vaga">
            <select
              value={st.filtro.vaga}
              onChange={(ev) => fila.mudarFiltro({ vaga: ev.target.value })}
            >
              <option value="">Todas</option>
              {(dados.vagas || []).map((v) => (
                <option key={v.codigo} value={v.codigo}>
                  {[v.codigo, v.cargo].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Responsável">
            <select
              value={st.filtro.responsavel}
              onChange={(ev) =>
                fila.mudarFiltro({ responsavel: ev.target.value })
              }
            >
              <option value="">Todos</option>
              <option value="eu">Minhas fichas</option>
              <option value="ninguem">Sem responsável</option>
              {(dados.analistas || []).map((a) => (
                <option key={a.usuario} value={a.usuario}>
                  {a.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Modalidade">
            <select
              value={st.filtro.modalidade}
              onChange={(ev) =>
                fila.mudarFiltro({ modalidade: ev.target.value })
              }
            >
              <option value="">Todas</option>
              {modalidades.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Código ou nome">
            <input
              type="search"
              value={busca}
              placeholder="Código ou nome"
              data-tour="avd-fila-busca"
              onChange={(ev) => {
                setBusca(ev.target.value);
                fila.mudarFiltro({ busca: ev.target.value });
              }}
              onKeyDown={(ev) => {
                if (ev.key !== "Enter") return;
                const achado = fichaPeloCodigo(candidatos, busca);
                if (achado) void fila.abrir(achado.ficha.id);
              }}
            />
          </Campo>
          <FiltrosSalvos
            fila={fila}
            f={st.filtro}
            filtros={dados.filtros || []}
          />
        </div>
        <div className="avd-fila-acoes">
          {dados.eu ? (
            <button
              type="button"
              className="btn secondary"
              aria-pressed={minhas}
              data-tour="avd-fila-minhas"
              onClick={() =>
                fila.mudarFiltro({ responsavel: minhas ? "" : "eu" })
              }
            >
              <i className="fa-solid fa-user-check" aria-hidden="true" /> Minhas
              fichas
            </button>
          ) : null}
          {dados.pode_pegar ? (
            <button
              type="button"
              className="btn"
              data-tour="avd-fila-pegar"
              data-acao="pegar-proximo"
              disabled={st.abrindo}
              onClick={() => void fila.pegarProxima(st.filtro.vaga)}
            >
              <i className="fa-solid fa-arrow-right" aria-hidden="true" /> Pegar
              próximo
            </button>
          ) : null}
          {coordena ? (
            <MenuDeAcoes
              rotulo="Ações da coordenação"
              icone="fa-sliders"
              tour="avd-fila-acoes-coordenacao"
              contagem={selecionados.length}
              acoes={acoesDaCoordenacao}
            />
          ) : null}
        </div>
      </section>

      <TabelaDaFila
        st={st}
        fila={fila}
        dados={dados}
        linhas={linhas}
        ordenadas={ordenadas}
        exibidas={exibidas}
        ordem={ordem}
        setOrdem={setOrdem}
        total={contadores[st.filtro.etapa] ?? 0}
        semPreClassificacao={!candidatos.length}
        coordena={coordena}
        selecao={selecao}
        marcar={marcar}
        limparSelecao={() => setSelecao(new Set())}
        grupo={grupo}
      />

      {incluindo ? (
        <IncluirPorDecisao
          candidatos={foraDoLote}
          aoIncluir={(escolhidos, motivo) =>
            fila.incluirPorDecisao(escolhidos, motivo)
          }
          aoFechar={() => setIncluindo(false)}
        />
      ) : null}
      {acao ? (
        <AcaoEmLote
          key={`${acao.tipo}:${acao.fichas.length}`}
          fila={fila}
          acao={acao}
          dados={dados}
          aoFechar={(feito) => {
            setAcao(null);
            if (feito) setSelecao(new Set());
          }}
        />
      ) : null}
    </div>
  );
}
