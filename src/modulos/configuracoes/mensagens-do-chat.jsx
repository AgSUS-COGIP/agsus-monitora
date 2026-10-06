import { useEffect, useState, useSyncExternalStore } from "react";
import { Icone } from "../../componentes/icone.jsx";
import { formatDateBR, formatNumberBR } from "../../lib/formatters.js";
import {
  contagensDaLimpeza,
  ESCOLHAS_DE_PRAZO,
  escolhaDoPrazo,
  MOTIVO_MAXIMO,
  OUTRO,
  oQueOZerarApaga,
  PALAVRA_DE_CONFIRMACAO,
  PRAZO_MAXIMO,
  PRAZO_MINIMO,
  quantasApagaria,
  rotuloDaLimpeza,
  rotuloDoPrazo,
  textoDaConfirmacaoDoPrazo,
  validarMotivo,
  validarPrazo,
  validarZerar,
} from "../../lib/retencao-do-chat.js";
import {
  Aviso,
  BlocosEsqueleto,
  Campo,
  classes,
  ErroAoCarregar,
  GradeDeKpis,
  Kpi,
  Modal,
} from "../../ui/index.js";
import { Grupo } from "./partes.jsx";

/*
  Configurações › Mensagens (chat), só o administrador global: os números de
  hoje, o prazo de retenção (guardar para sempre ou N dias; salvar um prazo
  que apaga mensagens pergunta antes), o "Zerar mensagens" (digitar ZERAR e
  o motivo) e o histórico das limpezas. Estado em
  `estado-das-mensagens-do-chat.js`; regras em src/lib/retencao-do-chat.js.
  A seção lê de novo a cada vez que é aberta. Explicações: docs/aya
  (regras-do-chat.md).
*/

const usar = (estado) => useSyncExternalStore(estado.assinar, estado.obter);

function dataHora(valor) {
  if (!valor) return "—";
  return valor.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function CampoDoMotivo({ id, valor, erro, aoMudar }) {
  return (
    <Campo rotulo="Motivo" obrigatorio largo erro={erro}>
      <textarea
        id={id}
        rows={2}
        maxLength={MOTIVO_MAXIMO}
        value={valor}
        className={erro ? "config-field-invalid" : undefined}
        onChange={(evento) => aoMudar(evento.target.value)}
      />
    </Campo>
  );
}

function Numeros({ dados }) {
  return (
    <GradeDeKpis rotulo="Mensagens guardadas" className="config-chat-numeros">
      <Kpi
        chave="mensagens"
        tom="info"
        icone="fa-comments"
        rotulo="Mensagens"
        valor={formatNumberBR(dados.mensagens)}
      />
      <Kpi
        chave="reacoes"
        tom="destaque"
        icone="fa-face-smile"
        rotulo="Reações"
        valor={formatNumberBR(dados.reacoes)}
      />
      <Kpi
        chave="conversas"
        tom="neutro"
        icone="fa-users"
        rotulo="Conversas"
        valor={formatNumberBR(dados.conversas)}
      />
      <Kpi
        chave="mais-antiga"
        tom="alerta"
        icone="fa-calendar"
        rotulo="Mensagem mais antiga"
        valor={formatDateBR(dados.maisAntiga, "—")}
      />
    </GradeDeKpis>
  );
}

function DialogoDeConfirmacao({ titulo, children, rodape, aoFechar }) {
  return (
    <Modal
      rotuloId="configChatConfirmacaoTitulo"
      className="config-publicacao"
      cartaoClassName="config-governance-dialog"
      aoFechar={aoFechar}
      fecharAoClicarFora={false}
    >
      <header>
        <div>
          <h2 id="configChatConfirmacaoTitulo">{titulo}</h2>
        </div>
        <button
          type="button"
          className="btn icon outline"
          aria-label="Fechar"
          title="Fechar"
          onClick={aoFechar}
        >
          <Icone nome="x" tamanho={16} />
        </button>
      </header>
      <div className="config-governance-body">{children}</div>
      <footer className="config-governance-footer">{rodape}</footer>
    </Modal>
  );
}

function Prazo({ estado, atual }) {
  const { dados } = atual;
  const [escolha, setEscolha] = useState(() => escolhaDoPrazo(dados.dias));
  const [livre, setLivre] = useState(() =>
    escolhaDoPrazo(dados.dias) === OUTRO ? String(dados.dias) : "",
  );
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const prazo = validarPrazo(escolha, livre);
  const conferido = validarMotivo(motivo);
  const apagaria = prazo.ok ? quantasApagaria(dados.idades, prazo.dias) : 0;
  const confirmacao = prazo.ok
    ? textoDaConfirmacaoDoPrazo(prazo.dias, apagaria)
    : null;
  const igual = prazo.ok && prazo.dias === dados.dias;
  const salvando = atual.acao === "prazo";

  async function salvar() {
    setConfirmando(false);
    if (await estado.salvarPrazo(prazo.dias, conferido.motivo)) {
      setMotivo("");
      setTentou(false);
    }
  }
  function pedirSalvar() {
    setTentou(true);
    if (!prazo.ok || !conferido.ok) return;
    if (confirmacao) setConfirmando(true);
    else void salvar();
  }

  return (
    <Grupo
      secao="mensagens"
      id="prazo"
      titulo="Prazo de retenção"
      icone="history"
      tom="azul"
    >
      <p className="config-chat-em-vigor ui-campo-largo">
        Em vigor: <strong>{rotuloDoPrazo(dados.dias)}</strong>
        {dados.atualizadoEm
          ? ` · ${dados.atualizadoPor || "administrador"}, ${dataHora(dados.atualizadoEm)}`
          : ""}
      </p>
      <Campo rotulo="Guardar as mensagens por">
        <select
          id="configChatPrazo"
          value={escolha}
          onChange={(evento) => setEscolha(evento.target.value)}
        >
          {ESCOLHAS_DE_PRAZO.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
      </Campo>
      {escolha === OUTRO ? (
        <Campo
          rotulo={`Dias (${PRAZO_MINIMO} a ${formatNumberBR(PRAZO_MAXIMO)})`}
          obrigatorio
          erro={tentou || livre ? prazo.erro || undefined : undefined}
        >
          <input
            id="configChatPrazoDias"
            type="number"
            inputMode="numeric"
            min={PRAZO_MINIMO}
            max={PRAZO_MAXIMO}
            step={1}
            value={livre}
            onChange={(evento) => setLivre(evento.target.value)}
          />
        </Campo>
      ) : null}
      {prazo.ok && prazo.dias !== null ? (
        <p
          className={classes(
            "config-chat-previsao ui-campo-largo",
            apagaria > 0 && "is-apaga",
          )}
          role="status"
          data-previsao
        >
          {apagaria > 0
            ? `${formatNumberBR(apagaria)} ${apagaria === 1 ? "mensagem será apagada" : "mensagens serão apagadas"} ao salvar.`
            : "Nenhuma mensagem passa deste prazo hoje."}
        </p>
      ) : null}
      <CampoDoMotivo
        id="configChatMotivoPrazo"
        valor={motivo}
        erro={tentou && !conferido.ok ? conferido.erro : undefined}
        aoMudar={setMotivo}
      />
      <div className="config-chat-acoes ui-campo-largo">
        <button
          type="button"
          className="btn green"
          data-tour="config-mensagens-salvar-prazo"
          disabled={salvando || igual || Boolean(atual.acao)}
          aria-busy={salvando || undefined}
          onClick={pedirSalvar}
        >
          {salvando ? (
            <span className="botao-girando" aria-hidden="true" />
          ) : (
            <Icone nome="save" tamanho={16} />
          )}
          {salvando ? " Salvando..." : " Salvar prazo"}
        </button>
      </div>
      {confirmando ? (
        <DialogoDeConfirmacao
          titulo="Salvar o prazo de retenção"
          aoFechar={() => setConfirmando(false)}
          rodape={
            <>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setConfirmando(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn danger"
                data-foco-inicial
                onClick={() => void salvar()}
              >
                <Icone nome="trash-2" tamanho={16} /> Apagar e salvar
              </button>
            </>
          }
        >
          <Aviso tom="warning" papel="alert" className="config-alerta">
            <strong>{confirmacao}</strong>
          </Aviso>
        </DialogoDeConfirmacao>
      ) : null}
    </Grupo>
  );
}

function DialogoDeZerar({ estado, atual, incluirConversas, aoFechar }) {
  const [palavra, setPalavra] = useState("");
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const validacao = validarZerar({ confirmacao: palavra, motivo });
  const zerando = atual.acao === "zerar";

  async function zerar() {
    setTentou(true);
    if (!validacao.ok) return;
    if (
      await estado.zerar({
        confirmacao: palavra,
        motivo: validacao.motivo,
        incluirConversas,
      })
    )
      aoFechar();
  }

  return (
    <DialogoDeConfirmacao
      titulo="Zerar mensagens"
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="btn secondary" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={zerando || !validacao.ok}
            aria-busy={zerando || undefined}
            onClick={() => void zerar()}
          >
            {zerando ? (
              <span className="botao-girando" aria-hidden="true" />
            ) : (
              <Icone nome="trash-2" tamanho={16} />
            )}
            {zerando ? " Zerando..." : " Zerar mensagens"}
          </button>
        </>
      }
    >
      {atual.acaoComErro === "zerar" ? (
        <Aviso tom="danger" papel="alert" className="config-alerta">
          <strong>Nada foi apagado.</strong> <span>{atual.erroDaAcao}</span>
        </Aviso>
      ) : null}
      <Aviso tom="warning" className="config-alerta">
        <strong>Isto apaga, sem volta:</strong>
        <ul className="config-chat-lista">
          {oQueOZerarApaga(atual.dados, incluirConversas).map((linha) => (
            <li key={linha}>{linha}</li>
          ))}
        </ul>
      </Aviso>
      <div className="ui-grade-de-campos">
        <Campo
          rotulo={`Digite ${PALAVRA_DE_CONFIRMACAO}`}
          obrigatorio
          largo
          erro={tentou ? validacao.erros.confirmacao : undefined}
        >
          <input
            id="configChatZerarPalavra"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={palavra}
            data-foco-inicial
            onChange={(evento) => setPalavra(evento.target.value)}
          />
        </Campo>
        <CampoDoMotivo
          id="configChatMotivoZerar"
          valor={motivo}
          erro={tentou ? validacao.erros.motivo : undefined}
          aoMudar={setMotivo}
        />
      </div>
    </DialogoDeConfirmacao>
  );
}

function Zerar({ estado, atual }) {
  const [incluirConversas, setIncluirConversas] = useState(false);
  const [aberto, setAberto] = useState(false);
  const { dados } = atual;
  const vazio = !dados.mensagens && !dados.reacoes;
  return (
    <Grupo
      secao="mensagens"
      id="zerar"
      titulo="Zerar mensagens"
      icone="triangle-alert"
      tom="atencao"
    >
      <p className="config-chat-em-vigor ui-campo-largo">
        {oQueOZerarApaga(dados, incluirConversas).join(" · ")}
      </p>
      <label className="config-chat-opcao ui-campo-largo">
        <input
          type="checkbox"
          checked={incluirConversas}
          onChange={(evento) => setIncluirConversas(evento.target.checked)}
        />
        Apagar também as conversas sem participante ativo
      </label>
      <div className="config-chat-acoes ui-campo-largo">
        <button
          type="button"
          className="btn danger"
          data-tour="config-mensagens-zerar"
          disabled={
            Boolean(atual.acao) ||
            (vazio && !(incluirConversas && dados.conversasSemParticipante))
          }
          onClick={() => {
            estado.limparErroDaAcao();
            setAberto(true);
          }}
        >
          <Icone nome="trash-2" tamanho={16} /> Zerar mensagens…
        </button>
      </div>
      {aberto ? (
        <DialogoDeZerar
          estado={estado}
          atual={atual}
          incluirConversas={incluirConversas}
          aoFechar={() => setAberto(false)}
        />
      ) : null}
    </Grupo>
  );
}

function Historico({ historico }) {
  return (
    <section
      className="config-historico"
      aria-labelledby="configChatHistoricoTitulo"
      data-tour="config-mensagens-historico"
    >
      <div className="config-card-title">
        <div>
          <h3 id="configChatHistoricoTitulo">Histórico das limpezas</h3>
        </div>
      </div>
      {historico.length ? (
        <div className="config-history-list">
          {historico.map((item) => (
            <article
              className="config-history-item config-chat-limpeza"
              key={item.id}
              data-tipo={item.tipo}
            >
              <div
                className={classes(
                  "config-history-icon",
                  item.tipo === "ZERAR" && "is-zerar",
                )}
                aria-hidden="true"
              >
                <Icone
                  nome={item.tipo === "ZERAR" ? "trash-2" : "history"}
                  tamanho={16}
                />
              </div>
              <div className="config-history-main">
                <div className="config-history-head">
                  <strong>{rotuloDaLimpeza(item)}</strong>
                  <span>{dataHora(item.em)}</span>
                </div>
                {item.motivo ? <p>{item.motivo}</p> : null}
                <div className="config-history-meta">
                  <span>{contagensDaLimpeza(item)}</span>
                  <span>
                    <Icone nome="user-round" tamanho={12} />{" "}
                    {item.origem === "AGENDA"
                      ? "Tarefa diária"
                      : item.quem || "Usuário não identificado"}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="config-history-empty">
          <Icone nome="history" tamanho={22} />
          <strong>Nenhuma limpeza ainda.</strong>
        </div>
      )}
    </section>
  );
}

export function SecaoMensagensDoChat({ estado, configuracoes }) {
  const atual = usar(estado);
  const { secao } = usar(configuracoes);
  useEffect(() => {
    if (secao === "mensagens") void estado.carregar();
  }, [estado, secao]);

  if (atual.status === "error" && !atual.dados)
    return (
      <div className="config-secao-react">
        <ErroAoCarregar
          oQue="as mensagens do chat"
          mensagem={atual.erro}
          aoTentar={() => void estado.carregar()}
        />
      </div>
    );
  if (!atual.dados)
    return (
      <div className="config-secao-react" aria-busy="true">
        <BlocosEsqueleto quantos={3} className="config-history-esqueleto" />
      </div>
    );

  return (
    <div
      className="config-secao-react config-chat"
      data-tour="config-mensagens"
    >
      <div className="config-secao-react__campos">
        <Numeros dados={atual.dados} />
        {atual.aviso ? (
          <Aviso tom="info" papel="status" className="config-alerta">
            {atual.aviso}
          </Aviso>
        ) : null}
        {atual.acaoComErro === "prazo" ? (
          <Aviso tom="danger" papel="alert" className="config-alerta">
            {atual.erroDaAcao}
          </Aviso>
        ) : null}
        <Prazo key={`${atual.dados.dias}`} estado={estado} atual={atual} />
        <Zerar estado={estado} atual={atual} />
      </div>
      <Historico historico={atual.dados.historico} />
    </div>
  );
}
