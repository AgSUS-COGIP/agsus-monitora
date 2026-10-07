import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import {
  resumoDaVersao,
  valorParaExibir,
} from "../../lib/publicacao-de-configuracoes.js";
import {
  EVENTO_SECAO_ABERTA,
  SECOES,
  secaoAtualDeConfiguracao,
} from "./secoes.js";
import { Icone } from "../../componentes/icone.jsx";
import {
  Aviso,
  BlocosEsqueleto,
  Campo,
  classes,
  ErroAoCarregar,
  Modal,
} from "../../ui/index.js";
import { SecaoAparencia } from "./aparencia.jsx";
import { InterruptorPessoal, SecaoComemoracoes } from "./comemoracoes.tsx";
import { estadoDasConfiguracoes, SECOES_COM_SALVAR_PROPRIO } from "./estado.js";
import { criarEstadoDasMensagensDoChat } from "./estado-das-mensagens-do-chat.js";
import { criarImagensDaAparencia } from "./imagens.js";
import { SecaoMarca } from "./marca.jsx";
import { SecaoMensagensDoChat } from "./mensagens-do-chat.jsx";
import { SecaoOperacao } from "./operacao.jsx";
import { SecaoPaginaInicial } from "./pagina-inicial.jsx";
import { SecaoPaineisExternos } from "./paineis-externos.jsx";
import { SecaoTelaDeAcesso } from "./tela-de-acesso.jsx";

/*
  A moldura de Configurações em React, a mesma para todas as seções:

    Cabeçalho       ícone, nome e descrição da seção aberta (o mesmo ícone do
                    menu lateral), o aviso de alteração não salva e o resumo
                    da validação
    Barra fixa      situação e "Salvar alterações" (e o Ctrl+S, no estado);
                    some em Acessos e em Módulos e abas, que salvam sozinhas
    Diálogos        corrigir, nada a publicar, revisar e publicar com motivo,
                    restaurar uma versão
    Histórico       publicações auditadas, na seção Operação

  As seções (Marca, Página inicial, Tela de acesso, Aparência, Painéis
  externos, Operação e Comemorações) entram por portal no corpo da própria seção
  (`.config-secao__corpo`, criado por secoes.js). O estado é de
  `estado.js`; as imagens da Aparência, de `imagens.js`. Mensagens (chat),
  só do administrador global, também entra por portal, mas salva sozinha
  (`estado-das-mensagens-do-chat.js`; a barra fixa some nela).
*/

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function usarEstado(estado) {
  return useSyncExternalStore(estado.assinar, estado.obter);
}

const secaoPorId = (id) => SECOES.find((secao) => secao.id === id) || SECOES[0];

// ── Cabeçalho ──────────────────────────────────────────────────────────────

function Cabecalho({ estado }) {
  const atual = usarEstado(estado);
  const secao = secaoPorId(atual.secao);
  const comSalvar = !SECOES_COM_SALVAR_PROPRIO.includes(secao.id);
  const erros = atual.errosDaValidacao;
  return (
    <header
      className="config-cabecalho"
      data-secao={secao.id}
      data-tour="config-cabecalho"
    >
      <div className="config-cabecalho__linha">
        <span className="config-cabecalho__icone" aria-hidden="true">
          <Icone nome={secao.iconeDoMenu} tamanho={18} />
        </span>
        <div className="config-cabecalho__texto">
          <h2>{secao.rotulo}</h2>
        </div>
        {/* Comemorações: a preferência deste navegador fica no título. */}
        {secao.id === "comemoracoes" ? <InterruptorPessoal /> : null}
        {comSalvar && estado.temAlteracoes() ? (
          <span className="config-cabecalho__pendente">
            <span className="config-cabecalho__ponto" aria-hidden="true" />
            Alterações não salvas
          </span>
        ) : null}
      </div>
      {comSalvar && erros.length ? (
        <Aviso tom="danger" papel="alert" className="config-validation-summary">
          <strong>
            Revise {plural(erros.length, "campo", "campos")} antes de salvar.
          </strong>
          <ul>
            {erros.map((mensagem) => (
              <li key={mensagem}>{mensagem}</li>
            ))}
          </ul>
        </Aviso>
      ) : null}
    </header>
  );
}

// ── Barra fixa ─────────────────────────────────────────────────────────────

function situacaoDaBarra(atual, alterado) {
  if (atual.salvando)
    return {
      tom: "salvando",
      titulo: "Preparando publicação",
      texto: "Aguarde a resposta do servidor.",
    };
  if (alterado)
    return {
      tom: "alterado",
      titulo: "Existem alterações não salvas",
      texto: "Revise os campos e salve antes de sair desta página.",
    };
  return {
    tom: "limpo",
    titulo: "Nenhuma alteração pendente",
  };
}

function BarraDeSalvar({ estado }) {
  const atual = usarEstado(estado);
  if (SECOES_COM_SALVAR_PROPRIO.includes(atual.secao)) return null;
  const alterado = estado.temAlteracoes();
  const situacao = situacaoDaBarra(atual, alterado);
  return (
    <div className="config-barra" aria-live="polite" data-tour="config-barra">
      <div className="config-barra__situacao">
        <span
          className={`config-barra__icone config-barra__icone--${situacao.tom}`}
          aria-hidden="true"
        >
          {situacao.tom === "salvando" ? (
            <span className="botao-girando" />
          ) : (
            <Icone
              nome={situacao.tom === "alterado" ? "pencil" : "circle-check"}
              tamanho={18}
            />
          )}
        </span>
        <div className="config-barra__texto">
          <strong>{situacao.titulo}</strong>
          {situacao.texto ? <span>{situacao.texto}</span> : null}
        </div>
      </div>
      <div className="config-barra__acoes">
        <span className="config-barra__atalho" aria-hidden="true">
          <kbd>Ctrl</kbd> + <kbd>S</kbd>
        </span>
        <button
          type="button"
          className="btn green config-barra__salvar"
          data-tour="config-publicar"
          disabled={!alterado || atual.salvando}
          aria-busy={atual.salvando || undefined}
          onClick={() => void estado.revisar()}
        >
          {atual.salvando ? (
            <span className="botao-girando" aria-hidden="true" />
          ) : (
            <Icone nome="save" tamanho={16} />
          )}
          <span>{atual.salvando ? "Publicando..." : "Salvar alterações"}</span>
        </button>
      </div>
    </div>
  );
}

// ── Diálogos ───────────────────────────────────────────────────────────────

function ListaDeAlteracoes({ alteracoes }) {
  return (
    <div className="config-change-list">
      {alteracoes.map((alteracao, indice) => (
        <div className="config-change-row" key={indice}>
          <div className="config-change-name">
            <span>{alteracao.entity}</span>
            <strong>{alteracao.label}</strong>
            <small>{alteracao.field}</small>
          </div>
          <div className="config-change-value is-before">
            <span>Antes</span>
            <code>{valorParaExibir(alteracao.before)}</code>
          </div>
          <span className="config-change-arrow" aria-hidden="true">
            <Icone nome="arrow-right" tamanho={16} />
          </span>
          <div className="config-change-value is-after">
            <span>Depois</span>
            <code>{valorParaExibir(alteracao.after)}</code>
          </div>
        </div>
      ))}
    </div>
  );
}

function Alerta({ titulo, detalhe, tom = "danger", children }) {
  return (
    <Aviso tom={tom} papel="alert" className="config-alerta">
      <strong>{titulo}</strong>
      {detalhe ? <span>{detalhe}</span> : null}
      {children}
    </Aviso>
  );
}

/* O motivo vai para o histórico: obrigatório para publicar e restaurar. */
function CampoDoMotivo({ id, rotulo, placeholder, valor, invalido, aoMudar }) {
  return (
    <div className="config-motivo">
      <Campo
        rotulo={rotulo}
        obrigatorio
        largo
        erro={invalido ? "Informe o motivo." : undefined}
      >
        <textarea
          id={id}
          rows={3}
          maxLength={500}
          placeholder={placeholder}
          value={valor}
          className={invalido ? "config-field-invalid" : undefined}
          data-foco-inicial
          onChange={(evento) => aoMudar(evento.target.value)}
        />
      </Campo>
    </div>
  );
}

function Dialogo({ estado, titulo, children, rodape }) {
  return (
    <Modal
      id="configGovernanceModal"
      rotuloId="configGovernanceTitle"
      className="config-publicacao"
      cartaoClassName="config-governance-dialog"
      aoFechar={estado.fecharModal}
      fecharAoClicarFora={false}
    >
      <header>
        <div>
          <h2 id="configGovernanceTitle">{titulo}</h2>
        </div>
        <button
          type="button"
          className="btn icon outline"
          aria-label="Fechar"
          title="Fechar"
          onClick={estado.fecharModal}
        >
          <Icone nome="x" tamanho={16} />
        </button>
      </header>
      <div className="config-governance-body">{children}</div>
      <footer className="config-governance-footer">{rodape}</footer>
    </Modal>
  );
}

const BotaoFechar = ({ estado, children = "Fechar" }) => (
  <button type="button" className="btn secondary" onClick={estado.fecharModal}>
    {children}
  </button>
);

function DialogoDeRevisao({ estado, modal }) {
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const total = modal.alteracoes.length;
  const publicar = () => {
    setTentou(true);
    if (motivo.trim()) void estado.confirmarPublicacao(motivo);
  };
  return (
    <Dialogo
      estado={estado}
      titulo="Revisar publicação"
      rodape={
        <>
          <BotaoFechar estado={estado}>Cancelar</BotaoFechar>
          <button
            type="button"
            className="btn green"
            data-tour="config-publicar-confirmar"
            disabled={modal.enviando}
            aria-busy={modal.enviando || undefined}
            onClick={publicar}
          >
            {modal.enviando ? (
              <span className="botao-girando" aria-hidden="true" />
            ) : (
              <Icone nome="cloud-upload" tamanho={16} />
            )}
            {modal.enviando
              ? " Publicando..."
              : modal.erro
                ? " Tentar novamente"
                : ` Publicar ${total} alteração(ões)`}
          </button>
        </>
      }
    >
      {modal.erro ? (
        <Alerta titulo="Não foi possível publicar." detalhe={modal.erro} />
      ) : null}
      <div className="config-governance-summary">
        <strong>
          {plural(total, "alteração encontrada", "alterações encontradas")}
        </strong>
      </div>
      <ListaDeAlteracoes alteracoes={modal.alteracoes} />
      <CampoDoMotivo
        id="configPublishReason"
        rotulo="Motivo da alteração"
        placeholder="Ex.: ajuste de rótulos"
        valor={motivo}
        invalido={tentou && !motivo.trim()}
        aoMudar={setMotivo}
      />
    </Dialogo>
  );
}

function DialogoDeRestauracao({ estado, modal }) {
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const restaurar = () => {
    setTentou(true);
    if (motivo.trim()) void estado.confirmarRestauracao(motivo);
  };
  const excedente = modal.alteracoes.length - 20;
  return (
    <Dialogo
      estado={estado}
      titulo="Restaurar versão"
      rodape={
        <>
          <BotaoFechar estado={estado}>Cancelar</BotaoFechar>
          <button
            type="button"
            className="btn danger"
            disabled={modal.enviando}
            aria-busy={modal.enviando || undefined}
            onClick={restaurar}
          >
            {modal.enviando ? (
              <span className="botao-girando" aria-hidden="true" />
            ) : (
              <Icone nome="rotate-ccw" tamanho={16} />
            )}
            {modal.enviando
              ? " Restaurando..."
              : modal.erro
                ? " Tentar novamente"
                : " Restaurar versão"}
          </button>
        </>
      }
    >
      {modal.erro ? (
        <Alerta titulo="Não foi possível restaurar." detalhe={modal.erro} />
      ) : null}
      <Alerta
        tom="warning"
        titulo="Esta ação publicará novamente os valores dessa versão."
      />
      <ListaDeAlteracoes alteracoes={modal.alteracoes.slice(0, 20)} />
      {excedente > 0 ? (
        <p className="config-governance-more">
          Mais {excedente} alteração(ões) fazem parte desta versão.
        </p>
      ) : null}
      <CampoDoMotivo
        id="configRestoreReason"
        rotulo="Motivo da restauração"
        placeholder="Ex.: Reverter alteração publicada incorretamente"
        valor={motivo}
        invalido={tentou && !motivo.trim()}
        aoMudar={setMotivo}
      />
    </Dialogo>
  );
}

function Dialogos({ estado }) {
  const { modal } = usarEstado(estado);
  if (!modal) return null;
  if (modal.tipo === "revisar")
    return <DialogoDeRevisao estado={estado} modal={modal} />;
  if (modal.tipo === "restaurar")
    return <DialogoDeRestauracao estado={estado} modal={modal} />;
  if (modal.tipo === "erros")
    return (
      <Dialogo
        estado={estado}
        titulo="Corrigir configurações"
        rodape={<BotaoFechar estado={estado} />}
      >
        <Alerta titulo="Não foi possível publicar.">
          <ul>
            {modal.mensagens.map((mensagem) => (
              <li key={mensagem}>{mensagem}</li>
            ))}
          </ul>
        </Alerta>
      </Dialogo>
    );
  if (modal.tipo === "vazio")
    return (
      <Dialogo
        estado={estado}
        titulo="Nenhuma alteração"
        rodape={<BotaoFechar estado={estado} />}
      >
        <div className="config-governance-empty">
          <Icone nome="circle-check" tamanho={28} />
          <strong>Nada para publicar.</strong>
        </div>
      </Dialogo>
    );
  return (
    <Dialogo
      estado={estado}
      titulo={modal.titulo}
      rodape={<BotaoFechar estado={estado} />}
    >
      <Alerta titulo="Nada foi publicado." detalhe={modal.detalhe} />
      <p>As alterações continuam na tela. Tente salvar de novo.</p>
    </Dialogo>
  );
}

// ── Histórico (seção Operação) ─────────────────────────────────────────────

function dataDaVersao(item) {
  const data = item.created_at ? new Date(item.created_at) : null;
  return data && !Number.isNaN(data.getTime())
    ? data.toLocaleString("pt-BR")
    : "Data não informada";
}

function Historico({ estado }) {
  const { historico, secao } = usarEstado(estado);
  useEffect(() => {
    if (secao === "operacao") void estado.carregarHistorico();
  }, [estado, secao]);
  const carregando = historico.status === "loading";
  return (
    <section
      id="configHistoryCard"
      data-tour="config-operacao-historico"
      className="config-historico"
      aria-labelledby="configHistoryTitle"
    >
      <div className="config-card-title">
        <div>
          <h3 id="configHistoryTitle">Histórico de configurações</h3>
        </div>
        <button
          type="button"
          className="btn secondary"
          disabled={carregando}
          aria-busy={carregando || undefined}
          onClick={() => void estado.carregarHistorico(true)}
        >
          {carregando ? (
            <span className="botao-girando" aria-hidden="true" />
          ) : (
            <Icone nome="refresh-cw" tamanho={16} />
          )}{" "}
          Atualizar
        </button>
      </div>
      <CorpoDoHistorico estado={estado} historico={historico} />
    </section>
  );
}

function CorpoDoHistorico({ estado, historico }) {
  if (historico.status === "error")
    return (
      <ErroAoCarregar
        oQue="o histórico"
        mensagem={historico.erro}
        aoTentar={() => void estado.carregarHistorico(true)}
      />
    );
  if (historico.status !== "ready" && !historico.itens.length)
    return (
      <div className="config-history-list" aria-busy="true">
        <BlocosEsqueleto quantos={3} className="config-history-esqueleto" />
      </div>
    );
  if (!historico.itens.length)
    return (
      <div className="config-history-empty">
        <Icone nome="history" tamanho={22} />
        <strong>Nenhuma publicação auditada ainda.</strong>
      </div>
    );
  return (
    <div className="config-history-list">
      {historico.itens.map((item) => {
        const restauracao = item.acao === "restaurar";
        return (
          <article className="config-history-item" key={item.id}>
            <div
              className={classes(
                "config-history-icon",
                `is-${item.acao || "salvar"}`,
              )}
              aria-hidden="true"
            >
              <Icone
                nome={restauracao ? "history" : "cloud-upload"}
                tamanho={16}
              />
            </div>
            <div className="config-history-main">
              <div className="config-history-head">
                <strong>{restauracao ? "Restauração" : "Publicação"}</strong>
                <span>{dataDaVersao(item)}</span>
              </div>
              <p>{item.motivo || "Sem motivo informado"}</p>
              <small>{resumoDaVersao(item.alteracoes)}</small>
              <div className="config-history-meta">
                <span>
                  <Icone nome="user-round" tamanho={12} />{" "}
                  {item.created_by_email || "Usuário não identificado"}
                </span>
                <span>{Number(item.total_alteracoes || 0)} alteração(ões)</span>
              </div>
            </div>
            <button
              type="button"
              className="btn secondary config-history-restore"
              onClick={() => estado.abrirRestauracao(item.id)}
            >
              <Icone nome="rotate-ccw" tamanho={16} /> Restaurar
            </button>
          </article>
        );
      })}
    </div>
  );
}

// ── Montagem ───────────────────────────────────────────────────────────────

/* Seção → componente que entra por portal no corpo dela. */
const SECOES_NO_PORTAL = Object.freeze([
  ["marca", SecaoMarca],
  ["inicio", SecaoPaginaInicial],
  ["acesso", SecaoTelaDeAcesso],
  ["aparencia", SecaoAparencia],
  ["recursos", SecaoPaineisExternos],
  ["comemoracoes", SecaoComemoracoes],
]);

function Configuracoes({ estado, imagens, mensagensDoChat, alvos }) {
  return (
    <>
      <Cabecalho estado={estado} />
      <BarraDeSalvar estado={estado} />
      <Dialogos estado={estado} />
      {SECOES_NO_PORTAL.map(([secao, Secao]) =>
        alvos[secao]
          ? createPortal(
              <Secao estado={estado} imagens={imagens} />,
              alvos[secao],
              secao,
            )
          : null,
      )}
      {alvos.operacao
        ? createPortal(
            <>
              <SecaoOperacao estado={estado} />
              <Historico estado={estado} />
            </>,
            alvos.operacao,
          )
        : null}
      {alvos.mensagens && mensagensDoChat
        ? createPortal(
            <SecaoMensagensDoChat
              estado={mensagensDoChat}
              configuracoes={estado}
            />,
            alvos.mensagens,
          )
        : null}
    </>
  );
}

const corpoDaSecao = (pagina, secao) =>
  pagina.querySelector(
    `.config-secao[data-secao="${secao}"] .config-secao__corpo`,
  );

/*
  Chamada em src/main.js depois de `organizarConfiguracoesEmSecoes`, que cria
  o corpo de cada seção (os alvos dos portais).
*/
export function montarConfiguracoes({
  documento = document,
  estado = estadoDasConfiguracoes,
  imagens = criarImagensDaAparencia({
    supabase: getSupabaseClient,
    configuracoes: estado,
    documento,
  }),
  mensagensDoChat = criarEstadoDasMensagensDoChat({
    supabase: getSupabaseClient,
  }),
} = {}) {
  const pagina = documento.getElementById("page-config");
  const raizDaTela = documento.getElementById("configuracoesApp");
  if (!pagina || !raizDaTela) return null;

  estado.instalar(pagina);
  estado.definirSecao(secaoAtualDeConfiguracao(documento));
  documento.addEventListener(EVENTO_SECAO_ABERTA, (evento) =>
    estado.definirSecao(evento.detail?.secao),
  );

  const { raiz } = montarModulo(
    raizDaTela,
    <Configuracoes
      estado={estado}
      imagens={imagens}
      mensagensDoChat={mensagensDoChat}
      alvos={Object.fromEntries(
        [
          ...SECOES_NO_PORTAL.map(([secao]) => secao),
          "operacao",
          "mensagens",
        ].map((secao) => [secao, corpoDaSecao(pagina, secao)]),
      )}
    />,
    { nome: "Configurações" },
  );
  return { estado, imagens, mensagensDoChat, raiz };
}
