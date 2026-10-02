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
  gerenciariaAcessosSemCoordenacao,
  grupoDaLinha,
  pendenciasDoUsuario,
  resumoDoRascunho,
  separarRascunhoDaPessoa,
} from "../../lib/matriz-de-acessos.js";
import { dataCurta } from "../../lib/convite-de-acesso.js";
import {
  PALAVRA_DE_CONFIRMACAO,
  avisoDeTransformarEmCoordenacao,
  confirmacaoDeTransformarValida,
} from "../../lib/grupos-e-coordenacoes.js";
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
  contextoDepoisDeSalvar,
  menuDoContexto,
  perfilDoContexto,
  resumoDoEscopo,
} from "../../lib/ver-como.js";
import { Icone } from "../../componentes/icone.jsx";
import {
  Aviso,
  BlocosEsqueleto,
  BotaoDeAcao,
  Campo,
  classes,
  Modal,
  Selo,
} from "../../ui/index.js";
import {
  AvisoSemArea,
  AvisoSemCoordenacao,
  CabecalhoDaGaveta,
  CaixasDeArea,
  CampoMotivo,
  OpcoesDeCoordenacao,
  OpcoesDoGrupo,
  OpcoesDoModulo,
  motivoValido,
} from "./partes.jsx";
import { AcoesDoConvite } from "./convite.jsx";

/*
  Modal da pessoa (centralizado; o nome "gaveta" ficou dos ids e das classes),
  aberto pela linha na tabela: o ÚNICO lugar para mudar alguém. Duas colunas:
  à esquerda, na ordem em que se pensa, grupo (e o que ele deixa fazer),
  coordenação e áreas; à direita, "como a pessoa vê" — que, com alteração
  pendente, já mostra o resultado ("Depois de salvar"). O rodapé tem o próprio "Salvar" com motivo
  (grava só esta pessoa) e "Desativar acesso". Quem ainda não entrou tem o
  convite para reenviar ou cancelar.

  "Avançado" (fechado): exceções por módulo, painéis externos e, só para o
  administrador global, "transformar em coordenação" — ação que DESATIVA a
  conta, com confirmação escrita (em 30/09 foi usada numa conta de pessoa por
  engano). Nunca aparece para a própria conta.

  Trava: grupo que não é de administrador sem área e sem coordenação deixa a
  pessoa num sistema vazio — a gaveta avisa e o salvar espera a área (o banco
  recusa com 23514).
*/

function ComoAPessoaVe({
  estado,
  usuario,
  matriz,
  rascunho,
  secoesDeConfiguracao,
}) {
  const [salvo, setSalvo] = useState(null);
  const [erro, setErro] = useState("");
  // Relê a cada carga da matriz (depois de salvar, o salvo mudou).
  useEffect(() => {
    let vivo = true;
    estado
      .lerContextoDoUsuario(usuario.id)
      .then((dados) => {
        if (!vivo) return;
        setErro(""); // a falha de uma leitura anterior não fica na tela
        setSalvo(dados);
      })
      .catch((falha) => vivo && setErro(falha?.message || "Tente novamente."));
    return () => {
      vivo = false;
    };
  }, [estado, usuario.id, matriz]);

  if (erro)
    return (
      <p className="acessos-erro">
        <Icone nome="circle-alert" tamanho={14} /> Não foi possível ler o acesso
        salvo.
      </p>
    );
  const contexto = salvo
    ? contextoDepoisDeSalvar(salvo, usuario, rascunho, matriz)
    : null;
  const perfil = contexto ? perfilDoContexto(contexto) : null;
  if (!perfil)
    return (
      <div className="acessos-carregando" aria-busy="true">
        <BlocosEsqueleto quantos={2} className="acessos-esqueleto" />
      </div>
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
  Conta de e-mail compartilhado de um setor (ex.: "COET – …") não é uma
  pessoa: vira coordenação (com o nome da conta) e a conta é DESATIVADA. A
  confirmação diz isso com todas as letras e pede CONFIRMAR (ou o e-mail) e
  motivo antes de liberar o botão.
*/
function TransformarEmCoordenacao({ estado, usuario, areas }) {
  const [aberto, setAberto] = useState(false);
  const [area, setArea] = useState(areas[0]?.id || "");
  const [confirmacao, setConfirmacao] = useState("");
  const [motivo, setMotivo] = useState("");
  const tituloDaArea = areas.find((a) => a.id === area)?.titulo || area;
  const pronto =
    Boolean(area) &&
    confirmacaoDeTransformarValida(confirmacao, usuario) &&
    motivoValido(motivo);
  if (!aberto)
    return (
      <div className="acessos-conta-de-setor">
        <button
          type="button"
          className="btn ghost perigo"
          onClick={() => setAberto(true)}
        >
          Transformar em coordenação
        </button>
      </div>
    );
  return (
    <form
      className="acessos-mover acessos-conta-de-setor"
      aria-label="Transformar a conta em coordenação"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (pronto)
          void estado.moverParaCoordenacoes(usuario, area, motivo.trim());
      }}
    >
      <Campo rotulo="Área da coordenação">
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
      </Campo>
      <Aviso tom="danger" papel="alert" como="p">
        {avisoDeTransformarEmCoordenacao(usuario, tituloDaArea)}
      </Aviso>
      <Campo
        rotulo={`Para confirmar, digite ${PALAVRA_DE_CONFIRMACAO} ou o e-mail da conta`}
      >
        <input
          id="acessosMoverConfirmacao"
          value={confirmacao}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setConfirmacao(e.target.value)}
          placeholder={PALAVRA_DE_CONFIRMACAO}
        />
      </Campo>
      <Campo rotulo="Motivo">
        <input
          id="acessosMoverMotivo"
          value={motivo}
          maxLength={500}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </Campo>
      <div className="ui-acoes">
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setAberto(false);
            setConfirmacao("");
          }}
        >
          Cancelar
        </button>
        <BotaoDeAcao
          estado={estado}
          acao={`mover:${usuario.id}`}
          type="submit"
          className="btn outline perigo"
          disabled={!pronto}
        >
          Desativar a conta e criar a coordenação
        </BotaoDeAcao>
      </div>
    </form>
  );
}

/*
  Quem foi cadastrado e nunca entrou: reenviar a mensagem do convite ou
  cancelar (desativa o cadastro, com motivo, pela mesma RPC de desativar).
*/
/*
  Desativar (ou cancelar o convite, a mesma RPC): o motivo é obrigatório — vai
  para o histórico e aparece na aba "Desativadas", de onde dá para reativar.
*/
function ConfirmarDesativacao({
  estado,
  usuario,
  id,
  texto,
  rotulo,
  convite = false,
  aoVoltar,
}) {
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  return (
    <form
      className="acessos-mover"
      aria-label={rotulo}
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        setTentou(true);
        if (motivoValido(motivo))
          void estado.desativarUsuario(usuario, motivo.trim(), { convite });
      }}
    >
      <p>{texto}</p>
      <CampoMotivo
        id={id}
        rotulo={convite ? "Motivo do cancelamento" : "Motivo da desativação"}
        valor={motivo}
        aoMudar={setMotivo}
        erro={tentou && !motivoValido(motivo)}
      />
      <div className="ui-acoes">
        <button type="button" className="btn ghost" onClick={aoVoltar}>
          Voltar
        </button>
        <BotaoDeAcao
          estado={estado}
          acao={`desativar:${usuario.id}`}
          type="submit"
          className="btn outline perigo"
          disabled={!motivoValido(motivo)}
        >
          {rotulo}
        </BotaoDeAcao>
      </div>
    </form>
  );
}

function Convite({ estado, usuario, podeCancelar }) {
  const [cancelando, setCancelando] = useState(false);
  const nome = usuario.nome || usuario.email;
  const desde = dataCurta(usuario.cadastrado_em);
  return (
    <section aria-labelledby="acessosGavetaConvite">
      <h4 id="acessosGavetaConvite">Convite</h4>
      <p>
        <Selo tom="pendente" className="acessos-selo-convite">
          Convidado · ainda não entrou
        </Selo>
        {desde ? (
          <span className="acessos-secundario"> Cadastrado em {desde}.</span>
        ) : null}
      </p>
      <details className="acessos-reenviar">
        <summary>Reenviar convite</summary>
        <AcoesDoConvite nome={usuario.nome} email={usuario.email} />
      </details>
      {!podeCancelar ? null : cancelando ? (
        <ConfirmarDesativacao
          estado={estado}
          usuario={usuario}
          id="acessosCancelarConviteMotivo"
          texto={`O cadastro de ${nome} é desativado e o e-mail deixa de entrar.`}
          rotulo="Cancelar convite"
          convite
          aoVoltar={() => setCancelando(false)}
        />
      ) : (
        <div className="ui-acoes">
          <button
            type="button"
            className="btn ghost perigo"
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
          <li
            key={modulo.id}
            className={classes(
              celula.individual && "acessos-modulo-individual",
            )}
          >
            <div>
              <strong>{modulo.rotulo}</strong>
              <small>
                {celula.individual
                  ? `Individual · no grupo: ${rotuloDoNivel(celula.nivelGrupo, modulo.id)}`
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

/*
  "Salvar" da gaveta: o que mudou nesta pessoa, com o motivo ali mesmo. Grava
  só esta pessoa (o que foi mudado em outras linhas segue pendente na página).
*/
function SalvarNaGaveta({ estado, usuario, rascunho, matriz, semArea }) {
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const { daPessoa } = separarRascunhoDaPessoa(rascunho, usuario.id);
  const itens =
    resumoDoRascunho(daPessoa, {
      grupos: matriz.grupos,
      coordenacoes: matriz.coordenacoes,
    })[0]?.itens || [];
  return (
    <form
      className="ui-barra-de-salvar acessos-salvar acessos-salvar-gaveta"
      aria-label={`Salvar alterações de ${usuario.nome || usuario.email}`}
      onSubmit={(evento) => {
        evento.preventDefault();
        setTentou(true);
        if (!motivoValido(motivo) || semArea) return;
        void estado
          .salvar(motivo, { usuarioId: usuario.id })
          .then((ok) => ok && (setMotivo(""), setTentou(false)));
      }}
    >
      <details>
        <summary>
          {itens.length}{" "}
          {itens.length === 1 ? "alteração pendente" : "alterações pendentes"}
        </summary>
        <ul>
          {itens.map((item, indice) => (
            <li key={indice}>
              {item.rotulo}: {item.de} → {item.para}
            </li>
          ))}
        </ul>
      </details>
      <CampoMotivo
        id="acessosGavetaMotivo"
        valor={motivo}
        aoMudar={setMotivo}
        erro={tentou && !motivoValido(motivo)}
      />
      <div className="ui-acoes">
        <button
          type="button"
          className="btn ghost"
          onClick={() => estado.descartarDaPessoa(usuario.id)}
        >
          Descartar
        </button>
        <BotaoDeAcao
          estado={estado}
          acao="salvar"
          type="submit"
          className="btn primary"
          disabled={semArea}
        >
          Salvar
        </BotaoDeAcao>
      </div>
    </form>
  );
}

export function GavetaDoUsuario({ estado, secoesDeConfiguracao = [] }) {
  const atual = useSyncExternalStore(estado.assinar, estado.obter);
  const [desativando, setDesativando] = useState(false);
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
  // Própria conta: podeEditarUsuario já trava (e esconde as ações do rodapé).
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
  // Nível em "acessos" no rascunho: exceção da pessoa ou, sem ela, o do grupo escolhido.
  const excecaoAcessos = celulaExibida(usuario, "acessos", rascunho);
  const nivelAcessos =
    excecaoAcessos?.origem === "excecao"
      ? excecaoAcessos.nivel
      : grupo?.niveis?.acessos || excecaoAcessos?.nivel;
  const semCoordenacao =
    usuario.ativo !== false &&
    gerenciariaAcessosSemCoordenacao({
      adminGlobal,
      coordenacao,
      nivelAcessos,
    });
  const nome = usuario.nome || usuario.email;
  const pendentes = pendenciasDoUsuario(rascunho, usuario.id);
  const adminPodeAgir = Boolean(teto.admin_global && edicao.pode);
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
        avatar={nome}
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

        <div className="acessos-gaveta-colunas">
          <div className="acessos-gaveta-coluna">
            <section aria-labelledby="acessosGavetaGrupo">
              <h4 id="acessosGavetaGrupo">Grupo</h4>
              <select
                aria-label={`Grupo de ${nome}`}
                title={explicacaoDoGrupo(grupo) || undefined}
                value={codigoDoGrupo || ""}
                disabled={!edicao.pode}
                className={classes(
                  codigoDoGrupo !== usuario.grupo && "acessos-pendente",
                )}
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
                {semCoordenacao ? <AvisoSemCoordenacao /> : null}
              </section>
            ) : null}

            <section aria-labelledby="acessosGavetaAreas">
              <h4 id="acessosGavetaAreas">Áreas</h4>
              {adminGlobal ? (
                <p className="acessos-secundario">
                  Administrador global: vê todas as áreas.
                </p>
              ) : coordenacao ? (
                <p className="acessos-secundario">
                  Vê só o recorte da coordenação{" "}
                  {nomeDaCoordenacao || coordenacao}.
                </p>
              ) : (
                <CaixasDeArea
                  areas={areas}
                  marcadas={areasMarcadasDaLinha(usuario, rascunho, areas)}
                  desabilitado={!edicao.pode || !podeEditarAreas(teto)}
                  aoAlternar={(id, ligar) => alternar(`area:${id}`, ligar)}
                />
              )}
              {semArea ? <AvisoSemArea nome={nome} /> : null}
            </section>

            {usuario.convite_pendente ? (
              <Convite
                estado={estado}
                usuario={usuario}
                podeCancelar={adminPodeAgir}
              />
            ) : null}
          </div>
          <section
            className="acessos-gaveta-previa"
            aria-labelledby="acessosGavetaVe"
          >
            <h4 id="acessosGavetaVe">
              Como a pessoa vê
              {pendentes ? (
                <Selo tom="revisar" className="acessos-selo-rascunho">
                  Depois de salvar
                </Selo>
              ) : null}
            </h4>
            <ComoAPessoaVe
              estado={estado}
              usuario={usuario}
              matriz={matriz}
              rascunho={rascunho}
              secoesDeConfiguracao={secoesDeConfiguracao}
            />
          </section>
        </div>

        <details className="acessos-avancado">
          <summary>
            <Icone nome="chevron-right" tamanho={16} />
            <span>Avançado</span>
          </summary>
          <h5>Exceções por módulo</h5>
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
          {adminPodeAgir && !usuario.convite_pendente ? (
            <TransformarEmCoordenacao
              estado={estado}
              usuario={usuario}
              areas={areas}
            />
          ) : null}
        </details>
      </div>
      {edicao.pode && (pendentes || adminPodeAgir) ? (
        <div className="acessos-gaveta-rodape">
          {pendentes ? (
            <SalvarNaGaveta
              estado={estado}
              usuario={usuario}
              rascunho={rascunho}
              matriz={matriz}
              semArea={semArea || semCoordenacao}
            />
          ) : null}
          {!adminPodeAgir || usuario.convite_pendente ? null : desativando ? (
            <ConfirmarDesativacao
              estado={estado}
              usuario={usuario}
              id="acessosDesativarMotivo"
              texto={`${nome} perde o acesso agora.`}
              rotulo="Desativar acesso"
              aoVoltar={() => setDesativando(false)}
            />
          ) : (
            <BotaoDeAcao
              estado={estado}
              acao={`desativar:${usuario.id}`}
              className="btn ghost perigo"
              onClick={() => setDesativando(true)}
            >
              <Icone nome="user-x" tamanho={16} /> Desativar acesso
            </BotaoDeAcao>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
