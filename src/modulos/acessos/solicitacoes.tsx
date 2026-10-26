import { useState, type FormEvent } from "react";
import { gruposAtribuiveis } from "../../lib/teto-de-acessos.js";
import { coordenacoesPorArea } from "../../lib/grupos-e-coordenacoes.js";
import { linhaDoPedidoDeReativacao } from "../../lib/contas-desativadas.js";
import {
  MOTIVOS_DE_RECUSA,
  MOTIVO_DE_RECUSA_OUTRO,
  areaDaSolicitacao,
  diaEMes,
  grupoSugeridoDoPedido,
  rotuloDoCargo,
  validarRecusa,
} from "../../lib/solicitacao-de-acesso.ts";
import { MultiSelectBusca } from "../../componentes/multi-select-busca.tsx";
import {
  Aviso,
  BotaoDeAcao,
  Campo,
  ErroAoCarregar,
  LinhasEsqueleto,
  Modal,
  Selo,
} from "../../ui/index.ts";
import type { EstadoDaAcao } from "../../ui/botao-de-acao.tsx";
import { CabecalhoDaGaveta } from "./partes.jsx";

/*
  Pedidos de acesso pendentes, na mesma seção de Usuários ("Pendentes"). O
  admin global vê todos; o coordenador, só os que pediram a coordenação dele
  (e aprova sempre nela, com grupo dentro do teto) — as permissões são as do
  banco (private."FC_EXIGIR_GESTOR_DE_ACESSOS").

  Cada pedido mostra área, cargo/função, unidade/lotação, coordenação e a
  justificativa. Quem aprova escolhe o GRUPO (o cargo pedido sugere:
  grupoSugeridoDoPedido) e a coordenação ou as áreas (a área do pedido vem
  marcada). Recusar abre o motivo da lista fixa (MOTIVOS_DE_RECUSA; "Outro"
  pede descrição), que a pessoa vê ao entrar de novo.

  Pedido de quem tem conta desativada é de REATIVAÇÃO: selo, quando/por
  quem/por que foi desativada e o grupo de antes já escolhido. Aprovar
  reativa a conta.
*/

type Grupo = { codigo: string; nome: string; admin_global?: boolean };
type AreaDaMatriz = { id: string; titulo: string };
type Coordenacao = {
  codigo: string;
  nome: string;
  area: string;
  ativo?: boolean;
};
type Teto = { admin_global?: boolean; coordenacao?: string | null };
type Matriz = {
  teto: Teto;
  grupos?: Grupo[];
  areas?: AreaDaMatriz[];
  coordenacoes?: Coordenacao[];
};

export type PedidoPendente = {
  id: string;
  nome?: string | null;
  email: string;
  setor?: string | null;
  justificativa?: string | null;
  created_at?: string | null;
  coordenacao?: string | null;
  coordenacao_nome?: string | null;
  area?: string | null;
  area_nome?: string | null;
  cargo?: string | null;
  cargo_rotulo?: string | null;
  cargo_outro?: string | null;
  reativacao?: boolean;
  grupo_anterior?: string | null;
};

type Resultado = { ok: boolean; erro: string };

type EstadoDosAcessos = {
  aprovar: (
    solicitacao: PedidoPendente,
    escolha: {
      grupo: string;
      coordenacao: string;
      areas: string[] | null;
    },
  ) => Promise<unknown>;
  recusar: (
    solicitacao: PedidoPendente,
    argumentos: { p_motivo: string; p_complemento: string | null },
  ) => Promise<Resultado>;
  carregarSolicitacoes: () => Promise<unknown>;
} & EstadoDaAcao;

/** A área do pedido, se a pessoa que aprova pode marcá-la; senão nenhuma. */
export function areasIniciaisDoPedido(
  solicitacao: PedidoPendente,
  areas: readonly AreaDaMatriz[],
): string[] {
  return areas.some((a) => a.id === solicitacao.area)
    ? [String(solicitacao.area)]
    : [];
}

function OQuePediu({ solicitacao }: { solicitacao: PedidoPendente }) {
  const area =
    areaDaSolicitacao(solicitacao.area)?.rotulo || solicitacao.area_nome || "";
  const cargo = rotuloDoCargo(
    solicitacao.cargo,
    solicitacao.cargo_outro,
    solicitacao.cargo_rotulo,
  );
  const linha = [area, cargo].filter(Boolean).join(" · ");
  const onde = [solicitacao.setor, solicitacao.coordenacao_nome]
    .filter(Boolean)
    .join(" · ");
  if (!linha && !onde) return <span className="acessos-vazio">—</span>;
  return (
    <div className="acessos-pedido">
      {linha ? <strong>{linha}</strong> : null}
      {onde ? <small>{onde}</small> : null}
    </div>
  );
}

function ModalDeRecusa({
  estado,
  solicitacao,
  aoFechar,
}: {
  estado: EstadoDosAcessos;
  solicitacao: PedidoPendente;
  aoFechar: () => void;
}) {
  const [motivo, definirMotivo] = useState("");
  const [complemento, definirComplemento] = useState("");
  const [tentou, definirTentou] = useState(false);
  const [recusa, definirRecusa] = useState("");
  const nome = solicitacao.nome || solicitacao.email;
  const resultado = validarRecusa({ motivo, complemento });
  const erro = tentou && !resultado.ok ? resultado : null;

  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    definirTentou(true);
    if (!resultado.ok) return;
    const resposta = await estado.recusar(solicitacao, resultado.argumentos);
    if (resposta.ok) aoFechar();
    else definirRecusa(resposta.erro);
  }

  return (
    <Modal
      id="acessosRecusarPedido"
      rotuloId="acessosRecusarPedidoTitulo"
      className="acessos-modal"
      cartaoClassName="acessos-modal-cartao"
      aoFechar={aoFechar}
      fecharAoClicarFora={false}
    >
      <CabecalhoDaGaveta
        tituloId="acessosRecusarPedidoTitulo"
        titulo={`Recusar o pedido de ${nome}`}
        aoFechar={aoFechar}
      />
      <form className="acessos-modal-corpo" onSubmit={confirmar} noValidate>
        <Campo
          rotulo="Motivo"
          obrigatorio
          erro={erro?.campo === "motivo" ? erro.erro : undefined}
        >
          <select
            id="acessosRecusarMotivo"
            data-foco-inicial
            value={motivo}
            onChange={(e) => {
              definirRecusa("");
              definirMotivo(e.target.value);
            }}
          >
            <option value="">Escolha</option>
            {MOTIVOS_DE_RECUSA.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          rotulo={
            motivo === MOTIVO_DE_RECUSA_OUTRO
              ? "Descreva o motivo"
              : "Complemento"
          }
          obrigatorio={motivo === MOTIVO_DE_RECUSA_OUTRO}
          erro={erro?.campo === "complemento" ? erro.erro : undefined}
        >
          <textarea
            id="acessosRecusarComplemento"
            rows={3}
            maxLength={500}
            value={complemento}
            onChange={(e) => {
              definirRecusa("");
              definirComplemento(e.target.value);
            }}
          />
        </Campo>
        {resultado.ok ? (
          <p className="acessos-secundario" id="acessosRecusarPrevia">
            A pessoa verá: {resultado.texto}
          </p>
        ) : null}
        {recusa ? (
          <Aviso tom="danger" papel="alert" como="p" className="acessos-recusa">
            {recusa}
          </Aviso>
        ) : null}
        <div className="ui-acoes acessos-modal-rodape">
          <button type="button" className="btn ghost" onClick={aoFechar}>
            Cancelar
          </button>
          <BotaoDeAcao
            estado={estado}
            acao={`recusar:${solicitacao.id}`}
            type="submit"
            className="btn red"
          >
            Recusar pedido
          </BotaoDeAcao>
        </div>
      </form>
    </Modal>
  );
}

function Pedido({
  estado,
  solicitacao,
  matriz,
  aoRecusar,
}: {
  estado: EstadoDosAcessos;
  solicitacao: PedidoPendente;
  matriz: Matriz;
  aoRecusar: () => void;
}) {
  const teto = matriz.teto;
  const grupos: Grupo[] = gruposAtribuiveis(teto, matriz.grupos || []);
  const areas = matriz.areas || [];
  const [grupo, setGrupo] = useState(() =>
    grupoSugeridoDoPedido(solicitacao, grupos),
  );
  const [coordenacao, setCoordenacao] = useState(
    teto.admin_global ? solicitacao.coordenacao || "" : teto.coordenacao || "",
  );
  const [areasEscolhidas, setAreasEscolhidas] = useState<string[]>(() =>
    areasIniciaisDoPedido(solicitacao, areas),
  );
  const sugerido = grupoSugeridoDoPedido(solicitacao, grupos);
  const adminGlobal = grupos.find((g) => g.codigo === grupo)?.admin_global;
  const semCoordenacao = !coordenacao && !adminGlobal;
  const podeAprovar =
    Boolean(grupo) && (!semCoordenacao || areasEscolhidas.length > 0);
  const nome = solicitacao.nome || solicitacao.email;
  const dia = diaEMes(solicitacao.created_at);

  return (
    <tr>
      <th scope="row">
        <strong>{nome}</strong>
        <small>
          {solicitacao.email}
          {dia ? ` · ${dia}` : ""}
        </small>
        {solicitacao.reativacao ? (
          <>
            <Selo tom="revisar" className="acessos-selo-reativacao">
              Reativação
            </Selo>
            <small className="acessos-linha-reativacao">
              {linhaDoPedidoDeReativacao(solicitacao)}
            </small>
          </>
        ) : null}
      </th>
      <td>
        <OQuePediu solicitacao={solicitacao} />
        {solicitacao.justificativa ? (
          <p
            className="acessos-justificativa"
            title={solicitacao.justificativa}
          >
            {solicitacao.justificativa}
          </p>
        ) : null}
      </td>
      <td>
        <select
          className="acessos-tag"
          aria-label={`Grupo de ${nome}`}
          value={grupo}
          onChange={(e) => setGrupo(e.target.value)}
        >
          {grupos.map((g) => (
            <option key={g.codigo} value={g.codigo}>
              {g.codigo === sugerido && solicitacao.cargo
                ? `${g.nome} (sugerido)`
                : g.nome}
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
              {coordenacoesPorArea(
                (matriz.coordenacoes || []).filter((c) => c.ativo),
                areas,
              ).map(
                (g: { area: AreaDaMatriz; coordenacoes: Coordenacao[] }) => (
                  <optgroup key={g.area.id} label={g.area.titulo}>
                    {g.coordenacoes.map((c) => (
                      <option key={c.codigo} value={c.codigo}>
                        {c.nome}
                      </option>
                    ))}
                  </optgroup>
                ),
              )}
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
        <span className="ui-acoes">
          <button
            type="button"
            className="btn ghost perigo"
            onClick={aoRecusar}
          >
            Recusar
          </button>
          <BotaoDeAcao
            estado={estado}
            acao={`aprovar:${solicitacao.id}`}
            className="btn secondary"
            disabled={!podeAprovar}
            title={
              podeAprovar
                ? undefined
                : "Escolha uma coordenação ou ao menos uma área."
            }
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

export function Solicitacoes({
  estado,
  atual,
}: {
  estado: EstadoDosAcessos;
  atual: {
    solicitacoes: PedidoPendente[];
    statusDasSolicitacoes: string;
    matriz: Matriz | null;
  };
}) {
  const { solicitacoes, statusDasSolicitacoes, matriz } = atual;
  const [recusando, setRecusando] = useState<PedidoPendente | null>(null);
  if (statusDasSolicitacoes === "error")
    return (
      <ErroAoCarregar
        oQue="os pedidos de acesso"
        aoTentar={() => void estado.carregarSolicitacoes()}
      />
    );
  const carregando = statusDasSolicitacoes !== "ready" || !matriz;
  return (
    <div
      className="acessos-tabela"
      data-mobile-table="scroll"
      role="region"
      aria-label="Pedidos de acesso pendentes"
      data-tour="acessos-pendentes"
    >
      <table>
        <thead>
          <tr>
            <th scope="col">Pessoa</th>
            <th scope="col">Pediu</th>
            <th scope="col">Grupo</th>
            <th scope="col">Coordenação ou áreas</th>
            <th scope="col">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {carregando || !matriz ? (
            <LinhasEsqueleto colunas={5} linhas={3} />
          ) : solicitacoes.length ? (
            solicitacoes.map((s) => (
              <Pedido
                key={s.id}
                estado={estado}
                solicitacao={s}
                matriz={matriz}
                aoRecusar={() => setRecusando(s)}
              />
            ))
          ) : (
            <tr>
              <td colSpan={5} className="acessos-vazio">
                Nenhum pedido pendente.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {recusando ? (
        <ModalDeRecusa
          estado={estado}
          solicitacao={recusando}
          aoFechar={() => setRecusando(null)}
        />
      ) : null}
    </div>
  );
}
