import { useMemo, useState } from "react";
import {
  erroDoMotivo,
  MOTIVO_DA_DECISAO,
  MOTIVO_DA_REVOGACAO,
  MOTIVO_SUGERIDO_DA_DECISAO,
  nota,
  seloDaDecisao,
} from "../../lib/avaliacao-documental/tela-da-pre-classificacao.js";
import { Aviso, Campo, Gaveta, Selo } from "../../ui/index.js";

/*
  Inclusão no lote por decisão da coordenação (aba Pré-classificação e Fila):
  o selo "Decisão: <motivo>", a gaveta "Incluir por decisão da coordenação"
  (candidatos fora do lote, motivo com a sugestão "Critério CORES") e o
  "Revogar decisão" (com motivo). As ações são dos stores (decisao-no-banco.js).
  Explicação: docs/aya/regras-da-avaliacao-documental.md.
*/

const quando = (valor) =>
  valor
    ? new Date(valor).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";

/** "Decisão: Critério CORES", com quem decidiu, quando e o que a regra dizia. */
export function SeloDaDecisao({ c }) {
  const texto = seloDaDecisao(c);
  if (!texto) return null;
  const d = c?.decisao && typeof c.decisao === "object" ? c.decisao : null;
  const titulo = d
    ? [
        d.por ? `Por ${d.por}` : "",
        d.em ? `em ${quando(d.em)}` : "",
        d.motivo_regra
          ? `Pela regra: ${d.motivo_regra}`
          : d.situacao_regra === "RANQUEADO"
            ? "Pela regra: fora do lote"
            : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;
  return (
    <Selo tom="revisar" className="avd-selo-decisao" titulo={titulo}>
      {texto}
    </Selo>
  );
}

const textoDaSituacao = (c) =>
  c.situacao === "ELIMINADO"
    ? `Eliminado${c.motivo ? `: ${c.motivo}` : ""}`
    : "Fora do lote";

/**
 * A gaveta "Incluir por decisão da coordenação".
 *   candidatos  os de fora do lote [{ id, codigo, nome, vaga, situacao, motivo, nota }]
 *   aoIncluir   (escolhidos, motivo) => Promise<{ ok, erro }>
 */
export function IncluirPorDecisao({ candidatos, aoIncluir, aoFechar }) {
  const [marcados, setMarcados] = useState(() => new Set());
  const [motivo, setMotivo] = useState(MOTIVO_SUGERIDO_DA_DECISAO);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo
      ? candidatos.filter(
          (c) =>
            String(c.codigo ?? "").includes(termo) ||
            String(c.nome ?? "")
              .toLowerCase()
              .includes(termo),
        )
      : candidatos;
  }, [candidatos, busca]);
  const erroDoTexto = erroDoMotivo(motivo, MOTIVO_DA_DECISAO);
  const marcar = (id, sim) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (sim) novo.add(id);
      else novo.delete(id);
      return novo;
    });

  async function confirmar() {
    setErro("");
    setEnviando(true);
    const r = await aoIncluir(
      candidatos.filter((c) => marcados.has(c.id)),
      motivo.trim(),
    );
    setEnviando(false);
    if (r?.ok) aoFechar(true);
    else setErro(r?.erro || "Não foi possível incluir.");
  }

  return (
    <Gaveta
      tituloId="avdDecisaoTitulo"
      titulo="Incluir por decisão da coordenação"
      resumo={`${marcados.size} selecionado(s)`}
      aoFechar={() => aoFechar(false)}
      fecharAoClicarFora={false}
      tour="avd-incluir-por-decisao"
    >
      <div className="avd-gaveta-corpo">
        <Campo rotulo="Buscar por código ou nome">
          <input
            type="search"
            value={busca}
            onChange={(ev) => setBusca(ev.target.value)}
          />
        </Campo>
        {visiveis.length ? (
          <div className="ui-tabela-rolagem">
            <table
              className="avd-tabela"
              aria-label="Candidatos fora do lote pela regra"
            >
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Selecionar</span>
                  </th>
                  <th scope="col">Código</th>
                  <th scope="col">Nome</th>
                  <th scope="col">Vaga</th>
                  <th scope="col">Pela regra</th>
                  <th scope="col">Nota</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((c) => (
                  <tr key={c.id} data-candidato={c.codigo}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Incluir ${c.codigo}`}
                        checked={marcados.has(c.id)}
                        onChange={(ev) => marcar(c.id, ev.target.checked)}
                      />
                    </td>
                    <td>{c.codigo}</td>
                    <td>{c.nome}</td>
                    <td>{c.vaga}</td>
                    <td>{textoDaSituacao(c)}</td>
                    <td>{nota(c.nota)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ui-texto-secundario">Nenhum candidato fora do lote.</p>
        )}
        <Campo
          rotulo="Motivo da decisão"
          obrigatorio
          erro={motivo && erroDoTexto ? erroDoTexto : undefined}
        >
          <input
            type="text"
            list="avdMotivosDaDecisao"
            maxLength={MOTIVO_DA_DECISAO.maximo}
            value={motivo}
            onChange={(ev) => setMotivo(ev.target.value)}
          />
        </Campo>
        <datalist id="avdMotivosDaDecisao">
          <option value={MOTIVO_SUGERIDO_DA_DECISAO} />
        </datalist>
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
            data-acao="confirmar-incluir-por-decisao"
            disabled={!marcados.size || Boolean(erroDoTexto) || enviando}
            onClick={() => void confirmar()}
          >
            {enviando
              ? "Incluindo…"
              : marcados.size
                ? `Incluir ${marcados.size} no lote`
                : "Incluir no lote"}
          </button>
        </div>
      </div>
    </Gaveta>
  );
}

/**
 * "Revogar decisão" de um candidato, com motivo (o banco recusa com a ficha
 * concluída). aoRevogar(motivo) => Promise<{ ok, erro }>.
 */
export function RevogarDecisao({ c, aoRevogar }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  if (!seloDaDecisao(c)) return null;
  if (!aberto)
    return (
      <button
        type="button"
        className="btn secondary small"
        data-acao="abrir-revogar-decisao"
        onClick={() => setAberto(true)}
      >
        Revogar decisão
      </button>
    );
  const erroDoTexto = erroDoMotivo(motivo, MOTIVO_DA_REVOGACAO);
  async function revogar() {
    setErro("");
    setEnviando(true);
    const r = await aoRevogar(motivo.trim());
    setEnviando(false);
    if (r?.ok) {
      setAberto(false);
      setMotivo("");
    } else setErro(r?.erro || "Não foi possível revogar.");
  }
  return (
    <span className="avd-inline" data-revogar={c.codigo}>
      <Campo
        rotulo={`Motivo para revogar a decisão de ${c.codigo}`}
        obrigatorio
        erro={motivo && erroDoTexto ? erroDoTexto : undefined}
      >
        <input
          type="text"
          maxLength={MOTIVO_DA_REVOGACAO.maximo}
          value={motivo}
          onChange={(ev) => setMotivo(ev.target.value)}
        />
      </Campo>
      <button
        type="button"
        className="btn small"
        data-acao="revogar-decisao"
        disabled={Boolean(erroDoTexto) || enviando}
        onClick={() => void revogar()}
      >
        {enviando ? "Revogando…" : "Revogar decisão"}
      </button>
      <button
        type="button"
        className="btn secondary small"
        onClick={() => {
          setAberto(false);
          setMotivo("");
          setErro("");
        }}
      >
        Cancelar
      </button>
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}
    </span>
  );
}
