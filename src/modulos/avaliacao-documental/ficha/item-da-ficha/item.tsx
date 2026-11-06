/* Item da ficha: o item inteiro (API pública em ../item-da-ficha.tsx). */

import type { ReactNode } from "react";
import {
  blocoNaoPontuaNoNivel,
  blocoSeAplica,
  decidePelaNota,
  itemCompleto,
  mensagemDoBloco,
  respostasDoBloco,
  sugereNaoEnviado,
  textoDaNota,
} from "../../../../lib/avaliacao-documental/ficha.ts";
import {
  blocoEditaNota,
  declaradoDoBloco,
  escolhaDoBloco,
  semConfirmacaoSeMudouItens,
} from "../../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import type { Escolha } from "../../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import { semPerguntaNoQuestionario } from "../../../../lib/avaliacao-documental/respostas-do-candidato.ts";
import { leiturasDaFicha } from "../../../../lib/avaliacao-documental/leitura-dos-arquivos.ts";
import { Selo } from "../../../../ui/index.ts";
import {
  AreaExigida,
  AvisosDoTituloUnico,
  ExtrasDoBloco,
  RequisitosDoCargo,
} from "../diferencas-do-cargo.tsx";
import { ConferenciaDoLido } from "../leitura-dos-arquivos.tsx";
import { ObservacaoDoItem } from "../observacao-do-item.tsx";
import type {
  Bloco,
  ContextoDaEmpregare,
  EstadoDaFicha,
  ItemLancado,
  Lancado,
  LinhaDeResposta,
  Mudar,
} from "../tipos.ts";
import { DecisaoPelosItens } from "./decisao-pelos-itens.tsx";
import {
  BLOCOS_COM_ITENS,
  PARCIAL_DO_TIPO,
  SELO_DA_SITUACAO,
  decidePelosItens,
  decidirNoLancamento,
  lidosDoBloco,
  textoDoEfeito,
} from "./escolha.ts";
import type { ContextoDaEscolha } from "./escolha.ts";
import { Escolhas, NaoConfere } from "./escolhas.tsx";
import { Itens } from "./itens.tsx";
import { Respostas } from "./respostas.tsx";
import { Etnico, Justificativa, Resultado } from "./resultado.tsx";

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
    !decidePelaNota(bloco, lancamento) &&
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
  if (falta)
    mensagem = {
      texto: falta,
      tom: "falta",
      // Confere acima do comprovado pelos vínculos: o atalho para Editar nota.
      acao:
        !desabilitado &&
        escolha === "CONFERE" &&
        pendencias.some(
          (p) =>
            p.bloco === bloco.codigo && p.tipo === "acima" && p.texto === falta,
        )
          ? { rotulo: "Editar nota", aoClicar: () => escolher("EDITAR") }
          : undefined,
    };
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
