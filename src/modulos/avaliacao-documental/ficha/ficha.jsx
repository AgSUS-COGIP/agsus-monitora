import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  BLOCOS_COM_ITENS,
  blocoSeAplica,
  composicaoDaNota,
  enderecoDaVagaNaEmpregare,
  enderecoDoCandidatoNaEmpregare,
  nomeCurtoDoBloco,
  PASSO_DA_CONCLUSAO,
  passosDaFicha,
  previaDoParecer,
  proximoPassoPendente,
  situacaoDaTecla,
  textoDaSituacaoDaConferencia,
  textoDoResultado,
  textoDoSalvo,
  tomDoResultado,
} from "../../../lib/avaliacao-documental/ficha.js";
import {
  NIVEIS,
  rotuloDe,
} from "../../../lib/avaliacao-documental/catalogo.js";
import {
  DICA_DA_ART,
  ROTULO_DA_ART,
} from "../../../lib/avaliacao-documental/tela-da-pre-classificacao.js";
import { Aviso, Campo } from "../../../ui/index.js";
import { compartilharNoChat } from "../../chat/ponte.js";
import { usarChatLiberado } from "../../chat/usar-chat-liberado.js";
import { CabecalhoDaFicha } from "./cabecalho-da-ficha.tsx";
import { ConclusaoDaFicha } from "./conclusao-da-ficha.tsx";
import { copiar } from "./empregare.tsx";
import { ItemDaFicha } from "./item-da-ficha.tsx";
import { MaisAcoesDaFicha } from "./mais-acoes-da-ficha.tsx";
import { ProgressoDaFicha } from "./progresso-da-ficha.tsx";
import { ResumoDaNota } from "./resumo-da-nota.tsx";
import { RodapeDaFicha } from "./rodape-da-ficha.tsx";
import { criarEstadoDaFicha } from "./estado-da-ficha.js";

/*
  O conteúdo da ficha no modo de análise da aba Fila, calmo e guiado:
  - no alto, o cabeçalho enxuto (cabecalho-da-ficha.tsx) e o stepper com a
    barra de progresso (progresso-da-ficha.tsx);
  - MODO FOCO (padrão): um item por vez, largo (item-da-ficha.tsx). Conforme
    sem pendência avança sozinho ao próximo item que pede algo; Não conforme e
    Não enviado abrem os motivos em chips. A etapa final, Conclusão
    (conclusao-da-ficha.tsx), tem o resumo, a nota final, as observações e o
    parecer. "Ver todos" troca para a lista completa, e a escolha fica
    lembrada no navegador;
  - fora da Conclusão, a lateral só com a nota, o mínimo, a composição por
    bloco e o "⋯" (resumo-da-nota.tsx, mais-acoes-da-ficha.tsx);
  - rodapé fixo mínimo (rodape-da-ficha.tsx).
  Mesmas RPCs e mesma gravação (estado-da-ficha.js): rascunho automático,
  conclusão só sem pendência, concluída só leitura com Reabrir. Teclas 1/2/3,
  J/K, Ctrl+S e Ctrl+Enter. Explicações: docs/aya/regras-da-avaliacao-documental.md.
*/

/* O passo já não pede nada (marcado sem pendência, opcional ou a Conclusão). */
const passoResolvido = (passo) =>
  !passo ||
  passo.codigo === PASSO_DA_CONCLUSAO ||
  !["nao_conferido", "pendencia"].includes(passo.estado);

const CHAVE_DO_MODO = "monitora.avaliacao-documental.ficha-modo";
const ESPERA_PARA_AVANCAR_MS = 420;

function lerModo() {
  try {
    return globalThis.localStorage?.getItem(CHAVE_DO_MODO) === "lista"
      ? "lista"
      : "foco";
  } catch {
    return "foco";
  }
}
function guardarModo(modo) {
  try {
    globalThis.localStorage?.setItem(CHAVE_DO_MODO, modo);
  } catch {
    /* sem armazenamento: o modo vale só nesta tela */
  }
}

const ehCampoDeTexto = (alvo) =>
  ["INPUT", "TEXTAREA", "SELECT"].includes(alvo?.tagName) ||
  alvo?.isContentEditable;

/* Os endereços da Empregare da ficha (obter_ficha_analise → empregare; sem eles, a lista de vagas). */
function enderecosDaEmpregare(dados, ficha) {
  const empregare = dados.empregare || {};
  const vaga = enderecoDaVagaNaEmpregare(ficha.vaga, empregare.vaga_interno);
  return {
    candidato: enderecoDoCandidatoNaEmpregare(empregare.link_candidato),
    vaga,
    vagaDireta: Boolean(vaga?.includes("/candidaturas/")),
  };
}

function Reabrir({ loja }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  if (!aberto)
    return (
      <button
        type="button"
        className="btn secondary"
        data-tour="avd-ficha-reabrir"
        onClick={() => setAberto(true)}
      >
        Reabrir
      </button>
    );
  return (
    <div className="avd-inline">
      <Campo rotulo="Motivo para reabrir" obrigatorio erro={erro}>
        <input
          value={motivo}
          maxLength={2000}
          onChange={(ev) => setMotivo(ev.target.value)}
        />
      </Campo>
      <button
        type="button"
        className="btn small"
        disabled={motivo.trim().length < 10}
        onClick={async () => {
          const r = await loja.reabrir(motivo.trim());
          if (!r.ok) setErro(r.erro);
        }}
      >
        Reabrir
      </button>
    </div>
  );
}

function textoDoEstado(st) {
  if (st.salvando) return "Salvando…";
  if (st.sujo) return "Alteração não salva";
  return textoDoSalvo(st.salvoEm);
}

/**
 * O corpo da ficha aberta. `registrarAntesDeFechar(fn)` recebe a função que o
 * modo de análise chama antes de sair (salva o que falta e confirma se não
 * der). `topo`: o que o cabeçalho mostra (fila.jsx); `children`: os avisos
 * logo abaixo dele.
 */
export function ConteudoDaFicha({
  fila,
  aberta,
  filtroVaga,
  aoFechar,
  registrarAntesDeFechar,
  topo,
  children,
  criarLoja = criarEstadoDaFicha,
}) {
  const [loja] = useState(() =>
    criarLoja({ rpc: fila.rpc, toast: fila.toast }),
  );
  const st = useSyncExternalStore(loja.assinar, loja.obter);
  const [escolhido, setEscolhido] = useState(null);
  const [modo, setModo] = useState(lerModo);
  const [direcao, setDirecao] = useState("frente");
  const [erroDeConclusao, setErroDeConclusao] = useState("");
  const [tentouConcluir, setTentouConcluir] = useState(false);
  // "Código copiado" e afins, no rodapé.
  const [aviso, setAviso] = useState("");
  const raiz = useRef(null);
  const avanco = useRef(null);
  // "Compartilhar no chat" no "⋯" (o cartão da ficha vai para uma conversa).
  const comChat = usarChatLiberado();
  const fichaId = aberta.ficha.id;

  useEffect(() => {
    void loja.carregar(fichaId);
  }, [loja, fichaId]);
  useEffect(
    () => () => {
      clearTimeout(avanco.current);
      loja.descartar();
    },
    [loja],
  );
  useEffect(() => {
    if (!aviso) return undefined;
    const id = setTimeout(() => setAviso(""), 6000);
    return () => clearTimeout(id);
  }, [aviso]);

  useEffect(() => {
    registrarAntesDeFechar?.(async () => {
      if (!loja.temAlteracaoPendente()) return true;
      if (await loja.salvar()) return true;
      return (
        globalThis.confirm?.(
          "Há alteração que não foi salva. Fechar mesmo assim?",
        ) ?? true
      );
    });
    return () => registrarAntesDeFechar?.(null);
  }, [loja, registrarAntesDeFechar]);

  useEffect(() => {
    const avisar = (ev) => {
      if (!loja.temAlteracaoPendente()) return;
      ev.preventDefault();
      ev.returnValue = "";
    };
    globalThis.addEventListener?.("beforeunload", avisar);
    return () => globalThis.removeEventListener?.("beforeunload", avisar);
  }, [loja]);

  const regra = st.dados?.regra?.configuracao;
  const blocos = useMemo(() => regra?.blocos || [], [regra]);
  const passos = useMemo(
    () =>
      regra && st.lancamento
        ? passosDaFicha(regra, st.lancamento, st.pendencias)
        : [],
    [regra, st.lancamento, st.pendencias],
  );
  const concluida = st.dados?.ficha?.situacao === "CONCLUIDA";
  /* O passo inicial, decidido uma vez ao abrir: na concluída, a Conclusão; senão, o primeiro que pede algo. */
  const inicial = useRef(null);
  if (!inicial.current && passos.length)
    inicial.current = concluida
      ? PASSO_DA_CONCLUSAO
      : proximoPassoPendente(passos, null);
  const atual =
    escolhido && passos.some((p) => p.codigo === escolhido)
      ? escolhido
      : inicial.current;

  /* Vai ao passo: no foco, troca o item (com a animação); na lista, rola até ele. */
  const irPara = useCallback(
    (codigo) => {
      if (!codigo) return;
      clearTimeout(avanco.current);
      const de = passos.findIndex((p) => p.codigo === atual);
      const para = passos.findIndex((p) => p.codigo === codigo);
      setDirecao(para < de ? "tras" : "frente");
      setEscolhido(codigo);
      // Sem mover o foco (o contorno do foco do app pesaria no cartão): o anúncio vai pelo aria-live.
      const depois =
        globalThis.requestAnimationFrame ?? ((fn) => setTimeout(fn, 0));
      depois(() => {
        if (modo === "foco") {
          if (globalThis.scrollY > 0) globalThis.scrollTo?.({ top: 0 });
          return;
        }
        raiz.current
          ?.querySelector(`[data-bloco="${codigo}"]`)
          ?.scrollIntoView?.({ block: "nearest" });
      });
    },
    [passos, atual, modo],
  );

  /*
    Os atalhos valem na página inteira enquanto a ficha está aberta (sem
    precisar clicar nela antes), menos em campo de texto, com um modal aberto
    ou com o foco em outro painel (chat, Aya).
  */
  const teclar = useRef(null);
  teclar.current = null;
  useEffect(() => {
    const aoTeclarNaPagina = (ev) => {
      if (ev.defaultPrevented || document.querySelector(".modal.show")) return;
      const alvo = ev.target;
      const area = raiz.current?.closest(".avd-analise") ?? raiz.current;
      const naFicha =
        alvo === document.body ||
        alvo === document.documentElement ||
        Boolean(area?.contains(alvo));
      if (naFicha) teclar.current?.(ev);
    };
    document.addEventListener("keydown", aoTeclarNaPagina);
    return () => document.removeEventListener("keydown", aoTeclarNaPagina);
  }, []);

  if (st.erro)
    return (
      <>
        {topo ? <CabecalhoDaFicha {...topo} /> : null}
        {children}
        <Aviso tom="danger" papel="alert">
          Não foi possível abrir o conteúdo da ficha: {st.erro}
        </Aviso>
      </>
    );
  if (!st.dados || !st.lancamento)
    return (
      <>
        {topo ? <CabecalhoDaFicha {...topo} /> : null}
        {children}
        <div className="ui-card" aria-busy="true">
          <div className="ui-esqueleto-linha" />
          <div className="ui-esqueleto-linha" />
        </div>
      </>
    );

  const ficha = { ...aberta.ficha, ...st.dados.ficha };
  const desabilitado = !st.podeEditar;
  const conferencia = st.conferencia;
  const avaliacao = st.avaliacao;
  const lancamento = st.lancamento;
  // Mexer no item (itens, nota, motivo) cancela o avanço sozinho que estava por vir.
  const mudar = (transformar) => {
    clearTimeout(avanco.current);
    loja.mudar(transformar);
  };
  const itens = passos.filter((p) => p.codigo !== PASSO_DA_CONCLUSAO);
  const naConclusao = atual === PASSO_DA_CONCLUSAO;
  const foco = modo === "foco";
  /* Os blocos que não valem para o candidato (o critério étnico fica: é nele que se marca "Indígena"). */
  const naoSeAplicam = blocos.filter(
    (b) =>
      b.tipo !== "PONTUACAO" &&
      b.tipo !== "REGISTRO" &&
      !blocoSeAplica(b, lancamento),
  );
  const registros = blocos.filter((b) => b.tipo === "REGISTRO");
  const empregare = {
    enderecos: enderecosDaEmpregare(st.dados, ficha),
    codigoDoCandidato: String(ficha.codigo ?? ""),
    codigoDaVaga: String(ficha.vaga ?? ""),
    loja,
    aoAvisar: setAviso,
  };

  /* A nota: concluída, o que foi gravado; em análise, a conta ao vivo. */
  const gravada = concluida && ficha.parecer;
  const emAnalise = !gravada && conferencia?.situacao === "EM_ANALISE";
  const resultado = gravada
    ? ficha.tp_resultado
    : (conferencia?.situacao ?? avaliacao.resultado);
  const art = st.dados.declarada_gravada?.art;
  const nota = {
    nota: emAnalise
      ? avaliacao.nota_apurada
      : gravada
        ? ficha.nota_final
        : avaliacao.nota_final,
    parcial: emAnalise,
    minima: avaliacao.nota_minima ?? null,
    art:
      art !== null && art !== undefined
        ? { rotulo: ROTULO_DA_ART, dica: DICA_DA_ART, valor: art }
        : null,
    selo: {
      tom: emAnalise ? "neutro" : tomDoResultado(resultado),
      texto:
        gravada || !conferencia
          ? textoDoResultado(resultado)
          : textoDaSituacaoDaConferencia(conferencia),
    },
    resultado,
    partes: composicaoDaNota(regra, lancamento, avaliacao, st.declarada),
  };
  const previa = gravada
    ? { completa: true, texto: ficha.parecer, motivos: [] }
    : previaDoParecer(avaliacao, conferencia, lancamento);

  const compartilhar = comChat
    ? () => {
        const ok = compartilharNoChat({
          view: "avaliacao-documental",
          area: st.dados.edital?.area || "",
          edital: {
            id: st.dados.edital?.id,
            titulo: st.dados.edital?.rotulo || "",
          },
          ficha: { id: ficha.id, codigo: String(ficha.codigo ?? "") },
        });
        if (!ok) setAviso("Não foi possível compartilhar esta ficha");
      }
    : null;
  const maisAcoes = (
    <MaisAcoesDaFicha
      empregare={empregare}
      aoCompartilhar={compartilhar}
      nivel={
        !desabilitado && st.dados.papel === "COORDENADOR"
          ? {
              valor: lancamento.nivel,
              aoMudar: (nivel) =>
                mudar((l) => {
                  l.nivel = nivel;
                  return l;
                }),
            }
          : null
      }
    />
  );

  /* Depois de uma decisão: Conforme sem pendência avança (no foco) ao próximo que pede algo. */
  function depoisDeDecidir(codigo, situacao) {
    if (situacao !== "CONFORME" || modo !== "foco") return;
    const agora = loja.obter();
    if (agora.pendencias.some((p) => p.bloco === codigo)) return;
    // Títulos, cursos ou vínculos ainda sem item: fica, para lançar os comprovados.
    const bloco = blocos.find((b) => b.codigo === codigo);
    const chave = BLOCOS_COM_ITENS[bloco?.tipo];
    if (chave && !(agora.lancamento[chave] || []).length) return;
    const proximo = proximoPassoPendente(
      passosDaFicha(
        agora.dados.regra.configuracao,
        agora.lancamento,
        agora.pendencias,
      ),
      codigo,
    );
    clearTimeout(avanco.current);
    avanco.current = setTimeout(() => irPara(proximo), ESPERA_PARA_AVANCAR_MS);
  }

  function decidir(codigo, situacao) {
    mudar((l) => {
      const atualDoBloco = l.blocos?.[codigo] || {};
      l.blocos = {
        ...l.blocos,
        [codigo]: {
          ...atualDoBloco,
          situacao,
          motivos: situacao === "CONFORME" ? [] : atualDoBloco.motivos || [],
        },
      };
      return l;
    });
    depoisDeDecidir(codigo, situacao);
  }

  async function concluirEProxima() {
    setErroDeConclusao("");
    setTentouConcluir(true);
    const r = await loja.concluir();
    if (r.ok) {
      await fila.pegarProxima(filtroVaga || "");
      return;
    }
    if (r.pendencias?.length) irPara(r.pendencias[0].bloco);
    else setErroDeConclusao(r.erro || "Não foi possível concluir.");
  }

  const posicao = passos.findIndex((p) => p.codigo === atual);
  const vizinho = (passo) => passos[posicao + passo]?.codigo;

  function aoTeclar(ev) {
    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && ev.key.toLowerCase() === "s") {
      ev.preventDefault();
      void loja.salvar();
      return;
    }
    if (ctrl && ev.key === "Enter") {
      ev.preventDefault();
      void concluirEProxima();
      return;
    }
    if (ctrl || ev.altKey || ehCampoDeTexto(ev.target)) return;
    const k = ev.key.toLowerCase();
    if (k === "j" || k === "k") {
      ev.preventDefault();
      const alvo = vizinho(k === "j" ? 1 : -1);
      if (alvo) irPara(alvo);
      return;
    }
    if (desabilitado) return;
    const situacao = situacaoDaTecla(ev.key);
    const bloco = blocos.find((b) => b.codigo === atual);
    if (!situacao || !bloco || !itens.some((p) => p.codigo === atual)) return;
    if (bloco.tipo === "REGISTRO" || !blocoSeAplica(bloco, lancamento)) return;
    ev.preventDefault();
    decidir(bloco.codigo, situacao);
  }

  teclar.current = aoTeclar;

  /* O botão primário do rodapé, conforme o momento. */
  let primaria = null;
  let secundaria = null;
  if (st.podeEditar) {
    if (naConclusao || !foco) {
      primaria = {
        rotulo: "Concluir e próxima",
        acao: "concluir-e-proxima",
        aoClicar: () => void concluirEProxima(),
        desabilitado: st.concluindo || !conferencia?.pode_concluir,
        dica: conferencia?.texto_da_falta || undefined,
      };
      secundaria = {
        rotulo: "Salvar rascunho",
        acao: "salvar-rascunho",
        aoClicar: () => void loja.salvar(),
        desabilitado: st.salvando || !st.sujo,
      };
    } else if (!passoResolvido(passos[posicao])) {
      // O item da vez ainda pede algo: as decisões dele são a ação principal.
    } else if (conferencia?.pode_concluir) {
      primaria = {
        rotulo: "Revisar e concluir",
        acao: "ir-para-conclusao",
        aoClicar: () => irPara(PASSO_DA_CONCLUSAO),
      };
    } else {
      primaria = {
        rotulo: "Próximo pendente",
        acao: "proximo-pendente",
        aoClicar: () => irPara(proximoPassoPendente(passos, atual)),
      };
    }
  }

  const conclusao = (
    <ConclusaoDaFicha
      st={st}
      passos={passos}
      blocos={blocos}
      naoSeAplicam={naoSeAplicam.map((b) => nomeCurtoDoBloco(b))}
      aoIr={irPara}
      nota={nota}
      previa={previa}
      concluida={concluida}
      desabilitado={desabilitado}
      mudar={mudar}
      aoCopiarParecer={async () =>
        setAviso(
          (await copiar(previa.texto))
            ? "Parecer copiado"
            : "Não foi possível copiar",
        )
      }
      historico={st.dados.historico || []}
      registros={
        foco && registros.length
          ? registros.map((b) => (
              <ItemDaFicha
                key={b.codigo}
                st={st}
                bloco={b}
                modo="lista"
                ativo={false}
                desabilitado={desabilitado}
                mostrarFaltaDeSituacao={false}
                empregare={empregare}
                mudar={mudar}
              />
            ))
          : null
      }
    />
  );
  const item = (bloco, extra = {}) => (
    <ItemDaFicha
      key={bloco.codigo}
      st={st}
      bloco={bloco}
      modo={modo}
      desabilitado={desabilitado}
      mostrarFaltaDeSituacao={tentouConcluir}
      empregare={empregare}
      mudar={mudar}
      aoDecidir={depoisDeDecidir}
      aoFocar={() => {
        if (atual !== bloco.codigo) setEscolhido(bloco.codigo);
      }}
      ativo={!desabilitado && bloco.codigo === atual}
      {...extra}
    />
  );
  const blocoAtual = blocos.find((b) => b.codigo === atual);
  const numero = itens.findIndex((p) => p.codigo === atual);

  return (
    <div
      className="avd-ficha"
      ref={raiz}
      data-modo={modo}
      data-conclusao={naConclusao && foco ? "sim" : undefined}
      data-tour="avd-ficha-conteudo"
    >
      {topo ? (
        <CabecalhoDaFicha {...topo} nivel={rotuloDe(NIVEIS, lancamento.nivel)}>
          <ProgressoDaFicha
            passos={passos}
            atual={atual}
            conferencia={conferencia}
            modo={modo}
            aoIr={irPara}
            comAtalhos={!desabilitado}
            aoAlternarModo={() => {
              const novo = foco ? "lista" : "foco";
              guardarModo(novo);
              setModo(novo);
            }}
          />
        </CabecalhoDaFicha>
      ) : null}
      {children}
      <p className="sr-only" aria-live="polite">
        {foco
          ? naConclusao
            ? "Conclusão"
            : blocoAtual && numero >= 0
              ? `Item ${numero + 1} de ${itens.length}: ${blocoAtual.titulo}`
              : ""
          : ""}
      </p>
      {st.aviso ? (
        <Aviso tom="warning" papel="alert">
          {st.aviso}
        </Aviso>
      ) : null}
      {st.dados.regra.versao !== st.dados.regra.vigente ? (
        <Aviso>
          Analisada pela regra v{st.dados.regra.versao}; a vigente é a v
          {st.dados.regra.vigente}.
        </Aviso>
      ) : st.dados.regra.situacao !== "CONFERIDA" && !concluida ? (
        <Aviso tom="warning">
          A regra v{st.dados.regra.versao} ainda não foi conferida: dá para
          salvar o rascunho, não para concluir.
        </Aviso>
      ) : null}
      <div className="avd-ficha-grade">
        <div className="avd-ficha-principal" data-tour="avd-ficha-blocos">
          {foco ? (
            naConclusao ? (
              <div
                className="avd-ficha-palco"
                key="conclusao"
                data-direcao={direcao}
              >
                {conclusao}
              </div>
            ) : blocoAtual ? (
              <div
                className="avd-ficha-palco"
                key={blocoAtual.codigo}
                data-direcao={direcao}
              >
                {item(blocoAtual, {
                  numero:
                    numero >= 0
                      ? { atual: numero + 1, total: itens.length }
                      : null,
                })}
              </div>
            ) : null
          ) : (
            <>
              {blocos
                .filter((b) => !naoSeAplicam.includes(b))
                .map((b) => item(b))}
              {naoSeAplicam.length ? (
                <details
                  className="ui-card avd-ficha-nao-se-aplicam"
                  data-tour="avd-ficha-nao-se-aplicam"
                >
                  <summary>
                    Não se aplicam:{" "}
                    {naoSeAplicam.map((b) => nomeCurtoDoBloco(b)).join(", ")}
                  </summary>
                  {naoSeAplicam.map((b) => item(b, { ativo: false }))}
                </details>
              ) : null}
              {conclusao}
            </>
          )}
        </div>
        {naConclusao && foco ? null : (
          <aside
            className="avd-ficha-lateral"
            aria-label="Nota"
            data-tour="avd-ficha-lateral"
          >
            <ResumoDaNota {...nota} acoes={maisAcoes} />
          </aside>
        )}
      </div>
      <RodapeDaFicha
        estado={
          concluida
            ? `Concluída${st.dados.ficha.concluida_por ? ` por ${st.dados.ficha.concluida_por}` : ""}`
            : textoDoEstado(st)
        }
        aviso={aviso}
        erro={erroDeConclusao}
        anterior={
          posicao > 0
            ? {
                rotulo: "Anterior",
                acao: "item-anterior",
                aoClicar: () => irPara(vizinho(-1)),
              }
            : null
        }
        proximo={
          posicao >= 0 && posicao < passos.length - 1
            ? {
                rotulo: "Próximo",
                acao: "item-proximo",
                aoClicar: () => irPara(vizinho(1)),
              }
            : null
        }
        secundaria={secundaria}
        primaria={primaria}
      >
        {st.dados.pode_reabrir ? <Reabrir loja={loja} /> : null}
      </RodapeDaFicha>
    </div>
  );
}
