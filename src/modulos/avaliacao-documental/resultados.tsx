import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  FILTRO_INICIAL,
  filtrarFila,
  type InscritoNaFila,
} from "../../lib/avaliacao-documental/fila.ts";
import { Aviso, Campo } from "../../ui/index.ts";
import type { LojaDaFila } from "./estado-da-fila.ts";

/* Apenas lê fichas concluídas da mesma RPC e store já usadas pela Fila.
   Não cria resultados, recalcula notas nem oferece ações de coordenação. */
const POR_PAGINA = 100;

const valor = (v: unknown) =>
  v === null || v === undefined || String(v).trim() === ""
    ? "—"
    : String(v);

function dataDaConclusao(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}

function linhaConcluida(c: InscritoNaFila) {
  return (
    <tr key={c.id} data-resultado-candidato={c.codigo}>
      <td>{valor(c.codigo)}</td>
      <td>{valor(c.nome)}</td>
      <td>{valor(c.vaga)}</td>
      <td>{valor(c.modalidade)}</td>
      <td>{valor(c.ficha?.nota_final)}</td>
      <td>{valor(c.ficha?.resultado)}</td>
      <td>{valor(c.ficha?.motivo_saida)}</td>
      <td>{valor(c.ficha?.responsavel_nome)}</td>
      <td>{dataDaConclusao(c.ficha?.concluida_em)}</td>
    </tr>
  );
}

export function ResultadosDaAvaliacao({
  editalId,
  fila,
}: {
  editalId: string;
  fila: LojaDaFila;
}) {
  const st = useSyncExternalStore(fila.assinar, fila.obter);
  const [busca, setBusca] = useState("");
  const [vaga, setVaga] = useState("");
  const [paginas, setPaginas] = useState(1);

  useEffect(() => {
    if (fila.obter().editalId !== editalId || fila.estaDesatualizada())
      void fila.carregar(editalId);
  }, [fila, editalId]);

  const dados = st.editalId === editalId ? st.dados : null;
  const candidatos = dados?.candidatos;
  const concluidos = useMemo(
    () =>
      filtrarFila(
        candidatos,
        { ...FILTRO_INICIAL, etapa: "concluidas", busca, vaga },
        dados?.eu,
      ),
    [candidatos, busca, vaga, dados?.eu],
  );
  const exibidos = concluidos.slice(0, paginas * POR_PAGINA);
  const trocarBusca = (texto: string) => {
    setBusca(texto);
    setPaginas(1);
  };

  if (st.erro && !dados)
    return (
      <Aviso tom="danger" papel="alert">
        Não foi possível carregar os resultados: {st.erro}
        <button type="button" className="btn secondary small" onClick={() => void fila.carregar(editalId)}>
          Tentar novamente
        </button>
      </Aviso>
    );
  if (!dados)
    return <div className="ui-card" aria-busy="true">Carregando resultados do edital…</div>;

  return (
    <section className="ui-card avd-resultados" aria-label="Resultados da avaliação documental">
      <h3 className="ui-titulo">Avaliações concluídas</h3>
      <p className="ui-texto-secundario">
        Consulta dos resultados e justificativas gravados nas fichas. Os valores
        são apresentados como registrados, sem recalcular a avaliação.
      </p>
      <div className="avd-resultados-filtros">
        <Campo rotulo="Código ou nome">
          <input type="search" value={busca} onChange={(ev) => trocarBusca(ev.target.value)} placeholder="Buscar resultado" />
        </Campo>
        <Campo rotulo="Vaga">
          <select value={vaga} onChange={(ev) => { setVaga(ev.target.value); setPaginas(1); }}>
            <option value="">Todas as vagas</option>
            {(dados.vagas || []).map((v) => (
              <option key={v.codigo} value={String(v.codigo)}>
                {v.codigo}{v.cargo ? ` · ${v.cargo}` : ""}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <div className="avd-resultados-resumo" role="status">
        <span>{concluidos.length.toLocaleString("pt-BR")} avaliação(ões) concluída(s) na seleção.</span>
        <button type="button" className="btn secondary small" data-acao="exportar-resultados-avd" disabled={!concluidos.length} onClick={() => fila.exportarCsv(concluidos, "concluidas")}>
          Exportar resultados CSV
        </button>
      </div>
      <div className="ui-tabela-rolagem">
        <table className="avd-tabela">
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Nome</th>
              <th scope="col">Vaga</th>
              <th scope="col">Modalidade</th>
              <th scope="col">Nota final</th>
              <th scope="col">Resultado</th>
              <th scope="col">Justificativa</th>
              <th scope="col">Responsável</th>
              <th scope="col">Concluída em</th>
            </tr>
          </thead>
          <tbody>{exibidos.map(linhaConcluida)}</tbody>
        </table>
      </div>
      {!concluidos.length ? (
        <p className="ui-texto-secundario">Nenhuma avaliação concluída para os filtros informados.</p>
      ) : null}
      {exibidos.length < concluidos.length ? (
        <button type="button" className="btn secondary small" onClick={() => setPaginas((n) => n + 1)}>
          Mostrar mais ({(concluidos.length - exibidos.length).toLocaleString("pt-BR")} restantes)
        </button>
      ) : null}
    </section>
  );
}
