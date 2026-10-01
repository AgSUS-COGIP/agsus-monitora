import { useEffect, useState } from "react";
import {
  errosDaReativacao,
  linhaDaDesativacao,
  motivoDaDesativacao,
  MOTIVO_NAO_REGISTRADO,
  valoresIniciaisDaReativacao,
} from "../../lib/contas-desativadas.js";
import { gruposAtribuiveis } from "../../lib/teto-de-acessos.js";
import { explicacaoDoGrupo } from "../../lib/matriz-de-acessos.js";
import { Modal } from "../modal.jsx";
import { Icone } from "../icone.jsx";
import { BotaoDeAcao, LinhasEsqueleto } from "../lista-aprovados/partes.jsx";
import {
  AvisoSemArea,
  AvisoSemCoordenacao,
  CabecalhoDaGaveta,
  CaixasDeArea,
  CampoMotivo,
  OpcoesDeCoordenacao,
  OpcoesDoGrupo,
  classes,
  motivoValido,
} from "./partes.jsx";

/*
  Usuários › "Desativadas" (só o administrador global): quem foi desativado,
  quando, por quem e por quê, com o grupo e as áreas de antes. "Reativar"
  abre um modal com o que a pessoa tinha (editável, com as mesmas travas da
  gaveta) e pede motivo. Na próxima entrada, a pessoa vê "Bem-vindo(a) de
  volta" (src/modules/comemoracao-do-acesso.js).
*/

function ModalReativarConta({ estado, conta, matriz, aoFechar }) {
  const grupos = matriz.grupos || [];
  const areas = matriz.areas || [];
  const [valores, setValores] = useState(() =>
    valoresIniciaisDaReativacao(conta, grupos),
  );
  const [tentou, setTentou] = useState(false);
  const [recusa, setRecusa] = useState("");
  const nome = conta.nome || conta.email;
  const grupo = grupos.find((g) => g.codigo === valores.grupo);
  const adminGlobal = Boolean(grupo?.admin_global);
  const erros = errosDaReativacao(valores, grupos);
  const travado = Boolean(erros.grupo || erros.semArea || erros.semCoordenacao);
  const mudar = (mudancas) => {
    setRecusa("");
    setValores((antes) => ({ ...antes, ...mudancas }));
  };
  const nomeDaCoordenacao = (matriz.coordenacoes || []).find(
    (c) => c.codigo === valores.coordenacao,
  )?.nome;

  async function salvar(evento) {
    evento.preventDefault();
    setTentou(true);
    if (travado || !motivoValido(valores.motivo)) return;
    const resultado = await estado.reativar(conta, valores, grupos);
    if (resultado.ok) aoFechar();
    else setRecusa(resultado.erro);
  }

  return (
    <Modal
      id="acessosReativar"
      rotuloId="acessosReativarTitulo"
      className="acessos-modal"
      cartaoClassName="acessos-modal-cartao"
      aoFechar={aoFechar}
      fecharAoClicarFora={false}
    >
      <CabecalhoDaGaveta
        tituloId="acessosReativarTitulo"
        titulo={`Reativar ${nome}`}
        aoFechar={aoFechar}
      />
      <form className="acessos-modal-corpo" onSubmit={salvar} noValidate>
        <div className="acessos-grade-campos">
          <div className="acessos-campo">
            <label htmlFor="acessosReativarGrupo">Grupo</label>
            <select
              id="acessosReativarGrupo"
              data-foco-inicial
              title={explicacaoDoGrupo(grupo) || undefined}
              value={valores.grupo}
              onChange={(e) => mudar({ grupo: e.target.value })}
            >
              <OpcoesDoGrupo
                grupos={grupos}
                atribuiveis={gruposAtribuiveis(matriz.teto, grupos)}
                atual={valores.grupo}
              />
            </select>
          </div>
          {!adminGlobal ? (
            <div className="acessos-campo">
              <label htmlFor="acessosReativarCoordenacao">Coordenação</label>
              <select
                id="acessosReativarCoordenacao"
                value={valores.coordenacao}
                onChange={(e) => mudar({ coordenacao: e.target.value })}
              >
                <option value="">Sem coordenação</option>
                <OpcoesDeCoordenacao
                  coordenacoes={matriz.coordenacoes || []}
                  areas={areas}
                  atual={valores.coordenacao}
                />
              </select>
            </div>
          ) : null}
        </div>
        <div className="acessos-campo">
          <span className="acessos-rotulo">Áreas</span>
          {adminGlobal ? (
            <p className="acessos-secundario">
              Administrador global: vê todas as áreas.
            </p>
          ) : valores.coordenacao ? (
            <p className="acessos-secundario">
              Vê só o recorte da coordenação{" "}
              {nomeDaCoordenacao || valores.coordenacao}.
            </p>
          ) : (
            <CaixasDeArea
              areas={areas}
              marcadas={valores.areas}
              aoAlternar={(id, ligar) =>
                mudar({
                  areas: ligar
                    ? [...new Set([...valores.areas, id])]
                    : valores.areas.filter((a) => a !== id),
                })
              }
            />
          )}
        </div>
        {erros.semArea ? <AvisoSemArea nome={nome} /> : null}
        {erros.semCoordenacao ? <AvisoSemCoordenacao /> : null}
        <CampoMotivo
          id="acessosReativarMotivo"
          rotulo="Motivo da reativação"
          valor={valores.motivo}
          aoMudar={(motivo) => mudar({ motivo })}
          erro={tentou && !motivoValido(valores.motivo)}
        />
        {recusa ? (
          <p className="alert error acessos-recusa" role="alert">
            <Icone nome="circle-alert" tamanho={16} /> {recusa}
          </p>
        ) : null}
        <div className="acessos-acoes acessos-modal-rodape">
          <button
            type="button"
            className="btn outline acessos-ghost"
            onClick={aoFechar}
          >
            Cancelar
          </button>
          <BotaoDeAcao
            estado={estado}
            acao={`reativar:${conta.id}`}
            type="submit"
            className="btn primary"
            disabled={travado}
          >
            Reativar
          </BotaoDeAcao>
        </div>
      </form>
    </Modal>
  );
}

function Antes({ conta, matriz }) {
  const titulo = new Map((matriz.areas || []).map((a) => [a.id, a.titulo]));
  const coordenacao = (matriz.coordenacoes || []).find(
    (c) => c.codigo === conta.coordenacao,
  );
  const areas = Array.isArray(conta.areas) ? conta.areas : [];
  return (
    <span className="acessos-grupo">
      <span className="acessos-chip acessos-chip-grupo">
        {conta.grupo_nome || conta.grupo || "—"}
      </span>
      {conta.coordenacao ? (
        <small>{coordenacao?.nome || conta.coordenacao}</small>
      ) : null}
      {areas.length ? (
        <span className="acessos-chips">
          {areas.map((id) => (
            <span key={id} className="acessos-chip">
              {titulo.get(id) || id}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

export function Desativadas({ estado, atual, busca, campoDeBusca }) {
  const { desativadas, statusDasDesativadas, matriz } = atual;
  const [reativando, setReativando] = useState(null);
  // Mesma busca da aba (nome ou e-mail), 300 ms depois da digitação.
  useEffect(() => {
    if (busca.trim() === atual.buscaDasDesativadas) return undefined;
    const espera = setTimeout(
      () => void estado.carregarDesativadas({ busca: busca.trim() }),
      300,
    );
    return () => clearTimeout(espera);
  }, [busca, atual.buscaDasDesativadas, estado]);

  if (statusDasDesativadas === "error")
    return (
      <div className="alert error" role="alert">
        <Icone nome="circle-alert" tamanho={16} /> Não foi possível carregar as
        contas desativadas.{" "}
        <button
          type="button"
          className="btn secondary"
          onClick={() => void estado.carregarDesativadas()}
        >
          Tentar novamente
        </button>
      </div>
    );
  const carregando = statusDasDesativadas !== "ready" || !matriz;
  return (
    <>
      <div className="acessos-filtros">{campoDeBusca}</div>
      <div
        className="acessos-tabela acessos-tabela-simples"
        data-mobile-table="scroll"
        tabIndex={0}
        role="region"
        aria-label="Contas desativadas"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Pessoa</th>
              <th scope="col">Antes</th>
              <th scope="col">Desativação</th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <LinhasEsqueleto colunas={4} linhas={3} />
            ) : desativadas.length ? (
              desativadas.map((conta) => {
                const motivo = motivoDaDesativacao(conta);
                return (
                  <tr key={conta.id}>
                    <th scope="row">
                      <span className="acessos-pessoa-textos">
                        <strong>{conta.nome || conta.email}</strong>
                        {conta.nome ? <small>{conta.email}</small> : null}
                        {conta.pedido_pendente ? (
                          <span className="acessos-selo acessos-selo-convite">
                            Pediu reativação
                          </span>
                        ) : null}
                      </span>
                    </th>
                    <td>
                      <Antes conta={conta} matriz={matriz} />
                    </td>
                    <td>
                      <span className="acessos-empilhado">
                        <span>{linhaDaDesativacao(conta)}</span>
                        <small
                          className={classes(
                            "acessos-secundario",
                            motivo === MOTIVO_NAO_REGISTRADO &&
                              "acessos-motivo-ausente",
                          )}
                        >
                          {motivo}
                        </small>
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => setReativando(conta)}
                      >
                        Reativar
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="acessos-vazio">
                  {atual.buscaDasDesativadas
                    ? "Nenhuma conta desativada corresponde à busca."
                    : "Nenhuma conta desativada."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {reativando && matriz ? (
        <ModalReativarConta
          key={reativando.id}
          estado={estado}
          conta={reativando}
          matriz={matriz}
          aoFechar={() => setReativando(null)}
        />
      ) : null}
    </>
  );
}
