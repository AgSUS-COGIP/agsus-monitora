import { useState } from "react";
import type { ReactNode } from "react";
import { enunciadoCompleto } from "../../../lib/avaliacao-documental/anexo-na-empregare.ts";
import { PARCIAL_DO_TIPO as PARCIAIS_DOS_TIPOS } from "../../../lib/avaliacao-documental/catalogo.js";
import {
  BLOCOS_COM_ITENS as ITENS_DOS_TIPOS,
  blocoConferido,
  blocoSeAplica,
  divergenciaDoBloco,
  ehAnexo,
  respostasDoBloco,
  SITUACOES_DA_FICHA,
  sugereNaoEnviado,
  textoDaNota,
  titulosDoNivel,
} from "../../../lib/avaliacao-documental/ficha.js";
import {
  apuradoDoBloco,
  apuradoZeradoPelaDecisao,
  blocoComDecisao,
  comItensLancados,
  temItensLancados,
} from "../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import {
  devolverItem,
  tirarItem,
} from "../../../lib/avaliacao-documental/itens-da-ficha.ts";
import type { ItemTirado } from "../../../lib/avaliacao-documental/itens-da-ficha.ts";
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
  Um item da ficha (um bloco da regra). No modo foco, um por vez, largo: o
  que se pede, a resposta do candidato em destaque (com "Abrir na Empregare" e
  onde achar o anexo), as três decisões grandes (teclas 1, 2 e 3 no title),
  os motivos em chips, e nos blocos que pontuam "Declarado → Apurado" e a
  lista compacta de títulos, cursos ou vínculos. O Apurado começa preenchido
  (com o Declarado, ou com o Calculado quando há itens lançados) e a decisão
  mexe nele (apurado-da-ficha.ts): Conforme confirma, Não conforme e Não
  enviado zeram. No modo lista, o mesmo em cartão compacto. A gravação é a
  do estado da ficha (mudar).
*/

type ChaveDosItens = "titulos" | "cursos" | "vinculos";
const BLOCOS_COM_ITENS = ITENS_DOS_TIPOS as Readonly<
  Record<string, ChaveDosItens | undefined>
>;
const PARCIAL_DO_TIPO = PARCIAIS_DOS_TIPOS as Readonly<
  Record<string, string | undefined>
>;
const SITUACOES = SITUACOES_DA_FICHA as unknown as ReadonlyArray<
  readonly [Situacao, string, string]
>;
const ICONE_DA_DECISAO: Record<Situacao, string> = {
  CONFORME: "fa-check",
  NAO_CONFORME: "fa-xmark",
  NAO_ENVIADO: "fa-ban",
};
const PEDEM_MOTIVO: ReadonlyArray<string> = ["NAO_CONFORME", "NAO_ENVIADO"];

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

/**
 * Grava uma decisão (botões ou teclas 1, 2 e 3): a situação, os motivos e,
 * nos blocos que pontuam, o Apurado (blocoComDecisao).
 */
export function decidirNoLancamento(
  st: Pick<EstadoDaFicha, "avaliacao" | "declarada">,
  bloco: Bloco,
  mudar: Mudar,
  situacao: Situacao | null,
) {
  const calculado =
    st.avaliacao.calculados?.[PARCIAL_DO_TIPO[bloco.tipo] ?? ""] ?? 0;
  mudar((l) => {
    l.blocos = {
      ...l.blocos,
      [bloco.codigo]: blocoComDecisao({
        bloco,
        lancamento: l,
        situacao,
        declarada: st.declarada,
        calculado,
      }) as Lancado,
    };
    return l;
  });
}

/* ── A resposta declarada ─────────────────────────────────────────────── */

function RespostaDeclarada({
  linha,
  empregare,
  comLinkGeral,
  declarado,
}: {
  linha: LinhaDeResposta;
  empregare: ContextoDaEmpregare;
  /** Sem anexo no item: o "Abrir na Empregare" do candidato ao lado da resposta. */
  comLinkGeral?: boolean;
  /** Nos blocos com itens: "Declarado pelo candidato" (o comprovado vem dos itens). */
  declarado?: boolean;
}) {
  const [inteiro, setInteiro] = useState(false);
  const completo = enunciadoCompleto(linha.coluna);
  const temMais = completo.length > linha.enunciado.length + 3;
  const anexo = ehAnexo(linha.texto);
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
      <div className="avd-ficha-valor" data-anexo={anexo || undefined}>
        {declarado && !anexo ? (
          <span className="avd-ficha-rotulo">Declarado pelo candidato:</span>
        ) : null}
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
    </div>
  );
}

function Respostas({
  linhas,
  sugestao,
  empregare,
  declarado,
}: {
  linhas: LinhaDeResposta[];
  sugestao: boolean;
  empregare: ContextoDaEmpregare;
  declarado?: boolean;
}) {
  const algumAnexo = linhas.some((l) => ehAnexo(l.texto));
  return (
    <div className="avd-ficha-respostas">
      {linhas.map((l, i) => (
        <RespostaDeclarada
          key={l.coluna}
          linha={l}
          empregare={empregare}
          comLinkGeral={!algumAnexo && i === 0}
          declarado={declarado}
        />
      ))}
      {sugestao ? (
        <p className="avd-ficha-sugestao">
          <i className="fa-solid fa-circle-info" aria-hidden="true" /> Sem
          resposta: sugestão, Não enviado
        </p>
      ) : null}
    </div>
  );
}

/* ── Decisões e chips ─────────────────────────────────────────────────── */

export function Decisoes({
  valor,
  aoMudar,
  desabilitado,
  compacto,
}: {
  valor: Situacao | null | undefined;
  aoMudar: (situacao: Situacao | null) => void;
  desabilitado: boolean;
  compacto?: boolean;
}) {
  return (
    <div
      className="avd-ficha-decisoes"
      role="group"
      aria-label="Decisão do item"
      data-compacto={compacto || undefined}
      data-tour="avd-ficha-decisoes"
    >
      {SITUACOES.map(([codigo, rotulo, tecla]) => {
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
            onClick={() => aoMudar(escolhido ? null : codigo)}
          >
            <span className="avd-ficha-decisao-icone" aria-hidden="true">
              <i className={`fa-solid ${ICONE_DA_DECISAO[codigo]}`} />
            </span>
            <span className="avd-ficha-decisao-rotulo">{rotulo}</span>
            <kbd aria-hidden="true">{tecla}</kbd>
          </button>
        );
      })}
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

/* ── Títulos, cursos e vínculos ───────────────────────────────────────── */

const ROTULO_DO_NOVO: Record<ChaveDosItens, string> = {
  titulos: "Adicionar título",
  cursos: "Adicionar curso",
  vinculos: "Adicionar vínculo",
};

function Itens({
  bloco,
  lancamento,
  declarada,
  mudar: mudarDoEstado,
  desabilitado,
  experiencia,
}: {
  bloco: Bloco;
  lancamento: Lancamento;
  declarada: EstadoDaFicha["declarada"];
  mudar: Mudar;
  desabilitado: boolean;
  experiencia: EstadoDaFicha["avaliacao"]["experiencia"];
}) {
  // O item tirado pelo "×", para o "Desfazer" (o clique não pede confirmação).
  const [tirado, setTirado] = useState<ItemTirado<ItemLancado> | null>(null);
  // O primeiro item lançado devolve o Apurado ao Calculado (comItensLancados).
  const mudar: Mudar = (transformar) =>
    mudarDoEstado((l) => {
      const tinhaItens = temItensLancados(bloco, l);
      return comItensLancados(bloco, { tinhaItens }, transformar(l), declarada);
    });
  const chave = BLOCOS_COM_ITENS[bloco.tipo];
  if (!chave) return null;
  const itens = (lancamento[chave] || []) as ItemLancado[];
  const categorias = bloco.categorias || [];
  const titulos = titulosDoNivel(bloco, lancamento.nivel) as {
    codigo: string;
    rotulo: string;
    pontos: number;
  }[];
  const lista = (l: Lancamento) => (l[chave] || []) as ItemLancado[];
  const alterar = (i: number, campos: Partial<ItemLancado>) =>
    mudar((l) => {
      l[chave] = lista(l).map((it, j) => (j === i ? { ...it, ...campos } : it));
      return l;
    });
  const novo = (): ItemLancado => {
    if (chave === "titulos")
      return {
        titulo: titulos[0]?.codigo || "ESPECIALIZACAO",
        nome: "",
        aceito: true,
      };
    if (chave === "cursos") return { nome: "", horas: "", aceito: true };
    return {
      empregador: "",
      categoria: categorias[0]?.codigo,
      inicio: "",
      fim: "",
      aceito: true,
    };
  };
  return (
    <div className="avd-ficha-itens" data-tour="avd-ficha-itens">
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
                  <input
                    aria-label="Início"
                    className="avd-ficha-item-data"
                    type="date"
                    value={it.inicio || ""}
                    disabled={desabilitado}
                    onChange={(ev) => alterar(i, { inicio: ev.target.value })}
                  />
                  <input
                    aria-label="Fim"
                    className="avd-ficha-item-data"
                    type="date"
                    value={it.fim || ""}
                    disabled={desabilitado}
                    onChange={(ev) => alterar(i, { fim: ev.target.value })}
                  />
                </>
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
      <ComprovadoDaFicha
        bloco={bloco}
        lancamento={lancamento}
        experiencia={experiencia}
      />
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
    </div>
  );
}

const ROTULO_DO_TIRADO: Record<ChaveDosItens, string> = {
  titulos: "Título tirado.",
  cursos: "Curso tirado.",
  vinculos: "Vínculo tirado.",
};

/* ── Declarado → Apurado ──────────────────────────────────────────────── */

function Pontos({
  st,
  bloco,
  lancado,
  mudar,
  desabilitado,
  conferido,
}: {
  st: EstadoDaFicha;
  bloco: Bloco;
  lancado: Lancado;
  mudar: Mudar;
  desabilitado: boolean;
  conferido: boolean;
}) {
  const { lancamento, avaliacao, declarada } = st;
  const regra = st.dados.regra.configuracao;
  const parcial = PARCIAL_DO_TIPO[bloco.tipo] ?? "";
  const calculado = avaliacao.calculados?.[parcial] ?? 0;
  const decl = declarada?.parciais?.[parcial];
  const teto = tetoDoBloco(bloco, lancamento.nivel) as number | null;
  const ajuste =
    typeof lancado.nota_ajustada === "number" ? lancado.nota_ajustada : null;
  // Conferido: o que a conta dá (o efeito do bloco vale). Antes: o de partida.
  const valor = conferido
    ? (ajuste ?? avaliacao.parciais?.[parcial] ?? 0)
    : apuradoDoBloco({ bloco, lancamento, declarada, calculado }).valor;
  const diferenca = typeof decl === "number" ? valor - decl : null;
  const temDiferenca = diferenca !== null && Math.abs(diferenca) >= 0.005;
  const zerado = apuradoZeradoPelaDecisao(lancado);
  // A diferença para a declarada só conta depois de o item ser conferido.
  const divergencia = conferido
    ? divergenciaDoBloco(bloco, avaliacao, declarada)
    : null;
  const { doBloco: opcoesDoBloco, outras } = justificativasDoBloco(
    regra,
    bloco,
  );
  const opcoes: Opcao[] = [...opcoesDoBloco, ...outras];
  const marcadas = lancado.justificativas || [];
  const outraMarcada = outras.some((o) => marcadas.includes(o.codigo));
  const menorQueODeclarado =
    lancado.situacao === "CONFORME" && temDiferenca && (diferenca ?? 0) < 0;
  // Zerado pela decisão: o motivo do Não conforme/Não enviado já justifica.
  const mostrarJustificativa =
    (!zerado && Boolean(divergencia)) ||
    (lancado.justificativas || []).length > 0 ||
    (ajuste !== null && ajuste !== calculado && ajuste !== decl);
  const definir = (v: number | null) => {
    const limitado =
      v === null ? null : Math.max(0, teto !== null ? Math.min(teto, v) : v);
    // Valor explícito: vazio, na regra, quer dizer "segue o cálculo dos itens".
    alterarBloco(mudar, bloco.codigo, { nota_ajustada: limitado });
  };
  const idDoApurado = `avdApurado-${bloco.codigo}`;
  const porQue = "Por que o apurado é menor que o declarado?";
  return (
    <div className="avd-ficha-pontos" data-tour="avd-ficha-nota">
      {!conferido && typeof decl === "number" && !desabilitado ? (
        <p className="avd-ficha-pontos-guia">
          Confira o documento: se comprova os pontos declarados, marque
          Conforme; se comprova menos, ajuste o Apurado.
        </p>
      ) : null}
      <div className="avd-ficha-pontos-linha">
        <div className="avd-ficha-pontos-caixa">
          <span className="avd-ficha-rotulo">Declarado</span>
          <strong className="avd-ficha-pontos-numero">
            {decl === undefined ? "—" : textoDaNota(decl)}
          </strong>
        </div>
        <i
          className="fa-solid fa-arrow-right avd-ficha-pontos-seta"
          aria-hidden="true"
        />
        <div
          className="avd-ficha-pontos-caixa"
          data-divergente={divergencia ? "sim" : undefined}
        >
          <span className="avd-ficha-rotulo" id={idDoApurado}>
            Apurado{teto !== null ? ` (até ${textoDaNota(teto)})` : ""}
          </span>
          <div className="avd-ficha-passador">
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
              aria-labelledby={idDoApurado}
              value={valor}
              disabled={desabilitado}
              data-divergente={divergencia ? "sim" : undefined}
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
          </div>
        </div>
      </div>
      {typeof decl === "number" ? (
        <p
          className="avd-ficha-pontos-resumo"
          data-diferenca={
            !temDiferenca ? "nenhuma" : (diferenca ?? 0) < 0 ? "menor" : "maior"
          }
        >
          Declarado <strong>{textoDaNota(decl)}</strong> → Apurado{" "}
          <strong>{textoDaNota(valor)}</strong>
          {temDiferenca ? (
            <span className="avd-ficha-pontos-diferenca">
              {(diferenca ?? 0) > 0 ? "+" : "−"}
              {textoDaNota(Math.abs(diferenca ?? 0))}
            </span>
          ) : null}
        </p>
      ) : null}
      {zerado ? (
        <p className="avd-ficha-pontos-aviso" role="status">
          <i className="fa-solid fa-circle-info" aria-hidden="true" /> Apurado
          zerado:{" "}
          {lancado.situacao === "NAO_ENVIADO"
            ? "o documento não foi enviado."
            : "o documento não está conforme."}
        </p>
      ) : null}
      <p className="avd-ficha-calculado">
        Calculado pelos itens <strong>{textoDaNota(calculado)}</strong>
        {ajuste !== null && ajuste !== calculado && !desabilitado ? (
          <button
            type="button"
            className="avd-ficha-link"
            onClick={() =>
              alterarBloco(mudar, bloco.codigo, { nota_ajustada: null })
            }
          >
            Usar o calculado
          </button>
        ) : null}
      </p>
      {mostrarJustificativa ? (
        <div
          className="avd-ficha-justificativa"
          data-tour="avd-ficha-justificativa"
        >
          {opcoesDoBloco.length ? (
            <Chips
              rotulo={menorQueODeclarado ? porQue : "Justificativa da nota"}
              opcoes={opcoesDoBloco}
              marcados={marcadas}
              desabilitado={desabilitado}
              aoMudar={(justificativas) =>
                alterarBloco(mudar, bloco.codigo, { justificativas })
              }
            />
          ) : null}
          {outras.length ? (
            <details
              className="avd-ficha-outras-justificativas"
              open={outraMarcada || !opcoesDoBloco.length || undefined}
            >
              <summary>Outras justificativas ({outras.length})</summary>
              <Chips
                rotulo="Outras justificativas"
                rotuloOculto
                opcoes={outras}
                marcados={marcadas}
                desabilitado={desabilitado}
                aoMudar={(justificativas) =>
                  alterarBloco(mudar, bloco.codigo, { justificativas })
                }
              />
            </details>
          ) : null}
          <label className="avd-ficha-campo">
            <span className="avd-ficha-rotulo">
              {opcoes.length
                ? "Complemento (opcional)"
                : menorQueODeclarado
                  ? `${porQue} (10 caracteres ou mais)`
                  : "Justificativa da nota"}
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
      ) : null}
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

/* ── O item ───────────────────────────────────────────────────────────── */

export type PropriedadesDoItem = {
  st: EstadoDaFicha;
  bloco: Bloco;
  modo: "foco" | "lista";
  /** "Item 3 de 6" no modo foco. */
  numero?: { atual: number; total: number } | null;
  ativo: boolean;
  desabilitado: boolean;
  /** "Marque Conforme…" só depois de tentar concluir (no modo lista). */
  mostrarFaltaDeSituacao: boolean;
  empregare: ContextoDaEmpregare;
  mudar: Mudar;
  aoDecidir?: (codigo: string, situacao: Situacao | null) => void;
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
  const conferido = pedeSituacao && blocoConferido(lancamento, bloco);
  const doBloco = pendencias.filter(
    (p) =>
      p.bloco === bloco.codigo &&
      (mostrarFaltaDeSituacao || p.tipo !== "situacao"),
  );
  const avaliado = avaliacao.blocos.find((b) => b.codigo === bloco.codigo);
  const situacao = lancado.situacao ? SELO_DA_SITUACAO[lancado.situacao] : null;
  const pedeMotivo =
    pedeSituacao && PEDEM_MOTIVO.includes(lancado.situacao ?? "");
  const pontua =
    aplica && (BLOCOS_COM_ITENS[bloco.tipo] || PARCIAL_DO_TIPO[bloco.tipo]);
  const foco = modo === "foco";
  return (
    <section
      className="avd-ficha-cartao"
      data-modo={modo}
      data-bloco={bloco.codigo}
      data-situacao={aplica ? lancado.situacao || "" : "NAO_SE_APLICA"}
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
            <Respostas
              linhas={linhas}
              sugestao={!lancado.situacao && sugereNaoEnviado(linhas)}
              empregare={empregare}
              declarado={Boolean(BLOCOS_COM_ITENS[bloco.tipo])}
            />
          ) : null}
          {bloco.tipo === "PONTUACAO" ? (
            <Etnico
              lancamento={lancamento}
              mudar={mudar}
              desabilitado={desabilitado}
            />
          ) : null}
          {/* Nos blocos que pontuam, os itens e a nota vêm antes da decisão. */}
          {pontua ? (
            <div className="avd-ficha-apuracao">
              <Itens
                bloco={bloco}
                lancamento={lancamento}
                declarada={st.declarada}
                mudar={mudar}
                desabilitado={desabilitado}
                experiencia={avaliacao.experiencia}
              />
              {PARCIAL_DO_TIPO[bloco.tipo] ? (
                <Pontos
                  st={st}
                  bloco={bloco}
                  lancado={lancado}
                  mudar={mudar}
                  desabilitado={desabilitado}
                  conferido={conferido}
                />
              ) : null}
            </div>
          ) : null}
          {pedeSituacao ? (
            <Decisoes
              valor={lancado.situacao}
              desabilitado={desabilitado}
              compacto={!foco}
              aoMudar={(nova) => {
                decidirNoLancamento(st, bloco, mudar, nova);
                aoDecidir?.(bloco.codigo, nova);
              }}
            />
          ) : null}
          {pedeMotivo ? (
            (bloco.motivos || []).length ? (
              <Chips
                rotulo={
                  lancado.situacao === "NAO_ENVIADO"
                    ? "Por que não foi enviado?"
                    : "Por que não está conforme?"
                }
                tour="avd-ficha-motivos"
                opcoes={bloco.motivos || []}
                marcados={lancado.motivos || []}
                desabilitado={desabilitado}
                aoMudar={(motivos) =>
                  alterarBloco(mudar, bloco.codigo, { motivos })
                }
              />
            ) : (
              <label className="avd-ficha-campo">
                <span className="avd-ficha-rotulo">Motivo</span>
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
            )
          ) : null}
          {doBloco.length && !desabilitado ? (
            <ul
              className="avd-ficha-pendencias"
              aria-label="O que falta neste item"
            >
              {doBloco.map((p) => (
                <li key={p.texto}>
                  <i
                    className="fa-solid fa-circle-exclamation"
                    aria-hidden="true"
                  />{" "}
                  {p.texto}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
