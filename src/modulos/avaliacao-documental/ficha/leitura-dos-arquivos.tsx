import { useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  itemCompleto,
  titulosDoNivel,
} from "../../../lib/avaliacao-documental/ficha.ts";
import {
  aceitarItemCorrigido,
  aceitarItemLido,
  aceitarTodosSemAlerta,
  alertasDoArquivo,
  alertasResumidos,
  conferirTodos,
  desfazerAceitos,
  desfazerDecisaoLida,
  estadoDoItemLido,
  linhaAceita,
  linhaDoItemLido,
  linhaParaCorrigir,
  MOTIVOS_DA_RECUSA,
  pendentesCompletos,
  recusarItemLido,
  rotuloDaRecusa,
  TAMANHO_DO_TEXTO_DA_RECUSA,
  textoDaLinha,
} from "../../../lib/avaliacao-documental/leitura-dos-arquivos.ts";
import type {
  ItemParaConferir,
  LeituraDoArquivo,
  MotivoDaRecusa,
} from "../../../lib/avaliacao-documental/leitura-dos-arquivos.ts";
import { CamposDoItem } from "./campos-do-item.tsx";
import type { ChaveDosItens } from "./campos-do-item.tsx";
import type {
  Bloco,
  ContextoDaEmpregare,
  ItemLancado,
  Lancamento,
  Mudar,
} from "./tipos.ts";

/*
  O que o robô leu dos arquivos, na ficha (a leitura é do Python; aqui só se
  mostra e se registra a decisão — leitura-dos-arquivos.ts):
  - LidoDoArquivo: ao lado de cada arquivo, uma linha com o resumo
    ("3 certificados · 145 h, 60 h, 40 h · nome confere", e "por imagem —
    confira" quando foi OCR) e, se houver, os alertas do arquivo noutra;
  - ConferenciaDoLido: no item da ficha, cada certificado, título ou vínculo
    lido numa linha de conferência, com no máximo UM alerta visível (o que
    impede, em laranja; os leves em cinza; os demais no "+N" com a dica), o
    link do arquivo (e a página) e Aceitar / Corrigir / Recusar (teclas A, C
    e R na linha focada). Aceitar vira linha do item, marcada "lido do
    arquivo"; Corrigir abre a linha preenchida para ajustar e "Aceitar com a
    correção" marca "lido do arquivo, corrigido"; Recusar pede o motivo em
    chips curtos e fica registrado (dá para trocar ou desfazer). "Conferir
    todos" aceita de uma vez todos os pendentes completos (com ou sem
    alerta; o recusado e o já aceito não mudam), com "Desfazer" logo ao
    lado; "Aceitar todos sem alerta" aparece quando há pendentes com alerta. Embaixo da
    lista (children), as linhas digitadas à mão e o "Adicionar …".
  Sem leitura, nada aparece.
*/

const TOM_DA_SITUACAO: Record<LeituraDoArquivo["situacao"], string> = {
  LIDO: "lido",
  ILEGIVEL: "alerta",
  ERRO: "neutro",
  NAO_SUPORTADO: "neutro",
};

/** "Lido do arquivo: …" ao lado do arquivo; os alertas do arquivo numa linha. */
export function LidoDoArquivo({
  leitura,
}: {
  leitura: LeituraDoArquivo | null;
}) {
  if (!leitura) return null;
  const alertas = alertasDoArquivo(leitura);
  return (
    <div className="avd-lido" data-tom={TOM_DA_SITUACAO[leitura.situacao]}>
      <p className="avd-lido-resumo">
        <i className="fa-solid fa-file-circle-check" aria-hidden="true" />
        <span>
          <span className="avd-lido-rotulo">Lido do arquivo:</span>{" "}
          {leitura.resumo}
          {leitura.metodo === "OCR" ? (
            <span
              className="avd-lido-metodo"
              title="Lido por reconhecimento de imagem: confira os valores no documento"
            >
              {" "}
              · por imagem — confira
            </span>
          ) : null}
        </span>
      </p>
      {alertas ? (
        <p className="avd-lido-alertas" role="note">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <span>{alertas}</span>
        </p>
      ) : null}
    </div>
  );
}

type PropriedadesDaConferencia = {
  bloco: Bloco;
  itens: ItemParaConferir[];
  lancamento: Lancamento;
  mudar: Mudar;
  desabilitado: boolean;
  empregare: ContextoDaEmpregare;
  /** Embaixo da lista: as linhas digitadas à mão e o "Adicionar …". */
  children?: ReactNode;
};

const ROTULO_DA_LISTA: Record<string, [string, string]> = {
  CURSOS: ["certificado lido", "certificados lidos"],
  TITULOS: ["título lido", "títulos lidos"],
  VINCULOS: ["vínculo lido", "vínculos lidos"],
};
const LISTA_DO_BLOCO: Record<string, ChaveDosItens | undefined> = {
  TITULOS: "titulos",
  CURSOS: "cursos",
  VINCULOS: "vinculos",
};
const FALTA_PARA_ACEITAR: Record<ChaveDosItens, string> = {
  titulos: "Escolha o título para aceitar.",
  cursos: "Informe a carga horária para aceitar.",
  vinculos:
    "Informe o início e o fim (vínculo atual: até quando) para aceitar.",
};

type Correcao = { chave: string; linha: ItemLancado };

/** A conferência dos itens lidos do bloco (cursos, títulos ou vínculos). */
export function ConferenciaDoLido({
  bloco,
  itens,
  lancamento,
  mudar,
  desabilitado,
  empregare,
  children,
}: PropriedadesDaConferencia) {
  const [recusando, setRecusando] = useState<string | null>(null);
  const [corrigindo, setCorrigindo] = useState<Correcao | null>(null);
  const [ultimoLote, setUltimoLote] = useState<string[] | null>(null);
  const lista = LISTA_DO_BLOCO[bloco.tipo];
  if (!itens.length || !lista) return null;
  const estados = itens.map((i) =>
    estadoDoItemLido(lancamento, bloco, i.chave),
  );
  const pendentes = estados.filter((e) => e === "PENDENTE").length;
  const semAlerta = itens.filter(
    (i, n) => estados[n] === "PENDENTE" && !i.alertas.length,
  ).length;
  const completos = pendentesCompletos(lancamento, bloco, itens).length;
  const loteParaDesfazer =
    ultimoLote?.filter(
      (c) => estadoDoItemLido(lancamento, bloco, c) === "ACEITO",
    ) ?? [];
  const [um, varios] = ROTULO_DA_LISTA[bloco.tipo] ?? [
    "item lido",
    "itens lidos",
  ];
  const tituloPadrao = (
    titulosDoNivel(bloco, lancamento.nivel) as { codigo: string }[]
  )[0]?.codigo;
  const aplicar = (transformar: (l: Lancamento) => Lancamento) =>
    mudar((l) => transformar(l));
  const abrirCorrecao = (item: ItemParaConferir) => {
    setRecusando(null);
    const aceita = linhaAceita(lancamento, bloco, item.chave);
    const linha =
      aceita ?? linhaParaCorrigir(bloco, item.item, item.chave, tituloPadrao);
    if (linha) setCorrigindo({ chave: item.chave, linha: { ...linha } });
  };
  const aceitar = (item: ItemParaConferir) => {
    setRecusando(null);
    // A linha lida que não conta sozinha (sem fim, sem horas, título não
    // classificado) abre já no Corrigir, para o avaliador completar.
    const linha = linhaDoItemLido(bloco, item.item, item.chave);
    if (!linha || !itemCompleto(lista, linha)) {
      abrirCorrecao(item);
      return;
    }
    setCorrigindo(null);
    aplicar((l) => aceitarItemLido(l, bloco, item));
  };
  const aceitarCorrigido = (item: ItemParaConferir, linha: ItemLancado) => {
    setCorrigindo(null);
    aplicar((l) => aceitarItemCorrigido(l, bloco, item, linha));
  };
  const recusar = (
    item: ItemParaConferir,
    motivo: MotivoDaRecusa,
    texto?: string,
  ) => aplicar((l) => recusarItemLido(l, bloco, item.chave, motivo, texto));
  const desfazer = (item: ItemParaConferir) => {
    setRecusando(null);
    setCorrigindo(null);
    aplicar((l) => desfazerDecisaoLida(l, bloco, item.chave));
  };
  const aceitarTodos = () => {
    setRecusando(null);
    setCorrigindo(null);
    const { aceitos } = conferirTodos(lancamento, bloco, itens);
    if (!aceitos.length) return;
    setUltimoLote(aceitos);
    // A mesma mudança do Aceitar de cada item, numa só (o rascunho grava pelo mesmo caminho).
    aplicar((l) => conferirTodos(l, bloco, itens).lancamento);
  };
  const desfazerLote = () => {
    const chaves = loteParaDesfazer;
    setUltimoLote(null);
    if (chaves.length) aplicar((l) => desfazerAceitos(l, bloco, chaves));
  };
  const aoTeclar = (
    ev: KeyboardEvent<HTMLLIElement>,
    item: ItemParaConferir,
  ) => {
    if (desabilitado || ev.target !== ev.currentTarget) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = ev.key.toLowerCase();
    if (k === "a") {
      ev.preventDefault();
      aceitar(item);
    } else if (k === "r") {
      ev.preventDefault();
      setCorrigindo(null);
      setRecusando(item.chave);
    } else if (k === "c") {
      ev.preventDefault();
      abrirCorrecao(item);
    }
  };
  return (
    <section
      className="avd-conferir"
      aria-label="Lido dos arquivos"
      data-tour="avd-ficha-lido"
    >
      <header className="avd-conferir-topo">
        <p className="avd-conferir-titulo">
          <i className="fa-solid fa-file-lines" aria-hidden="true" />{" "}
          {itens.length} {itens.length === 1 ? um : varios}
          {pendentes ? (
            <span className="avd-conferir-pendentes">
              · {pendentes} para conferir
            </span>
          ) : null}
        </p>
        <span className="avd-conferir-atalhos">
          {!desabilitado && completos > 1 ? (
            <button
              type="button"
              className="avd-ficha-link"
              data-acao="conferir-todos"
              title="Aceita de uma vez os itens ainda sem decisão (com ou sem alerta). Os recusados e os já aceitos não mudam; o que falta dado (sem carga horária ou sem data) fica para corrigir."
              onClick={aceitarTodos}
            >
              <i className="fa-solid fa-check-double" aria-hidden="true" />{" "}
              Conferir todos ({completos})
            </button>
          ) : null}
          {!desabilitado && loteParaDesfazer.length ? (
            <button
              type="button"
              className="avd-ficha-link"
              data-acao="desfazer-todos"
              onClick={desfazerLote}
            >
              <i className="fa-solid fa-rotate-left" aria-hidden="true" />{" "}
              Desfazer ({loteParaDesfazer.length})
            </button>
          ) : null}
          {!desabilitado && semAlerta > 1 && semAlerta < completos ? (
            <button
              type="button"
              className="avd-ficha-link"
              data-acao="aceitar-sem-alerta"
              onClick={() =>
                aplicar((l) => aceitarTodosSemAlerta(l, bloco, itens))
              }
            >
              <i className="fa-solid fa-list-check" aria-hidden="true" />{" "}
              Aceitar todos sem alerta ({semAlerta})
            </button>
          ) : null}
        </span>
      </header>
      <ul className="avd-conferir-lista">
        {itens.map((item, n) => {
          const estado = estados[n] ?? "PENDENTE";
          const recusa = lancamento.recusas_lidas?.[item.chave];
          const aceita =
            estado === "ACEITO"
              ? linhaAceita(lancamento, bloco, item.chave)
              : null;
          const corrigido = Boolean(aceita?.corrigido);
          const resumo = alertasResumidos(item.alertas);
          const correcao =
            !desabilitado && corrigindo?.chave === item.chave
              ? corrigindo
              : null;
          const abertoParaRecusar =
            !desabilitado &&
            !correcao &&
            (recusando === item.chave || estado === "RECUSADO");
          return (
            <li
              key={item.chave}
              className="avd-conferir-item"
              data-estado={estado.toLowerCase()}
              data-alerta={
                resumo.principal ? (resumo.grave ? "grave" : "leve") : undefined
              }
              tabIndex={desabilitado ? undefined : 0}
              aria-keyshortcuts={desabilitado ? undefined : "A C R"}
              aria-label={`${item.texto}${item.alertas.length ? `. Alertas: ${item.alertas.map((a) => a.texto).join("; ")}` : ""}`}
              onKeyDown={(ev) => aoTeclar(ev, item)}
            >
              <div className="avd-conferir-linha">
                <span className="avd-conferir-texto">
                  {item.texto}
                  {resumo.concomitante ? (
                    <span
                      className="avd-conferir-selo"
                      title="Ao mesmo tempo que um vínculo de outro empregador (pode ser legítimo). Os dias em comum contam uma vez."
                    >
                      concomitante
                    </span>
                  ) : null}
                </span>
                <a
                  className="avd-conferir-arquivo"
                  href={item.anexo.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Abrir ${item.anexo.nome ?? "o arquivo"} na Empregare`}
                  onClick={() =>
                    void empregare.loja.registrarAcesso("ABRIR_EMPREGARE")
                  }
                >
                  {item.item.pagina ? `pág. ${item.item.pagina}` : "arquivo"}{" "}
                  <i
                    className="fa-solid fa-arrow-up-right-from-square"
                    aria-hidden="true"
                  />
                </a>
                {estado === "ACEITO" ? (
                  <span className="avd-conferir-estado" data-estado="aceito">
                    <i className="fa-solid fa-check" aria-hidden="true" />{" "}
                    {corrigido ? "Aceito, corrigido" : "Aceito"}
                  </span>
                ) : null}
                {estado === "RECUSADO" ? (
                  <span className="avd-conferir-estado" data-estado="recusado">
                    <i className="fa-solid fa-xmark" aria-hidden="true" />{" "}
                    Recusado
                    {recusa && desabilitado
                      ? `: ${rotuloDaRecusa(recusa)}`
                      : ""}
                  </span>
                ) : null}
                {!desabilitado && !correcao ? (
                  <span className="avd-conferir-acoes">
                    {estado === "PENDENTE" ? (
                      <>
                        <button
                          type="button"
                          className="avd-conferir-botao"
                          data-acao="aceitar"
                          onClick={() => aceitar(item)}
                        >
                          <i className="fa-solid fa-check" aria-hidden="true" />{" "}
                          Aceitar
                        </button>
                        <button
                          type="button"
                          className="avd-conferir-botao"
                          data-acao="corrigir"
                          onClick={() => abrirCorrecao(item)}
                        >
                          <i className="fa-solid fa-pen" aria-hidden="true" />{" "}
                          Corrigir
                        </button>
                        <button
                          type="button"
                          className="avd-conferir-botao"
                          data-acao="recusar"
                          aria-expanded={recusando === item.chave}
                          onClick={() =>
                            setRecusando(
                              recusando === item.chave ? null : item.chave,
                            )
                          }
                        >
                          <i className="fa-solid fa-xmark" aria-hidden="true" />{" "}
                          Recusar
                        </button>
                      </>
                    ) : (
                      <>
                        {estado === "ACEITO" ? (
                          <button
                            type="button"
                            className="avd-ficha-link"
                            data-acao="corrigir"
                            onClick={() => abrirCorrecao(item)}
                          >
                            <i className="fa-solid fa-pen" aria-hidden="true" />{" "}
                            Corrigir
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="avd-ficha-link"
                          onClick={() => desfazer(item)}
                        >
                          <i
                            className="fa-solid fa-rotate-left"
                            aria-hidden="true"
                          />{" "}
                          Desfazer
                        </button>
                      </>
                    )}
                  </span>
                ) : null}
              </div>
              {corrigido && aceita && !correcao ? (
                <p className="avd-conferir-corrigido">
                  Corrigido: {textoDaLinha(lista, aceita)}
                </p>
              ) : null}
              {resumo.principal && estado !== "RECUSADO" ? (
                <p
                  className="avd-conferir-alertas"
                  data-tom={resumo.grave ? "grave" : "leve"}
                >
                  <i
                    className={`fa-solid ${resumo.grave ? "fa-triangle-exclamation" : "fa-circle-info"}`}
                    aria-hidden="true"
                  />
                  <span>{resumo.principal.texto}</span>
                  {resumo.outros.length ? (
                    <span
                      className="avd-conferir-mais"
                      tabIndex={0}
                      title={resumo.outros.map((a) => a.texto).join("\n")}
                      aria-label={`Mais ${resumo.outros.length}: ${resumo.outros.map((a) => a.texto).join("; ")}`}
                    >
                      +{resumo.outros.length}
                    </span>
                  ) : null}
                </p>
              ) : null}
              {correcao ? (
                <CorrecaoDoItem
                  chave={lista}
                  bloco={bloco}
                  nivel={lancamento.nivel}
                  linha={correcao.linha}
                  aoMudar={(linha) =>
                    setCorrigindo({ chave: item.chave, linha })
                  }
                  aoAceitar={() => aceitarCorrigido(item, correcao.linha)}
                  aoCancelar={() => setCorrigindo(null)}
                />
              ) : null}
              {abertoParaRecusar && estado !== "ACEITO" ? (
                <MotivosDaRecusa
                  marcado={recusa?.motivo}
                  textoLivre={recusa?.texto ?? ""}
                  aoEscolher={(motivo, texto) => recusar(item, motivo, texto)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      {children}
    </section>
  );
}

/* "Corrigir": a linha lida aberta e preenchida, para ajustar antes de aceitar. */
function CorrecaoDoItem({
  chave,
  bloco,
  nivel,
  linha,
  aoMudar,
  aoAceitar,
  aoCancelar,
}: {
  chave: ChaveDosItens;
  bloco: Bloco;
  nivel: string | null | undefined;
  linha: ItemLancado;
  aoMudar: (linha: ItemLancado) => void;
  aoAceitar: () => void;
  aoCancelar: () => void;
}) {
  const completa = itemCompleto(chave, linha);
  return (
    <div
      className="avd-conferir-corrigir"
      role="group"
      aria-label="Corrigir o item lido"
    >
      <div className="avd-ficha-item" data-chave={chave}>
        <CamposDoItem
          chave={chave}
          bloco={bloco}
          nivel={nivel}
          item={linha}
          pedeCampos
          desabilitado={false}
          aoAlterar={(campos) => aoMudar({ ...linha, ...campos })}
        />
      </div>
      <div className="avd-conferir-corrigir-acoes">
        {!completa ? (
          <span className="avd-conferir-falta">
            {FALTA_PARA_ACEITAR[chave]}
          </span>
        ) : null}
        <button type="button" className="avd-ficha-link" onClick={aoCancelar}>
          Cancelar
        </button>
        <button
          type="button"
          className="avd-conferir-botao"
          data-acao="aceitar-correcao"
          disabled={!completa}
          onClick={aoAceitar}
        >
          <i className="fa-solid fa-check" aria-hidden="true" /> Aceitar com a
          correção
        </button>
      </div>
    </div>
  );
}

function MotivosDaRecusa({
  marcado,
  textoLivre,
  aoEscolher,
}: {
  marcado?: MotivoDaRecusa;
  textoLivre: string;
  aoEscolher: (motivo: MotivoDaRecusa, texto?: string) => void;
}) {
  return (
    <div
      className="avd-conferir-motivos"
      role="group"
      aria-label="Por que recusar?"
    >
      {MOTIVOS_DA_RECUSA.map(([codigo, rotulo]) => (
        <button
          key={codigo}
          type="button"
          className="avd-ficha-chip"
          aria-pressed={marcado === codigo}
          onClick={() =>
            aoEscolher(codigo, codigo === "OUTRO" ? textoLivre : undefined)
          }
        >
          {rotulo}
        </button>
      ))}
      {marcado === "OUTRO" ? (
        <input
          className="avd-conferir-outro"
          aria-label="Outro motivo"
          placeholder="Qual?"
          maxLength={TAMANHO_DO_TEXTO_DA_RECUSA}
          value={textoLivre}
          onChange={(ev) => aoEscolher("OUTRO", ev.target.value)}
        />
      ) : null}
    </div>
  );
}
