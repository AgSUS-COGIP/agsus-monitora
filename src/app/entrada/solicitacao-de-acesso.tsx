import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { Abas, Aviso, Campo, classes } from "../../ui/index.ts";
import { Mascote } from "../../modulos/aya/mascote/mascote.tsx";
import type { EstadoDaMascote } from "../../lib/estado-da-aya.ts";
import {
  AREAS_DA_SOLICITACAO,
  CARGO_OUTRO,
  JUSTIFICATIVA_MAXIMA,
  JUSTIFICATIVA_MINIMA,
  LOTACAO_MAXIMA,
  NOME_MAXIMO,
  CARGO_OUTRO_MAXIMO,
  PALAVRAS_DA_JUSTIFICATIVA,
  PERGUNTA_DA_REATIVACAO,
  areaDaSolicitacao,
  cargosDaArea,
  resumoDoPedido,
  SITUACOES,
  type CodigoDaArea,
} from "../../lib/solicitacao-de-acesso.ts";
import {
  IconeDeEscudo,
  IconeDoMonitora,
  MarcaDoGoogle,
} from "./icones-da-entrada.tsx";
import {
  coordenacoesDaArea,
  lotacoesDaArea,
  visaoDoPedido,
  type EstadoDoPedido,
  type PedidoDeAcesso,
  type VisaoDoPedido,
} from "./pedido-de-acesso.ts";

/*
  A página "Solicitação de acesso" — quem entrou com Google e não tem perfil
  ativo. Duas colunas em tela larga (a marca do MONITORA e a Aya à esquerda,
  o pedido à direita; uma só no celular): abas por área (Projetos · Saúde
  Indígena · SEDE) com os campos da área, o pedido enviado com Editar e
  Cancelar, a recusa com o motivo e a conta desativada com "Pedir
  reativação". O estado é de pedido-de-acesso.ts; as listas e textos, de
  src/lib/solicitacao-de-acesso.ts. O que a tela explica, a Aya diz no balão.

  Ids de antes (#accessRequestCard, #accessReqEmail, #accessReqNome,
  #accessReqJustificativa…) continuam: testes e tours os leem.
*/

type Sessao = {
  entrarComGoogle: () => unknown;
  limparSessao: () => unknown;
};

type Props = {
  pedido: PedidoDeAcesso;
  sessao: Sessao;
  logoUrl: string;
  slogan: string;
  instituicao: string;
};

/** O que a Aya diz no balão, pela situação (a explicação da página é dela). */
export function falaDaAya(
  visao: VisaoDoPedido,
  estado: EstadoDoPedido,
): { texto: string; humor: EstadoDaMascote | null } {
  if (visao.verificando)
    return {
      texto: "Um instante, estou conferindo seu acesso.",
      humor: "pensando",
    };
  const situacao = estado.tela.situacao;
  if (situacao === SITUACOES.LIBERADO)
    return {
      texto: "Tudo certo! Seu acesso foi aprovado.",
      humor: "comemorando",
    };
  if (visao.conteudo === "resumo")
    return {
      texto:
        "Seu pedido está com quem gerencia os acessos. Não chega e-mail: entre de novo com esta conta para ver a resposta.",
      humor: null,
    };
  if (situacao === SITUACOES.DESATIVADA && !estado.modoReativacao)
    return {
      texto:
        "Se você ainda precisa do MONITORA, peça a reativação e conte o motivo.",
      humor: null,
    };
  if (visao.reativacao)
    return {
      texto:
        "Conte por que precisa do acesso de novo. Quem gerencia os acessos decide.",
      humor: null,
    };
  if (situacao === SITUACOES.RECUSADO)
    return {
      texto:
        "Veja o motivo da recusa, corrija o que for preciso e envie de novo.",
      humor: null,
    };
  return {
    texto:
      "Escolha a aba de onde você trabalha e o seu cargo. Vai avaliar outra área? Diga na justificativa. Quem gerencia os acessos analisa e escolhe o seu grupo.",
    humor: null,
  };
}

function Logo({ url }: { url: string }) {
  const [falhou, definirFalhou] = useState(false);
  useEffect(() => definirFalhou(false), [url]);
  return (
    <img
      src={url}
      alt=""
      width="44"
      height="44"
      data-falhou={falhou || undefined}
      onError={() => definirFalhou(true)}
    />
  );
}

function Marca({
  logoUrl,
  slogan,
  instituicao,
  fala,
}: {
  logoUrl: string;
  slogan: string;
  instituicao: string;
  fala: { texto: string; humor: EstadoDaMascote | null };
}) {
  return (
    <aside className="solicitacao-marca">
      <div className="solicitacao-lockup" aria-label="AgSUS · MONITORA">
        <span className="solicitacao-organizacao">
          <Logo url={logoUrl} />
          <strong>AgSUS</strong>
        </span>
        <span className="solicitacao-divisor" aria-hidden="true" />
        <span className="solicitacao-produto">
          <IconeDoMonitora />
          <strong>MONITORA</strong>
        </span>
      </div>
      <p className="solicitacao-slogan">{slogan}</p>
      <div className="solicitacao-aya">
        <Mascote
          tamanho={96}
          estado={fala.humor}
          ouvirAya={false}
          dormir={false}
          rotulo="Aya, a assistente do MONITORA"
          className="solicitacao-aya-arara"
        />
        <p className="solicitacao-aya-fala" aria-live="polite">
          {fala.texto}
        </p>
      </div>
      <p className="solicitacao-instituicao">
        <IconeDeEscudo />
        <span>{instituicao}</span>
      </p>
    </aside>
  );
}

function Faixa({
  faixa,
  pedido,
}: {
  faixa: NonNullable<VisaoDoPedido["faixa"]>;
  pedido: PedidoDeAcesso;
}) {
  return (
    <div
      id="accessRequestStatus"
      className={classes("solicitacao-faixa", faixa.tom && `is-${faixa.tom}`)}
      role="status"
    >
      {faixa.titulo ? (
        <strong id="accessRequestStatusTitulo">{faixa.titulo}</strong>
      ) : null}
      <span id="accessRequestStatusTexto">{faixa.texto}</span>
      {faixa.entrar ? (
        <button
          id="accessRequestEnterBtn"
          type="button"
          className="btn"
          onClick={() => pedido.entrarAgora()}
        >
          Entrar agora
        </button>
      ) : null}
      {faixa.oferecerReativacao ? (
        <span id="accessRequestReativar" className="solicitacao-reativar">
          <span>{PERGUNTA_DA_REATIVACAO}</span>
          <button
            id="accessRequestReativarBtn"
            type="button"
            className="btn secondary"
            onClick={() => pedido.abrirReativacao()}
          >
            Pedir reativação
          </button>
        </span>
      ) : null}
    </div>
  );
}

function Resumo({
  estado,
  pedido,
}: {
  estado: EstadoDoPedido;
  pedido: PedidoDeAcesso;
}) {
  const [confirmando, definirConfirmando] = useState(false);
  const linhas = resumoDoPedido(estado.solicitacao);
  return (
    <div className="solicitacao-resumo-bloco">
      <dl id="accessRequestResumo" className="solicitacao-resumo">
        {linhas.map((linha) => (
          <div
            key={linha.rotulo}
            className={classes(
              linha.rotulo === "Justificativa" && "solicitacao-resumo-largo",
            )}
          >
            <dt>{linha.rotulo}</dt>
            <dd>{linha.valor}</dd>
          </div>
        ))}
      </dl>
      <div className="solicitacao-acoes">
        {confirmando ? (
          <>
            <span className="solicitacao-pergunta" role="alert">
              Cancelar o pedido?
            </span>
            <button
              type="button"
              className="btn ghost"
              onClick={() => definirConfirmando(false)}
            >
              Não
            </button>
            <button
              id="accessRequestConfirmarCancelamento"
              type="button"
              className="btn red"
              disabled={estado.cancelando}
              onClick={() => void pedido.cancelar()}
            >
              Sim, cancelar
            </button>
          </>
        ) : (
          <>
            <button
              id="accessRequestCancelarBtn"
              type="button"
              className="btn ghost perigo"
              onClick={() => definirConfirmando(true)}
            >
              Cancelar pedido
            </button>
            <button
              id="accessRequestEditarBtn"
              type="button"
              className="btn secondary"
              onClick={() => pedido.editar()}
            >
              Editar pedido
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CampoDaLotacao({
  estado,
  pedido,
  area,
}: {
  estado: EstadoDoPedido;
  pedido: PedidoDeAcesso;
  area: CodigoDaArea;
}) {
  const definicao = areaDaSolicitacao(area);
  const { campos, erros, opcoes } = estado;
  if (!definicao) return null;
  if (definicao.lotacao === "texto")
    return (
      <Campo
        rotulo={definicao.rotuloDaLotacao}
        obrigatorio
        erro={erros.lotacao}
      >
        <input
          id="accessReqLotacao"
          type="text"
          maxLength={LOTACAO_MAXIMA}
          placeholder="Ex.: Diretoria de Gestão de Pessoas"
          value={campos.lotacao}
          onChange={(e) => pedido.atualizarCampo("lotacao", e.target.value)}
        />
      </Campo>
    );
  if (opcoes.status === "erro")
    return (
      <Campo
        rotulo={definicao.rotuloDaLotacao}
        obrigatorio
        erro="Não foi possível carregar a lista."
        idDoControle="accessReqLotacaoRecarregar"
      >
        <button
          id="accessReqLotacaoRecarregar"
          type="button"
          className="btn secondary"
          onClick={() => pedido.recarregarOpcoes()}
        >
          Tentar de novo
        </button>
      </Campo>
    );
  const unidades = lotacoesDaArea(opcoes, area);
  const tipos = [...new Set(unidades.map((u) => u.tipo || ""))];
  return (
    <Campo rotulo={definicao.rotuloDaLotacao} obrigatorio erro={erros.lotacao}>
      <select
        id="accessReqLotacao"
        value={campos.lotacao}
        disabled={opcoes.status !== "pronto"}
        onChange={(e) => pedido.atualizarCampo("lotacao", e.target.value)}
      >
        <option value="">
          {opcoes.status === "pronto" ? "Escolha" : "Carregando…"}
        </option>
        {tipos.length > 1
          ? tipos.map((tipo) => (
              <optgroup key={tipo} label={tipo}>
                {unidades
                  .filter((u) => (u.tipo || "") === tipo)
                  .map((u) => (
                    <option key={u.nome} value={u.nome}>
                      {u.nome}
                    </option>
                  ))}
              </optgroup>
            ))
          : unidades.map((u) => (
              <option key={u.nome} value={u.nome}>
                {u.nome}
              </option>
            ))}
      </select>
    </Campo>
  );
}

function Formulario({
  estado,
  pedido,
  visao,
}: {
  estado: EstadoDoPedido;
  pedido: PedidoDeAcesso;
  visao: VisaoDoPedido;
}) {
  const { campos, erros } = estado;
  const primeiro = useRef<HTMLInputElement | null>(null);
  const area = campos.area;
  const cargos = cargosDaArea(area);
  const coordenacoes = coordenacoesDaArea(estado.opcoes, area);
  const tamanho = campos.justificativa.trim().length;

  useEffect(() => {
    if (estado.focoNoFormulario) primeiro.current?.focus();
  }, [estado.focoNoFormulario]);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    void pedido.enviar();
  }

  return (
    <form
      id="accessRequestForm"
      className="solicitacao-form"
      noValidate
      onSubmit={enviar}
    >
      {visao.abas ? (
        <div className="solicitacao-onde">
          <p id="solicitacaoOnde" className="solicitacao-onde-titulo">
            Onde você trabalha?
          </p>
          <small className="ui-campo-dica">
            Vai avaliar outra área? Diga na justificativa; quem aprovar libera.
          </small>
          <Abas
            rotulo="Onde você trabalha"
            className="solicitacao-abas"
            abas={AREAS_DA_SOLICITACAO.map((a) => ({
              id: a.codigo,
              rotulo: a.rotulo,
              idDaAba: `solicitacaoAba-${a.codigo}`,
              idDoPainel: "solicitacaoCampos",
            }))}
            ativa={area}
            aoEscolher={(id: string) => pedido.escolherArea(id as CodigoDaArea)}
          />
        </div>
      ) : null}
      <div
        id="solicitacaoCampos"
        className="solicitacao-campos"
        role={visao.abas ? "tabpanel" : undefined}
        aria-labelledby={visao.abas ? `solicitacaoAba-${area}` : undefined}
      >
        <Campo rotulo="Nome completo" obrigatorio erro={erros.nome}>
          <input
            id="accessReqNome"
            ref={primeiro}
            type="text"
            autoComplete="name"
            maxLength={NOME_MAXIMO}
            value={campos.nome}
            onChange={(e) => pedido.atualizarCampo("nome", e.target.value)}
          />
        </Campo>
        <Campo rotulo="E-mail institucional">
          <input
            id="accessReqEmailCampo"
            type="email"
            readOnly
            value={estado.email}
          />
        </Campo>
        {visao.reativacao ? null : (
          <>
            <Campo rotulo="Cargo ou função" obrigatorio erro={erros.cargo}>
              <select
                id="accessReqCargo"
                value={campos.cargo}
                onChange={(e) => pedido.atualizarCampo("cargo", e.target.value)}
              >
                <option value="">Escolha</option>
                {cargos.map((c) => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
            {campos.cargo === CARGO_OUTRO ? (
              <Campo
                rotulo="Qual cargo ou função?"
                obrigatorio
                erro={erros.cargoOutro}
              >
                <input
                  id="accessReqCargoOutro"
                  type="text"
                  maxLength={CARGO_OUTRO_MAXIMO}
                  value={campos.cargoOutro}
                  onChange={(e) =>
                    pedido.atualizarCampo("cargoOutro", e.target.value)
                  }
                />
              </Campo>
            ) : null}
            <CampoDaLotacao estado={estado} pedido={pedido} area={area} />
            {coordenacoes.length ? (
              <Campo rotulo="Coordenação">
                <select
                  id="accessReqCoordenacao"
                  value={campos.coordenacao}
                  onChange={(e) =>
                    pedido.atualizarCampo("coordenacao", e.target.value)
                  }
                >
                  <option value="">Não sei</option>
                  {coordenacoes.map((c) => (
                    <option key={c.codigo} value={c.codigo}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            ) : null}
          </>
        )}
        <Campo
          rotulo="Justificativa"
          obrigatorio
          largo
          dica={`${tamanho.toLocaleString("pt-BR")}/${JUSTIFICATIVA_MAXIMA.toLocaleString("pt-BR")} · mínimo de ${JUSTIFICATIVA_MINIMA} caracteres e ${PALAVRAS_DA_JUSTIFICATIVA} palavras`}
          erro={erros.justificativa}
        >
          <textarea
            id="accessReqJustificativa"
            rows={4}
            maxLength={JUSTIFICATIVA_MAXIMA}
            placeholder="Para que você vai usar o MONITORA?"
            value={campos.justificativa}
            onChange={(e) =>
              pedido.atualizarCampo("justificativa", e.target.value)
            }
          />
        </Campo>
      </div>
      <div className="solicitacao-acoes">
        {visao.podeVoltar ? (
          <button
            id="accessRequestVoltarBtn"
            type="button"
            className="btn ghost"
            onClick={() => pedido.voltar()}
          >
            Voltar
          </button>
        ) : null}
        <button
          id="accessRequestBtn"
          type="submit"
          className="btn"
          disabled={estado.enviando}
          aria-busy={estado.enviando || undefined}
        >
          {visao.rotuloDoBotao}
        </button>
      </div>
    </form>
  );
}

export function PaginaDaSolicitacao({
  pedido,
  sessao,
  logoUrl,
  slogan,
  instituicao,
}: Props) {
  const estado = useSyncExternalStore(pedido.assinar, pedido.obter);
  const visao = visaoDoPedido(estado);

  return (
    <div
      id="accessRequestCard"
      className="solicitacao"
      aria-busy={visao.verificando || undefined}
    >
      <Marca
        logoUrl={logoUrl}
        slogan={slogan}
        instituicao={instituicao}
        fala={falaDaAya(visao, estado)}
      />
      <section
        className="solicitacao-cartao"
        aria-labelledby="accessRequestTitulo"
      >
        <header className="solicitacao-topo">
          <h1 id="accessRequestTitulo">{visao.titulo}</h1>
          <div className="solicitacao-conta">
            <span className="solicitacao-conta-email">
              <MarcaDoGoogle />
              <strong id="accessReqEmail">{estado.email || "-"}</strong>
            </span>
            <span className="solicitacao-conta-acoes">
              <button
                id="accessSwitchAccountBtn"
                type="button"
                className="btn ghost"
                onClick={() => void sessao.entrarComGoogle()}
              >
                Usar outra conta
              </button>
              <button
                id="accessReturnLoginBtn"
                type="button"
                className="btn ghost"
                onClick={() => void sessao.limparSessao()}
              >
                Sair
              </button>
            </span>
          </div>
        </header>

        {visao.verificando ? (
          <div className="solicitacao-carregando" aria-hidden="true">
            <span className="ui-esqueleto ui-esqueleto-linha" />
            <span className="ui-esqueleto ui-esqueleto-linha" />
            <span className="ui-esqueleto ui-esqueleto-linha" />
          </div>
        ) : null}

        {visao.faixa ? <Faixa faixa={visao.faixa} pedido={pedido} /> : null}
        {visao.aviso ? (
          <Aviso
            tom={visao.aviso.tom === "warn" ? "warning" : visao.aviso.tom}
            papel={visao.aviso.tom === "danger" ? "alert" : "status"}
            como="p"
            className="solicitacao-aviso"
          >
            {visao.aviso.texto}
          </Aviso>
        ) : null}

        {visao.conteudo === "resumo" ? (
          <Resumo estado={estado} pedido={pedido} />
        ) : null}
        {visao.conteudo === "formulario" ? (
          <Formulario estado={estado} pedido={pedido} visao={visao} />
        ) : null}
      </section>
    </div>
  );
}
