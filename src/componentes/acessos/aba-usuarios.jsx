import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ALVO_COORDENACAO,
  ALVO_GRUPO,
  MODULOS,
  alvoPendente,
  celulaExibida,
  contarPendencias,
  coordenacaoDaLinha,
  grupoDaLinha,
  resumoDoRascunho,
} from "../../lib/matriz-de-acessos.js";
import {
  gruposAtribuiveis,
  opcoesDoModulo,
  podeEditarUsuario,
  podeMudarCoordenacao,
  valorDoSelect,
} from "../../lib/teto-de-acessos.js";
import { coordenacoesPorArea } from "../../lib/grupos-e-coordenacoes.js";
import { rotuloDoNivel } from "../../lib/permissoes-recursos.js";
import { BotaoDeAcao, LinhasEsqueleto } from "../lista-aprovados/partes.jsx";
import { Icone } from "../icone.jsx";
import {
  CampoMotivo,
  ControleSegmentado,
  classes,
  motivoValido,
} from "./partes.jsx";
import { Solicitacoes } from "./solicitacoes.jsx";
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
  Usuários: cada pessoa segue um grupo (select em forma de tag) e pode ter
  permissão individual em qualquer módulo (um select por módulo; "Do grupo"
  segue o grupo). Áreas, painéis e "como a pessoa vê" ficam na gaveta, aberta
  pelo nome. As alterações vão para um rascunho e só gravam com motivo.
*/

function OpcoesDeCoordenacao({ coordenacoes, areas, atual }) {
  return coordenacoesPorArea(
    coordenacoes.filter((c) => c.ativo || c.codigo === atual),
    areas,
  ).map((grupo) => (
    <optgroup key={grupo.area.id} label={grupo.area.titulo}>
      {grupo.coordenacoes.map((c) => (
        <option key={c.codigo} value={c.codigo}>
          {c.nome}
        </option>
      ))}
    </optgroup>
  ));
}

/*
  O select mostra só o nível. Aberto, separa o que vem do grupo (valor "") do
  que vira permissão individual; a legenda acima da tabela explica o destaque.
*/
function OpcoesDoModulo({ opcoes }) {
  const [doGrupo, ...individuais] = opcoes;
  const opcao = (o) => (
    <option key={o.valor} value={o.valor} disabled={o.desabilitada}>
      {o.rotulo}
    </option>
  );
  return (
    <>
      <optgroup label="Do grupo">{opcao(doGrupo)}</optgroup>
      <optgroup label="Individual">{individuais.map(opcao)}</optgroup>
    </>
  );
}

function Linha({
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
  const atribuiveis = gruposAtribuiveis(teto, grupos);
  const nome = usuario.nome || usuario.email;
  return (
    <tr>
      <th scope="row">
        <span className="acessos-pessoa">
          <span className="acessos-avatar" aria-hidden="true">
            {iniciais(nome)}
          </span>
          <button
            type="button"
            className="acessos-nome"
            title={`${usuario.email}${edicao.motivo ? ` · ${edicao.motivo}` : ""}`}
            onClick={() => estado.abrirGaveta(usuario.id)}
          >
            {nome}
          </button>
        </span>
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
          {grupos.map((g) => (
            <option
              key={g.codigo}
              value={g.codigo}
              disabled={g.codigo !== grupo && !atribuiveis.includes(g)}
            >
              {g.nome}
            </option>
          ))}
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
              disabled={bloqueada || usuario.admin_global}
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

function BarraDeSalvar({ estado, rascunho, matriz }) {
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const pendentes = contarPendencias(rascunho);
  if (!pendentes) return null;
  const porPessoa = resumoDoRascunho(rascunho, {
    grupos: matriz.grupos,
    coordenacoes: matriz.coordenacoes,
  });
  return (
    <form
      className="acessos-salvar"
      onSubmit={(evento) => {
        evento.preventDefault();
        setTentou(true);
        if (!motivoValido(motivo)) return;
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
        >
          Salvar alterações
        </BotaoDeAcao>
      </div>
    </form>
  );
}

function Ativos({ estado, atual }) {
  const { matriz, rascunho } = atual;
  const [busca, setBusca] = useState(atual.busca);
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
  const colunas = MODULOS.length + (comCoordenacao ? 3 : 2);

  return (
    <>
      <div className="acessos-filtros">
        <label className="acessos-busca">
          <Icone nome="search" tamanho={16} />
          <span className="sr-only">Pesquisar pessoas</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por nome ou e-mail"
            maxLength={100}
          />
        </label>
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
        <span className="acessos-legenda" aria-label="Como ler os níveis">
          <span className="acessos-legenda-grupo">Leitor</span> segue o grupo
          <span className="acessos-legenda-individual">Editor</span> individual
        </span>
        <span className="acessos-contagem-resultados">
          {total.toLocaleString("pt-BR")} {total === 1 ? "pessoa" : "pessoas"}
        </span>
      </div>

      <div
        className="acessos-tabela"
        data-mobile-table="scroll"
        tabIndex={0}
        role="region"
        aria-label="Permissões por pessoa"
      >
        <table>
          <thead>
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
          </thead>
          <tbody>
            {!matriz ? (
              <LinhasEsqueleto colunas={colunas} linhas={6} />
            ) : usuarios.length ? (
              usuarios.map((usuario) => (
                <Linha
                  key={usuario.id}
                  estado={estado}
                  matriz={matriz}
                  usuario={usuario}
                  rascunho={rascunho}
                  gruposPorCodigo={gruposPorCodigo}
                  usuarioLogado={usuarioLogado}
                  comCoordenacao={comCoordenacao}
                />
              ))
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
  const [situacao, setSituacao] = useState("ativos");
  const pendentes = atual.solicitacoes.length;
  return (
    <section className="acessos-usuarios" aria-label="Usuários">
      <div className="acessos-topo">
        <ControleSegmentado
          rotulo="Situação"
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[
            { valor: "ativos", rotulo: "Ativos" },
            {
              valor: "pendentes",
              rotulo: pendentes ? `Pendentes (${pendentes})` : "Pendentes",
            },
          ]}
        />
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
        <Ativos estado={estado} atual={atual} />
      ) : (
        <Solicitacoes estado={estado} atual={atual} />
      )}
      {atual.adicionando && atual.matriz ? (
        <ModalAdicionarPessoa key={atual.adicionando} estado={estado} />
      ) : null}
    </section>
  );
}
