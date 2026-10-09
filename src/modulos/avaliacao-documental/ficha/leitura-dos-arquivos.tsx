import { useState } from "react";
import type { KeyboardEvent } from "react";
import {
  aceitarItemLido,
  aceitarTodosSemAlerta,
  alertasDoArquivo,
  desfazerDecisaoLida,
  estadoDoItemLido,
  MOTIVOS_DA_RECUSA,
  recusarItemLido,
  rotuloDaRecusa,
  TAMANHO_DO_TEXTO_DA_RECUSA,
} from "../../../lib/avaliacao-documental/leitura-dos-arquivos.ts";
import type {
  ItemParaConferir,
  LeituraDoArquivo,
  MotivoDaRecusa,
} from "../../../lib/avaliacao-documental/leitura-dos-arquivos.ts";
import type { Bloco, ContextoDaEmpregare, Lancamento, Mudar } from "./tipos.ts";

/*
  O que o robô leu dos arquivos, na ficha (a leitura é do Python; aqui só se
  mostra e se registra a decisão — leitura-dos-arquivos.ts):
  - LidoDoArquivo: ao lado de cada arquivo, uma linha com o resumo
    ("3 certificados · 145 h, 60 h, 40 h · nome confere") e, se houver, os
    alertas do arquivo noutra;
  - ConferenciaDoLido: no item da ficha, cada certificado, título ou vínculo
    lido numa linha de conferência, com os alertas dele, o link do arquivo
    (e a página) e Aceitar / Recusar (teclas A e R na linha focada). Aceitar
    vira linha do item, marcada "lido do arquivo"; Recusar pede o motivo em
    chips curtos e fica registrado (dá para trocar ou desfazer). "Aceitar
    todos sem alerta" aceita de uma vez os pendentes sem alerta.
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
              title="Lido por reconhecimento de imagem: confira os valores"
            >
              {" "}
              · por imagem
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
};

const ROTULO_DA_LISTA: Record<string, [string, string]> = {
  CURSOS: ["certificado lido", "certificados lidos"],
  TITULOS: ["título lido", "títulos lidos"],
  VINCULOS: ["vínculo lido", "vínculos lidos"],
};

/** A conferência dos itens lidos do bloco (cursos, títulos ou vínculos). */
export function ConferenciaDoLido({
  bloco,
  itens,
  lancamento,
  mudar,
  desabilitado,
  empregare,
}: PropriedadesDaConferencia) {
  const [recusando, setRecusando] = useState<string | null>(null);
  if (!itens.length) return null;
  const estados = itens.map((i) =>
    estadoDoItemLido(lancamento, bloco, i.chave),
  );
  const pendentes = estados.filter((e) => e === "PENDENTE").length;
  const semAlerta = itens.filter(
    (i, n) => estados[n] === "PENDENTE" && !i.alertas.length,
  ).length;
  const [um, varios] = ROTULO_DA_LISTA[bloco.tipo] ?? [
    "item lido",
    "itens lidos",
  ];
  const aplicar = (transformar: (l: Lancamento) => Lancamento) =>
    mudar((l) => transformar(l));
  const aceitar = (item: ItemParaConferir) => {
    setRecusando(null);
    aplicar((l) => aceitarItemLido(l, bloco, item));
  };
  const recusar = (
    item: ItemParaConferir,
    motivo: MotivoDaRecusa,
    texto?: string,
  ) => aplicar((l) => recusarItemLido(l, bloco, item.chave, motivo, texto));
  const desfazer = (item: ItemParaConferir) => {
    setRecusando(null);
    aplicar((l) => desfazerDecisaoLida(l, bloco, item.chave));
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
      setRecusando(item.chave);
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
        {!desabilitado && semAlerta > 1 ? (
          <button
            type="button"
            className="avd-ficha-link"
            onClick={() =>
              aplicar((l) => aceitarTodosSemAlerta(l, bloco, itens))
            }
          >
            <i className="fa-solid fa-list-check" aria-hidden="true" /> Aceitar
            todos sem alerta ({semAlerta})
          </button>
        ) : null}
      </header>
      <ul className="avd-conferir-lista">
        {itens.map((item, n) => {
          const estado = estados[n] ?? "PENDENTE";
          const recusa = lancamento.recusas_lidas?.[item.chave];
          const abertoParaRecusar =
            !desabilitado &&
            (recusando === item.chave || estado === "RECUSADO");
          return (
            <li
              key={item.chave}
              className="avd-conferir-item"
              data-estado={estado.toLowerCase()}
              data-alerta={item.alertas.length ? "sim" : undefined}
              tabIndex={desabilitado ? undefined : 0}
              aria-keyshortcuts={desabilitado ? undefined : "A R"}
              aria-label={`${item.texto}${item.alertas.length ? `. Alertas: ${item.alertas.map((a) => a.texto).join("; ")}` : ""}`}
              onKeyDown={(ev) => aoTeclar(ev, item)}
            >
              <div className="avd-conferir-linha">
                <span className="avd-conferir-texto">{item.texto}</span>
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
                    Aceito
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
                {!desabilitado ? (
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
                    )}
                  </span>
                ) : null}
              </div>
              {item.alertas.length ? (
                <p className="avd-conferir-alertas">
                  <i
                    className="fa-solid fa-triangle-exclamation"
                    aria-hidden="true"
                  />
                  <span>{item.alertas.map((a) => a.texto).join(" · ")}</span>
                </p>
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
    </section>
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
