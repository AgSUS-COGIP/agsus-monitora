import { useState } from "react";
import { gruposAtribuiveis } from "../../lib/teto-de-acessos.js";
import { coordenacoesPorArea } from "../../lib/grupos-e-coordenacoes.js";
import { MultiSelectBusca } from "../multi-select-busca.jsx";
import { BotaoDeAcao, LinhasEsqueleto } from "../lista-aprovados/partes.jsx";
import { Icone } from "../icone.jsx";

/*
  Pedidos de acesso pendentes, na mesma seção de Usuários ("Pendentes"). O
  admin vê todos; o coordenador, só os que pediram a coordenação dele (e
  aprova sempre nela, com grupo dentro do teto). Sem coordenação, o admin
  escolhe as áreas que a pessoa vê inteiras.
*/

function Pedido({ estado, solicitacao, matriz }) {
  const teto = matriz.teto;
  const grupos = gruposAtribuiveis(teto, matriz.grupos || []);
  const areas = matriz.areas || [];
  const [grupo, setGrupo] = useState(grupos.find((g) => g.codigo === "usuario")?.codigo || grupos[0]?.codigo || "");
  const [coordenacao, setCoordenacao] = useState(
    teto.admin_global ? solicitacao.coordenacao || "" : teto.coordenacao || "",
  );
  const [areasEscolhidas, setAreasEscolhidas] = useState(["saude-indigena"]);
  const adminGlobal = grupos.find((g) => g.codigo === grupo)?.admin_global;
  const semCoordenacao = !coordenacao && !adminGlobal;
  const podeAprovar = Boolean(grupo) && (!semCoordenacao || areasEscolhidas.length > 0);
  const nome = solicitacao.nome || solicitacao.email;

  return (
    <tr>
      <th scope="row">
        <strong>{nome}</strong>
        <small>{solicitacao.email}</small>
        {solicitacao.justificativa ? (
          <small className="acessos-truncado" title={solicitacao.justificativa}>
            {solicitacao.justificativa}
          </small>
        ) : null}
      </th>
      <td>{solicitacao.coordenacao_nome || <span className="acessos-vazio">—</span>}</td>
      <td>
        <select className="acessos-tag" aria-label={`Grupo de ${nome}`} value={grupo} onChange={(e) => setGrupo(e.target.value)}>
          {grupos.map((g) => (
            <option key={g.codigo} value={g.codigo}>
              {g.nome}
            </option>
          ))}
        </select>
      </td>
      <td>
        {adminGlobal ? (
          <span className="acessos-vazio">Todas as áreas</span>
        ) : (
          <div className="acessos-empilhado">
            <select
              aria-label={`Coordenação de ${nome}`}
              value={coordenacao}
              disabled={!teto.admin_global}
              onChange={(e) => setCoordenacao(e.target.value)}
            >
              <option value="">Sem coordenação</option>
              {coordenacoesPorArea((matriz.coordenacoes || []).filter((c) => c.ativo), areas).map((g) => (
                <optgroup key={g.area.id} label={g.area.titulo}>
                  {g.coordenacoes.map((c) => (
                    <option key={c.codigo} value={c.codigo}>
                      {c.nome}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {semCoordenacao ? (
              <MultiSelectBusca
                id={`acessosAreas-${solicitacao.id}`}
                opcoes={areas.map((a) => ({ value: a.id, label: a.titulo }))}
                selecionados={areasEscolhidas}
                placeholder="Escolha as áreas"
                aoMudar={setAreasEscolhidas}
              />
            ) : null}
          </div>
        )}
      </td>
      <td>
        <span className="acessos-acoes">
          <BotaoDeAcao
            estado={estado}
            acao={`recusar:${solicitacao.id}`}
            className="btn outline acessos-ghost acessos-perigo"
            onClick={() => {
              if (estado.confirmar(`Recusar o pedido de acesso de ${nome}?`)) void estado.recusar(solicitacao, "");
            }}
          >
            Recusar
          </BotaoDeAcao>
          <BotaoDeAcao
            estado={estado}
            acao={`aprovar:${solicitacao.id}`}
            className="btn secondary"
            disabled={!podeAprovar}
            title={podeAprovar ? undefined : "Escolha uma coordenação ou ao menos uma área."}
            onClick={() =>
              void estado.aprovar(solicitacao, {
                grupo,
                coordenacao,
                areas: semCoordenacao ? areasEscolhidas : null,
              })
            }
          >
            Aprovar
          </BotaoDeAcao>
        </span>
      </td>
    </tr>
  );
}

export function Solicitacoes({ estado, atual }) {
  const { solicitacoes, statusDasSolicitacoes, matriz } = atual;
  if (statusDasSolicitacoes === "error")
    return (
      <div className="alert error" role="alert">
        <Icone nome="circle-alert" tamanho={16} /> Não foi possível carregar os pedidos de acesso.{" "}
        <button type="button" className="btn secondary" onClick={() => void estado.carregarSolicitacoes()}>
          Tentar novamente
        </button>
      </div>
    );
  const carregando = statusDasSolicitacoes !== "ready" || !matriz;
  return (
    <div className="acessos-tabela" data-mobile-table="scroll" role="region" aria-label="Pedidos de acesso pendentes">
      <table>
        <thead>
          <tr>
            <th scope="col">Pessoa</th>
            <th scope="col">Pediu</th>
            <th scope="col">Grupo</th>
            <th scope="col">Coordenação</th>
            <th scope="col">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {carregando ? (
            <LinhasEsqueleto colunas={5} linhas={3} />
          ) : solicitacoes.length ? (
            solicitacoes.map((s) => <Pedido key={s.id} estado={estado} solicitacao={s} matriz={matriz} />)
          ) : (
            <tr>
              <td colSpan={5} className="acessos-vazio">
                Nenhum pedido pendente. Quem pedir acesso aparece aqui.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
