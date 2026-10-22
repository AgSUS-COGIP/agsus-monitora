import {
  anexosDaEmpregare,
  enviosAnterioresDaEmpregare,
  impressaoDasRespostas,
  respostaLidaDaEmpregare,
} from "../../../lib/avaliacao-documental/anexo-na-empregare.ts";
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
  escolhaDaTecla,
  textoDaSituacaoDaConferencia,
  textoDoResultado,
  textoDoSalvo,
  tomDoResultado,
} from "../../../lib/avaliacao-documental/ficha.js";
import {
  NIVEIS,
  PARCIAL_DO_TIPO,
  rotuloDe,
} from "../../../lib/avaliacao-documental/catalogo.js";
import {
  DICA_DA_ART,
  ROTULO_DA_ART,
} from "../../../lib/avaliacao-documental/tela-da-pre-classificacao.js";
import {
  composicaoComPrevias,
  notaComPrevias,
} from "../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import { motivosDoResultado } from "../../../lib/avaliacao-documental/motivos-do-resultado.ts";
import { pontuacaoInformativaDaFicha } from "../../../lib/avaliacao-documental/pontos-informativos.ts";
import { modalidadesDoLancamento } from "../../../lib/avaliacao-documental/pontuacao.js";
import { rotuloDaVersaoNaLista } from "../../../lib/nome-da-versao.ts";
import { Aviso } from "../../../ui/index.js";
import { guardaDeAlteracoes } from "../../../app/guarda-de-alteracoes.ts";
import { CabecalhoDaFicha } from "./cabecalho-da-ficha.tsx";
import { cpfDaFicha } from "../../../lib/avaliacao-documental/cpf-da-ficha.ts";
import { ConclusaoDaFicha } from "./conclusao-da-ficha.tsx";
import { ReabrirAFicha } from "./reabrir-a-ficha.tsx";
import { copiar, EnviosAnteriores } from "./empregare.tsx";
import { abrirEspelhoDeNota, baixarEspelhoEmPdf } from "./espelho-de-nota.ts";
import { textosParaOEspelho } from "../modelo-do-espelho-no-banco.ts";
import {
  blocoEditaNota,
  escolhaDoBloco,
} from "../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import {
  contextoDaEscolha,
  decidirNoLancamento,
  ItemDaFicha,
} from "./item-da-ficha.tsx";
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
    sem pendência avança sozinho ao próximo item que pede algo; Não confere
    abre os motivos; Editar nota, os itens e o passador. A etapa final, Conclusão
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

/* Quantos títulos, cursos ou vínculos o bloco tem (a escolha pode abrir uma linha). */
function contarItens(estado, codigo) {
  const bloco = estado.regra?.blocos?.find((b) => b.codigo === codigo);
  const chave = bloco ? BLOCOS_COM_ITENS[bloco.tipo] : null;
  return chave ? (estado.lancamento?.[chave] || []).length : 0;
}

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
    anexos: anexosDaEmpregare(empregare),
    impressao: impressaoDasRespostas(empregare),
    anteriores: enviosAnterioresDaEmpregare(empregare),
    respostaLida: respostaLidaDaEmpregare(empregare),
  };
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
  versoes = null,
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
  const fichaId = aberta.ficha.id;

  useEffect(() => {
    void loja.carregar(fichaId);
  }, [loja, fichaId]);
  /*
    A fila espera o salvamento desta ficha antes de liberar a reserva
    (estado-da-fila.js, fechar). Ao desmontar, o envio do que estava pendente
    fica no lugar, para a liberação que vier depois esperar por ele.
  */
  useEffect(() => {
    fila.registrarSalvamento?.(fichaId, () => loja.salvar());
    return () => {
      clearTimeout(avanco.current);
      const envio = loja.descartar();
      fila.registrarSalvamento?.(fichaId, () => envio);
    };
  }, [loja, fila, fichaId]);
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

  // Rascunho ainda não salvo: o F5 e o fechar pedem confirmação, a versão nova
  // do sistema espera, e a página desligada pela coordenação não fecha
  // (src/app/guarda-de-alteracoes.ts).
  useEffect(
    () =>
      guardaDeAlteracoes.registrar({
        comAlteracoes: () => loja.temAlteracaoPendente(),
        naoGuardado: () => loja.temAlteracaoPendente(),
      }),
    [loja],
  );

  useEffect(() => {
    // Esconder a aba ou sair da página salva o rascunho na hora (o automático espera até 3 s).
    const salvarAgora = () => {
      if (loja.temAlteracaoPendente()) void loja.salvar();
    };
    const aoMudarVisibilidade = () => {
      if (globalThis.document?.visibilityState === "hidden") salvarAgora();
    };
    globalThis.document?.addEventListener?.(
      "visibilitychange",
      aoMudarVisibilidade,
    );
    globalThis.addEventListener?.("pagehide", salvarAgora);
    return () => {
      globalThis.document?.removeEventListener?.(
        "visibilitychange",
        aoMudarVisibilidade,
      );
      globalThis.removeEventListener?.("pagehide", salvarAgora);
    };
  }, [loja]);

  // A regra da vaga (a diferença do cargo por cima do nível): estado-da-ficha.js.
  const regra = st.regra;
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
    ou com o foco em outro painel (Aya).
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
  const desabilitado = !st.podeEditar || st.concluindo;
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
  // Antes da decisão, cada item entra com a prévia (o Apurado que o item mostra).
  const partes = composicaoComPrevias(
    composicaoDaNota(regra, lancamento, avaliacao, st.declarada),
    blocos,
    lancamento,
    avaliacao.calculados,
  );
  const comPrevias = notaComPrevias(partes);
  const nota = {
    nota: emAnalise
      ? comPrevias.nota
      : gravada
        ? ficha.nota_final
        : avaliacao.nota_final,
    parcial: emAnalise,
    comPrevia: emAnalise && comPrevias.comPrevia,
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
    // O por quê do Inapto, com o link para o item.
    motivos: emAnalise
      ? []
      : motivosDoResultado(blocos, lancamento, avaliacao, resultado),
    aoIr: irPara,
    // Inapto por requisito com a opção da regra: a pontuação só informativa.
    informativa: emAnalise
      ? null
      : pontuacaoInformativaDaFicha(avaliacao, resultado),
    partes,
  };
  const previa = gravada
    ? { completa: true, texto: ficha.parecer, motivos: [] }
    : previaDoParecer(avaliacao, conferencia, lancamento);

  const maisAcoes = (
    <MaisAcoesDaFicha
      empregare={empregare}
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

  /*
    Depois de uma escolha: Confere sem pendência avança (no foco) ao próximo
    que pede algo. A linha que a escolha acabou de abrir segura o item, para
    o avaliador ver o registro (o título já vem da resposta).
  */
  function depoisDeDecidir(codigo, escolha, itensAntes = null) {
    if (escolha !== "CONFERE" || modo !== "foco") return;
    const agora = loja.obter();
    if (agora.pendencias.some((p) => p.bloco === codigo)) return;
    if (itensAntes !== null && itensAntes !== contarItens(agora, codigo))
      return;
    const proximo = proximoPassoPendente(
      passosDaFicha(agora.regra, agora.lancamento, agora.pendencias),
      codigo,
    );
    clearTimeout(avanco.current);
    avanco.current = setTimeout(() => irPara(proximo), ESPERA_PARA_AVANCAR_MS);
  }

  function decidir(bloco, escolha) {
    const agora = loja.obter();
    const antes = contarItens(agora, bloco.codigo);
    const parcial = PARCIAL_DO_TIPO[bloco.tipo];
    const atual = escolhaDoBloco(
      bloco,
      agora.lancamento.blocos?.[bloco.codigo],
      agora.declarada,
      parcial ? (agora.avaliacao.calculados?.[parcial] ?? 0) : null,
    );
    const contexto = contextoDaEscolha(agora, bloco, empregare.enderecos);
    // A mesma tecla de novo só confirma (como o clique): nada muda. Pelos
    // itens lidos, o 1 é o Confirmar e grava de novo (os aceitos podem ter mudado).
    const gravada =
      escolha !== atual ||
      (contexto.pelosItens && (escolha === "CONFERE" || escolha === "EDITAR"))
        ? decidirNoLancamento(bloco, mudar, escolha, contexto)
        : escolha;
    depoisDeDecidir(bloco.codigo, gravada, antes);
  }

  async function concluirEProxima() {
    setErroDeConclusao("");
    setTentouConcluir(true);
    const r = await loja.concluir();
    if (r.emAndamento) return;
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
    const escolha = escolhaDaTecla(ev.key);
    const bloco = blocos.find((b) => b.codigo === atual);
    if (!escolha || !bloco || !itens.some((p) => p.codigo === atual)) return;
    if (bloco.tipo === "REGISTRO" || !blocoSeAplica(bloco, lancamento)) return;
    if (escolha === "EDITAR" && !blocoEditaNota(bloco)) return;
    ev.preventDefault();
    decidir(bloco, escolha);
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
      aoAbrirEspelho={
        gravada && ficha.tp_resultado
          ? async () =>
              abrirEspelhoDeNota(st, ficha, {
                textos: await textosParaOEspelho(
                  fila.rpc,
                  fila.obter().editalId,
                ),
              })
          : null
      }
      aoBaixarEspelho={
        gravada && ficha.tp_resultado
          ? async () =>
              baixarEspelhoEmPdf(st, ficha, {
                textos: await textosParaOEspelho(
                  fila.rpc,
                  fila.obter().editalId,
                ),
              }).catch((e) =>
                setAviso(
                  `Não foi possível gerar o PDF: ${e?.message || String(e)}`,
                ),
              )
          : null
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
        <CabecalhoDaFicha
          {...topo}
          modalidade={
            modalidadesDoLancamento(lancamento).join(" + ") || topo.modalidade
          }
          nivel={rotuloDe(NIVEIS, lancamento.nivel)}
          cpf={cpfDaFicha(st.dados.cpf_informado)}
        >
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
          Analisada pela regra{" "}
          {rotuloDaVersaoNaLista(versoes, st.dados.regra.versao)}; a vigente é a{" "}
          {rotuloDaVersaoNaLista(versoes, st.dados.regra.vigente)}.
        </Aviso>
      ) : st.dados.regra.situacao !== "CONFERIDA" && !concluida ? (
        <Aviso tom="warning">
          A regra {rotuloDaVersaoNaLista(versoes, st.dados.regra.versao)} ainda
          não foi conferida: dá para salvar o rascunho, não para concluir.
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
            <EnviosAnteriores empregare={empregare} />
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
        {(st.dados.pode_reabrir ||
          (st.dados.papel === "COORDENADOR" &&
            st.dados.ficha.situacao === "REVISAR")) ? (
          <ReabrirAFicha loja={loja} />
        ) : null}
      </RodapeDaFicha>
    </div>
  );
}
