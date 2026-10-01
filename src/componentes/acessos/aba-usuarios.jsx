import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ALVO_COORDENACAO,
  ALVO_GRUPO,
  MODULOS,
  alvoPendente,
  areasDaLinha,
  celulaExibida,
  contarPendencias,
  coordenacaoDaLinha,
  explicacaoDoGrupo,
  grupoDaLinha,
  linhaFicariaSemArea,
  pendenciasDoUsuario,
  pessoasSemAreaNoRascunho,
  resumoDoRascunho,
} from "../../lib/matriz-de-acessos.js";
import { situacaoDoAcesso } from "../../lib/convite-de-acesso.js";
import {
  gruposAtribuiveis,
  opcoesDoModulo,
  podeEditarUsuario,
  podeMudarCoordenacao,
  valorDoSelect,
} from "../../lib/teto-de-acessos.js";
import { rotuloDoNivel } from "../../lib/permissoes-recursos.js";
import { BotaoDeAcao, LinhasEsqueleto } from "../lista-aprovados/partes.jsx";
import { Icone } from "../icone.jsx";
import {
  CampoMotivo,
  ControleSegmentado,
  OpcoesDeCoordenacao,
  OpcoesDoGrupo,
  OpcoesDoModulo,
  classes,
  motivoValido,
} from "./partes.jsx";
import { Solicitacoes } from "./solicitacoes.jsx";
import { Desativadas } from "./contas-desativadas.jsx";
import { resumoDeContas } from "../../lib/contas-desativadas.js";
import { ModalAdicionarPessoa } from "./modal-adicionar-pessoa.jsx";

const POR_PAGINA = 30;

/** "Ana Luísa Costa" → "AC": primeira e última palavra. */
export function iniciais(nome) {
  const partes = String(nome || "")
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((parte) => parte.length > 2 || /^[A-ZÀ-Ý]/.test(parte));
  if (!partes.length) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes.at(-1)[0] : "";
  return (primeira + ultima).toLocaleUpperCase("pt-BR");
}

/*
  Usuários. Por padrão, a visão SIMPLES: uma linha por pessoa com grupo (e o
  que ele deixa fazer), áreas, coordenação e situação (convite pendente ou
  último acesso). A linha abre a gaveta, onde se muda grupo, áreas e
  coordenação.

  "Ver permissões por módulo (avançado)" troca pela matriz: grupo (select em
  forma de tag) e um select por módulo ("Do grupo" segue o grupo). Nas duas,
  as alterações vão para o mesmo rascunho e só gravam com motivo.
*/

function Pessoa({ usuario, titulo, aoAbrir, comEmail = false }) {
  const nome = usuario.nome || usuario.email;
  return (
    <span className="acessos-pessoa">
      <span className="acessos-avatar" aria-hidden="true">
        {iniciais(nome)}
      </span>
      <span className="acessos-pessoa-textos">
        <button
          type="button"
          className="acessos-nome"
          title={titulo}
          onClick={(evento) => {
            evento.stopPropagation();
            aoAbrir();
          }}
        >
          {nome}
        </button>
        {comEmail && usuario.nome ? <small>{usuario.email}</small> : null}
      </span>
    </span>
  );
}

// ── Visão simples ───────────────────────────────────────────────────────────

function LinhaSimples({ estado, matriz, usuario, rascunho, gruposPorCodigo }) {
  const { areas = [], coordenacoes = [] } = matriz;
  const codigoDoGrupo = grupoDaLinha(usuario, rascunho);
  const grupo = gruposPorCodigo[codigoDoGrupo];
  const explicacao = explicacaoDoGrupo(grupo);
  const coordenacao = coordenacaoDaLinha(usuario, rascunho);
  const nomeDaCoordenacao = coordenacoes.find(
    (c) => c.codigo === coordenacao,
  )?.nome;
  const visiveis = areasDaLinha(usuario, rascunho, matriz);
  const tituloDaArea = new Map(areas.map((a) => [a.id, a.titulo]));
  const semArea = linhaFicariaSemArea(usuario, rascunho, matriz);
  const situacao = situacaoDoAcesso(usuario);
  const abrir = () => estado.abrirGaveta(usuario.id);
  const adminGlobal = visiveis.todas;
  return (
    <tr
      className={classes(
        "acessos-linha-clicavel",
        pendenciasDoUsuario(rascunho, usuario.id) && "acessos-linha-pendente",
      )}
      onClick={abrir}
    >
      <th scope="row">
        <Pessoa
          usuario={usuario}
          titulo={`Abrir o acesso de ${usuario.nome || usuario.email}`}
          aoAbrir={abrir}
          comEmail
        />
      </th>
      <td
        className={classes(
          alvoPendente(rascunho, usuario.id, ALVO_GRUPO) && "acessos-pendente",
        )}
      >
        <span className="acessos-grupo" title={grupo?.descricao || explicacao}>
          <span className="acessos-chip acessos-chip-grupo">
            {grupo?.nome || codigoDoGrupo || "—"}
          </span>
        </span>
      </td>
      <td>
        <span className="acessos-chips">
          {adminGlobal ? (
            <span className="acessos-chip">Todas as áreas</span>
          ) : visiveis.ids.length ? (
            areas
              .filter((a) => visiveis.ids.includes(a.id))
              .concat(
                visiveis.ids
                  .filter((id) => !tituloDaArea.has(id))
                  .map((id) => ({ id, titulo: id })),
              )
              .map((a) => (
                <span key={a.id} className="acessos-chip">
                  {a.titulo}
                </span>
              ))
          ) : (
            <span
              className="acessos-chip acessos-chip-alerta"
              title={
                semArea
                  ? "Sem área e sem coordenação: a pessoa entra e não vê nada."
                  : undefined
              }
            >
              Nenhuma área
            </span>
          )}
        </span>
      </td>
      <td
        className={classes(
          alvoPendente(rascunho, usuario.id, ALVO_COORDENACAO) &&
            "acessos-pendente",
        )}
      >
        {adminGlobal ? (
          <span className="acessos-vazio">—</span>
        ) : (
          <span className={classes(!coordenacao && "acessos-secundario")}>
            {nomeDaCoordenacao || coordenacao || "Sem coordenação"}
          </span>
        )}
      </td>
      <td>
        {situacao.tipo === "convite" ? (
          <span className="acessos-selo acessos-selo-convite">
            {situacao.rotulo}
          </span>
        ) : (
          <span className="acessos-secundario">{situacao.rotulo}</span>
        )}
      </td>
    </tr>
  );
}

// ── Visão avançada: permissões por módulo ─────────────────────────────────────

function LinhaPorModulo({
  estado,
  matriz,
  usuario,
  rascunho,
  gruposPorCodigo,
  usuarioLogado,
  comCoordenacao,
}) {
  const { teto, grupos = [], coordenacoes = [], areas = [] } = matriz;
  const edicao = podeEditarUsuario(teto, usuario, usuarioLogado);
  const bloqueada = !edicao.pode;
  const grupo = grupoDaLinha(usuario, rascunho);
  const coordenacao = coordenacaoDaLinha(usuario, rascunho);
  const nome = usuario.nome || usuario.email;
  return (
    <tr>
      <th scope="row">
        <Pessoa
          usuario={usuario}
          titulo={`${usuario.email}${edicao.motivo ? ` · ${edicao.motivo}` : ""}`}
          aoAbrir={() => estado.abrirGaveta(usuario.id)}
        />
      </th>
      <td
        className={classes(
          alvoPendente(rascunho, usuario.id, ALVO_GRUPO) && "acessos-pendente",
        )}
      >
        <select
          className="acessos-tag"
          aria-label={`Grupo de ${nome}`}
          value={grupo || ""}
          disabled={bloqueada}
          onChange={(e) =>
            estado.registrar(usuario, ALVO_GRUPO, e.target.value)
          }
        >
          <OpcoesDoGrupo
            grupos={grupos}
            atribuiveis={gruposAtribuiveis(teto, grupos)}
            atual={grupo}
          />
        </select>
      </td>
      {comCoordenacao ? (
        <td
          className={classes(
            alvoPendente(rascunho, usuario.id, ALVO_COORDENACAO) &&
              "acessos-pendente",
          )}
        >
          {usuario.admin_global ? (
            <span className="acessos-vazio">—</span>
          ) : (
            <select
              aria-label={`Coordenação de ${nome}`}
              value={coordenacao || ""}
              disabled={bloqueada || !podeMudarCoordenacao(teto)}
              onChange={(e) =>
                estado.registrar(
                  usuario,
                  ALVO_COORDENACAO,
                  e.target.value || null,
                )
              }
            >
              <option value="">Sem coordenação</option>
              <OpcoesDeCoordenacao
                coordenacoes={coordenacoes}
                areas={areas}
                atual={coordenacao}
              />
            </select>
          )}
          {usuario.setor && !usuario.admin_global ? (
            <small
              className="acessos-setor"
              title="Setor que a pessoa informou ao pedir acesso"
            >
              Informou: {usuario.setor}
            </small>
          ) : null}
        </td>
      ) : null}
      {MODULOS.map((modulo) => {
        const celula = celulaExibida(
          usuario,
          modulo.id,
          rascunho,
          gruposPorCodigo,
        );
        /*
          Admin global tem tudo pelo grupo: texto, não um select desabilitado.
          O texto é o nível real do grupo — em "Gestão de acessos" é Editor.
        */
        if (usuario.admin_global)
          return (
            <td key={modulo.id}>
              <span className="acessos-nivel-fixo">
                {rotuloDoNivel(celula.nivel, modulo.id)}
              </span>
            </td>
          );
        return (
          <td
            key={modulo.id}
            className={classes(celula.pendente && "acessos-pendente")}
          >
            <select
              className={classes(
                "acessos-nivel",
                celula.individual && "individual",
              )}
              aria-label={`${modulo.rotulo} de ${nome}`}
              value={valorDoSelect(celula)}
              disabled={bloqueada}
              title={
                celula.individual
                  ? "Permissão individual: vale só para esta pessoa"
                  : "Segue o grupo"
              }
              onChange={(e) =>
                estado.registrar(usuario, modulo.id, e.target.value || null)
              }
            >
              <OpcoesDoModulo
                opcoes={opcoesDoModulo(teto, modulo.id, celula)}
              />
            </select>
          </td>
        );
      })}
    </tr>
  );
}

// ── Salvar ──────────────────────────────────────────────────────────────────

function BarraDeSalvar({ estado, rascunho, matriz }) {
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const pendentes = contarPendencias(rascunho);
  if (!pendentes) return null;
  const porPessoa = resumoDoRascunho(rascunho, {
    grupos: matriz.grupos,
    coordenacoes: matriz.coordenacoes,
  });
  // Mesma regra do banco: ninguém sai do lote sem área.
  const semArea = pessoasSemAreaNoRascunho(rascunho, matriz);
  return (
    <form
      className="acessos-salvar"
      onSubmit={(evento) => {
        evento.preventDefault();
        setTentou(true);
        if (!motivoValido(motivo) || semArea.length) return;
        void estado
          .salvar(motivo)
          .then((ok) => ok && (setMotivo(""), setTentou(false)));
      }}
    >
      <details>
        <summary>
          {pendentes} {pendentes === 1 ? "alteração" : "alterações"} em{" "}
          {porPessoa.length} {porPessoa.length === 1 ? "pessoa" : "pessoas"}
        </summary>
        <ul>
          {porPessoa.map(({ usuario, itens }) => (
            <li key={usuario.id}>
              <strong>{usuario.nome || usuario.email}</strong>
              {itens.map((item, indice) => (
                <span key={indice}>
                  {item.rotulo}: {item.de} → {item.para}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </details>
      {semArea.length ? (
        <div className="alert warn acessos-sem-area" role="alert">
          <Icone nome="triangle-alert" tamanho={16} />
          <span>
            {semArea.map((u) => u.nome || u.email).join(", ")}{" "}
            {semArea.length === 1 ? "ficaria" : "ficariam"} sem nenhuma área e
            não {semArea.length === 1 ? "veria" : "veriam"} nada. Marque ao
            menos uma área (ou uma coordenação) antes de salvar.
          </span>
          <button
            type="button"
            className="btn outline acessos-ghost"
            onClick={() => estado.abrirGaveta(semArea[0].id)}
          >
            Marcar área
          </button>
        </div>
      ) : null}
      <CampoMotivo
        id="acessosMotivo"
        valor={motivo}
        aoMudar={setMotivo}
        erro={tentou && !motivoValido(motivo)}
      />
      <div className="acessos-acoes">
        <button
          type="button"
          className="btn outline acessos-ghost"
          onClick={estado.descartar}
        >
          Descartar
        </button>
        <BotaoDeAcao
          estado={estado}
          acao="salvar"
          type="submit"
          className="btn primary"
          disabled={semArea.length > 0}
        >
          Salvar alterações
        </BotaoDeAcao>
      </div>
    </form>
  );
}

/* A busca é uma só na aba: vale para Ativos e Desativadas (nome ou e-mail). */
function CampoDeBusca({ valor, aoMudar }) {
  return (
    <label className="acessos-busca">
      <Icone nome="search" tamanho={16} />
      <span className="sr-only">Pesquisar pessoas</span>
      <input
        type="search"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder="Pesquisar por nome ou e-mail"
        maxLength={100}
      />
    </label>
  );
}

function Ativos({ estado, atual, busca, setBusca, campoDeBusca }) {
  const { matriz, rascunho } = atual;
  const [porModulo, setPorModulo] = useState(false);
  // Busca aplica 300 ms depois da digitação (design.md 11.3).
  useEffect(() => {
    if (busca.trim() === atual.busca) return undefined;
    const espera = setTimeout(
      () => void estado.carregarMatriz({ busca: busca.trim(), offset: 0 }),
      300,
    );
    return () => clearTimeout(espera);
  }, [busca, atual.busca, estado]);

  const gruposPorCodigo = useMemo(
    () => Object.fromEntries((matriz?.grupos || []).map((g) => [g.codigo, g])),
    [matriz?.grupos],
  );
  const teto = matriz?.teto;
  const comCoordenacao = Boolean(teto?.admin_global);
  const total = matriz?.total || 0;
  const usuarios = matriz?.usuarios || [];
  const usuarioLogado = atual.perfil
    ? { id: atual.perfil.user_id, email: atual.perfil.email }
    : null;
  const filtrando = Boolean(
    atual.busca || atual.filtroGrupo || atual.filtroCoordenacao,
  );
  const colunas = porModulo ? MODULOS.length + (comCoordenacao ? 3 : 2) : 5;

  return (
    <>
      <div className="acessos-filtros">
        {campoDeBusca}
        <select
          aria-label="Filtrar por grupo"
          value={atual.filtroGrupo}
          onChange={(e) =>
            void estado.carregarMatriz({
              filtroGrupo: e.target.value,
              offset: 0,
            })
          }
        >
          <option value="">Todos os grupos</option>
          {(matriz?.grupos || []).map((g) => (
            <option key={g.codigo} value={g.codigo}>
              {g.nome}
            </option>
          ))}
        </select>
        {comCoordenacao ? (
          <select
            aria-label="Filtrar por coordenação"
            value={atual.filtroCoordenacao}
            onChange={(e) =>
              void estado.carregarMatriz({
                filtroCoordenacao: e.target.value,
                offset: 0,
              })
            }
          >
            <option value="">Todas as coordenações</option>
            <option value="__sem__">Sem coordenação</option>
            <OpcoesDeCoordenacao
              coordenacoes={matriz?.coordenacoes || []}
              areas={matriz?.areas || []}
            />
          </select>
        ) : null}
        {filtrando ? (
          <button
            type="button"
            className="btn outline acessos-ghost"
            onClick={() => {
              setBusca("");
              void estado.carregarMatriz({
                busca: "",
                filtroGrupo: "",
                filtroCoordenacao: "",
                offset: 0,
              });
            }}
          >
            Limpar filtros
          </button>
        ) : null}
        <label className="acessos-alternar">
          <input
            type="checkbox"
            checked={porModulo}
            onChange={(e) => setPorModulo(e.target.checked)}
          />
          Ver permissões por módulo (avançado)
        </label>
        {porModulo ? (
          <span className="acessos-legenda" aria-label="Como ler os níveis">
            <span className="acessos-legenda-grupo">Leitor</span> segue o grupo
            <span className="acessos-legenda-individual">Editor</span>{" "}
            individual
          </span>
        ) : null}
        <span className="acessos-contagem-resultados">
          {total.toLocaleString("pt-BR")} {total === 1 ? "pessoa" : "pessoas"}
        </span>
      </div>

      <div
        className={classes(
          "acessos-tabela",
          !porModulo && "acessos-tabela-simples",
        )}
        data-mobile-table="scroll"
        tabIndex={0}
        role="region"
        aria-label={porModulo ? "Permissões por módulo" : "Pessoas com acesso"}
      >
        <table>
          <thead>
            {porModulo ? (
              <tr>
                <th scope="col">Pessoa</th>
                <th scope="col">Grupo</th>
                {comCoordenacao ? <th scope="col">Coordenação</th> : null}
                {MODULOS.map((modulo) => (
                  <th key={modulo.id} scope="col">
                    {modulo.rotulo}
                  </th>
                ))}
              </tr>
            ) : (
              <tr>
                <th scope="col">Pessoa</th>
                <th scope="col">Grupo</th>
                <th scope="col">Áreas</th>
                <th scope="col">Coordenação</th>
                <th scope="col">Situação</th>
              </tr>
            )}
          </thead>
          <tbody>
            {!matriz ? (
              <LinhasEsqueleto colunas={colunas} linhas={6} />
            ) : usuarios.length ? (
              usuarios.map((usuario) =>
                porModulo ? (
                  <LinhaPorModulo
                    key={usuario.id}
                    estado={estado}
                    matriz={matriz}
                    usuario={usuario}
                    rascunho={rascunho}
                    gruposPorCodigo={gruposPorCodigo}
                    usuarioLogado={usuarioLogado}
                    comCoordenacao={comCoordenacao}
                  />
                ) : (
                  <LinhaSimples
                    key={usuario.id}
                    estado={estado}
                    matriz={matriz}
                    usuario={usuario}
                    rascunho={rascunho}
                    gruposPorCodigo={gruposPorCodigo}
                  />
                ),
              )
            ) : (
              <tr>
                <td colSpan={colunas} className="acessos-vazio">
                  {filtrando
                    ? "Nenhuma pessoa corresponde aos filtros aplicados."
                    : "Nenhuma pessoa com acesso ativo."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > POR_PAGINA ? (
        <div className="acessos-paginacao">
          <span>
            {atual.offset + 1}–{Math.min(atual.offset + usuarios.length, total)}{" "}
            de {total.toLocaleString("pt-BR")}
          </span>
          <span className="acessos-acoes">
            <button
              type="button"
              className="btn icon outline"
              aria-label="Página anterior"
              disabled={atual.offset === 0}
              onClick={() =>
                void estado.carregarMatriz({
                  offset: Math.max(0, atual.offset - POR_PAGINA),
                })
              }
            >
              <Icone nome="chevron-left" tamanho={16} />
            </button>
            <button
              type="button"
              className="btn icon outline"
              aria-label="Próxima página"
              disabled={atual.offset + POR_PAGINA >= total}
              onClick={() =>
                void estado.carregarMatriz({
                  offset: atual.offset + POR_PAGINA,
                })
              }
            >
              <Icone nome="chevron-right" tamanho={16} />
            </button>
          </span>
        </div>
      ) : null}

      {atual.aviso ? (
        <p
          role="status"
          className={classes(
            "alert",
            atual.aviso.tom === "danger" ? "error" : atual.aviso.tom,
          )}
        >
          <Icone nome="triangle-alert" tamanho={16} /> {atual.aviso.texto}
        </p>
      ) : null}
      {matriz ? (
        <BarraDeSalvar estado={estado} rascunho={rascunho} matriz={matriz} />
      ) : null}
    </>
  );
}

export function AbaUsuarios({ estado }) {
  const atual = useSyncExternalStore(estado.assinar, estado.obter);
  const [escolhida, setSituacao] = useState("ativos");
  const [busca, setBusca] = useState(atual.busca);
  const pendentes = atual.solicitacoes.length;
  // "Desativadas" só para o administrador global (o banco recusa os demais).
  const adminGlobal = Boolean(atual.matriz?.teto?.admin_global);
  const desativadas =
    adminGlobal && atual.statusDasDesativadas === "ready"
      ? atual.desativadas.length
      : null;
  const situacao =
    escolhida === "desativadas" && !adminGlobal ? "ativos" : escolhida;
  const opcoes = [
    { valor: "ativos", rotulo: "Ativos" },
    {
      valor: "pendentes",
      rotulo: pendentes ? `Pendentes (${pendentes})` : "Pendentes",
    },
  ];
  if (adminGlobal)
    opcoes.push({
      valor: "desativadas",
      rotulo: desativadas ? `Desativadas (${desativadas})` : "Desativadas",
    });
  const campoDeBusca = <CampoDeBusca valor={busca} aoMudar={setBusca} />;
  return (
    <section className="acessos-usuarios" aria-label="Usuários">
      <div className="acessos-topo">
        <span className="acessos-topo-inicio">
          <ControleSegmentado
            rotulo="Situação"
            valor={situacao}
            aoMudar={setSituacao}
            opcoes={opcoes}
          />
          {adminGlobal && atual.matriz ? (
            <span className="acessos-resumo-contas">
              {resumoDeContas({
                ativas: atual.matriz.total || 0,
                desativadas,
              })}
            </span>
          ) : null}
        </span>
        {atual.matriz ? (
          <button
            type="button"
            className="btn primary"
            onClick={estado.abrirAdicionar}
          >
            <Icone nome="plus" tamanho={16} /> Adicionar pessoa
          </button>
        ) : null}
      </div>
      {situacao === "ativos" ? (
        <Ativos
          estado={estado}
          atual={atual}
          busca={busca}
          setBusca={setBusca}
          campoDeBusca={campoDeBusca}
        />
      ) : situacao === "desativadas" ? (
        <Desativadas
          estado={estado}
          atual={atual}
          busca={busca}
          campoDeBusca={campoDeBusca}
        />
      ) : (
        <Solicitacoes estado={estado} atual={atual} />
      )}
      {atual.adicionando && atual.matriz ? (
        <ModalAdicionarPessoa key={atual.adicionando} estado={estado} />
      ) : null}
    </section>
  );
}
