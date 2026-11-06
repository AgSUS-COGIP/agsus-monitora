/* Item da ficha: títulos, cursos e vínculos (API pública em ../item-da-ficha.tsx). */

import { useEffect, useRef, useState } from "react";
import { itemCompleto } from "../../../../lib/avaliacao-documental/ficha.ts";
import {
  abreComLinhaNova,
  comLinhaAberta,
  novoItemDoBloco,
} from "../../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import {
  devolverItem,
  tirarItem,
} from "../../../../lib/avaliacao-documental/itens-da-ficha.ts";
import type { ItemTirado } from "../../../../lib/avaliacao-documental/itens-da-ficha.ts";
import { CamposDoItem } from "../campos-do-item.tsx";
import { ComprovadoDaFicha } from "../comprovado-da-ficha.tsx";
import type {
  Bloco,
  EstadoDaFicha,
  ItemLancado,
  Lancamento,
  Mudar,
} from "../tipos.ts";
import { BLOCOS_COM_ITENS } from "./escolha.ts";
import type { ChaveDosItens } from "./escolha.ts";

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

export function Itens({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando volta a ficar vazia, não a cada mudança do lançamento.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- foca só quando a primeira linha fica em branco, não ao destravar a ficha.
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
