import { useMemo, useRef, useState } from "react";
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
type Baixar = (conteudo: BlobPart, nome: string, tipo: string) => void;

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

export function RelatorioDeMotivos({
  editalId,
  edital,
  regra,
  vagas,
  analistas = [],
  rpc,
  aoFechar,
  baixar = baixarNoNavegador,
  agora = () => new Date(),
}: {
  editalId: string;
  /** O rótulo do edital (nome do arquivo). */
  edital?: string | null;
  /** A configuração da regra vigente (títulos e textos dos motivos). */
  regra: unknown;
  vagas: Vaga[];
  /** A equipe da fila: o filtro de avaliador antes da primeira leitura. */
  analistas?: { usuario: string; nome: string }[];
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
  const [filtros, setFiltros] = useState<FiltrosDoRelatorio>(FILTROS_INICIAIS);
  const [agrupar, setAgrupar] = useState(false);
  const [lidas, setLidas] = useState<{ n: number; total: number } | null>(null);
  const [erro, setErro] = useState("");
  const [lido, setLido] = useState<Lido | null>(null);
  const [busca, setBusca] = useState("");
  const cancelar = useRef(false);

  const motivos = useMemo(
    () => motivosDoFiltro(catalogo, filtros.blocos),
    [catalogo, filtros.blocos],
  );
  const linhas = useMemo(
    () => (lido ? linhasDoRelatorio(lido.fichas, catalogo) : []),
    [lido, catalogo],
  );
  const grupos = useMemo(() => agruparPorOutroMotivo(linhas), [linhas]);
  const avaliadores = lido?.avaliadores.length ? lido.avaliadores : analistas;
  const buscando = lidas !== null;
  const multiplos = filtros.blocos.length > 1;

  const mudar = (m: Partial<FiltrosDoRelatorio>) =>
    setFiltros((atual) => ({ ...atual, ...m }));

  async function gerar(escolha = filtros) {
    setErro("");
    setBusca("");
    cancelar.current = false;
    setLidas({ n: 0, total: 0 });
    try {
      const r = await lerRelatorioDeMotivos({
        rpc,
        editalId,
        filtros: escolha,
        aoProgredir: (n, total) => setLidas({ n, total }),
        cancelado: () => cancelar.current,
      });
      if (r) setLido(r);
    } catch (e) {
      setErro(
        `Não foi possível gerar o relatório: ${(e as { message?: string })?.message || String(e)}`,
      );
    } finally {
      setLidas(null);
    }
  }

  function usarAtalho(a: Atalho) {
    const novos = filtrosDoAtalho(a.id, catalogo, filtros);
    setFiltros(novos);
    setAgrupar(a.agrupar);
    void gerar(novos);
  }

  const nome = () => nomeDoRelatorio(edital, filtros.blocos, agora());
  const exportarCsv = () =>
    baixar(csvDoRelatorio(linhas), `${nome()}.csv`, "text/csv;charset=utf-8;");
  const exportarXlsx = () =>
    baixar(xlsxDoRelatorio(linhas, agora()), `${nome()}.xlsx`, MIME_XLSX);

  const comOutro = linhas.filter((l) => l.outroMotivo).length;

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
              {(RESULTADOS as unknown as readonly (readonly [string, string])[]).map(
                ([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ),
              )}
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
              onChange={(ev) => setAgrupar(ev.target.checked)}
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
                setAgrupar(false);
              }}
            >
              Limpar
            </button>
            {buscando ? (
              <button
                type="button"
                className="btn secondary small"
                onClick={() => {
                  cancelar.current = true;
                }}
              >
                Cancelar
              </button>
            ) : null}
            <button
              type="button"
              className="btn small"
              data-acao="gerar-relatorio"
              disabled={buscando}
              onClick={() => void gerar()}
            >
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />{" "}
              Gerar relatório
            </button>
          </div>
        </section>

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
                valor={lido.total.toLocaleString("pt-BR")}
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
                              onClick={() => setBusca(g.texto)}
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
            ) : null}

            <TabelaInfinita
              idDoTitulo="avdRelatorioTabelaTitulo"
              titulo="Fichas"
              tour="avd-relatorio-tabela"
              busca={{
                placeholder: "Código, nome ou texto",
                rotulo: "Buscar na tabela",
                valor: busca,
                aoMudar: setBusca,
              }}
              carregado
              itens={linhas}
              filtrarPelaBusca={buscarNaLinha}
              colunas={COLUNAS}
              total={linhas.length}
              vazio="Nenhuma ficha com estes filtros."
              informacao={(n: number | null) =>
                n === null ? "" : `${n.toLocaleString("pt-BR")} ficha(s)`
              }
              ferramentas={
                <>
                  <button
                    type="button"
                    className="btn secondary small"
                    data-acao="relatorio-csv"
                    disabled={!linhas.length}
                    onClick={exportarCsv}
                  >
                    <i className="fa-solid fa-file-csv" aria-hidden="true" />{" "}
                    CSV
                  </button>
                  <button
                    type="button"
                    className="btn secondary small"
                    data-acao="relatorio-xlsx"
                    disabled={!linhas.length}
                    onClick={exportarXlsx}
                  >
                    <i className="fa-solid fa-file-excel" aria-hidden="true" />{" "}
                    XLSX
                  </button>
                </>
              }
              linha={(l: LinhaDoRelatorio) => (
                <tr key={l.id} data-codigo={l.codigo}>
                  <td>{l.codigo}</td>
                  <td>{l.candidato}</td>
                  <td title={l.cargo}>{l.vaga}</td>
                  <td>{l.resultado || l.situacaoDaFicha}</td>
                  <td>
                    {l.criterio}
                    {l.situacaoDoBloco ? (
                      <span className="ui-texto-secundario">
                        {" "}
                        · {l.situacaoDoBloco}
                      </span>
                    ) : null}
                  </td>
                  <td>{l.outroMotivo}</td>
                  <td>
                    {[l.demaisMotivos, l.justificativas]
                      .filter(Boolean)
                      .join(" | ")}
                    {l.notaAjustada ? (
                      <span className="ui-texto-secundario">
                        {" "}
                        (nota {l.notaAjustada})
                      </span>
                    ) : null}
                  </td>
                  <td>{l.concluidaPor}</td>
                  <td>{l.concluidaEm}</td>
                </tr>
              )}
            />
          </>
        ) : null}
      </div>
    </Gaveta>
  );
}
