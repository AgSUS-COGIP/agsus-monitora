import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ordinal } from "../../lib/classificacao/numeros.js";
import {
  acoesDaSelecao,
  contadoresDaFila,
  ETAPAS_DA_FILA,
  fichaPeloCodigo,
  filtrarFila,
  filtroEhInicial,
  FILTRO_INICIAL,
  planoDeDistribuicao,
  reservaVigente,
  SITUACOES_DA_FICHA,
  textoDaReserva,
} from "../../lib/avaliacao-documental/fila.js";
import { nota } from "../../lib/avaliacao-documental/tela-da-pre-classificacao.js";
import {
  Abas,
  Aviso,
  Campo,
  EstadoVazio,
  Gaveta,
  GradeDeKv,
  Kv,
  Selo,
} from "../../ui/index.js";

/*
  Aba Fila (fase F3): as etapas com contadores no topo (clicáveis como filtro),
  os filtros e os filtros salvos, "Pegar próximo" e "Minhas fichas" para o
  analista, as ações em lote da coordenação (distribuir, redistribuir, liberar
  reservas e mandar para revisão, com confirmação e motivo) e a ficha aberta
  com a reserva. O conteúdo da análise entra na F4. Explicações:
  docs/aya/regras-da-avaliacao-documental.md.
*/

const ROTULO_DA_PRE = {
  ELIMINADO: "Eliminado",
  RANQUEADO: "Fora do lote",
  NO_LOTE: "No lote",
  ANALISADO: "No lote",
};

function SituacaoDaLinha({ c }) {
  if (c.ficha) {
    const s = SITUACOES_DA_FICHA[c.ficha.situacao] || {};
    return (
      <Selo tom={s.tom} titulo={c.ficha.motivo_saida || undefined}>
        {s.rotulo || c.ficha.situacao}
      </Selo>
    );
  }
  return (
    <Selo
      tom={c.situacao_pre === "ELIMINADO" ? "reprovado" : "neutro"}
      titulo={c.motivo_eliminacao || undefined}
    >
      {ROTULO_DA_PRE[c.situacao_pre] || c.situacao_pre}
      {c.situacao_pre === "NO_LOTE" ? " · sem ficha" : ""}
    </Selo>
  );
}

function FiltrosSalvos({ fila, f, filtros }) {
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [escolhido, setEscolhido] = useState("");
  return (
    <div className="avd-inline" data-tour="avd-fila-filtros-salvos">
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
          className="btn secondary small"
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
          className="btn secondary small"
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

function FichaAberta({ fila, aberta, dados }) {
  const f = aberta.ficha;
  const [liberando, setLiberando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const situacao = SITUACOES_DA_FICHA[f.situacao] || {};
  const reservaDeOutro =
    reservaVigente(f.reserva) && f.reserva.usuario !== dados.eu;
  return (
    <Gaveta
      tituloId="avdFichaTitulo"
      sobretitulo={[`Vaga ${f.vaga}`, f.cargo].filter(Boolean).join(" · ")}
      titulo={`Candidato ${f.codigo}`}
      resumo={<Selo tom={situacao.tom}>{situacao.rotulo || f.situacao}</Selo>}
      aoFechar={() => void fila.fechar()}
      tour="avd-ficha"
    >
      <div className="avd-gaveta-corpo">
        <GradeDeKv rotulo="Cabeçalho da ficha">
          <Kv rotulo="Nome">{f.nome}</Kv>
          <Kv rotulo="Posição">{f.posicao ? ordinal(f.posicao) : ""}</Kv>
          <Kv rotulo="Lote">{f.lote}</Kv>
          <Kv rotulo="ART">{nota(f.art)}</Kv>
          <Kv rotulo="Modalidade">{f.modalidade}</Kv>
          <Kv rotulo="Responsável">{f.responsavel_nome}</Kv>
          <Kv rotulo="Reserva">{textoDaReserva(f.reserva, dados.eu)}</Kv>
          <Kv rotulo="Regra">{f.versao_regra ? `v${f.versao_regra}` : ""}</Kv>
          {f.motivo_saida ? (
            <Kv rotulo="Saiu do lote">{f.motivo_saida}</Kv>
          ) : null}
        </GradeDeKv>
        {aberta.somente_leitura && aberta.motivo ? (
          <Aviso tom="warning">Só leitura: {aberta.motivo}</Aviso>
        ) : null}
        <Aviso>O conteúdo da análise chega na fase F4.</Aviso>
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
              className="btn secondary"
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
        <div className="ui-acoes">
          <button
            type="button"
            className="btn"
            onClick={() => void fila.fechar()}
          >
            {aberta.reservada ? "Fechar e liberar" : "Fechar"}
          </button>
        </div>
      </div>
    </Gaveta>
  );
}

export function Fila({ e, fila }) {
  const st = useSyncExternalStore(fila.assinar, fila.obter);
  const [selecao, setSelecao] = useState(() => new Set());
  const [acao, setAcao] = useState(null);
  const [busca, setBusca] = useState(st.filtro.busca);

  useEffect(() => {
    if (fila.obter().editalId !== e.editalId) void fila.carregar(e.editalId);
  }, [fila, e.editalId]);
  useEffect(() => {
    const sair = () => void fila.fechar();
    globalThis.addEventListener?.("pagehide", sair);
    return () => {
      globalThis.removeEventListener?.("pagehide", sair);
      sair();
    };
  }, [fila]);

  const dados = st.dados;
  const candidatos = useMemo(() => dados?.candidatos || [], [dados]);
  const contadores = useMemo(() => contadoresDaFila(candidatos), [candidatos]);
  const linhas = useMemo(
    () => filtrarFila(candidatos, st.filtro, dados?.eu),
    [candidatos, st.filtro, dados?.eu],
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
  const comFicha = linhas.filter((c) => c.ficha);
  const todasMarcadas =
    comFicha.length > 0 && comFicha.every((c) => selecao.has(c.id));
  const minhas = st.filtro.responsavel === "eu";

  return (
    <div className="avd-fila" data-tour="avd-fila">
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
        <div className="avd-linha" data-tour="avd-fila-filtros">
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
        </div>
        <div className="avd-inline avd-fila-acoes">
          <FiltrosSalvos
            fila={fila}
            f={st.filtro}
            filtros={dados.filtros || []}
          />
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
              <i className="fa-solid fa-forward" aria-hidden="true" /> Pegar
              próximo
            </button>
          ) : null}
          {coordena && dados.sem_ficha ? (
            <button
              type="button"
              className="btn secondary"
              data-tour="avd-fila-abrir-fichas"
              disabled={Boolean(st.acao)}
              onClick={() => void fila.abrirFichasDoLote()}
            >
              Abrir fichas do lote ({dados.sem_ficha})
            </button>
          ) : null}
          {coordena && livres.length ? (
            <button
              type="button"
              className="btn secondary"
              data-tour="avd-fila-distribuir-livres"
              onClick={() => setAcao({ tipo: "distribuir", fichas: livres })}
            >
              Distribuir as livres ({livres.length})
            </button>
          ) : null}
        </div>
      </section>

      {coordena && selecionados.length ? (
        <div className="ui-card avd-inline" data-tour="avd-fila-acoes-lote">
          <span>{selecionados.length} selecionada(s)</span>
          <button
            type="button"
            className="btn secondary small"
            disabled={!acoes.distribuir.length}
            onClick={() =>
              setAcao({ tipo: "distribuir", fichas: acoes.distribuir })
            }
          >
            Distribuir ({acoes.distribuir.length})
          </button>
          <button
            type="button"
            className="btn secondary small"
            disabled={!acoes.liberar.length}
            onClick={() => setAcao({ tipo: "liberar", fichas: acoes.liberar })}
          >
            Liberar reservas ({acoes.liberar.length})
          </button>
          <button
            type="button"
            className="btn secondary small"
            disabled={!acoes.revisao.length}
            onClick={() => setAcao({ tipo: "revisao", fichas: acoes.revisao })}
          >
            Mandar para revisão ({acoes.revisao.length})
          </button>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => setSelecao(new Set())}
          >
            Limpar seleção
          </button>
        </div>
      ) : null}

      {linhas.length ? (
        <div className="ui-card ui-tabela-rolagem" data-tour="avd-fila-tabela">
          <table className="avd-tabela">
            <thead>
              <tr>
                {coordena ? (
                  <th scope="col">
                    <input
                      type="checkbox"
                      aria-label="Selecionar as fichas da lista"
                      checked={todasMarcadas}
                      onChange={(ev) => {
                        for (const c of comFicha)
                          marcar(c.id, ev.target.checked);
                      }}
                    />
                  </th>
                ) : null}
                <th scope="col">Vaga</th>
                <th scope="col">Posição</th>
                <th scope="col">Código</th>
                <th scope="col">Nome</th>
                <th scope="col">ART</th>
                <th scope="col">Situação</th>
                <th scope="col">Responsável</th>
                <th scope="col">Reserva</th>
                <th scope="col">
                  <span className="sr-only">Ficha</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((c) => (
                <tr key={c.id} data-candidato={c.codigo}>
                  {coordena ? (
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
                  <td>{c.vaga}</td>
                  <td>{c.posicao ? ordinal(c.posicao) : "—"}</td>
                  <td>{c.codigo}</td>
                  <td>{c.nome}</td>
                  <td>{nota(c.art)}</td>
                  <td>
                    <SituacaoDaLinha c={c} />
                  </td>
                  <td>{c.ficha?.responsavel_nome || "—"}</td>
                  <td>{textoDaReserva(c.ficha?.reserva, dados.eu)}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EstadoVazio>
          {candidatos.length
            ? "Nenhum inscrito neste filtro."
            : "O edital ainda não tem pré-classificação."}
        </EstadoVazio>
      )}

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
      {st.aberta?.ficha ? (
        <FichaAberta
          key={`${st.aberta.ficha.id}:${st.aberta.ficha.versao}`}
          fila={fila}
          aberta={st.aberta}
          dados={dados}
        />
      ) : null}
    </div>
  );
}
