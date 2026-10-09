import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { enunciadoCompleto } from "../../../lib/avaliacao-documental/anexo-na-empregare.ts";
import { PARCIAL_DO_TIPO as PARCIAIS_DOS_TIPOS } from "../../../lib/avaliacao-documental/catalogo.js";
import {
  BLOCOS_COM_ITENS as ITENS_DOS_TIPOS,
  blocoSeAplica,
  divergenciaDoBloco,
  ehAnexo,
  ESCOLHAS_DA_FICHA,
  itemCompleto,
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
  lancamentoComEscolha,
  novoItemDoBloco,
} from "../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import type { Escolha } from "../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import {
  devolverItem,
  tirarItem,
} from "../../../lib/avaliacao-documental/itens-da-ficha.ts";
import type { ItemTirado } from "../../../lib/avaliacao-documental/itens-da-ficha.ts";
import { arquivosDaPergunta } from "../../../lib/avaliacao-documental/respostas-do-candidato.ts";
import type { ArquivoDoCandidato } from "../../../lib/avaliacao-documental/respostas-do-candidato.ts";
import { justificativasDoBloco } from "../../../lib/avaliacao-documental/justificativas-do-bloco.ts";
import { tetoDoBloco } from "../../../lib/avaliacao-documental/pontuacao.js";
import { Selo } from "../../../ui/index.js";
import { ComprovadoDaFicha } from "./comprovado-da-ficha.tsx";
import { LinkDaEmpregare, LinkDoAnexo } from "./empregare.tsx";
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
  1. o que o candidato declarou e o anexo ("Abrir na Empregare");
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
};

/** O contexto da escolha de um bloco, a partir do estado da ficha. */
export function contextoDaEscolha(
  st: EstadoDaFicha,
  bloco: Bloco,
): ContextoDaEscolha {
  const linhas = respostasDoBloco(
    bloco,
    st.dados.respostas,
  ) as LinhaDeResposta[];
  return {
    declarada: st.declarada,
    respostas: linhas.map((l) => l.texto),
    naoEnviou: sugereNaoEnviado(linhas),
    sugestoes: st.dados.sugestoes,
  };
}

/**
 * Grava uma escolha (botões ou teclas 1, 2 e 3): a situação, os motivos, a
 * pontuação e, no Confere/Editar sem nada registrado, a primeira linha.
 */
export function decidirNoLancamento(
  bloco: Bloco,
  mudar: Mudar,
  escolha: Escolha | null,
  contexto: ContextoDaEscolha,
) {
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
}

/* ── A resposta declarada ─────────────────────────────────────────────── */

/* Os arquivos da pergunta de anexo, cada um com o link direto e o nome. */
function ArquivosDaPergunta({
  arquivos,
  empregare,
}: {
  arquivos: ArquivoDoCandidato[];
  empregare: ContextoDaEmpregare;
}) {
  return (
    <ul className="avd-ficha-arquivos" aria-label="Arquivos enviados">
      {arquivos.map((a) => (
        <li key={a.link}>
          <a
            className="avd-ficha-arquivo"
            href={a.link}
            target="_blank"
            rel="noopener noreferrer"
            title={`Abrir ${a.nome} na Empregare`}
            onClick={() =>
              void empregare.loja.registrarAcesso("ABRIR_EMPREGARE")
            }
          >
            <i className="fa-solid fa-paperclip" aria-hidden="true" />
            <span>{a.nome}</span>
            <i
              className="fa-solid fa-arrow-up-right-from-square"
              aria-hidden="true"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

function RespostaDeclarada({
  linha,
  empregare,
  comLinkGeral,
}: {
  linha: LinhaDeResposta;
  empregare: ContextoDaEmpregare;
  /** Sem anexo no item: o "Abrir na Empregare" do candidato ao lado da resposta. */
  comLinkGeral?: boolean;
}) {
  const [inteiro, setInteiro] = useState(false);
  const completo = enunciadoCompleto(linha.coluna);
  const temMais = completo.length > linha.enunciado.length + 3;
  const anexo = ehAnexo(linha.texto);
  // Anexo com os links capturados: a lista dos arquivos, cada um com o seu link.
  const arquivos = anexo
    ? arquivosDaPergunta(empregare.enderecos, linha.coluna)
    : [];
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
        <ArquivosDaPergunta arquivos={arquivos} empregare={empregare} />
      ) : (
        <div className="avd-ficha-valor" data-anexo={anexo || undefined}>
          <strong className="avd-ficha-texto-declarado">
            {anexo ? (
              <i className="fa-solid fa-paperclip" aria-hidden="true" />
            ) : null}
            {linha.texto || "Sem resposta"}
          </strong>
          {anexo ? (
            <LinkDoAnexo empregare={empregare} coluna={linha.coluna} />
          ) : comLinkGeral ? (
            <LinkDaEmpregare
              empregare={empregare}
              rotulo="Abrir na Empregare"
              className="btn secondary small avd-ficha-ver-candidato"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

/* "O que o candidato informou": as respostas das perguntas que a regra liga ao bloco. */
function Respostas({
  linhas,
  empregare,
}: {
  linhas: LinhaDeResposta[];
  empregare: ContextoDaEmpregare;
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
                <kbd aria-hidden="true">{tecla}</kbd>
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
  return (
    <div className="avd-ficha-nao-confere" data-tour="avd-ficha-motivos">
      {motivos.length ? (
        <Chips
          rotulo="Por que não confere?"
          opcoes={motivos}
          marcados={lancado.motivos || []}
          desabilitado={desabilitado}
          aoMudar={(escolhidos) =>
            alterarBloco(mudar, bloco.codigo, { motivos: escolhidos })
          }
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
      <label className="avd-ficha-campo">
        <span className="avd-ficha-rotulo">
          {motivos.length
            ? "Observação (opcional)"
            : "Motivo (10 caracteres ou mais)"}
        </span>
        <input
          value={lancado.motivo_livre || ""}
          maxLength={2000}
          disabled={desabilitado}
          onChange={(ev) =>
            alterarBloco(mudar, bloco.codigo, {
              motivo_livre: ev.target.value,
            })
          }
        />
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
}) {
  // O item tirado pelo "×", para o "Desfazer" (o clique não pede confirmação).
  const [tirado, setTirado] = useState<ItemTirado<ItemLancado> | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const chave = BLOCOS_COM_ITENS[bloco.tipo];
  const categorias = bloco.categorias || [];
  const titulos = titulosDoNivel(bloco, lancamento.nivel) as {
    codigo: string;
    rotulo: string;
    pontos: number;
  }[];
  const lista = (l: Lancamento) =>
    (chave ? l[chave] || [] : []) as ItemLancado[];
  const novo = () =>
    novoItemDoBloco(bloco, lancamento.nivel, respostas) as ItemLancado;
  // Rascunho de antes desta tela, já Confere sem nada registrado: a primeira
  // linha abre ao mostrar a lista (a mesma da escolha).
  const abrir = !desabilitado && abreComLinhaNova(bloco, lancamento, declarada);
  useEffect(() => {
    if (!abrir) return;
    mudar((l) => comLinhaAberta(bloco, l, declarada, respostas, sugestoes));
    // Só quando volta a ficar vazia.
  }, [abrir]);
  const itens = lista(lancamento);
  const primeiraEmBranco =
    chave && itens.length === 1 && itens[0] && emBranco(chave, itens[0]);
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
    <div className="avd-ficha-itens" data-tour="avd-ficha-itens" ref={caixa}>
      {itens.length ? (
        <ul className="avd-ficha-itens-lista">
          {itens.map((it, i) => (
            <li
              key={i}
              className="avd-ficha-item"
              data-chave={chave}
              data-aceito={it.aceito !== false}
            >
              {chave === "titulos" ? (
                <select
                  aria-label="Título"
                  value={it.titulo}
                  disabled={desabilitado}
                  onChange={(ev) => alterar(i, { titulo: ev.target.value })}
                >
                  {titulos.map((t) => (
                    <option key={t.codigo} value={t.codigo}>
                      {t.rotulo}
                      {t.pontos ? ` (${t.pontos})` : ""}
                    </option>
                  ))}
                </select>
              ) : null}
              {chave === "vinculos" ? (
                <input
                  aria-label="Empregador ou cargo"
                  placeholder="Empregador ou cargo"
                  value={it.empregador || ""}
                  maxLength={200}
                  disabled={desabilitado}
                  onChange={(ev) => alterar(i, { empregador: ev.target.value })}
                />
              ) : (
                <input
                  aria-label={
                    chave === "cursos" ? "Curso" : "Curso ou instituição"
                  }
                  placeholder={
                    chave === "cursos" ? "Curso" : "Curso ou instituição"
                  }
                  value={it.nome || ""}
                  maxLength={200}
                  disabled={desabilitado}
                  onChange={(ev) => alterar(i, { nome: ev.target.value })}
                />
              )}
              {chave === "cursos" ? (
                <input
                  aria-label="Carga horária"
                  className="avd-ficha-item-curto"
                  type="number"
                  min="0"
                  max="20000"
                  inputMode="numeric"
                  placeholder="Horas"
                  aria-invalid={
                    pedeCampos && !(Number(it.horas) > 0) ? true : undefined
                  }
                  value={it.horas ?? ""}
                  disabled={desabilitado}
                  onChange={(ev) =>
                    alterar(i, {
                      horas:
                        ev.target.value === "" ? "" : Number(ev.target.value),
                    })
                  }
                />
              ) : null}
              {chave === "vinculos" ? (
                <>
                  {categorias.length > 1 ? (
                    <select
                      aria-label="Categoria"
                      value={it.categoria}
                      disabled={desabilitado}
                      onChange={(ev) =>
                        alterar(i, { categoria: ev.target.value })
                      }
                    >
                      {categorias.map((c) => (
                        <option key={c.codigo} value={c.codigo}>
                          {c.rotulo || c.codigo}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {(["inicio", "fim"] as const).map((campo) => (
                    <input
                      key={campo}
                      aria-label={campo === "inicio" ? "Início" : "Fim"}
                      className="avd-ficha-item-data"
                      type="date"
                      aria-invalid={
                        pedeCampos && !itemCompleto(chave, it)
                          ? true
                          : undefined
                      }
                      value={it[campo] || ""}
                      disabled={desabilitado}
                      onChange={(ev) =>
                        alterar(i, { [campo]: ev.target.value })
                      }
                    />
                  ))}
                </>
              ) : null}
              {it.da_resposta ? (
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
        {itens.some((it) => it.aceito !== false && itemCompleto(chave, it)) ? (
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

/* A justificativa da pontuação diferente da declarada (uma só área). */
function Justificativa({
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
  const regra = st.dados.regra.configuracao;
  const divergencia = divergenciaDoBloco(bloco, st.avaliacao, st.declarada) as {
    diferenca: number;
  } | null;
  const marcadas = lancado.justificativas || [];
  if (lancado.situacao !== "CONFORME") return null;
  if (!divergencia && !marcadas.length && !lancado.justificativa_livre)
    return null;
  const { doBloco, outras } = justificativasDoBloco(regra, bloco);
  const opcoes: Opcao[] = [...doBloco, ...outras];
  const outraMarcada = outras.some((o) => marcadas.includes(o.codigo));
  const rotulo =
    divergencia && divergencia.diferenca < 0
      ? "Por que a pontuação é menor que a declarada?"
      : "Justificativa da pontuação";
  const mudarJustificativas = (justificativas: string[]) =>
    alterarBloco(mudar, bloco.codigo, { justificativas });
  return (
    <div
      className="avd-ficha-justificativa"
      data-tour="avd-ficha-justificativa"
    >
      {doBloco.length ? (
        <Chips
          rotulo={rotulo}
          opcoes={doBloco}
          marcados={marcadas}
          desabilitado={desabilitado}
          aoMudar={mudarJustificativas}
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
      <label className="avd-ficha-campo">
        <span className="avd-ficha-rotulo">
          {opcoes.length
            ? "Complemento (opcional)"
            : `${rotulo} (10 caracteres ou mais)`}
        </span>
        <input
          value={lancado.justificativa_livre || ""}
          maxLength={2000}
          disabled={desabilitado}
          onChange={(ev) =>
            alterarBloco(mudar, bloco.codigo, {
              justificativa_livre: ev.target.value,
            })
          }
        />
      </label>
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
  const contexto: ContextoDaEscolha = {
    declarada: st.declarada,
    respostas,
    naoEnviou: sugereNaoEnviado(linhas),
    sugestoes: dados.sugestoes,
  };
  // A lista aparece no Confere e no Editar (e num rascunho com itens sem decisão).
  const itensLancados = chave ? (lancamento[chave] as ItemLancado[]) || [] : [];
  const escolher = (nova: Escolha | null) => {
    // A mesma escolha de novo só confirma: nada muda no lançamento (o "não
    // enviou", os motivos e o ajuste ficam) e o item avança se nada falta.
    if (nova !== escolha) decidirNoLancamento(bloco, mudar, nova, contexto);
    aoDecidir?.(bloco.codigo, nova, itensLancados.length);
  };
  const mostraItens =
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
          {!aplica ? <Selo>Não se aplica</Selo> : null}
          {!foco && bloco.item_edital ? (
            <span className="avd-ficha-item-edital">
              Item {bloco.item_edital}
            </span>
          ) : null}
        </div>
      </header>
      {aplica || bloco.tipo === "PONTUACAO" ? (
        <div className="avd-ficha-cartao-corpo">
          {aplica && linhas.length ? (
            <Respostas linhas={linhas} empregare={empregare} />
          ) : null}
          {bloco.tipo === "PONTUACAO" ? (
            <Etnico
              lancamento={lancamento}
              mudar={mudar}
              desabilitado={desabilitado}
            />
          ) : null}
          {pedeSituacao ? (
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
          {parcial && escolha ? (
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
      {children}
    </section>
  );
}
