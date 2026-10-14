import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { enunciadoCompleto } from "../../../lib/avaliacao-documental/anexo-na-empregare.ts";
import { PARCIAL_DO_TIPO as PARCIAIS_DOS_TIPOS } from "../../../lib/avaliacao-documental/catalogo.js";
import {
  BLOCOS_COM_ITENS as ITENS_DOS_TIPOS,
  blocoNaoPontuaNoNivel,
  blocoSeAplica,
  divergenciaDoBloco,
  ehAnexo,
  ESCOLHAS_DA_FICHA,
  itemCompleto,
  marcouOutroMotivo,
  mensagemDoBloco,
  PERGUNTA_DA_DECISAO,
  respostasDoBloco,
  sugereNaoEnviado,
  textoDaNota,
  titulosDoNivel,
} from "../../../lib/avaliacao-documental/ficha.js";
import {
  abreComLinhaNova,
  apuradoDoBloco,
  blocoComEscolha,
  blocoEditaNota,
  comLinhaAberta,
  declaradoDoBloco,
  escolhaDoBloco,
  escolhaPelosItens,
  lancamentoComEscolha,
  lancamentoConfirmadoPelosItens,
  novoItemDoBloco,
  semConfirmacaoSeMudouItens,
} from "../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import type { Escolha } from "../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import {
  devolverItem,
  tirarItem,
} from "../../../lib/avaliacao-documental/itens-da-ficha.ts";
import type { ItemTirado } from "../../../lib/avaliacao-documental/itens-da-ficha.ts";
import {
  arquivosDaPergunta,
  semPerguntaNoQuestionario,
} from "../../../lib/avaliacao-documental/respostas-do-candidato.ts";
import type { ArquivoDoCandidato } from "../../../lib/avaliacao-documental/respostas-do-candidato.ts";
import { justificativasDoBloco } from "../../../lib/avaliacao-documental/justificativas-do-bloco.ts";
import {
  justificativaDoBloco,
  TAMANHO_DA_JUSTIFICATIVA,
} from "../../../lib/avaliacao-documental/justificativa-dos-itens.ts";
import type {
  BlocoComItens,
  RetratoDaFicha,
} from "../../../lib/avaliacao-documental/justificativa-dos-itens.ts";
import {
  anexoEhImagem,
  itensParaConferir,
  leituraDoAnexo,
  leiturasDaFicha,
  linkDaMiniatura,
} from "../../../lib/avaliacao-documental/leitura-dos-arquivos.ts";
import type { ItemParaConferir } from "../../../lib/avaliacao-documental/leitura-dos-arquivos.ts";
import type { EnderecosDaEmpregare } from "../../../lib/avaliacao-documental/anexo-na-empregare.ts";
import {
  comprovadoDaExperiencia,
  diasEmComum,
} from "../../../lib/avaliacao-documental/comprovado-da-ficha.ts";
import type { LeituraDoArquivo } from "../../../lib/avaliacao-documental/leitura-dos-arquivos.ts";
import { tetoDoBloco } from "../../../lib/avaliacao-documental/pontuacao.js";
import { Selo } from "../../../ui/index.js";
import { CamposDoItem } from "./campos-do-item.tsx";
import { ComprovadoDaFicha } from "./comprovado-da-ficha.tsx";
import {
  AreaExigida,
  AvisosDoTituloUnico,
  ExtrasDoBloco,
  RequisitosDoCargo,
} from "./diferencas-do-cargo.tsx";
import { AnexoDeclarado, LinkDaEmpregare } from "./empregare.tsx";
import { ConferenciaDoLido, LidoDoArquivo } from "./leitura-dos-arquivos.tsx";
import {
  comOutroMotivo,
  MotivoEscrito,
  ObservacaoDoItem,
  OPCAO_OUTRO_MOTIVO,
} from "./observacao-do-item.tsx";
import type {
  Bloco,
  ContextoDaEmpregare,
  EstadoDaFicha,
  ItemLancado,
  Lancado,
  Lancamento,
  LinhaDeResposta,
  Mudar,
  Opcao,
  Situacao,
} from "./tipos.ts";

/*
  Um item da ficha (um bloco da regra), na ordem do trabalho do avaliador,
  de cima para baixo:
  1. o que o candidato declarou e o anexo ("Abrir na Empregare"), com o
     "Lido do arquivo" do robô ao lado de cada arquivo e, nos blocos de
     títulos, cursos e vínculos, a conferência de cada item lido (Aceitar /
     Recusar — leitura-dos-arquivos.tsx);
  2. a pergunta "O documento confere com o declarado?" com as escolhas lado
     a lado: Confere · Não confere · Editar nota (esta só nos blocos que
     pontuam; teclas 1, 2 e 3). O que cada uma grava: apurado-da-ficha.ts;
  3. Não confere: só o motivo (chips do bloco, "não enviou" e observação);
     Confere ou Editar nota: a lista de títulos, cursos ou vínculos, com a
     primeira linha já aberta;
  4. o resumo numa linha: "Pontuação: X de 5 · declarou 5" (a diferença só
     se houver; no Editar nota, o passador e "Usar o calculado");
  5. no máximo UMA mensagem: a falta mais útil (mensagemDoBloco, pelas
     pendências da ficha) ou, no Confere, o aviso de que os itens dão outra
     pontuação, com o atalho para Editar nota.
  O que o cargo da vaga muda (diferencas-do-cargo.tsx): a lista de requisitos
  do cargo antes das escolhas, as linhas extras (ex.: UMCQA) depois dos
  itens, o aviso do 8.2.7 e a área exigida da experiência.
  PELOS ITENS (o robô leu títulos, cursos ou vínculos do arquivo): o fluxo é
  conferir os itens → a pontuação sai dos aceitos → o avaliador confirma.
  A conferência (Aceitar / Corrigir / Recusar) e, embaixo, as linhas à mão
  com "Adicionar …" sempre à vista; no rodapé, "Pontuação pelos itens
  aceitos: X de 10 · declarou 10" e Confirmar (Confere se X é o declarado;
  senão Editar nota com a justificativa) · Não confere (o motivo) · "Editar
  nota" só como ajuste fino; confirmado, a "Justificativa do ajuste" (o
  resumo dos aceitos e dos não pontuados, editável: justificativa-dos-itens.ts). Mexer nos itens depois de confirmar volta a
  pedir a confirmação. As situações gravadas são as de sempre
  (apurado-da-ficha.ts).
  No modo lista, o mesmo em cartão compacto. A gravação é a do estado da
  ficha (mudar).
*/

type ChaveDosItens = "titulos" | "cursos" | "vinculos";
const BLOCOS_COM_ITENS = ITENS_DOS_TIPOS as Readonly<
  Record<string, ChaveDosItens | undefined>
>;
const PARCIAL_DO_TIPO = PARCIAIS_DOS_TIPOS as Readonly<
  Record<string, string | undefined>
>;
const ESCOLHAS = ESCOLHAS_DA_FICHA as unknown as ReadonlyArray<
  readonly [Escolha, string, string]
>;
const ICONE_DA_ESCOLHA: Record<Escolha, string> = {
  CONFERE: "fa-check",
  NAO_CONFERE: "fa-xmark",
  EDITAR: "fa-pen",
};

/* O selo do item conferido: [tom, rótulo, ícone]. */
export const SELO_DA_SITUACAO: Record<Situacao, [string, string, string]> = {
  CONFORME: ["aprovado", "Conforme", "fa-check"],
  NAO_CONFORME: ["reprovado", "Não conforme", "fa-xmark"],
  NAO_ENVIADO: ["neutro", "Não enviado", "fa-ban"],
};

function textoDoEfeito(efeito: string) {
  if (efeito === "ELIMINA") return "Elimina";
  if (efeito.startsWith("ENCAMINHA")) return "Encaminha";
  if (efeito === "SEGUE_AMPLA") return "Segue na ampla";
  return "Sem pontos";
}

/* Muda os campos do bloco no lançamento. */
const alterarBloco = (mudar: Mudar, codigo: string, campos: Lancado) =>
  mudar((l) => {
    l.blocos = {
      ...l.blocos,
      [codigo]: { ...(l.blocos?.[codigo] || {}), ...campos },
    };
    return l;
  });

/** O que a escolha precisa saber do candidato: o declarado e as respostas. */
export type ContextoDaEscolha = {
  declarada: EstadoDaFicha["declarada"];
  /** As respostas do candidato no bloco (o título declarado vem pré-escolhido). */
  respostas: string[];
  /** No Não confere: o candidato não enviou o documento (NAO_ENVIADO). */
  naoEnviou?: boolean;
  /** As linhas que o job Python tirou das respostas (obter_ficha_analise → sugestoes). */
  sugestoes?: EstadoDaFicha["dados"]["sugestoes"];
  /** Pelos itens lidos do arquivo: a pontuação dos aceitos (o Confere vira "Confirmar"). */
  pelosItens?: { calculado: number } | null;
};

/** Os itens que o robô leu dos arquivos do bloco, para conferir (sem leitura, nenhum). */
export function lidosDoBloco(
  st: EstadoDaFicha,
  bloco: Bloco,
  enderecos: EnderecosDaEmpregare | null | undefined,
): ItemParaConferir[] {
  const leituras = leiturasDaFicha(st.dados.leituras);
  if (!enderecos || !leituras.length || !BLOCOS_COM_ITENS[bloco.tipo])
    return [];
  if (!blocoSeAplica(bloco, st.lancamento)) return [];
  const linhas = respostasDoBloco(
    bloco,
    st.dados.respostas,
  ) as LinhaDeResposta[];
  // Os arquivos capturados de cada pergunta, mesmo com "--" na exportação.
  return itensParaConferir(
    bloco,
    leituras,
    linhas.flatMap((l) => arquivosDaPergunta(enderecos, l.coluna)),
  );
}

/** O bloco decide pelos itens lidos? (pontua e o robô leu itens.) */
const decidePelosItens = (bloco: Bloco, lidos: ItemParaConferir[]) =>
  lidos.length > 0 && blocoEditaNota(bloco);

/** O contexto da escolha de um bloco, a partir do estado da ficha. */
export function contextoDaEscolha(
  st: EstadoDaFicha,
  bloco: Bloco,
  enderecos?: EnderecosDaEmpregare | null,
): ContextoDaEscolha {
  const linhas = respostasDoBloco(
    bloco,
    st.dados.respostas,
  ) as LinhaDeResposta[];
  const parcial = PARCIAL_DO_TIPO[bloco.tipo] ?? "";
  return {
    declarada: st.declarada,
    respostas: linhas.map((l) => l.texto),
    naoEnviou: sugereNaoEnviado(linhas),
    sugestoes: st.dados.sugestoes,
    pelosItens: decidePelosItens(bloco, lidosDoBloco(st, bloco, enderecos))
      ? { calculado: st.avaliacao.calculados?.[parcial] ?? 0 }
      : null,
  };
}

/**
 * Grava uma escolha (botões ou teclas 1, 2 e 3): a situação, os motivos, a
 * pontuação e, no Confere/Editar sem nada registrado, a primeira linha.
 * Pelos itens, o Confere é o "Confirmar" (Confere ou Editar nota, conforme
 * a pontuação dos aceitos). Devolve a escolha gravada.
 */
export function decidirNoLancamento(
  bloco: Bloco,
  mudar: Mudar,
  escolha: Escolha | null,
  contexto: ContextoDaEscolha,
): Escolha | null {
  if (escolha === "CONFERE" && contexto.pelosItens) {
    const { calculado } = contexto.pelosItens;
    mudar((l) =>
      lancamentoConfirmadoPelosItens({
        bloco,
        lancamento: l,
        declarada: contexto.declarada,
        calculado,
      }),
    );
    return escolhaPelosItens(bloco, contexto.declarada, calculado);
  }
  if (escolha === "EDITAR" && contexto.pelosItens) {
    // Pelos itens, "Editar nota" é o ajuste fino: parte da pontuação dos
    // aceitos (o passador aparece) e não abre linha nova.
    const { calculado } = contexto.pelosItens;
    mudar((l) => {
      const editado = blocoComEscolha({
        bloco,
        lancamento: l,
        escolha: "EDITAR",
        declarada: contexto.declarada,
      }) as Lancado;
      l.blocos = {
        ...l.blocos,
        [bloco.codigo]: {
          ...editado,
          nota_ajustada:
            typeof editado.nota_ajustada === "number"
              ? editado.nota_ajustada
              : calculado,
        },
      };
      return l;
    });
    return "EDITAR";
  }
  mudar((l) =>
    lancamentoComEscolha({
      bloco,
      lancamento: l,
      escolha,
      declarada: contexto.declarada,
      respostas: contexto.respostas,
      naoEnviou: contexto.naoEnviou,
      sugestoes: contexto.sugestoes,
    }),
  );
  return escolha;
}

/* ── A resposta declarada ─────────────────────────────────────────────── */

/*
  O ícone do arquivo: foto com link que abre a imagem direto vira miniatura
  (sem ela, ou se não carregar, o ícone de foto); os outros, o clipe.
*/
function IconeDoArquivo({ arquivo }: { arquivo: ArquivoDoCandidato }) {
  const [falhou, setFalhou] = useState(false);
  if (!anexoEhImagem(arquivo.nome))
    return <i className="fa-solid fa-paperclip" aria-hidden="true" />;
  const miniatura = linkDaMiniatura(arquivo.link);
  if (miniatura && !falhou)
    return (
      <img
        className="avd-ficha-miniatura"
        src={miniatura}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFalhou(true)}
      />
    );
  return <i className="fa-solid fa-image" aria-hidden="true" />;
}

/* Os arquivos da pergunta de anexo, cada um com o link direto e o nome. */
function ArquivosDaPergunta({
  arquivos,
  empregare,
  leituras,
}: {
  arquivos: ArquivoDoCandidato[];
  empregare: ContextoDaEmpregare;
  leituras: LeituraDoArquivo[];
}) {
  return (
    <ul className="avd-ficha-arquivos" aria-label="Arquivos enviados">
      {arquivos.map((a) => (
        <li key={a.link} className="avd-ficha-arquivo-lido">
          <a
            className="avd-ficha-arquivo"
            href={a.link}
            target="_blank"
            rel="noopener noreferrer"
            title={`Abrir ${a.nome} na Empregare`}
            data-imagem={anexoEhImagem(a.nome) || undefined}
            onClick={() =>
              void empregare.loja.registrarAcesso("ABRIR_EMPREGARE")
            }
          >
            <IconeDoArquivo arquivo={a} />
            <span>{a.nome}</span>
            <i
              className="fa-solid fa-arrow-up-right-from-square"
              aria-hidden="true"
            />
          </a>
          <LidoDoArquivo leitura={leituraDoAnexo(leituras, a)} />
        </li>
      ))}
    </ul>
  );
}

function RespostaDeclarada({
  linha,
  empregare,
  comLinkGeral,
  leituras,
}: {
  linha: LinhaDeResposta;
  empregare: ContextoDaEmpregare;
  leituras: LeituraDoArquivo[];
  /** Sem anexo no item: o "Abrir na Empregare" do candidato ao lado da resposta. */
  comLinkGeral?: boolean;
}) {
  const [inteiro, setInteiro] = useState(false);
  const completo = enunciadoCompleto(linha.coluna);
  const temMais = completo.length > linha.enunciado.length + 3;
  const anexo = ehAnexo(linha.texto);
  /*
    Os arquivos capturados da pergunta, cada um com o seu link — também quando
    a exportação traz "--" e a resposta lida tem arquivo nela.
  */
  const arquivos = arquivosDaPergunta(empregare.enderecos, linha.coluna);
  return (
    <div className="avd-ficha-resposta" data-anexo={anexo || undefined}>
      <p className="avd-ficha-pergunta">
        <span>{inteiro ? completo : linha.enunciado}</span>
        {temMais ? (
          <button
            type="button"
            className="avd-ficha-texto-completo"
            aria-expanded={inteiro}
            onClick={() => setInteiro(!inteiro)}
          >
            {inteiro ? "ver menos" : "ver texto completo"}
          </button>
        ) : null}
      </p>
      {arquivos.length ? (
        <ArquivosDaPergunta
          arquivos={arquivos}
          empregare={empregare}
          leituras={leituras}
        />
      ) : (
        <div className="avd-ficha-valor" data-anexo={anexo || undefined}>
          {anexo ? (
            <AnexoDeclarado
              empregare={empregare}
              coluna={linha.coluna}
              texto={linha.texto}
            />
          ) : (
            <>
              <strong className="avd-ficha-texto-declarado">
                {linha.texto || "Sem resposta"}
              </strong>
              {comLinkGeral ? (
                <LinkDaEmpregare
                  empregare={empregare}
                  rotulo="Abrir na Empregare"
                  className="btn secondary small avd-ficha-ver-candidato"
                />
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* "O que o candidato informou": as respostas das perguntas que a regra liga ao bloco. */
function Respostas({
  linhas,
  empregare,
  leituras,
}: {
  linhas: LinhaDeResposta[];
  empregare: ContextoDaEmpregare;
  leituras: LeituraDoArquivo[];
}) {
  const algumAnexo = linhas.some((l) => ehAnexo(l.texto));
  return (
    <div className="avd-ficha-respostas" data-tour="avd-ficha-respostas">
      <p className="avd-ficha-informou">O que o candidato informou</p>
      {linhas.map((l, i) => (
        <RespostaDeclarada
          key={l.coluna}
          linha={l}
          empregare={empregare}
          comLinkGeral={!algumAnexo && i === 0}
          leituras={leituras}
        />
      ))}
    </div>
  );
}

/* ── As escolhas e os chips ───────────────────────────────────────────── */

export function Escolhas({
  valor,
  comEditar,
  aoMudar,
  desabilitado,
  compacto,
  idDaPergunta,
}: {
  valor: Escolha | null;
  /** "Editar nota" só nos blocos que pontuam. */
  comEditar: boolean;
  aoMudar: (escolha: Escolha | null) => void;
  desabilitado: boolean;
  compacto?: boolean;
  idDaPergunta: string;
}) {
  return (
    <div className="avd-ficha-decidir" data-compacto={compacto || undefined}>
      <p
        className={compacto ? "sr-only" : "avd-ficha-decidir-pergunta"}
        id={idDaPergunta}
      >
        {PERGUNTA_DA_DECISAO}
      </p>
      <div
        className="avd-ficha-decisoes"
        role="group"
        aria-labelledby={idDaPergunta}
        data-compacto={compacto || undefined}
        data-opcoes={comEditar ? 3 : 2}
        data-tour="avd-ficha-decisoes"
      >
        {ESCOLHAS.filter(([codigo]) => comEditar || codigo !== "EDITAR").map(
          ([codigo, rotulo, tecla]) => {
            const escolhido = valor === codigo;
            return (
              <button
                key={codigo}
                type="button"
                className="avd-ficha-decisao"
                data-valor={codigo}
                aria-pressed={escolhido}
                aria-keyshortcuts={tecla}
                title={`${rotulo} (tecla ${tecla})`}
                disabled={desabilitado}
                // Clicar de novo na escolha marcada confirma (não desmarca):
                // quem completa a linha e clica Confere outra vez segue adiante.
                onClick={() => aoMudar(codigo)}
              >
                <span className="avd-ficha-decisao-icone" aria-hidden="true">
                  <i className={`fa-solid ${ICONE_DA_ESCOLHA[codigo]}`} />
                </span>
                <span className="avd-ficha-decisao-rotulo">{rotulo}</span>
              </button>
            );
          },
        )}
      </div>
    </div>
  );
}

export function Chips({
  rotulo,
  opcoes,
  marcados,
  aoMudar,
  desabilitado,
  tour,
  rotuloOculto,
}: {
  rotulo: string;
  opcoes: Opcao[];
  marcados: string[];
  aoMudar: (marcados: string[]) => void;
  desabilitado: boolean;
  tour?: string;
  /** O rótulo já aparece em volta (o resumo do "Outras justificativas"). */
  rotuloOculto?: boolean;
}) {
  return (
    <div
      className="avd-ficha-chips"
      role="group"
      aria-label={rotulo}
      data-tour={tour}
    >
      <span className={rotuloOculto ? "sr-only" : "avd-ficha-rotulo"}>
        {rotulo}
      </span>
      <div className="avd-ficha-chips-lista">
        {opcoes.map((o) => {
          const marcado = marcados.includes(o.codigo);
          return (
            <button
              key={o.codigo}
              type="button"
              className="avd-ficha-chip"
              data-motivo={o.codigo}
              aria-pressed={marcado}
              disabled={desabilitado}
              onClick={() =>
                aoMudar(
                  marcado
                    ? marcados.filter((c) => c !== o.codigo)
                    : [...marcados, o.codigo],
                )
              }
            >
              {marcado ? (
                <i className="fa-solid fa-check" aria-hidden="true" />
              ) : null}
              {o.texto}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Não confere: só o motivo ─────────────────────────────────────────── */

function NaoConfere({
  st,
  bloco,
  lancado,
  mudar,
  desabilitado,
}: {
  st: EstadoDaFicha;
  bloco: Bloco;
  lancado: Lancado;
  mudar: Mudar;
  desabilitado: boolean;
}) {
  const motivos = bloco.motivos || [];
  const naoEnviou = lancado.situacao === "NAO_ENVIADO";
  const marcados = lancado.motivos || [];
  const alterar = (campos: Lancado) =>
    alterarBloco(mudar, bloco.codigo, campos);
  return (
    <div className="avd-ficha-nao-confere" data-tour="avd-ficha-motivos">
      {motivos.length ? (
        <Chips
          rotulo="Por que não confere?"
          opcoes={[...motivos, OPCAO_OUTRO_MOTIVO]}
          marcados={marcados}
          desabilitado={desabilitado}
          aoMudar={(escolhidos) =>
            alterar(comOutroMotivo("motivos", escolhidos, lancado))
          }
        />
      ) : null}
      {/* Sem motivos na regra, o texto é o motivo; com motivos, só no "Outro". */}
      {!motivos.length || marcouOutroMotivo(marcados) ? (
        <MotivoEscrito
          codigo={bloco.codigo}
          rotulo={motivos.length ? "Descreva o motivo" : "Motivo"}
          lancado={lancado}
          desabilitado={desabilitado}
          aoMudar={alterar}
        />
      ) : null}
      <label className="avd-ficha-opcao avd-ficha-nao-enviou">
        <input
          type="checkbox"
          checked={naoEnviou}
          disabled={desabilitado}
          onChange={(ev) => {
            const marcado = ev.target.checked;
            mudar((l) => {
              l.blocos = {
                ...l.blocos,
                [bloco.codigo]: blocoComEscolha({
                  bloco,
                  lancamento: l,
                  escolha: "NAO_CONFERE",
                  declarada: st.declarada,
                  naoEnviou: marcado,
                }) as Lancado,
              };
              return l;
            });
          }}
        />{" "}
        O candidato não enviou o documento
      </label>
    </div>
  );
}

/* ── Títulos, cursos e vínculos ───────────────────────────────────────── */

const ROTULO_DO_NOVO: Record<ChaveDosItens, string> = {
  titulos: "Adicionar título",
  cursos: "Adicionar curso",
  vinculos: "Adicionar vínculo",
};

const ROTULO_DO_TIRADO: Record<ChaveDosItens, string> = {
  titulos: "Título tirado.",
  cursos: "Curso tirado.",
  vinculos: "Vínculo tirado.",
};

/* A linha recém-aberta, ainda em branco (o foco vai para ela). */
const emBranco = (chave: ChaveDosItens, it: ItemLancado) =>
  chave !== "titulos" &&
  !itemCompleto(chave, it) &&
  !String(it.nome ?? it.empregador ?? "").trim();

function Itens({
  bloco,
  lancamento,
  declarada,
  respostas,
  mudar,
  desabilitado,
  experiencia,
  pedeCampos,
  sugestoes,
  soAMao = false,
}: {
  bloco: Bloco;
  lancamento: Lancamento;
  declarada: EstadoDaFicha["declarada"];
  respostas: string[];
  mudar: Mudar;
  desabilitado: boolean;
  experiencia: EstadoDaFicha["avaliacao"]["experiencia"];
  /** Confere ou Editar nota: o campo que falta fica marcado. */
  pedeCampos: boolean;
  sugestoes: EstadoDaFicha["dados"]["sugestoes"];
  /**
   * Pelos itens lidos: só as linhas digitadas à mão (as aceitas do arquivo
   * estão na conferência), sem abrir linha sozinha e sem o "Comprovado"
   * (vai no rodapé da decisão).
   */
  soAMao?: boolean;
}) {
  // O item tirado pelo "×", para o "Desfazer" (o clique não pede confirmação).
  const [tirado, setTirado] = useState<ItemTirado<ItemLancado> | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const chave = BLOCOS_COM_ITENS[bloco.tipo];
  const lista = (l: Lancamento) =>
    (chave ? l[chave] || [] : []) as ItemLancado[];
  const novo = () =>
    novoItemDoBloco(bloco, lancamento.nivel, respostas) as ItemLancado;
  // Rascunho de antes desta tela, já Confere sem nada registrado: a primeira
  // linha abre ao mostrar a lista (a mesma da escolha).
  const abrir =
    !soAMao && !desabilitado && abreComLinhaNova(bloco, lancamento, declarada);
  useEffect(() => {
    if (!abrir) return;
    mudar((l) => comLinhaAberta(bloco, l, declarada, respostas, sugestoes));
    // Só quando volta a ficar vazia.
  }, [abrir]);
  const itens = lista(lancamento);
  // A posição de cada linha na lista do lançamento (pelos itens, só as à mão).
  const visiveis = itens
    .map((it, i) => [it, i] as const)
    .filter(([it]) => !soAMao || !it.do_arquivo);
  const primeiraEmBranco =
    chave &&
    visiveis.length === 1 &&
    visiveis[0] &&
    emBranco(chave, visiveis[0][0]);
  useEffect(() => {
    if (!primeiraEmBranco || desabilitado) return;
    caixa.current
      ?.querySelector<HTMLElement>(
        ".avd-ficha-item input, .avd-ficha-item select",
      )
      ?.focus();
  }, [primeiraEmBranco]);
  if (!chave) return null;
  const alterar = (i: number, campos: Partial<ItemLancado>) =>
    mudar((l) => {
      // Mexeu na linha que veio da resposta: agora é do avaliador.
      l[chave] = lista(l).map((it, j) =>
        j === i ? { ...it, ...campos, da_resposta: undefined } : it,
      );
      return l;
    });
  return (
    <div
      className="avd-ficha-itens"
      data-tour="avd-ficha-itens"
      data-so-a-mao={soAMao || undefined}
      ref={caixa}
    >
      {soAMao && visiveis.length ? (
        <p className="avd-ficha-itens-rotulo">Digitados à mão</p>
      ) : null}
      {visiveis.length ? (
        <ul className="avd-ficha-itens-lista">
          {visiveis.map(([it, i]) => (
            <li
              key={i}
              className="avd-ficha-item"
              data-chave={chave}
              data-aceito={it.aceito !== false}
            >
              <CamposDoItem
                chave={chave}
                bloco={bloco}
                nivel={lancamento.nivel}
                item={it}
                pedeCampos={pedeCampos}
                desabilitado={desabilitado}
                aoAlterar={(campos) => alterar(i, campos)}
              />
              {it.do_arquivo ? (
                <span
                  className="avd-ficha-da-resposta"
                  data-origem="arquivo"
                  title="Lido do arquivo pelo robô e aceito: confira no documento"
                >
                  <i className="fa-solid fa-file-lines" aria-hidden="true" />{" "}
                  {it.corrigido
                    ? "lido do arquivo, corrigido"
                    : "lido do arquivo"}
                </span>
              ) : it.da_resposta ? (
                <span
                  className="avd-ficha-da-resposta"
                  title="Preenchido pela resposta do candidato: confira no documento"
                >
                  <i
                    className="fa-solid fa-wand-magic-sparkles"
                    aria-hidden="true"
                  />{" "}
                  da resposta do candidato
                </span>
              ) : null}
              <label className="avd-ficha-aceito">
                <input
                  type="checkbox"
                  checked={it.aceito !== false}
                  disabled={desabilitado}
                  onChange={(ev) =>
                    alterar(i, {
                      aceito: ev.target.checked,
                      motivo: ev.target.checked ? null : it.motivo,
                    })
                  }
                />{" "}
                Aceito
              </label>
              {it.aceito === false ? (
                <select
                  aria-label="Motivo da recusa"
                  className="avd-ficha-item-motivo"
                  value={it.motivo || ""}
                  disabled={desabilitado}
                  onChange={(ev) =>
                    alterar(i, { motivo: ev.target.value || null })
                  }
                >
                  <option value="">Motivo da recusa…</option>
                  {(bloco.motivos || []).map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {m.texto}
                    </option>
                  ))}
                </select>
              ) : null}
              {!desabilitado ? (
                <button
                  type="button"
                  className="avd-ficha-tirar"
                  aria-label="Tirar o item"
                  title="Tirar o item"
                  onClick={() =>
                    mudar((l) => {
                      const r = tirarItem(lista(l), i);
                      l[chave] = r.itens;
                      setTirado(r.tirado);
                      return l;
                    })
                  }
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {tirado && !desabilitado ? (
        <p className="avd-ficha-tirado" role="status">
          {ROTULO_DO_TIRADO[chave]}
          <button
            type="button"
            className="avd-ficha-link"
            onClick={() => {
              const devolver = tirado;
              setTirado(null);
              mudar((l) => {
                l[chave] = devolverItem(lista(l), devolver);
                return l;
              });
            }}
          >
            Desfazer
          </button>
        </p>
      ) : null}
      <div className="avd-ficha-itens-pe">
        {!desabilitado ? (
          <button
            type="button"
            className="avd-ficha-adicionar"
            title={
              soAMao
                ? "Quando a leitura não achou ou errou: digite o item como está no documento"
                : undefined
            }
            onClick={() => {
              setTirado(null);
              mudar((l) => {
                l[chave] = [...lista(l), novo()];
                return l;
              });
            }}
          >
            <i className="fa-solid fa-plus" aria-hidden="true" />{" "}
            {ROTULO_DO_NOVO[chave]}
          </button>
        ) : null}
        {!soAMao &&
        itens.some((it) => it.aceito !== false && itemCompleto(chave, it)) ? (
          <ComprovadoDaFicha
            bloco={bloco}
            lancamento={lancamento}
            experiencia={experiencia}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ── O resumo: "Pontuação: X de 5 · declarou 5" ───────────────────────── */

function Resultado({
  st,
  bloco,
  lancado,
  escolha,
  mudar,
  desabilitado,
}: {
  st: EstadoDaFicha;
  bloco: Bloco;
  lancado: Lancado;
  escolha: Escolha;
  mudar: Mudar;
  desabilitado: boolean;
}) {
  const { lancamento, avaliacao, declarada } = st;
  const parcial = PARCIAL_DO_TIPO[bloco.tipo] ?? "";
  const calculado = avaliacao.calculados?.[parcial] ?? 0;
  const decl = declaradoDoBloco(bloco, declarada);
  const teto = tetoDoBloco(bloco, lancamento.nivel) as number | null;
  const ajuste =
    typeof lancado.nota_ajustada === "number" ? lancado.nota_ajustada : null;
  // O que a conta dá (o efeito do bloco vale); no Editar, o ajuste por cima.
  const valor =
    escolha === "EDITAR"
      ? (ajuste ?? apuradoDoBloco({ bloco, lancamento, calculado }).valor)
      : (avaliacao.parciais?.[parcial] ?? 0);
  const diferenca = decl !== null ? valor - decl : null;
  const temDiferenca = diferenca !== null && Math.abs(diferenca) >= 0.005;
  const editar = escolha === "EDITAR";
  const definir = (v: number | null) => {
    const limitado =
      v === null ? null : Math.max(0, teto !== null ? Math.min(teto, v) : v);
    alterarBloco(mudar, bloco.codigo, { nota_ajustada: limitado });
  };
  const idDoValor = `avdPontuacao-${bloco.codigo}`;
  return (
    <div
      className="avd-ficha-resultado"
      data-tour="avd-ficha-nota"
      data-diferenca={
        !temDiferenca ? "nenhuma" : (diferenca ?? 0) < 0 ? "menor" : "maior"
      }
    >
      <span className="avd-ficha-resultado-rotulo" id={idDoValor}>
        Pontuação:
      </span>
      {editar ? (
        <span className="avd-ficha-passador">
          <button
            type="button"
            aria-label="Diminuir meio ponto"
            disabled={desabilitado || valor <= 0}
            onClick={() => definir(valor - 0.5)}
          >
            −
          </button>
          <input
            type="number"
            min="0"
            max={teto ?? undefined}
            step="0.5"
            inputMode="decimal"
            aria-labelledby={idDoValor}
            value={valor}
            disabled={desabilitado}
            onChange={(ev) =>
              definir(ev.target.value === "" ? null : Number(ev.target.value))
            }
          />
          <button
            type="button"
            aria-label="Aumentar meio ponto"
            disabled={desabilitado || (teto !== null && valor >= teto)}
            onClick={() => definir(valor + 0.5)}
          >
            +
          </button>
        </span>
      ) : (
        <strong className="avd-ficha-resultado-valor">
          {textoDaNota(valor)}
        </strong>
      )}
      {teto !== null ? (
        <span className="avd-ficha-resultado-teto">de {textoDaNota(teto)}</span>
      ) : null}
      {decl !== null ? (
        <span className="avd-ficha-resultado-declarado">
          · declarou {textoDaNota(decl)}
        </span>
      ) : null}
      {temDiferenca ? (
        <span className="avd-ficha-resultado-diferenca">
          {(diferenca ?? 0) > 0 ? "+" : "−"}
          {textoDaNota(Math.abs(diferenca ?? 0))}
        </span>
      ) : null}
      {editar && ajuste !== null && ajuste !== calculado && !desabilitado ? (
        <button
          type="button"
          className="avd-ficha-link"
          onClick={() =>
            alterarBloco(mudar, bloco.codigo, { nota_ajustada: null })
          }
        >
          Usar o calculado ({textoDaNota(calculado)})
        </button>
      ) : null}
    </div>
  );
}

/* O resumo dos itens do bloco e se o item pede a justificativa. */
const justificativaDosItens = (st: EstadoDaFicha, bloco: Bloco) =>
  justificativaDoBloco(
    st as unknown as RetratoDaFicha,
    bloco as unknown as BlocoComItens,
    st.dados.leituras,
  );

/*
  "Justificativa do ajuste": o resumo dos itens aceitos e dos não pontuados,
  já preenchido no campo justificativa_livre (estado-da-ficha.js) e editável;
  o texto entra no parecer. Quando o texto não é o resumo atual (editado, ou
  os itens mudaram depois de editar), "Usar o resumo dos itens" volta a ele.
*/
function JustificativaDoAjuste({
  st,
  bloco,
  lancado,
  mudar,
  desabilitado,
  rotulo = "Justificativa do ajuste",
}: {
  st: EstadoDaFicha;
  bloco: Bloco;
  lancado: Lancado;
  mudar: Mudar;
  desabilitado: boolean;
  rotulo?: string;
}) {
  const { texto: resumo } = justificativaDosItens(st, bloco);
  const valor = lancado.justificativa_livre || "";
  const id = `avdJustificativaDoAjuste-${bloco.codigo}`;
  return (
    <div
      className="avd-ficha-justificativa-do-ajuste"
      data-tour="avd-ficha-justificativa-do-ajuste"
    >
      <div className="avd-ficha-justificativa-do-ajuste-topo">
        <label className="avd-ficha-rotulo" htmlFor={id}>
          {rotulo}
        </label>
        {resumo && valor !== resumo && !desabilitado ? (
          <button
            type="button"
            className="avd-ficha-link"
            onClick={() =>
              alterarBloco(mudar, bloco.codigo, { justificativa_livre: resumo })
            }
          >
            Usar o resumo dos itens
          </button>
        ) : null}
      </div>
      <textarea
        id={id}
        rows={3}
        value={valor}
        maxLength={TAMANHO_DA_JUSTIFICATIVA}
        disabled={desabilitado}
        onChange={(ev) =>
          alterarBloco(mudar, bloco.codigo, {
            // Uma linha só: o parecer lista uma observação por linha.
            justificativa_livre: ev.target.value.replace(/\s*\n\s*/g, " "),
          })
        }
      />
    </div>
  );
}

/* A justificativa da pontuação diferente da declarada (uma só área). */
function Justificativa({
  st,
  bloco,
  lancado,
  mudar,
  desabilitado,
  textoNoRodape = false,
}: {
  st: EstadoDaFicha;
  bloco: Bloco;
  lancado: Lancado;
  mudar: Mudar;
  desabilitado: boolean;
  /** Pelos itens: a "Justificativa do ajuste" fica no rodapé da decisão. */
  textoNoRodape?: boolean;
}) {
  const regra = st.dados.regra.configuracao;
  const divergencia = divergenciaDoBloco(bloco, st.avaliacao, st.declarada) as {
    diferenca: number;
  } | null;
  const marcadas = lancado.justificativas || [];
  // Bloco com itens: o texto é a "Justificativa do ajuste" (resumo dos itens).
  const comItens = Boolean(BLOCOS_COM_ITENS[bloco.tipo]);
  const comTexto =
    Boolean(lancado.justificativa_livre) ||
    (comItens && justificativaDosItens(st, bloco).precisa);
  if (lancado.situacao !== "CONFORME") return null;
  if (
    !divergencia &&
    !marcadas.length &&
    (!comTexto || (comItens && textoNoRodape))
  )
    return null;
  const { doBloco, outras } = justificativasDoBloco(regra, bloco);
  const opcoes: Opcao[] = [...doBloco, ...outras];
  const outraMarcada = outras.some((o) => marcadas.includes(o.codigo));
  const rotulo =
    divergencia && divergencia.diferenca < 0
      ? "Por que a pontuação é menor que a declarada?"
      : "Justificativa da pontuação";
  const mudarJustificativas = (justificativas: string[]) =>
    alterarBloco(
      mudar,
      bloco.codigo,
      comOutroMotivo("justificativas", justificativas, lancado),
    );
  return (
    <div
      className="avd-ficha-justificativa"
      data-tour="avd-ficha-justificativa"
    >
      {opcoes.length ? (
        <Chips
          rotulo={rotulo}
          opcoes={[...doBloco, OPCAO_OUTRO_MOTIVO]}
          marcados={marcadas}
          desabilitado={desabilitado}
          aoMudar={mudarJustificativas}
        />
      ) : null}
      {marcouOutroMotivo(marcadas) ? (
        <MotivoEscrito
          codigo={bloco.codigo}
          lancado={lancado}
          desabilitado={desabilitado}
          aoMudar={(campos) => alterarBloco(mudar, bloco.codigo, campos)}
        />
      ) : null}
      {outras.length ? (
        <details
          className="avd-ficha-outras-justificativas"
          open={outraMarcada || !doBloco.length || undefined}
        >
          <summary>Outras justificativas ({outras.length})</summary>
          <Chips
            rotulo="Outras justificativas"
            rotuloOculto
            opcoes={outras}
            marcados={marcadas}
            desabilitado={desabilitado}
            aoMudar={mudarJustificativas}
          />
        </details>
      ) : null}
      {comItens ? (
        textoNoRodape ? null : (
          <JustificativaDoAjuste
            st={st}
            bloco={bloco}
            lancado={lancado}
            mudar={mudar}
            desabilitado={desabilitado}
            rotulo={
              opcoes.length || !divergencia
                ? "Justificativa do ajuste"
                : "Justificativa do ajuste (10 caracteres ou mais)"
            }
          />
        )
      ) : opcoes.length ? null : (
        // Sem justificativas na regra, o texto é a justificativa (o comentário
        // à parte vai na Observação do avaliador, no fim do card).
        <label className="avd-ficha-campo">
          <span className="avd-ficha-rotulo">
            {rotulo} (10 caracteres ou mais)
          </span>
          <input
            value={lancado.justificativa_livre || ""}
            maxLength={TAMANHO_DA_JUSTIFICATIVA}
            disabled={desabilitado}
            onChange={(ev) =>
              alterarBloco(mudar, bloco.codigo, {
                justificativa_livre: ev.target.value,
              })
            }
          />
        </label>
      )}
    </div>
  );
}

function Etnico({
  lancamento,
  mudar,
  desabilitado,
}: {
  lancamento: Lancamento;
  mudar: Mudar;
  desabilitado: boolean;
}) {
  const caixa = (
    campo: "indigena" | "mora_aldeia" | "aldeia_na_lista",
    rotulo: string,
  ) => (
    <label className="avd-ficha-opcao">
      <input
        type="checkbox"
        checked={Boolean(lancamento[campo])}
        disabled={desabilitado}
        onChange={(ev) =>
          mudar((l) => {
            l[campo] = ev.target.checked;
            return l;
          })
        }
      />{" "}
      {rotulo}
    </label>
  );
  return (
    <div className="avd-ficha-etnico">
      {caixa("indigena", "Indígena")}
      {caixa("mora_aldeia", "Mora em aldeia")}
      {caixa("aldeia_na_lista", "Aldeia na lista do DSEI")}
    </div>
  );
}

/* ── Pelos itens: o rodapé da decisão ─────────────────────────────────── */

const milBr = (n: number) => n.toLocaleString("pt-BR");

/*
  "Pontuação pelos itens aceitos: X de 10 · declarou 10" e, na Experiência,
  o tempo já unido ("Comprovado: … · 1.160 dias") com os dias em comum entre
  vínculos (contam uma vez, sem alerta). Confirmar · Não confere e o "Editar
  nota" discreto, só para o ajuste fino. As teclas 1, 2 e 3 ficam na dica.
  Confirmado, embaixo, a "Justificativa do ajuste" quando o item precisa
  (pontuação diferente da declarada ou item não pontuado) ou já tem texto.
*/
function DecisaoPelosItens({
  st,
  bloco,
  lancado,
  escolha,
  calculado,
  desabilitado,
  mudar,
  aoEscolher,
}: {
  st: EstadoDaFicha;
  bloco: Bloco;
  lancado: Lancado;
  escolha: Escolha | null;
  calculado: number;
  desabilitado: boolean;
  mudar: Mudar;
  aoEscolher: (escolha: Escolha) => void;
}) {
  const { lancamento } = st;
  const decl = declaradoDoBloco(bloco, st.declarada);
  const teto = tetoDoBloco(bloco, lancamento.nivel) as number | null;
  const diferenca = decl !== null ? calculado - decl : null;
  const temDiferenca = diferenca !== null && Math.abs(diferenca) >= 0.005;
  const confirmado = escolha === "CONFERE" || escolha === "EDITAR";
  const mostraJustificativa =
    confirmado &&
    lancado.situacao === "CONFORME" &&
    (Boolean(lancado.justificativa_livre) ||
      justificativaDosItens(st, bloco).precisa);
  const idDoResumo = `avdPelosItens-${bloco.codigo}`;
  let tempo: { texto: string; dias: number; comum: number } | null = null;
  if (bloco.tipo === "VINCULOS") {
    const exp = st.avaliacao.experiencia;
    tempo = {
      texto: comprovadoDaExperiencia(
        bloco as Parameters<typeof comprovadoDaExperiencia>[0],
        exp,
        lancamento.nivel,
      ).texto,
      dias: exp?.dias_total ?? 0,
      comum: diasEmComum(
        bloco as Parameters<typeof diasEmComum>[0],
        lancamento.vinculos as Parameters<typeof diasEmComum>[1],
      ),
    };
  }
  return (
    <div
      className="avd-ficha-pelos-itens"
      data-tour="avd-ficha-decisoes"
      data-diferenca={
        !temDiferenca ? "nenhuma" : (diferenca ?? 0) < 0 ? "menor" : "maior"
      }
    >
      <p className="avd-ficha-pelos-itens-resumo" id={idDoResumo}>
        <span className="avd-ficha-resultado-rotulo">
          Pontuação pelos itens aceitos:
        </span>{" "}
        <strong className="avd-ficha-resultado-valor">
          {textoDaNota(calculado)}
        </strong>
        {teto !== null ? (
          <span className="avd-ficha-resultado-teto">
            {" "}
            de {textoDaNota(teto)}
          </span>
        ) : null}
        {decl !== null ? (
          <span className="avd-ficha-resultado-declarado">
            {" "}
            · declarou {textoDaNota(decl)}
          </span>
        ) : null}
        {temDiferenca ? (
          <span className="avd-ficha-resultado-diferenca">
            {(diferenca ?? 0) > 0 ? "+" : "−"}
            {textoDaNota(Math.abs(diferenca ?? 0))}
          </span>
        ) : null}
      </p>
      {tempo ? (
        <p className="avd-ficha-pelos-itens-tempo">
          {tempo.texto}
          {tempo.dias ? ` · ${milBr(tempo.dias)} dias` : ""}
          {tempo.comum > 0 ? (
            <span className="avd-ficha-pelos-itens-comum">
              {" "}
              · {milBr(tempo.comum)}{" "}
              {tempo.comum === 1 ? "dia em comum" : "dias em comum"} entre
              vínculos {tempo.comum === 1 ? "conta" : "contam"} uma vez
            </span>
          ) : null}
        </p>
      ) : null}
      <div
        className="avd-ficha-pelos-itens-acoes"
        role="group"
        aria-labelledby={idDoResumo}
      >
        <button
          type="button"
          className="avd-ficha-decisao"
          data-valor="CONFERE"
          data-acao="confirmar-pelos-itens"
          aria-pressed={confirmado}
          aria-keyshortcuts="1"
          title={
            temDiferenca
              ? "Confirmar a pontuação dos itens aceitos (diferente do declarado: pede a justificativa) — tecla 1"
              : "Confirmar a pontuação dos itens aceitos — tecla 1"
          }
          disabled={desabilitado}
          onClick={() => aoEscolher("CONFERE")}
        >
          <span className="avd-ficha-decisao-icone" aria-hidden="true">
            <i className="fa-solid fa-check" />
          </span>
          <span className="avd-ficha-decisao-rotulo">
            {confirmado ? "Confirmado" : "Confirmar"}
          </span>
        </button>
        <button
          type="button"
          className="avd-ficha-decisao"
          data-valor="NAO_CONFERE"
          aria-pressed={escolha === "NAO_CONFERE"}
          aria-keyshortcuts="2"
          title="Não confere (o documento não comprova) — tecla 2"
          disabled={desabilitado}
          onClick={() => aoEscolher("NAO_CONFERE")}
        >
          <span className="avd-ficha-decisao-icone" aria-hidden="true">
            <i className="fa-solid fa-xmark" />
          </span>
          <span className="avd-ficha-decisao-rotulo">Não confere</span>
        </button>
        {!desabilitado ? (
          <button
            type="button"
            className="avd-ficha-link avd-ficha-ajuste-fino"
            data-valor="EDITAR"
            aria-pressed={escolha === "EDITAR"}
            aria-keyshortcuts="3"
            title="Ajuste fino da pontuação, com justificativa — tecla 3"
            onClick={() => aoEscolher("EDITAR")}
          >
            <i className="fa-solid fa-pen" aria-hidden="true" /> Editar nota
          </button>
        ) : null}
      </div>
      {mostraJustificativa ? (
        <JustificativaDoAjuste
          st={st}
          bloco={bloco}
          lancado={lancado}
          mudar={mudar}
          desabilitado={desabilitado}
        />
      ) : null}
    </div>
  );
}

/* ── A mensagem única do item ─────────────────────────────────────────── */

type Mensagem = {
  texto: string;
  tom: "falta" | "dica";
  acao?: { rotulo: string; aoClicar: () => void };
};

/* ── O item ───────────────────────────────────────────────────────────── */

export type PropriedadesDoItem = {
  st: EstadoDaFicha;
  bloco: Bloco;
  modo: "foco" | "lista";
  /** "Item 3 de 6" no modo foco. */
  numero?: { atual: number; total: number } | null;
  ativo: boolean;
  desabilitado: boolean;
  /** "Escolha Confere…" só depois de tentar concluir. */
  mostrarFaltaDeSituacao: boolean;
  empregare: ContextoDaEmpregare;
  mudar: Mudar;
  /** Depois da escolha; `itensAntes`: quantos itens o bloco tinha antes. */
  aoDecidir?: (
    codigo: string,
    escolha: Escolha | null,
    itensAntes: number,
  ) => void;
  aoFocar?: () => void;
  /** Conteúdo extra no rodapé do item (o "não se aplica" da lista). */
  children?: ReactNode;
};

export function ItemDaFicha({
  st,
  bloco,
  modo,
  numero,
  ativo,
  desabilitado,
  mostrarFaltaDeSituacao,
  empregare,
  mudar,
  aoDecidir,
  aoFocar,
  children,
}: PropriedadesDoItem) {
  const { lancamento, avaliacao, dados, pendencias } = st;
  const lancado: Lancado = lancamento.blocos?.[bloco.codigo] || {};
  const linhas = respostasDoBloco(bloco, dados.respostas) as LinhaDeResposta[];
  const aplica = blocoSeAplica(bloco, lancamento);
  const pedeSituacao = bloco.tipo !== "REGISTRO" && aplica;
  const parcial = PARCIAL_DO_TIPO[bloco.tipo];
  const chave = BLOCOS_COM_ITENS[bloco.tipo];
  const calculado = parcial ? (avaliacao.calculados?.[parcial] ?? 0) : null;
  const escolha = pedeSituacao
    ? escolhaDoBloco(bloco, lancado, st.declarada, calculado)
    : null;
  const conferido = escolha !== null;
  const avaliado = avaliacao.blocos.find((b) => b.codigo === bloco.codigo);
  const situacao = lancado.situacao ? SELO_DA_SITUACAO[lancado.situacao] : null;
  const respostas = linhas.map((l) => l.texto);
  const foco = modo === "foco";
  // O que o robô leu dos arquivos do bloco (20261009220000): sem leitura, nada aparece.
  const leituras = leiturasDaFicha(dados.leituras);
  const lidos = aplica ? lidosDoBloco(st, bloco, empregare.enderecos) : [];
  // Pelos itens: conferir os lidos → a pontuação sai dos aceitos → confirmar.
  const pelosItens = pedeSituacao && decidePelosItens(bloco, lidos);
  const contexto: ContextoDaEscolha = {
    declarada: st.declarada,
    respostas,
    naoEnviou: sugereNaoEnviado(linhas),
    sugestoes: dados.sugestoes,
    pelosItens: pelosItens ? { calculado: calculado ?? 0 } : null,
  };
  // Pelos itens, mexer nos itens depois de confirmar volta a pedir a confirmação.
  const mudarItens: Mudar = pelosItens
    ? (transformar) =>
        mudar((l) => {
          const antes = { ...l };
          return semConfirmacaoSeMudouItens(bloco, antes, transformar(l));
        })
    : mudar;
  // A lista aparece no Confere e no Editar (e num rascunho com itens sem decisão).
  const itensLancados = chave ? (lancamento[chave] as ItemLancado[]) || [] : [];
  const escolher = (nova: Escolha | null) => {
    // A mesma escolha de novo só confirma: nada muda no lançamento (o "não
    // enviou", os motivos e o ajuste ficam) e o item avança se nada falta.
    // Pelos itens, Confirmar sempre grava (a pontuação dos aceitos pode ter
    // mudado) e o "Editar nota" abre o ajuste fino mesmo já em Editar.
    const gravada =
      nova !== escolha ||
      (pelosItens && (nova === "CONFERE" || nova === "EDITAR"))
        ? decidirNoLancamento(bloco, mudar, nova, contexto)
        : nova;
    aoDecidir?.(bloco.codigo, gravada, itensLancados.length);
  };
  const mostraItens =
    !pelosItens &&
    aplica &&
    Boolean(chave) &&
    (escolha === "CONFERE" ||
      escolha === "EDITAR" ||
      (escolha === null && itensLancados.length > 0));

  // A única mensagem: a falta mais útil; sem falta, a dica do momento.
  let mensagem: Mensagem | null = null;
  const falta = pedeSituacao
    ? mensagemDoBloco(pendencias, bloco.codigo, {
        comSituacao: mostrarFaltaDeSituacao,
      })
    : null;
  const decl = parcial ? declaradoDoBloco(bloco, st.declarada) : null;
  if (falta) mensagem = { texto: falta, tom: "falta" };
  else if (pedeSituacao && !escolha && sugereNaoEnviado(linhas))
    mensagem = {
      texto: "Sem resposta: o candidato provavelmente não enviou o documento.",
      tom: "dica",
    };
  else if (
    !pelosItens &&
    escolha === "CONFERE" &&
    chave &&
    decl !== null &&
    calculado !== null &&
    Math.abs(calculado - decl) >= 0.005 &&
    itensLancados.some((it) => it.aceito !== false && itemCompleto(chave, it))
  )
    mensagem = {
      texto: `Pelos itens registrados, a pontuação seria ${textoDaNota(calculado)}.`,
      tom: "dica",
      acao: desabilitado
        ? undefined
        : { rotulo: "Editar nota", aoClicar: () => escolher("EDITAR") },
    };

  return (
    <section
      className="avd-ficha-cartao"
      data-modo={modo}
      data-bloco={bloco.codigo}
      data-situacao={aplica ? lancado.situacao || "" : "NAO_SE_APLICA"}
      data-escolha={escolha || undefined}
      data-ativo={ativo ? "sim" : undefined}
      aria-labelledby={`avdBloco-${bloco.codigo}`}
      tabIndex={-1}
      onFocus={aoFocar}
      onClick={aoFocar}
    >
      <header className="avd-ficha-cartao-topo">
        {foco && numero ? (
          <p className="avd-ficha-sobretitulo">
            Item {numero.atual} de {numero.total}
            {bloco.item_edital ? ` · item ${bloco.item_edital} do edital` : ""}
          </p>
        ) : null}
        <div className="avd-ficha-titulo">
          <h3 id={`avdBloco-${bloco.codigo}`}>{bloco.titulo}</h3>
          {!foco && conferido && situacao ? (
            <Selo tom={situacao[0]} className="avd-ficha-selo-situacao">
              <i className={`fa-solid ${situacao[2]}`} aria-hidden="true" />{" "}
              {situacao[1]}
            </Selo>
          ) : null}
          {conferido &&
          avaliado?.efeito &&
          avaliado.efeito !== "SO_REGISTRO" ? (
            <Selo tom={avaliado.efeito === "ELIMINA" ? "reprovado" : "revisar"}>
              {textoDoEfeito(avaliado.efeito)}
            </Selo>
          ) : null}
          {!aplica ? (
            <Selo>
              {bloco.nao_se_aplica === true
                ? "Não se aplica a este cargo"
                : blocoNaoPontuaNoNivel(bloco, lancamento.nivel)
                  ? "Não pontua neste nível"
                  : "Não se aplica"}
            </Selo>
          ) : null}
          {!foco && bloco.item_edital ? (
            <span className="avd-ficha-item-edital">
              Item {bloco.item_edital}
            </span>
          ) : null}
        </div>
      </header>
      {aplica || bloco.tipo === "PONTUACAO" ? (
        <div className="avd-ficha-cartao-corpo">
          {aplica && bloco.area ? <AreaExigida area={bloco.area} /> : null}
          {aplica && linhas.length ? (
            <Respostas
              linhas={linhas}
              empregare={empregare}
              leituras={leituras}
            />
          ) : aplica &&
            semPerguntaNoQuestionario(bloco, dados.respostas, linhas.length) ? (
            <p className="avd-ficha-sem-pergunta">
              O questionário desta vaga não tem pergunta para este item.
            </p>
          ) : null}
          <ConferenciaDoLido
            bloco={bloco}
            itens={lidos}
            lancamento={lancamento}
            mudar={mudarItens}
            desabilitado={desabilitado}
            empregare={empregare}
          >
            {pelosItens ? (
              <Itens
                bloco={bloco}
                lancamento={lancamento}
                declarada={st.declarada}
                respostas={respostas}
                mudar={mudarItens}
                desabilitado={desabilitado}
                experiencia={avaliacao.experiencia}
                pedeCampos
                sugestoes={dados.sugestoes}
                soAMao
              />
            ) : null}
          </ConferenciaDoLido>
          {bloco.tipo === "PONTUACAO" ? (
            <Etnico
              lancamento={lancamento}
              mudar={mudar}
              desabilitado={desabilitado}
            />
          ) : null}
          {pelosItens ? (
            <DecisaoPelosItens
              st={st}
              bloco={bloco}
              lancado={lancado}
              escolha={escolha}
              calculado={calculado ?? 0}
              desabilitado={desabilitado}
              mudar={mudar}
              aoEscolher={escolher}
            />
          ) : null}
          {pedeSituacao && bloco.requisitos?.length ? (
            <RequisitosDoCargo
              bloco={bloco}
              lancado={lancado}
              mudar={mudar}
              desabilitado={desabilitado}
            />
          ) : null}
          {pelosItens ? null : pedeSituacao ? (
            <Escolhas
              valor={escolha}
              comEditar={blocoEditaNota(bloco)}
              desabilitado={desabilitado}
              compacto={!foco}
              idDaPergunta={`avdPergunta-${bloco.codigo}`}
              aoMudar={escolher}
            />
          ) : null}
          {escolha === "NAO_CONFERE" ? (
            <NaoConfere
              st={st}
              bloco={bloco}
              lancado={lancado}
              mudar={mudar}
              desabilitado={desabilitado}
            />
          ) : null}
          {mostraItens ? (
            <Itens
              bloco={bloco}
              lancamento={lancamento}
              declarada={st.declarada}
              respostas={respostas}
              mudar={mudar}
              desabilitado={desabilitado}
              experiencia={avaliacao.experiencia}
              pedeCampos={escolha === "CONFERE" || escolha === "EDITAR"}
              sugestoes={dados.sugestoes}
            />
          ) : null}
          {pedeSituacao && bloco.extras?.length && escolha !== "NAO_CONFERE" ? (
            <ExtrasDoBloco
              bloco={bloco}
              lancado={lancado}
              mudar={mudarItens}
              desabilitado={desabilitado}
            />
          ) : null}
          {aplica && (chave === "titulos" || chave === "cursos") ? (
            <AvisosDoTituloUnico
              regra={st.regra}
              bloco={bloco}
              lancamento={lancamento}
              itens={itensLancados}
            />
          ) : null}
          {parcial &&
          escolha &&
          // Pelos itens, o resumo é o do rodapé; o passador só no ajuste fino.
          (!pelosItens ||
            (escolha === "EDITAR" &&
              typeof lancado.nota_ajustada === "number")) ? (
            <Resultado
              st={st}
              bloco={bloco}
              lancado={lancado}
              escolha={escolha}
              mudar={mudar}
              desabilitado={desabilitado}
            />
          ) : null}
          {parcial && escolha ? (
            <Justificativa
              st={st}
              bloco={bloco}
              lancado={lancado}
              mudar={mudar}
              desabilitado={desabilitado}
              textoNoRodape={pelosItens}
            />
          ) : null}
          {mensagem && !desabilitado ? (
            <p
              className="avd-ficha-mensagem"
              data-tom={mensagem.tom}
              role="status"
            >
              <i
                className={`fa-solid ${mensagem.tom === "falta" ? "fa-circle-exclamation" : "fa-circle-info"}`}
                aria-hidden="true"
              />
              <span>{mensagem.texto}</span>
              {mensagem.acao ? (
                <button
                  type="button"
                  className="avd-ficha-link"
                  onClick={mensagem.acao.aoClicar}
                >
                  {mensagem.acao.rotulo}
                </button>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
      {/* O mesmo campo em todo item, cargo e situação, sempre no fim do card. */}
      <ObservacaoDoItem
        codigo={bloco.codigo}
        lancado={lancado}
        desabilitado={desabilitado}
        mudar={mudar}
      />
      {children}
    </section>
  );
}
