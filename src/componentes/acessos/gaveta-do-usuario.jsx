import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ALVO_COORDENACAO,
  ALVO_GRUPO,
  MODULOS,
  adminGlobalDaLinha,
  areasMarcadasDaLinha,
  celulaExibida,
  coordenacaoDaLinha,
  explicacaoDoGrupo,
  ficariaSemArea,
  grupoDaLinha,
  pendenciasDoUsuario,
} from "../../lib/matriz-de-acessos.js";
import { dataCurta } from "../../lib/convite-de-acesso.js";
import { rotuloDoNivel } from "../../lib/permissoes-recursos.js";
import {
  gruposAtribuiveis,
  nivelMaximo,
  opcoesDoModulo,
  podeEditarAreas,
  podeEditarUsuario,
  podeMudarCoordenacao,
  valorDoSelect,
} from "../../lib/teto-de-acessos.js";
import {
  capacidadesDoPerfil,
  menuDoContexto,
  perfilDoContexto,
  resumoDoEscopo,
} from "../../lib/ver-como.js";
import { Modal } from "../modal.jsx";
import { Icone } from "../icone.jsx";
import { BotaoDeAcao } from "../lista-aprovados/partes.jsx";
import {
  CabecalhoDaGaveta,
  OpcoesDeCoordenacao,
  OpcoesDoGrupo,
  OpcoesDoModulo,
  classes,
  motivoValido,
} from "./partes.jsx";
import { AcoesDoConvite } from "./convite.jsx";

/*
  Gaveta da pessoa, aberta pela linha na tabela. Na ordem em que se pensa:
  grupo (e o que ele deixa fazer), áreas, coordenação e, fechado, "Avançado:
  exceções por módulo" (níveis individuais e painéis externos). Embaixo,
  "como a pessoa vê" (menu e escopo lidos do que está salvo — não é entrar
  como ela). Quem ainda não entrou tem o convite para reenviar ou cancelar.

  O que muda aqui vai para o mesmo rascunho da tabela e grava com "Salvar
  alterações". Trava: grupo que não é de administrador sem área e sem
  coordenação deixa a pessoa num sistema vazio — a gaveta avisa e o salvar
  espera a área (o banco recusa com 23514).
*/

function ComoAPessoaVe({ estado, usuario, matriz, secoesDeConfiguracao }) {
  const [contexto, setContexto] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    estado
      .lerContextoDoUsuario(usuario.id)
      .then((dados) => vivo && setContexto(dados))
      .catch((falha) => vivo && setErro(falha?.message || "Tente novamente."));
    return () => {
      vivo = false;
    };
  }, [estado, usuario.id]);

  if (erro)
    return (
      <p className="acessos-erro">
        <Icone nome="circle-alert" tamanho={14} /> Não foi possível ler o acesso
        salvo.
      </p>
    );
  const perfil = contexto ? perfilDoContexto(contexto) : null;
  if (!perfil)
    return (
      <p aria-busy="true">
        <span className="esqueleto" />
      </p>
    );
  const nomesDasAreas = new Map(
    (matriz.areas || []).map((a) => [a.id, a.titulo]),
  );
  const menu = menuDoContexto(contexto, {
    paineis: matriz.paineis || [],
    secoesDeConfiguracao,
  });
  const capacidades = capacidadesDoPerfil(perfil);
  return (
    <>
      <p>{resumoDoEscopo(contexto, nomesDasAreas)}</p>
      <p className="acessos-secundario">
        {capacidades.length ? capacidades.join(" · ") : "Só consulta."}
      </p>
      {menu.length ? (
        <dl className="acessos-menu">
          {menu.map((grupo) => (
            <div key={grupo.id}>
              <dt>{grupo.rotulo}</dt>
              <dd>{grupo.itens.map((item) => item.rotulo).join(", ")}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="acessos-secundario">
          Nenhuma página liberada: a pessoa vê a tela "Sem acesso".
        </p>
      )}
    </>
  );
}

/*
  Conta de e-mail compartilhado de uma coordenação (ex.: "COET – …") não é uma
  pessoa: vira coordenação (com o nome da conta) e a conta é desativada.
*/
function MoverParaCoordenacoes({ estado, usuario, areas }) {
  const [aberto, setAberto] = useState(false);
  const [area, setArea] = useState(areas[0]?.id || "");
  const [motivo, setMotivo] = useState("");
  if (!aberto)
    return (
      <button
        type="button"
        className="btn outline acessos-ghost"
        onClick={() => setAberto(true)}
      >
        Mover para Coordenações
      </button>
    );
  return (
    <form
      className="acessos-mover"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (motivoValido(motivo))
          void estado.moverParaCoordenacoes(usuario, area, motivo.trim());
      }}
    >
      <p>
        Esta conta é de uma coordenação, não de uma pessoa? Ela vira a
        coordenação "{usuario.nome}" e a conta é desativada.
      </p>
      <div className="acessos-campo">
        <label htmlFor="acessosMoverArea">Área da coordenação</label>
        <select
          id="acessosMoverArea"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.titulo}
            </option>
          ))}
        </select>
      </div>
      <div className="acessos-campo">
        <label htmlFor="acessosMoverMotivo">Motivo</label>
        <input
          id="acessosMoverMotivo"
          value={motivo}
          maxLength={500}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Vai para o histórico"
        />
      </div>
      <div className="acessos-acoes">
        <button
          type="button"
          className="btn outline acessos-ghost"
          onClick={() => setAberto(false)}
        >
          Cancelar
        </button>
        <BotaoDeAcao
          estado={estado}
          acao={`mover:${usuario.id}`}
          type="submit"
          className="btn primary"
          disabled={!motivoValido(motivo)}
        >
          Mover para Coordenações
        </BotaoDeAcao>
      </div>
    </form>
  );
}

/*
  Quem foi cadastrado e nunca entrou: reenviar a mensagem do convite ou
  cancelar (desativa o cadastro, com motivo, pela mesma RPC de desativar).
*/
function Convite({ estado, usuario, podeCancelar }) {
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const nome = usuario.nome || usuario.email;
  const desde = dataCurta(usuario.cadastrado_em);
  return (
    <section aria-labelledby="acessosGavetaConvite">
      <h4 id="acessosGavetaConvite">Convite</h4>
      <p>
        <span className="acessos-selo acessos-selo-convite">
          Convidado · ainda não entrou
        </span>
        {desde ? (
          <span className="acessos-secundario"> Cadastrado em {desde}.</span>
        ) : null}
      </p>
      <details className="acessos-reenviar">
        <summary>Reenviar convite</summary>
        <AcoesDoConvite nome={usuario.nome} email={usuario.email} />
      </details>
      {!podeCancelar ? null : cancelando ? (
        <form
          className="acessos-mover"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (motivoValido(motivo))
              void estado.desativarUsuario(usuario, motivo.trim(), {
                convite: true,
              });
          }}
        >
          <p>
            O cadastro de {nome} é desativado e o e-mail deixa de entrar. Dá
            para convidar de novo depois.
          </p>
          <div className="acessos-campo">
            <label htmlFor="acessosCancelarConviteMotivo">Motivo</label>
            <input
              id="acessosCancelarConviteMotivo"
              value={motivo}
              maxLength={500}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Vai para o histórico"
            />
          </div>
          <div className="acessos-acoes">
            <button
              type="button"
              className="btn outline acessos-ghost"
              onClick={() => setCancelando(false)}
            >
              Voltar
            </button>
            <BotaoDeAcao
              estado={estado}
              acao={`desativar:${usuario.id}`}
              type="submit"
              className="btn outline acessos-perigo"
              disabled={!motivoValido(motivo)}
            >
              Cancelar convite
            </BotaoDeAcao>
          </div>
        </form>
      ) : (
        <div className="acessos-acoes">
          <button
            type="button"
            className="btn outline acessos-ghost acessos-perigo"
            onClick={() => setCancelando(true)}
          >
            <Icone nome="user-x" tamanho={16} /> Cancelar convite
          </button>
        </div>
      )}
    </section>
  );
}

/** Níveis individuais por módulo: o mesmo select da tabela avançada. */
function ExcecoesPorModulo({
  estado,
  usuario,
  rascunho,
  teto,
  gruposPorCodigo,
  pode,
}) {
  return (
    <ul className="acessos-modulos">
      {MODULOS.map((modulo) => {
        const celula = celulaExibida(
          usuario,
          modulo.id,
          rascunho,
          gruposPorCodigo,
        );
        return (
          <li key={modulo.id}>
            <div>
              <strong>{modulo.rotulo}</strong>
              <small>
                {celula.individual
                  ? "Individual: vale só para esta pessoa"
                  : "Segue o grupo"}
              </small>
            </div>
            {usuario.admin_global ? (
              <span className="acessos-nivel-fixo">
                {rotuloDoNivel(celula.nivel, modulo.id)}
              </span>
            ) : (
              <select
                className={classes(
                  "acessos-nivel",
                  celula.individual && "individual",
                  celula.pendente && "acessos-pendente",
                )}
                aria-label={`${modulo.rotulo}: nível da pessoa`}
                value={valorDoSelect(celula)}
                disabled={!pode}
                onChange={(e) =>
                  estado.registrar(usuario, modulo.id, e.target.value || null)
                }
              >
                <OpcoesDoModulo
                  opcoes={opcoesDoModulo(teto, modulo.id, celula)}
                />
              </select>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function GavetaDoUsuario({ estado, secoesDeConfiguracao = [] }) {
  const atual = useSyncExternalStore(estado.assinar, estado.obter);
  const { matriz, rascunho, gaveta } = atual;
  const usuario = matriz?.usuarios?.find((u) => u.id === gaveta?.usuarioId);
  if (!usuario) return null;
  const teto = matriz.teto;
  const grupos = matriz.grupos || [];
  const areas = matriz.areas || [];
  const gruposPorCodigo = Object.fromEntries(grupos.map((g) => [g.codigo, g]));
  const usuarioLogado = atual.perfil
    ? { id: atual.perfil.user_id, email: atual.perfil.email }
    : null;
  const edicao = podeEditarUsuario(teto, usuario, usuarioLogado);
  const codigoDoGrupo = grupoDaLinha(usuario, rascunho);
  const grupo = gruposPorCodigo[codigoDoGrupo];
  const adminGlobal = adminGlobalDaLinha(usuario, rascunho, gruposPorCodigo);
  const coordenacao = coordenacaoDaLinha(usuario, rascunho);
  const nomeDaCoordenacao = (matriz.coordenacoes || []).find(
    (c) => c.codigo === coordenacao,
  )?.nome;
  const semArea =
    usuario.ativo !== false &&
    ficariaSemArea({
      adminGlobal,
      coordenacao,
      areasMarcadas: areasMarcadasDaLinha(usuario, rascunho, areas),
    });
  const nome = usuario.nome || usuario.email;
  const pendentes = pendenciasDoUsuario(rascunho, usuario.id);
  const marcado = (recurso) =>
    celulaExibida(usuario, recurso, rascunho).nivel === "leitor";
  // Desmarcar o que só estava marcado no rascunho desfaz; desmarcar o que estava salvo grava "sem acesso".
  const alternar = (recurso, ligar) =>
    estado.registrar(
      usuario,
      recurso,
      ligar
        ? "leitor"
        : usuario.permissoes?.[recurso]?.origem === "excecao"
          ? "sem_acesso"
          : null,
    );

  return (
    <Modal
      id="acessosGaveta"
      rotuloId="acessosGavetaTitulo"
      className="acessos-gaveta"
      cartaoClassName="acessos-gaveta-cartao"
      aoFechar={estado.fecharGaveta}
    >
      <CabecalhoDaGaveta
        tituloId="acessosGavetaTitulo"
        titulo={nome}
        subtitulo={
          usuario.setor
            ? `${usuario.email} · setor informado: ${usuario.setor}`
            : usuario.email
        }
        aoFechar={estado.fecharGaveta}
      />
      <div className="acessos-gaveta-corpo">
        {edicao.motivo ? (
          <p className="acessos-secundario">{edicao.motivo}</p>
        ) : null}
        {pendentes ? (
          <p className="alert info">
            <Icone nome="triangle-alert" tamanho={16} /> {pendentes}{" "}
            {pendentes === 1 ? "alteração pendente" : "alterações pendentes"}:
            feche e salve na página, com o motivo.
          </p>
        ) : null}

        {usuario.convite_pendente ? (
          <Convite
            estado={estado}
            usuario={usuario}
            podeCancelar={Boolean(teto.admin_global && edicao.pode)}
          />
        ) : null}

        <section aria-labelledby="acessosGavetaGrupo">
          <h4 id="acessosGavetaGrupo">Grupo</h4>
          <select
            aria-label={`Grupo de ${nome}`}
            value={codigoDoGrupo || ""}
            disabled={!edicao.pode}
            onChange={(e) =>
              estado.registrar(usuario, ALVO_GRUPO, e.target.value)
            }
          >
            <OpcoesDoGrupo
              grupos={grupos}
              atribuiveis={gruposAtribuiveis(teto, grupos)}
              atual={codigoDoGrupo}
            />
          </select>
          <p className="acessos-secundario">{explicacaoDoGrupo(grupo)}</p>
        </section>

        <section aria-labelledby="acessosGavetaAreas">
          <h4 id="acessosGavetaAreas">Áreas</h4>
          {adminGlobal ? (
            <p className="acessos-secundario">
              Administrador global: vê todas as áreas.
            </p>
          ) : coordenacao ? (
            <p className="acessos-secundario">
              Vê só o recorte da coordenação {nomeDaCoordenacao || coordenacao}.
            </p>
          ) : (
            <fieldset className="acessos-opcoes">
              <legend className="sr-only">
                Áreas que a pessoa vê inteiras
              </legend>
              {areas.map((area) => (
                <label key={area.id}>
                  <input
                    type="checkbox"
                    checked={marcado(`area:${area.id}`)}
                    disabled={!edicao.pode || !podeEditarAreas(teto)}
                    onChange={(e) =>
                      alternar(`area:${area.id}`, e.target.checked)
                    }
                  />
                  {area.titulo}
                </label>
              ))}
            </fieldset>
          )}
          {semArea ? (
            <p className="alert warn acessos-sem-area" role="alert">
              <Icone nome="triangle-alert" tamanho={16} /> Sem área e sem
              coordenação, {nome} entra e não vê nada. Marque ao menos uma área
              (ou escolha uma coordenação) para poder salvar.
            </p>
          ) : null}
        </section>

        {!adminGlobal ? (
          <section aria-labelledby="acessosGavetaCoordenacao">
            <h4 id="acessosGavetaCoordenacao">Coordenação</h4>
            <select
              aria-label={`Coordenação de ${nome}`}
              value={coordenacao || ""}
              disabled={!edicao.pode || !podeMudarCoordenacao(teto)}
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
                coordenacoes={matriz.coordenacoes || []}
                areas={areas}
                atual={coordenacao}
              />
            </select>
            <p className="acessos-secundario">
              Com coordenação, a pessoa vê só os dados dela.
            </p>
          </section>
        ) : null}

        <details className="acessos-avancado">
          <summary>Avançado: exceções por módulo</summary>
          <p className="acessos-secundario">
            Só para casos especiais: o nível escolhido aqui vale só para esta
            pessoa e passa por cima do grupo.
          </p>
          <ExcecoesPorModulo
            estado={estado}
            usuario={usuario}
            rascunho={rascunho}
            teto={teto}
            gruposPorCodigo={gruposPorCodigo}
            pode={edicao.pode}
          />
          {(matriz.paineis || []).length ? (
            <fieldset className="acessos-opcoes">
              <legend>Painéis externos</legend>
              {matriz.paineis.map((painel) => {
                const recurso = `painel:${painel.id}`;
                return (
                  <label key={painel.id}>
                    <input
                      type="checkbox"
                      checked={marcado(recurso)}
                      disabled={
                        !edicao.pode ||
                        usuario.admin_global ||
                        nivelMaximo(teto, recurso) === "sem_acesso"
                      }
                      onChange={(e) => alternar(recurso, e.target.checked)}
                    />
                    {painel.titulo}
                  </label>
                );
              })}
            </fieldset>
          ) : null}
        </details>

        <section aria-labelledby="acessosGavetaVe">
          <h4 id="acessosGavetaVe">Como a pessoa vê</h4>
          <ComoAPessoaVe
            estado={estado}
            usuario={usuario}
            matriz={matriz}
            secoesDeConfiguracao={secoesDeConfiguracao}
          />
        </section>
      </div>
      {teto.admin_global && edicao.pode ? (
        <div className="acessos-gaveta-rodape">
          <MoverParaCoordenacoes
            estado={estado}
            usuario={usuario}
            areas={areas}
          />
          {usuario.convite_pendente ? null : (
            <BotaoDeAcao
              estado={estado}
              acao={`desativar:${usuario.id}`}
              className="btn outline acessos-ghost acessos-perigo"
              onClick={() => {
                const motivo = window.prompt(
                  `Desativar o acesso de ${nome}? Informe o motivo:`,
                );
                if (motivoValido(motivo))
                  void estado.desativarUsuario(usuario, motivo.trim());
              }}
            >
              <Icone nome="user-x" tamanho={16} /> Desativar acesso
            </BotaoDeAcao>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
