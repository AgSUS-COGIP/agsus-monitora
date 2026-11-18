import { useState } from "react";
import { classes } from "./classes.ts";

/*
  Os botões de exportação de toda tabela (revisão de 17/11; padrão do
  SIGEPSI): "Exportar em Excel" e "Salvar em PDF", sempre com esse nome, esse
  ícone e nessa ordem. Cada um aparece quando a tela passa a ação; enquanto
  gera, mostra "Gerando…" e fica ocupado. O retrato e os geradores ficam em
  src/lib/base/exportacao-da-tabela.ts; `baixarArquivo` entrega o arquivo.

  Lugar: no topo da tela (TopoDoPainel `exportacao`) ou na barra da tabela.
  Marcação: `.ui-exportacao` > `button[data-acao="exportar-excel" |
  "salvar-pdf"]`.
*/
export type AcaoDeExportar = () => unknown;

export interface PropriedadesDosBotoesDeExportacao {
  excel?: AcaoDeExportar | null;
  pdf?: AcaoDeExportar | null;
  desativado?: boolean;
  /** Botões menores (barra de tabela, gaveta). */
  pequenos?: boolean;
  className?: string;
}

const BOTOES = [
  {
    chave: "excel",
    acao: "exportar-excel",
    rotulo: "Exportar em Excel",
    icone: "fa-file-excel",
  },
  {
    chave: "pdf",
    acao: "salvar-pdf",
    rotulo: "Salvar em PDF",
    icone: "fa-file-pdf",
  },
] as const;

export function BotoesDeExportacao({
  excel,
  pdf,
  desativado = false,
  pequenos = false,
  className,
}: PropriedadesDosBotoesDeExportacao) {
  const [gerando, definirGerando] = useState<"excel" | "pdf" | null>(null);
  const acoes = { excel, pdf };
  if (!excel && !pdf) return null;

  async function executar(chave: "excel" | "pdf") {
    const acao = acoes[chave];
    if (!acao || gerando) return;
    definirGerando(chave);
    try {
      await acao();
    } finally {
      definirGerando(null);
    }
  }

  return (
    <span className={classes("ui-exportacao", className)}>
      {BOTOES.filter((botao) => acoes[botao.chave]).map((botao) => {
        const ocupado = gerando === botao.chave;
        return (
          <button
            key={botao.chave}
            type="button"
            className={classes("btn secondary", pequenos && "small")}
            data-acao={botao.acao}
            disabled={desativado || Boolean(gerando)}
            aria-busy={ocupado || undefined}
            onClick={() => void executar(botao.chave)}
          >
            <i className={`fa-solid ${botao.icone}`} aria-hidden="true" />{" "}
            {ocupado ? "Gerando…" : botao.rotulo}
          </button>
        );
      })}
    </span>
  );
}

/** Entrega o arquivo ao navegador (download), sem abrir aba. */
export function baixarArquivo(
  conteudo: Blob | Uint8Array,
  nome: string,
  tipo = "application/octet-stream",
) {
  const arquivo =
    conteudo instanceof Blob
      ? conteudo
      : new Blob([conteudo as Uint8Array<ArrayBuffer>], { type: tipo });
  const url = URL.createObjectURL(arquivo);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
