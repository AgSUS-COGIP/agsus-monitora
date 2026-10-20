import {
  memo,
  useCallback,
  useDeferredValue,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import { MIME_XLSX } from "../../lib/classificacao/exportacao.ts";
import { RESULTADOS } from "../../lib/avaliacao-documental/catalogo.js";
import {
  agruparPorOutroMotivo,
  argumentosDoRelatorio,
  ATALHOS,
  catalogoDoRelatorio,
  csvDoRelatorio,
  FILTROS_INICIAIS,
  filtrosDoAtalho,
  linhasDoRelatorio,
  motivosDoFiltro,
  nomeDoRelatorio,
  RPC_RELATORIO_DE_MOTIVOS,
  SITUACOES_DA_FICHA,
  SITUACOES_DO_FILTRO,
  xlsxDoRelatorio,
  type Atalho,
  type FichaDoRelatorio,
  type FiltrosDoRelatorio,
  type LinhaDoRelatorio,
  type PaginaDoRelatorio,
  type SituacaoDaFicha,
  type SituacaoDoBloco,
} from "../../lib/avaliacao-documental/relatorio-de-motivos.ts";
import {
  Aviso,
  Campo,
  Gaveta,
  GradeDeKpis,
  Kpi,
  TabelaInfinita,
} from "../../ui/index.js";
import { baixarNoNavegador } from "../classificacao/estado.ts";

/*
  "Relatório de motivos" (Avaliação documental › Fila › Ações da coordenação;
  só quem coordena o edital vê o menu, e o banco confere de novo): filtros
  (critério da regra, situação do critério, motivo, resultado, situação da
  ficha, vaga, avaliador e período de conclusão) e atalhos prontos; lê as
  fichas em páginas de 500 (listar_relatorio_de_motivos, migration
  20261020120000: só as colunas do relatório, sem CPF/e-mail/telefone), mostra
  a contagem, a tabela e, opcionalmente, os textos do "Outro motivo"
  agrupados; exporta CSV (Excel) ou XLSX montados no navegador. Nada é
  gravado (nem banco, nem Storage). Regras puras:
  src/lib/avaliacao-documental/relatorio-de-motivos.ts.

  Desenho em partes, para trocar filtro não travar a tela: os filtros moram
  no próprio painel (PainelDeFiltros) e só sobem ao gerar o relatório; o
  resultado (contagem, textos agrupados e tabela) só muda quando chega uma
  leitura nova, e cada linha da tabela é memorizada pela ficha. A busca da
  tabela filtra com o valor adiado (useDeferredValue): o campo responde na
  hora e a lista acompanha logo depois. A gaveta abre e fecha pelo próprio
  estado (RelatorioDeMotivosDaFila), sem redesenhar a Fila por trás.
*/

type Rpc = (
  nome: string,
  argumentos: Record<string, unknown>,
) => Promise<unknown>;

type Lido = {
  fichas: FichaDoRelatorio[];
  total: number;
  avaliadores: { usuario: string; nome: string }[];
};

/** Lê todas as páginas; `cancelado()` verdadeiro para no fim da página em curso (devolve null). */
export async function lerRelatorioDeMotivos({
  rpc,
  editalId,
  filtros,
  aoProgredir = () => {},
  cancelado = () => false,
}: {
  rpc: Rpc;
  editalId: string;
  filtros: FiltrosDoRelatorio;
  aoProgredir?: (lidas: number, total: number) => void;
  cancelado?: () => boolean;
}): Promise<Lido | null> {
  const lido: Lido = { fichas: [], total: 0, avaliadores: [] };
  let apos: string | null = null;
  for (let pagina = 0; pagina < 1000; pagina += 1) {
    const r = ((await rpc(
      RPC_RELATORIO_DE_MOTIVOS,
      argumentosDoRelatorio(editalId, filtros, apos),
    )) ?? {}) as PaginaDoRelatorio;
    if (cancelado()) return null;
    lido.fichas.push(...(r.fichas ?? []));
    if (pagina === 0) {
      lido.total = r.total ?? 0;
      lido.avaliadores = r.avaliadores ?? [];
    }
    aoProgredir(lido.fichas.length, lido.total);
    apos = r.proximo ?? null;
    if (!apos) break;
  }
  return lido;
}

type Vaga = { codigo: string | number; cargo?: string | null };
type Pessoa = { usuario: string; nome: string };
type Baixar = (conteudo: BlobPart, nome: string, tipo: string) => void;
type Catalogo = ReturnType<typeof catalogoDoRelatorio>;
type Grupo = ReturnType<typeof agruparPorOutroMotivo>[number];

/* Padrões de módulo: um `[]` ou `() => new Date()` novo a cada desenho desfaria a memória dos filhos. */
const NINGUEM: Pessoa[] = [];
const NENHUMA_VAGA: Vaga[] = [];
const AGORA = () => new Date();

const buscarNaLinha = (
  itens: readonly LinhaDoRelatorio[],
  busca: string,
): readonly LinhaDoRelatorio[] => {
  const t = busca.trim().toLowerCase();
  if (!t) return itens;
  return itens.filter((l) =>
    [l.codigo, l.candidato, l.outroMotivo, l.demaisMotivos].some((v) =>
      v.toLowerCase().includes(t),
    ),
  );
};
/* A busca já vem aplicada (com o valor adiado) nos itens da tabela. */
const jaFiltrado = (
  itens: readonly LinhaDoRelatorio[],
): readonly LinhaDoRelatorio[] => itens;

const COLUNAS = [
  { rotulo: "Código", chave: "codigo" },
  { rotulo: "Candidato", chave: "candidato" },
  { rotulo: "Vaga", chave: "vaga" },
  { rotulo: "Resultado", chave: "resultado" },
  { rotulo: "Critério", chave: "criterio" },
  { rotulo: "Texto do outro motivo", chave: "outro" },
  { rotulo: "Demais motivos", chave: "demais" },
  { rotulo: "Concluída por", chave: "por" },
  { rotulo: "Concluída em", chave: "em" },
];

const informacaoDaTabela = (n: number | null) =>
  n === null ? "" : `${n.toLocaleString("pt-BR")} ficha(s)`;

/* Uma ficha na tabela: só redesenha quando a própria linha muda (leitura nova). */
const LinhaDaFicha = memo(function LinhaDaFicha({
  linha: l,
}: {
  linha: LinhaDoRelatorio;
}) {
  return (
    <tr data-codigo={l.codigo}>
      <td>{l.codigo}</td>
      <td>{l.candidato}</td>
      <td title={l.cargo}>{l.vaga}</td>
      <td>{l.resultado || l.situacaoDaFicha}</td>
      <td>
        {l.criterio}
        {l.situacaoDoBloco ? (
          <span className="ui-texto-secundario"> · {l.situacaoDoBloco}</span>
        ) : null}
      </td>
      <td>{l.outroMotivo}</td>
      <td>
        {[l.demaisMotivos, l.justificativas].filter(Boolean).join(" | ")}
        {l.notaAjustada ? (
          <span className="ui-texto-secundario"> (nota {l.notaAjustada})</span>
        ) : null}
      </td>
      <td>{l.concluidaPor}</td>
      <td>{l.concluidaEm}</td>
    </tr>
  );
});
const desenharLinha = (l: LinhaDoRelatorio) => (
  <LinhaDaFicha key={l.id} linha={l} />
);

/*
  Os atalhos e os filtros, com o estado aqui dentro: escolher um filtro
  redesenha só este painel. `aoGerar(filtros)` leva a escolha para a leitura.
*/
const PainelDeFiltros = memo(function PainelDeFiltros({
  catalogo,
  vagas,
  avaliadores,
  buscando,
  agrupar,
  aoAgrupar,
  aoGerar,
  aoCancelar,
}: {
  catalogo: Catalogo;
  vagas: Vaga[];
  avaliadores: Pessoa[];
  buscando: boolean;
  agrupar: boolean;
  aoAgrupar: (agrupar: boolean) => void;
  aoGerar: (filtros: FiltrosDoRelatorio) => void;
  aoCancelar: () => void;
}) {
  const [filtros, setFiltros] = useState<FiltrosDoRelatorio>(FILTROS_INICIAIS);
  const motivos = useMemo(
    () => motivosDoFiltro(catalogo, filtros.blocos),
    [catalogo, filtros.blocos],
  );
  const multiplos = filtros.blocos.length > 1;

  const mudar = (m: Partial<FiltrosDoRelatorio>) =>
    setFiltros((atual) => ({ ...atual, ...m }));

  function usarAtalho(a: Atalho) {
    const novos = filtrosDoAtalho(a.id, catalogo, filtros);
    setFiltros(novos);
    aoAgrupar(a.agrupar);
    aoGerar(novos);
  }

  return (
    <>
      <div
        className="avd-relatorio-atalhos"
        role="group"
        aria-label="Atalhos"
        data-tour="avd-relatorio-atalhos"
      >
        {ATALHOS.map((a) => (
          <button
            key={a.id}
            type="button"
            className="btn secondary small"
            data-atalho={a.id}
            disabled={buscando || !catalogo.blocos.length}
            onClick={() => usarAtalho(a)}
          >
            <i className={`fa-solid ${a.icone}`} aria-hidden="true" />{" "}
            {a.rotulo}
          </button>
        ))}
      </div>

      <section
        className="ui-card avd-relatorio-filtros"
        aria-label="Filtros do relatório"
        data-tour="avd-relatorio-filtros"
      >
        <Campo rotulo="Critério">
          <select
            value={multiplos ? "__varios" : (filtros.blocos[0] ?? "")}
            disabled={buscando}
            data-filtro="criterio"
            onChange={(ev) =>
              mudar({
                blocos: ev.target.value ? [ev.target.value] : [],
                motivo: "",
              })
            }
          >
            <option value="">Todos</option>
            {multiplos ? (
              <option value="__varios">
                {catalogo.blocos
                  .filter((b) => filtros.blocos.includes(b.codigo))
                  .map((b) => b.nome)
                  .join(" + ")}
              </option>
            ) : null}
            {catalogo.blocos.map((b) => (
              <option key={b.codigo} value={b.codigo}>
                {b.titulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Situação do critério">
          <select
            value={filtros.situacao}
            disabled={buscando}
            data-filtro="situacao"
            onChange={(ev) =>
              mudar({ situacao: ev.target.value as SituacaoDoBloco | "" })
            }
          >
            <option value="">Qualquer</option>
            {SITUACOES_DO_FILTRO.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Motivo">
          <select
            value={filtros.motivo}
            disabled={buscando}
            data-filtro="motivo"
            onChange={(ev) => mudar({ motivo: ev.target.value })}
          >
            <option value="">Qualquer</option>
            {motivos.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.texto}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Resultado">
          <select
            value={filtros.resultado}
            disabled={buscando}
            data-filtro="resultado"
            onChange={(ev) => mudar({ resultado: ev.target.value })}
          >
            <option value="">Todos</option>
            {(
              RESULTADOS as unknown as readonly (readonly [string, string])[]
            ).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Situação da ficha">
          <select
            value={filtros.situacaoDaFicha}
            disabled={buscando}
            data-filtro="situacao-da-ficha"
            onChange={(ev) =>
              mudar({ situacaoDaFicha: ev.target.value as SituacaoDaFicha })
            }
          >
            {SITUACOES_DA_FICHA.map((s) => (
              <option key={s.valor || "todas"} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Vaga">
          <select
            value={filtros.vaga}
            disabled={buscando}
            data-filtro="vaga"
            onChange={(ev) => mudar({ vaga: ev.target.value })}
          >
            <option value="">Todas</option>
            {vagas.map((v) => (
              <option key={String(v.codigo)} value={String(v.codigo)}>
                {v.cargo ? `${v.codigo} · ${v.cargo}` : String(v.codigo)}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Avaliador">
          <select
            value={filtros.avaliador}
            disabled={buscando}
            data-filtro="avaliador"
            onChange={(ev) => mudar({ avaliador: ev.target.value })}
          >
            <option value="">Todos</option>
            {avaliadores.map((a) => (
              <option key={a.usuario} value={a.usuario}>
                {a.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Concluída de">
          <input
            type="date"
            value={filtros.de}
            disabled={buscando}
            data-filtro="de"
            onChange={(ev) => mudar({ de: ev.target.value })}
          />
        </Campo>
        <Campo rotulo="até">
          <input
            type="date"
            value={filtros.ate}
            disabled={buscando}
            data-filtro="ate"
            onChange={(ev) => mudar({ ate: ev.target.value })}
          />
        </Campo>
        <label className="avd-relatorio-marca">
          <input
            type="checkbox"
            checked={filtros.ajustada}
            disabled={buscando}
            data-filtro="ajustada"
            onChange={(ev) => mudar({ ajustada: ev.target.checked })}
          />{" "}
          Só nota ajustada
        </label>
        <label className="avd-relatorio-marca">
          <input
            type="checkbox"
            checked={agrupar}
            data-filtro="agrupar"
            onChange={(ev) => aoAgrupar(ev.target.checked)}
          />{" "}
          Agrupar pelo texto do outro motivo
        </label>
        <div className="ui-acoes">
          <button
            type="button"
            className="btn ghost small"
            disabled={buscando}
            onClick={() => {
              setFiltros(FILTROS_INICIAIS);
              aoAgrupar(false);
            }}
          >
            Limpar
          </button>
          {buscando ? (
            <button
              type="button"
              className="btn secondary small"
              onClick={aoCancelar}
            >
              Cancelar
            </button>
          ) : null}
          <button
            type="button"
            className="btn small"
            data-acao="gerar-relatorio"
            disabled={buscando}
            onClick={() => aoGerar(filtros)}
          >
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />{" "}
            Gerar relatório
          </button>
        </div>
      </section>
    </>
  );
});

/* Os textos do "Outro motivo" agrupados; clicar num texto busca as fichas dele. */
const GruposDoRelatorio = memo(function GruposDoRelatorio({
  grupos,
  aoEscolher,
}: {
  grupos: readonly Grupo[];
  aoEscolher: (texto: string) => void;
}) {
  return (
    <section
      className="ui-card avd-relatorio-grupos"
      aria-labelledby="avdRelatorioGruposTitulo"
      data-tour="avd-relatorio-grupos"
    >
      <h3 className="ui-titulo" id="avdRelatorioGruposTitulo">
        Textos do outro motivo
      </h3>
      {grupos.length ? (
        <table>
          <thead>
            <tr>
              <th scope="col">Texto</th>
              <th scope="col" className="num">
                Fichas
              </th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <tr key={g.texto} data-grupo-quantidade={g.quantidade}>
                <td>
                  <button
                    type="button"
                    className="btn ghost small avd-relatorio-texto"
                    title="Ver só estas fichas na tabela"
                    onClick={() => aoEscolher(g.texto)}
                  >
                    {g.texto}
                  </button>
                </td>
                <td className="num">{g.quantidade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="ui-vazio">Nenhum outro motivo escrito.</p>
      )}
    </section>
  );
});

/*
  A tabela das fichas lidas: `itens` já vem recortado pela busca adiada;
  `busca` é o texto do campo (responde a cada tecla).
*/
const TabelaDoRelatorio = memo(function TabelaDoRelatorio({
  linhas,
  itens,
  busca,
  aoBuscar,
  aoExportar,
}: {
  linhas: readonly LinhaDoRelatorio[];
  itens: readonly LinhaDoRelatorio[];
  busca: string;
  aoBuscar: (busca: string) => void;
  aoExportar: (formato: "csv" | "xlsx") => void;
}) {
  return (
    <TabelaInfinita
      idDoTitulo="avdRelatorioTabelaTitulo"
      titulo="Fichas"
      tour="avd-relatorio-tabela"
      busca={{
        placeholder: "Código, nome ou texto",
        rotulo: "Buscar na tabela",
        valor: busca,
        aoMudar: aoBuscar,
      }}
      carregado
      itens={itens}
      filtrarPelaBusca={jaFiltrado}
      colunas={COLUNAS}
      total={linhas.length}
      vazio="Nenhuma ficha com estes filtros."
      informacao={informacaoDaTabela}
      ferramentas={
        <>
          <button
            type="button"
            className="btn secondary small"
            data-acao="relatorio-csv"
            disabled={!linhas.length}
            onClick={() => aoExportar("csv")}
          >
            <i className="fa-solid fa-file-csv" aria-hidden="true" /> CSV
          </button>
          <button
            type="button"
            className="btn secondary small"
            data-acao="relatorio-xlsx"
            disabled={!linhas.length}
            onClick={() => aoExportar("xlsx")}
          >
            <i className="fa-solid fa-file-excel" aria-hidden="true" /> XLSX
          </button>
        </>
      }
      linha={desenharLinha}
    />
  );
});

export function RelatorioDeMotivos({
  editalId,
  edital,
  regra,
  vagas,
  analistas = NINGUEM,
  rpc,
  aoFechar,
  baixar = baixarNoNavegador,
  agora = AGORA,
}: {
  editalId: string;
  /** O rótulo do edital (nome do arquivo). */
  edital?: string | null;
  /** A configuração da regra vigente (títulos e textos dos motivos). */
  regra: unknown;
  vagas: Vaga[];
  /** A equipe da fila: o filtro de avaliador antes da primeira leitura. */
  analistas?: Pessoa[];
  rpc: Rpc;
  aoFechar: () => void;
  baixar?: Baixar;
  agora?: () => Date;
}) {
  const catalogo = useMemo(
    () =>
      catalogoDoRelatorio(regra as Parameters<typeof catalogoDoRelatorio>[0]),
    [regra],
  );
  const [agrupar, setAgrupar] = useState(false);
  const [lidas, setLidas] = useState<{ n: number; total: number } | null>(null);
  const [erro, setErro] = useState("");
  // A leitura e os filtros com que foi feita (o nome do arquivo exportado).
  const [lido, setLido] = useState<{
    r: Lido;
    filtros: FiltrosDoRelatorio;
  } | null>(null);
  const [busca, setBusca] = useState("");
  const buscaAdiada = useDeferredValue(busca);
  const cancelar = useRef(false);

  const linhas = useMemo(
    () => (lido ? linhasDoRelatorio(lido.r.fichas, catalogo) : []),
    [lido, catalogo],
  );
  const naTabela = useMemo(
    () => buscarNaLinha(linhas, buscaAdiada),
    [linhas, buscaAdiada],
  );
  const grupos = useMemo(() => agruparPorOutroMotivo(linhas), [linhas]);
  const comOutro = useMemo(
    () => linhas.filter((l) => l.outroMotivo).length,
    [linhas],
  );
  const avaliadores = lido?.r.avaliadores.length
    ? lido.r.avaliadores
    : analistas;
  const buscando = lidas !== null;

  const gerar = useCallback(
    async (filtros: FiltrosDoRelatorio) => {
      setErro("");
      setBusca("");
      cancelar.current = false;
      setLidas({ n: 0, total: 0 });
      try {
        const r = await lerRelatorioDeMotivos({
          rpc,
          editalId,
          filtros,
          aoProgredir: (n, total) => setLidas({ n, total }),
          cancelado: () => cancelar.current,
        });
        if (r) setLido({ r, filtros });
      } catch (e) {
        setErro(
          `Não foi possível gerar o relatório: ${(e as { message?: string })?.message || String(e)}`,
        );
      } finally {
        setLidas(null);
      }
    },
    [rpc, editalId],
  );
  const aoGerar = useCallback(
    (filtros: FiltrosDoRelatorio) => void gerar(filtros),
    [gerar],
  );
  const aoCancelar = useCallback(() => {
    cancelar.current = true;
  }, []);

  const blocos = lido?.filtros.blocos;
  const aoExportar = useCallback(
    (formato: "csv" | "xlsx") => {
      const nome = nomeDoRelatorio(edital, blocos ?? [], agora());
      if (formato === "csv")
        baixar(
          csvDoRelatorio(linhas),
          `${nome}.csv`,
          "text/csv;charset=utf-8;",
        );
      else baixar(xlsxDoRelatorio(linhas, agora()), `${nome}.xlsx`, MIME_XLSX);
    },
    [edital, blocos, agora, baixar, linhas],
  );

  return (
    <Gaveta
      tituloId="avdRelatorioMotivosTitulo"
      titulo="Relatório de motivos"
      aoFechar={aoFechar}
      fecharAoClicarFora={false}
      cartaoClassName="avd-relatorio-motivos"
      tour="avd-relatorio-motivos"
    >
      <div className="avd-gaveta-corpo">
        <PainelDeFiltros
          catalogo={catalogo}
          vagas={vagas}
          avaliadores={avaliadores}
          buscando={buscando}
          agrupar={agrupar}
          aoAgrupar={setAgrupar}
          aoGerar={aoGerar}
          aoCancelar={aoCancelar}
        />

        {lidas ? (
          <div className="avd-espelhos-progresso" role="status">
            <progress
              max={Math.max(lidas.total, lidas.n, 1)}
              value={lidas.n}
              aria-label="Fichas lidas"
            />
            <span>{lidas.n.toLocaleString("pt-BR")} ficha(s) lida(s)…</span>
          </div>
        ) : null}
        {erro ? (
          <Aviso tom="danger" papel="alert">
            {erro}
          </Aviso>
        ) : null}

        {lido ? (
          <>
            <GradeDeKpis
              rotulo="Contagem do relatório"
              className="avd-relatorio-kpis"
            >
              <Kpi
                chave="fichas"
                icone="fa-file-lines"
                rotulo="Fichas"
                valor={lido.r.total.toLocaleString("pt-BR")}
              />
              <Kpi
                chave="com-outro-motivo"
                icone="fa-pen-to-square"
                tom="alerta"
                rotulo="Com outro motivo"
                valor={comOutro.toLocaleString("pt-BR")}
              />
              <Kpi
                chave="textos-distintos"
                icone="fa-layer-group"
                tom="neutro"
                rotulo="Textos distintos"
                valor={grupos.length.toLocaleString("pt-BR")}
              />
            </GradeDeKpis>

            {agrupar ? (
              <GruposDoRelatorio grupos={grupos} aoEscolher={setBusca} />
            ) : null}

            <TabelaDoRelatorio
              linhas={linhas}
              itens={naTabela}
              busca={busca}
              aoBuscar={setBusca}
              aoExportar={aoExportar}
            />
          </>
        ) : null}
      </div>
    </Gaveta>
  );
}

export type AberturaDoRelatorio = { abrir: () => void };

/*
  A gaveta como a Fila a usa: aberta ou fechada pelo próprio estado. A Fila
  chama `ref.current.abrir()` (menu da coordenação) e não redesenha a lista
  de inscritos ao abrir nem ao fechar; memorizada, também não redesenha a
  gaveta quando a Fila muda por outro motivo.
*/
export const RelatorioDeMotivosDaFila = memo(function RelatorioDeMotivosDaFila({
  ref,
  coordena,
  vagas,
  analistas,
  ...props
}: {
  ref?: Ref<AberturaDoRelatorio>;
  coordena: boolean;
  editalId: string;
  edital?: string | null;
  regra: unknown;
  vagas?: Vaga[] | null;
  analistas?: Pessoa[] | null;
  rpc: Rpc;
}) {
  const [aberto, setAberto] = useState(false);
  useImperativeHandle(ref, () => ({ abrir: () => setAberto(true) }), []);
  const fechar = useCallback(() => setAberto(false), []);
  if (!aberto || !coordena) return null;
  return (
    <RelatorioDeMotivos
      {...props}
      vagas={vagas || NENHUMA_VAGA}
      analistas={analistas || NINGUEM}
      aoFechar={fechar}
    />
  );
});
