import type { FormEvent } from "react";
import type {
  AguardandoAnalise,
  EliminadoDaLista,
  ExplicacaoDoCandidato,
  LinhaDaLista,
  PendenciaDeEmpate,
  RecorteDasListas,
  ResultadoDoMotor,
  TipoDeLista,
  VagaDoResultado,
  VagaRecortada,
} from "../../lib/classificacao/tipos-do-resultado.ts";
import type {
  CalculoDaLista,
  DadosDaClassificacao,
  DesempateRegistrado,
  EstadoDaClassificacao,
  ListaRegistrada,
  SnapshotDaClassificacao,
} from "./tipos-do-estado.ts";

import type { RespostaDoDesempate } from "../../lib/classificacao/relatorio-de-desempate.ts";
import {
  acompanharPreparoDoDesempate,
  estadoDoRelatorio,
} from "../../lib/classificacao/relatorio-de-desempate.ts";
import { PRAZO_DO_CALCULO_MS } from "../../lib/classificacao/calculo-em-python.ts";
import { useEffect, useId, useMemo, useState } from "react";
import { usarFiltrosNaUrl } from "../../app/usar-filtros-na-url.ts";
import type { EsquemaDosFiltros } from "../../app/filtros-no-endereco.ts";
import { copiarTexto } from "../../lib/convite-de-acesso.ts";
import { formatNumberBR } from "../../lib/formatters";
import {
  MOTIVOS_DE_ELIMINACAO,
  TIPOS_DE_LISTA,
} from "../../lib/classificacao/catalogo.ts";
import {
  avisosAgrupados,
  chaveDoRecorte,
  filtrosAtivosDoRecorte,
  geracaoDesatualizada,
  listaDaFase,
  listaDesatualizada,
  normalizarRecorte,
  pessoasDoRecorte,
  recortarResultado,
  RECORTE_VAZIO,
  SITUACOES_DO_RECORTE,
} from "../../lib/classificacao/dados.ts";
import {
  dataBR,
  formatarNota,
  ordinal,
} from "../../lib/classificacao/numeros.ts";
import { normalizarRegra } from "../../lib/classificacao/regra.ts";
import { rotuloDaVersaoNaLista } from "../../lib/nome-da-versao.ts";
import { conferirSorteio } from "../../lib/classificacao/sorteio.ts";
import { DocumentoDoSei } from "./documento.tsx";
import { HoraDeNascimento } from "./hora-de-nascimento.tsx";
import { ModalDePublicacaoDeAprovados } from "./publicar-aprovados.tsx";
import {
  AcoesDaLinha,
  Aviso,
  BarraDaLista,
  Campo,
  CardDaLista,
  ErroAoCarregar,
  FaixaDeSituacao,
  Gaveta,
  Modal,
  Secao,
  Segmentado,
  Selo,
  TabelaDaLista,
} from "../../ui/index.ts";
import type {
  AcaoDoMenu,
  ColunaDaTabela,
  ItemDaFaixa,
} from "../../ui/index.ts";
import { CarregandoConteudo } from "../../ui/index.ts";

/*
  A aba "Listas" da Classificação: preliminar (documental), convocação para
  entrevista e resultado final, cada uma com a geral e as de cada modalidade,
  os eliminados com motivo, a explicação da posição (gaveta do candidato) e os
  avisos no topo. "Gerar" registra a lista (versão da regra, quem, quando,
  hash); "Exportar" sai de uma lista registrada (PDF pela impressão, DOCX,
  XLSX). O empate que espera sorteio ou decisão abre o registro aqui.
  No resultado final, "Publicar como lista de aprovados" faz dele a lista de
  aprovados vigente do edital (publicar-aprovados.tsx).
  Nota alterada por ajuste aprovado em recurso: selo "Recurso nº X" na linha
  e a frase na explicação; lista gerada antes de um ajuste aprovado (ou do
  cancelamento de um aprovado): aviso para gerar de novo.

  O layout das telas da seleção: a faixa de situação (Candidatos, Na vaga,
  Cadastro reserva, Convocados e Aptos quando há, Eliminados e Aguardando
  análise quando há; cada número é o total da lista que ele abre, contado
  com o mesmo recorte), com a lista (preliminar, convocação, entrevista,
  final) e a data de corte na linha de baixo; num card só, a barra (busca
  por nome ou código com "/", Vaga e, em "Filtros", a lista da modalidade e
  a situação, guardados na URL e na sessão por edital) e uma tabela só,
  agrupada por vaga, 50 e mais 50 ao rolar: posição como etiqueta (o 1º em
  destaque), a pessoa (nome e "código · modalidade"), a nota, a situação e
  "Ver posição" (ou "Ver motivo") com o "⋯" (registrar o empate da pessoa,
  copiar o código).
*/

/* "Recurso nº 12" ao lado do nome: a nota veio de um ajuste aprovado em recurso. */
export function MarcaDoRecurso({ recursos }: { recursos?: number[] }) {
  if (!recursos?.length) return null;
  const numeros = recursos.map((n) => `nº ${n}`).join(", ");
  return (
    <Selo
      tom="revisar"
      className="classificacao-marca-recurso"
      titulo={`Nota alterada pelo recurso ${numeros}`}
    >
      Recurso {numeros}
    </Selo>
  );
}

const SITUACOES: Record<string, [string, string]> = {
  VAGA: ["aprovado", "Vaga"],
  CR: ["neutro", "CR"],
  CONVOCADO: ["revisar", "Convocado"],
  APTO: ["aprovado", "Apto"],
};
const motivosDaEliminacao: Readonly<Record<string, string>> =
  MOTIVOS_DE_ELIMINACAO;

function dataHora(valor: unknown) {
  if (typeof valor !== "string" && typeof valor !== "number") return "";
  const d = new Date(valor);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      });
}

function Avisos({
  resultado,
  podeEditar,
  aoResolver,
}: {
  resultado: ResultadoDoMotor;
  podeEditar: boolean;
  aoResolver: (p: PendenciaDeEmpate) => void;
}) {
  const grupos = avisosAgrupados(resultado.avisos);
  if (!grupos.length && !resultado.pendencias.length) return null;
  const tom = grupos.some((g) => g.tom === "danger") ? "danger" : "warning";
  return (
    <Aviso tom={tom} papel="status" className="classificacao-avisos">
      {resultado.pendencias.length ? (
        <ul
          className="classificacao-pendencias"
          data-tour="classificacao-empates"
        >
          {resultado.pendencias.map((p) => (
            <li key={p.chave}>
              <span>
                Vaga {p.vagaTexto}: {p.candidatos.map((c) => c.nome).join(", ")}{" "}
                — {formatarNota(p.nota, resultado.casas)}
              </span>
              {podeEditar ? (
                <button
                  type="button"
                  className="btn small"
                  data-acao="resolver-empate"
                  onClick={() => aoResolver(p)}
                >
                  {p.metodo === "SORTEIO"
                    ? "Registrar sorteio"
                    : "Registrar decisão"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {grupos.map((g) => (
        <details key={g.codigo} data-aviso={g.codigo}>
          <summary>
            {g.rotulo} ({g.itens.length})
          </summary>
          <ul>
            {g.itens.slice(0, 50).map((a, i) => (
              <li key={`${a.analiseId || ""}-${i}`}>{a.texto}</li>
            ))}
            {g.itens.length > 50 ? (
              <li>… e mais {g.itens.length - 50}.</li>
            ) : null}
          </ul>
        </details>
      ))}
    </Aviso>
  );
}

/* As ações de cada pessoa na tabela da vaga. */
interface AcoesDaPessoa {
  codigos: ReadonlyMap<string, string>;
  empates: ReadonlyMap<string, PendenciaDeEmpate>;
  podeEditar: boolean;
  aoResolver: (p: PendenciaDeEmpate) => void;
  aoCopiar: (codigo: string) => void;
}

function AcoesDaPessoaNaLista({
  analiseId,
  nome,
  rotulo,
  aoAbrir,
  acoes,
}: {
  analiseId: string;
  nome: string;
  rotulo: string;
  aoAbrir: (id: string) => void;
  acoes: AcoesDaPessoa;
}) {
  const codigo = acoes.codigos.get(analiseId) ?? "";
  const empate = acoes.podeEditar ? acoes.empates.get(analiseId) : undefined;
  const outras: AcaoDoMenu[] = [
    ...(empate
      ? [
          {
            id: "empate",
            rotulo:
              empate.metodo === "SORTEIO"
                ? "Registrar sorteio do empate"
                : "Registrar decisão do empate",
            icone: "fa-scale-balanced",
            dados: { "data-acao": "linha-resolver-empate" },
            aoEscolher: () => acoes.aoResolver(empate),
          },
        ]
      : []),
    ...(codigo
      ? [
          {
            id: "copiar",
            rotulo: "Copiar código",
            icone: "fa-copy",
            dados: { "data-acao": "linha-copiar-codigo" },
            aoEscolher: () => acoes.aoCopiar(codigo),
          },
        ]
      : []),
  ];
  return (
    <AcoesDaLinha
      pessoa={codigo || nome}
      principal={{
        rotulo,
        icone: "fa-circle-info",
        acao: "ver-posicao",
        aoClicar: () => aoAbrir(analiseId),
      }}
      outras={outras}
    />
  );
}

const ORIGEM_DAS_VAGAS: Readonly<Record<string, string>> = Object.freeze({
  CONVOCACAO:
    "Vagas por modalidade: configuração de convocação do edital (Lista de aprovados).",
  REGRA: "Vagas por modalidade: percentuais da regra de classificação.",
});

/*
  As situações da faixa: Candidatos (todas), as da linha (Na vaga, Cadastro
  reserva, Convocados, Aptos), Eliminados e Aguardando análise. Convocados,
  Aptos e Aguardando só aparecem com alguém (dependem da lista e da fase).
*/
const SITUACOES_DA_FAIXA: ReadonlyArray<{
  valor: string;
  rotulo: string;
  tom: string;
  sempre?: boolean;
}> = [
  { valor: "", rotulo: "Candidatos", tom: "neutro", sempre: true },
  { valor: "VAGA", rotulo: "Na vaga", tom: "sucesso", sempre: true },
  { valor: "CR", rotulo: "Cadastro reserva", tom: "info", sempre: true },
  { valor: "CONVOCADO", rotulo: "Convocados", tom: "destaque" },
  { valor: "APTO", rotulo: "Aptos", tom: "sucesso" },
  { valor: "ELIMINADOS", rotulo: "Eliminados", tom: "perigo", sempre: true },
  { valor: "AGUARDANDO", rotulo: "Aguardando análise", tom: "alerta" },
];

/* Uma linha da tabela única: a pessoa na lista, eliminada ou aguardando, com a vaga. */
type LinhaDaTabela =
  | { tipo: "lista"; vaga: string; codigoDaVaga: string; l: LinhaDaLista }
  | {
      tipo: "eliminado";
      vaga: string;
      codigoDaVaga: string;
      l: EliminadoDaLista;
    }
  | {
      tipo: "aguardando";
      vaga: string;
      codigoDaVaga: string;
      l: AguardandoAnalise;
    };

/* As vagas recortadas numa lista só, na ordem: as linhas, os eliminados e quem aguarda. */
function linhasDasVagas(vagas: readonly VagaRecortada[]): LinhaDaTabela[] {
  const saida: LinhaDaTabela[] = [];
  for (const v of vagas) {
    const base = { vaga: v.chave, codigoDaVaga: v.codigo };
    for (const l of v.linhas) saida.push({ tipo: "lista", ...base, l });
    for (const l of v.eliminadosFiltrados)
      saida.push({ tipo: "eliminado", ...base, l });
    for (const l of v.aguardandoFiltrados)
      saida.push({ tipo: "aguardando", ...base, l });
  }
  return saida;
}
const vagaDaLinha = (linha: LinhaDaTabela) => linha.vaga;

const COLUNAS_DA_TABELA: ColunaDaTabela[] = [
  { rotulo: "Posição", largura: "6rem" },
  { rotulo: "Pessoa" },
  { rotulo: "Vaga" },
  { rotulo: "Nota", numero: true },
  { rotulo: "Situação" },
  {
    rotulo: "Ações",
    chave: "acoes",
    numero: true,
    cabecalho: <span className="sr-only">Ações</span>,
  },
];

/* A posição como etiqueta; o 1º lugar em destaque; "=" no empate. */
function EtiquetaDaPosicao({ l }: { l: LinhaDaLista }) {
  return (
    <span
      className="ui-posicao"
      data-primeiro={l.posicao === 1 ? "" : undefined}
      title={l.empatados > 1 ? "Empatados na mesma posição" : undefined}
    >
      {ordinal(l.posicao)}
      {l.empatados > 1 ? (
        <span className="classificacao-empate"> =</span>
      ) : null}
    </span>
  );
}

function LinhaDaClassificacao({
  linha,
  casas,
  rotulosDasModalidades,
  aoAbrir,
  acoes,
}: {
  linha: LinhaDaTabela;
  casas: number;
  rotulosDasModalidades: Record<string, string>;
  aoAbrir: (id: string) => void;
  acoes: AcoesDaPessoa;
}) {
  const { l } = linha;
  const codigo = acoes.codigos.get(l.analiseId) ?? "";
  const modalidades =
    linha.tipo === "lista"
      ? linha.l.modalidades
          .map((m) => rotulosDasModalidades[m] || m)
          .join(" / ")
      : "";
  const atributos =
    linha.tipo === "lista"
      ? { "data-candidato": l.analiseId }
      : linha.tipo === "eliminado"
        ? { "data-eliminado": l.analiseId }
        : { "data-aguardando": l.analiseId };
  return (
    <tr {...atributos}>
      <td>
        {linha.tipo === "lista" ? <EtiquetaDaPosicao l={linha.l} /> : "—"}
      </td>
      <td>
        <span className="ui-pessoa">
          <span>
            <button
              type="button"
              className="classificacao-nome"
              onClick={() => aoAbrir(l.analiseId)}
            >
              {l.nome}
            </button>{" "}
            {"recursos" in l ? <MarcaDoRecurso recursos={l.recursos} /> : null}
          </span>
          <span>{[codigo, modalidades].filter(Boolean).join(" · ")}</span>
        </span>
      </td>
      <td>{linha.codigoDaVaga}</td>
      <td className="num">
        {linha.tipo === "lista" ? formatarNota(linha.l.nota, casas) : "—"}
      </td>
      <td>
        {linha.tipo === "lista" ? (
          linha.l.situacao && SITUACOES[linha.l.situacao] ? (
            <Selo tom={SITUACOES[linha.l.situacao]?.[0]} ponto>
              {SITUACOES[linha.l.situacao]?.[1]}
              {linha.l.situacao === "VAGA" &&
              linha.l.vagaPor &&
              linha.l.vagaPor !== "AC"
                ? ` (${rotulosDasModalidades[linha.l.vagaPor] || linha.l.vagaPor})`
                : ""}
            </Selo>
          ) : (
            "—"
          )
        ) : linha.tipo === "eliminado" ? (
          <Selo tom="reprovado" ponto titulo={linha.l.detalhe || undefined}>
            {motivosDaEliminacao[linha.l.motivo] || linha.l.motivo}
          </Selo>
        ) : (
          <Selo tom="pendente" ponto>
            Aguardando análise
            {linha.l.situacao ? ` · ${linha.l.situacao}` : ""}
          </Selo>
        )}
      </td>
      <td className="num">
        {linha.tipo === "aguardando" ? null : (
          <AcoesDaPessoaNaLista
            analiseId={l.analiseId}
            nome={l.nome}
            rotulo={linha.tipo === "lista" ? "Ver posição" : "Ver motivo"}
            aoAbrir={aoAbrir}
            acoes={acoes}
          />
        )}
      </td>
    </tr>
  );
}

/* O cabeçalho do grupo da vaga: o cabeçalho dela, o limite da convocação e de onde vêm as vagas. */
function CabecalhoDaVaga({
  vaga,
  quantos,
}: {
  vaga: VagaRecortada | undefined;
  quantos: number;
}) {
  if (!vaga) return null;
  return (
    <>
      <strong>{vaga.cabecalho}</strong>
      <span className="ui-texto-secundario">
        {[
          `${formatNumberBR(quantos)} ${quantos === 1 ? "pessoa" : "pessoas"}`,
          vaga.limiteConvocacao
            ? `Limite da convocação: ${vaga.limiteConvocacao.origem}`
            : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {vaga.origemDasVagas && vaga.origemDasVagas !== "QUADRO" ? (
        <span
          className="ui-texto-secundario"
          data-origem-vagas={vaga.origemDasVagas}
        >
          {ORIGEM_DAS_VAGAS[vaga.origemDasVagas]}
        </span>
      ) : null}
    </>
  );
}

function GavetaDoCandidato({
  explicacao,
  vaga,
  rotulosDasModalidades,
  casas,
  podeEditar,
  aoSalvarHora,
  aoFechar,
}: {
  explicacao: ExplicacaoDoCandidato;
  vaga?: VagaDoResultado;
  rotulosDasModalidades: Record<string, string>;
  casas: number;
  podeEditar: boolean;
  aoSalvarHora: EstadoDaClassificacao["salvarHoraDeNascimento"];
  aoFechar: () => void;
}) {
  const posicoes = Object.entries(explicacao.posicoes || {});
  return (
    <Gaveta
      id="classificacaoCandidato"
      tituloId="classificacaoCandidatoTitulo"
      sobretitulo={vaga?.cabecalho || ""}
      titulo={explicacao.nome}
      resumo={
        explicacao.recursos?.length ? (
          <MarcaDoRecurso recursos={explicacao.recursos} />
        ) : undefined
      }
      rotuloDoFechar="Fechar a explicação"
      aoFechar={aoFechar}
    >
      <div className="ui-gaveta-corpo">
        {explicacao.elegivel ? (
          <Secao icone="fa-list-ol" titulo="Posição" secao="posicao">
            <ul className="classificacao-posicoes">
              <li>
                Geral:{" "}
                <b>
                  {explicacao.posicaoGeral
                    ? ordinal(explicacao.posicaoGeral)
                    : "fora da geral"}
                </b>{" "}
                · nota {formatarNota(explicacao.nota, casas)}
              </li>
              {posicoes.map(([codigo, posicao]) => (
                <li key={codigo}>
                  {rotulosDasModalidades[codigo] || codigo}:{" "}
                  <b>{ordinal(posicao)}</b>
                </li>
              ))}
              {explicacao.situacao ? (
                <li>
                  Situação:{" "}
                  {SITUACOES[explicacao.situacao]?.[1] || explicacao.situacao}
                </li>
              ) : null}
            </ul>
          </Secao>
        ) : null}
        <Secao
          icone="fa-circle-info"
          titulo={
            explicacao.elegivel
              ? "Por que nesta posição"
              : explicacao.aguardando
                ? "Aguardando análise"
                : "Por que fora da lista"
          }
          secao="explicacao"
        >
          <div className="ui-secao-texto classificacao-explicacao">
            {explicacao.explicacao.map((frase, i) => (
              <p key={i}>{frase}</p>
            ))}
          </div>
        </Secao>
        {explicacao.elegivel ? (
          <HoraDeNascimento
            key={explicacao.analiseId}
            horaNascimento={explicacao.horaNascimento ?? null}
            horaDecide={Boolean(explicacao.horaDecide)}
            podeEditar={podeEditar}
            aoSalvar={(hora) => aoSalvarHora(explicacao.analiseId, hora)}
          />
        ) : null}
      </div>
    </Gaveta>
  );
}

/* Registro do empate final: sorteio (semente do servidor ou informada) ou decisão manual. */
function ModalDeDesempate({
  pendencia,
  estado,
  aoFechar,
}: {
  pendencia: PendenciaDeEmpate;
  estado: EstadoDaClassificacao;
  aoFechar: () => void;
}) {
  const sorteio = pendencia.metodo === "SORTEIO";
  const [origem, setOrigem] = useState("SERVIDOR");
  const [semente, setSemente] = useState("");
  const [ordem, setOrdem] = useState(pendencia.candidatos);
  const [justificativa, setJustificativa] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [registro, setRegistro] = useState<DesempateRegistrado | null>(null);
  const ids = { semente: useId(), justificativa: useId() };
  const nomes = Object.fromEntries(
    pendencia.candidatos.map((c) => [c.analiseId, c.nome]),
  );

  const mover = (i: number, passo: number) =>
    setOrdem((atual) => {
      const nova = [...atual];
      const j = i + passo;
      if (j < 0 || j >= nova.length) return atual;
      const atualNaPosicao = nova[i],
        destino = nova[j];
      if (!atualNaPosicao || !destino) return atual;
      nova[i] = destino;
      nova[j] = atualNaPosicao;
      return nova;
    });

  const podeEnviar = sorteio
    ? origem === "SERVIDOR" || semente.trim().length >= 4
    : justificativa.trim().length >= 10;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!podeEnviar || enviando) return;
    setEnviando(true);
    const dados = {
      tipo_lista: pendencia.tipoLista,
      vaga: pendencia.vaga,
      chave: pendencia.chave,
      metodo: sorteio ? "SORTEIO" : "MANUAL",
      candidatos: pendencia.candidatos.map((c) => c.analiseId),
      ...(sorteio
        ? origem === "INFORMADA"
          ? { semente: semente.trim() }
          : {}
        : {
            ordem: ordem.map((c) => c.analiseId),
            justificativa: justificativa.trim(),
          }),
    };
    const novo = await estado.registrarDesempate(dados);
    setEnviando(false);
    if (novo && sorteio) setRegistro(novo);
    else if (novo) aoFechar();
  }

  return (
    <Modal
      id="classificacaoDesempate"
      rotuloId="classificacaoDesempateTitulo"
      aoFechar={aoFechar}
      cartaoClassName="classificacao-desempate"
      tamanho="medio"
    >
      <form onSubmit={enviar}>
        <h2 id="classificacaoDesempateTitulo">
          {sorteio ? "Sorteio do empate" : "Decisão do empate"}
        </h2>
        <p className="ui-texto-secundario">
          Vaga {pendencia.vagaTexto} · nota {formatarNota(pendencia.nota, 2)}
        </p>
        {registro ? (
          <>
            <ol className="classificacao-ordem">
              {(registro.ordem || []).map((id) => (
                <li key={id}>{nomes[id] || id}</li>
              ))}
            </ol>
            <p className="classificacao-semente">
              Semente: <code>{registro.semente}</code> (
              {registro.origem_semente === "SERVIDOR"
                ? "gerada no servidor"
                : "informada"}
              )
            </p>
            <Aviso
              tom={
                conferirSorteio(registro.semente, registro.ordem)
                  ? "info"
                  : "danger"
              }
              papel="status"
            >
              {conferirSorteio(registro.semente, registro.ordem)
                ? "Conferido: a ordem é a que a semente produz."
                : "A ordem gravada não confere com a semente."}
            </Aviso>
            <div className="ui-acoes">
              <button type="button" className="btn" onClick={aoFechar}>
                Fechar
              </button>
            </div>
          </>
        ) : (
          <>
            {sorteio ? (
              <>
                <Segmentado
                  rotulo="Semente"
                  opcoes={[
                    { valor: "SERVIDOR", rotulo: "Gerar no servidor" },
                    { valor: "INFORMADA", rotulo: "Informar" },
                  ]}
                  valor={origem}
                  aoMudar={setOrigem}
                />
                {origem === "INFORMADA" ? (
                  <Campo rotulo="Semente" obrigatorio>
                    <input
                      id={ids.semente}
                      value={semente}
                      maxLength={200}
                      onChange={(e) => setSemente(e.target.value)}
                    />
                  </Campo>
                ) : null}
                <ul className="classificacao-ordem">
                  {pendencia.candidatos.map((c) => (
                    <li key={c.analiseId}>{c.nome}</li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <ol className="classificacao-ordem">
                  {ordem.map((c, i) => (
                    <li key={c.analiseId}>
                      <span>{c.nome}</span>
                      <button
                        type="button"
                        className="btn secondary small"
                        aria-label={`Subir ${c.nome}`}
                        disabled={i === 0}
                        onClick={() => mover(i, -1)}
                      >
                        <i
                          className="fa-solid fa-arrow-up"
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        type="button"
                        className="btn secondary small"
                        aria-label={`Descer ${c.nome}`}
                        disabled={i === ordem.length - 1}
                        onClick={() => mover(i, 1)}
                      >
                        <i
                          className="fa-solid fa-arrow-down"
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  ))}
                </ol>
                <Campo rotulo="Justificativa" obrigatorio>
                  <textarea
                    id={ids.justificativa}
                    rows={3}
                    maxLength={2000}
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                  />
                </Campo>
              </>
            )}
            <div className="ui-acoes">
              <button
                type="button"
                className="btn secondary"
                onClick={aoFechar}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn"
                data-acao="registrar-desempate"
                disabled={!podeEnviar || enviando}
              >
                {sorteio ? "Sortear e registrar" : "Registrar decisão"}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

/*
  O "Gerar" com o cálculo pelo Python (chave "Gerar listas pelo Python"):
  esperando o job, o aviso de quando ele não chegou, falhou ou não confere com
  o motor da tela (nada registrado) e o "Tentar de novo" (um pedido novo).
*/
function CalculoPeloPython({
  calculo,
  tentar,
}: {
  calculo: CalculoDaLista;
  tentar: (() => void) | null;
}) {
  if (calculo.situacao === "calculando")
    return (
      <p className="status-discreto" role="status" data-calculo="calculando">
        Calculando a lista… (até {Math.round(PRAZO_DO_CALCULO_MS / 60000)} min)
      </p>
    );
  const diferente = calculo.situacao === "diferente";
  return (
    <Aviso
      tom={diferente ? "danger" : "warning"}
      papel="alert"
      className="classificacao-calculo-aviso"
    >
      <p data-calculo={calculo.situacao}>
        {calculo.mensagem || "O cálculo em Python não terminou."}
        {diferente
          ? " Clique em Atualizar e gere de novo; se continuar, avise o suporte."
          : ""}
      </p>
      {tentar ? (
        <button
          type="button"
          className="btn secondary"
          data-acao="tentar-calculo"
          onClick={tentar}
        >
          Tentar de novo
        </button>
      ) : null}
    </Aviso>
  );
}

function Acoes({
  tipo,
  e,
  resultado,
  registro,
  estado,
  aoGerado,
  aoCarregarRegistro,
  aoAbrirAgenda,
  confirmar,
}: {
  tipo: TipoDeLista;
  e: SnapshotDaClassificacao;
  resultado: ResultadoDoMotor;
  registro: ListaRegistrada | null;
  estado: EstadoDaClassificacao;
  aoGerado: (l: ListaRegistrada) => void;
  aoCarregarRegistro: (l: ListaRegistrada) => void;
  aoAbrirAgenda?: () => void;
  confirmar: (mensagem: string) => boolean;
}) {
  const [lista, setLista] = useState("todas");
  const [fase, setFase] = useState<"" | "PRELIMINAR" | "FINAL">("");
  const idLista = useId();
  const idFase = useId();
  const dados = e.dados;
  const geracoes = (dados?.listas || []).filter((l) => l.tipo === tipo);
  const ultima = registro || geracoes[0] || null;
  const desatualizada = listaDesatualizada(ultima, dados?.ajustes_mudaram_em);
  /*
    O relatório de desempate da lista gerada (do Python): gerar pede o
    relatório; enquanto ele é preparado, relê com espera crescente, só com a
    aba à frente e até o prazo (acompanharPreparoDoDesempate). Passado o
    prazo, o aviso com "Tentar de novo" (que recomeça a contar).
  */
  const [respostaDoDesempate, setRespostaDoDesempate] =
    useState<RespostaDoDesempate | null>(null);
  const [preparoEsgotado, setPreparoEsgotado] = useState(false);
  const [tentativaDoPreparo, setTentativaDoPreparo] = useState(0);
  const idDaUltima = ultima?.id || "";
  useEffect(() => {
    setRespostaDoDesempate(null);
    setPreparoEsgotado(false);
    if (!idDaUltima) return undefined;
    return acompanharPreparoDoDesempate({
      ler: () => estado.obterDesempate(idDaUltima),
      aoLer: setRespostaDoDesempate,
      aoEsgotar: () => setPreparoEsgotado(true),
    });
  }, [estado, idDaUltima, tentativaDoPreparo]);
  const desempate = respostaDoDesempate?.desempate ?? null;
  const relatorioLido = estadoDoRelatorio(respostaDoDesempate);
  const relatorio =
    preparoEsgotado && relatorioLido === "preparando"
      ? "esgotado"
      : relatorioLido;
  // O cálculo pelo Python desta lista (chave "Gerar listas pelo Python" ligada).
  const calculo = e.calculo?.tipo === tipo ? e.calculo : null;
  // A geração guardada não bate com os dados de agora (fichas, notas, regra…).
  const defasada = geracaoDesatualizada(
    ultima,
    resultado,
    dados?.regra?.versao ?? null,
  );
  const textoDaDefasagem = (motivo: string, l: ListaRegistrada | null) =>
    `Esta geração é de ${dataHora(l?.gerada_em) || "antes"}; ${motivo} desde então — gere de novo.`;
  const modalidades = normalizarRegra(
    dados?.regra?.configuracao,
  ).modalidades.filter((m) => m.lista_propria);

  const [documento, setDocumento] = useState<ListaRegistrada | null>(null);
  const [publicando, setPublicando] = useState<ListaRegistrada | null>(null);
  const [marcando, setMarcando] = useState(false);
  const analises = useMemo(
    () =>
      new Map(
        (dados?.candidatos || []).map((c) => [
          String(c.analise_id),
          { vaga: c.vaga, cargo: c.cargo },
        ]),
      ),
    [dados?.candidatos],
  );

  /* A lista registrada (a desta sessão ou a última gerada, lida do banco). */
  async function alvoRegistrado() {
    let alvo = registro;
    if (!alvo?.retrato && geracoes[0])
      alvo = await estado.obterLista(geracoes[0].id);
    if (alvo) aoCarregarRegistro(alvo);
    if (!alvo?.retrato) return null;
    // Com o retrato em mãos, confere o conteúdo inteiro antes de exportar.
    const motivo = geracaoDesatualizada(
      alvo,
      resultado,
      dados?.regra?.versao ?? null,
    );
    if (
      motivo &&
      !confirmar(
        `${textoDaDefasagem(motivo, alvo)}

Usar esta geração assim mesmo?`,
      )
    )
      return null;
    return alvo;
  }
  async function exportar(formato: string) {
    const alvo = await alvoRegistrado();
    if (alvo) await estado.exportar(alvo, formato, lista, fase || null);
  }
  async function exportarDesempate(formato: string) {
    const alvo = await alvoRegistrado();
    if (alvo) estado.exportarDesempate(desempate, alvo, formato);
  }
  async function copiarParaSei() {
    const alvo = await alvoRegistrado();
    if (alvo) await estado.copiarParaSei(alvo, { lista, fase: fase || null });
  }
  async function abrirDocumento() {
    const alvo = await alvoRegistrado();
    if (alvo) setDocumento(alvo);
  }
  async function marcarComoPublicada() {
    if (!ultima || marcando) return;
    setMarcando(true);
    const publicado = await estado.publicarLista(ultima, resultado);
    setMarcando(false);
    if (publicado) aoCarregarRegistro({ ...ultima, ...publicado });
  }
  function abrirPublicacaoDeAprovados() {
    const alvo = registro?.id ? registro : geracoes[0];
    if (alvo) setPublicando(alvo);
  }
  async function gerar() {
    const novo = await estado.gerarLista(resultado);
    if (novo) aoGerado(novo);
  }

  return (
    <section
      className="ui-card classificacao-acoes"
      aria-label="Geração e exportação"
      data-tour="classificacao-acoes"
    >
      <div className="classificacao-acoes-linha">
        {e.podeEditar ? (
          <button
            type="button"
            className="btn"
            data-acao="gerar"
            data-tour="classificacao-gerar"
            disabled={
              !resultado ||
              e.gerando ||
              !dados?.regra ||
              Boolean(e.erroDaConvocacao)
            }
            title={
              e.erroDaConvocacao
                ? "Leia a convocação do edital de novo antes de gerar."
                : undefined
            }
            onClick={gerar}
          >
            <i className="fa-solid fa-file-circle-check" aria-hidden="true" />{" "}
            Gerar
          </button>
        ) : null}
        <Campo rotulo="Exportar">
          <select
            id={idLista}
            data-tour="classificacao-exportar-lista"
            value={lista}
            onChange={(ev) => setLista(ev.target.value)}
          >
            <option value="todas">Geral e modalidades</option>
            <option value="geral">Só a geral</option>
            {modalidades.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                Só {m.nome}
              </option>
            ))}
            {tipo !== "CONVOCACAO" ? (
              <option value="eliminados">Só os eliminados</option>
            ) : null}
          </select>
        </Campo>
        {tipo !== "CONVOCACAO" ? (
          <Campo rotulo="Publicação">
            <select
              id={idFase}
              value={fase}
              data-campo="fase"
              onChange={(ev) => {
                const valor = ev.target.value;
                if (valor === "" || valor === "PRELIMINAR" || valor === "FINAL")
                  setFase(valor);
              }}
            >
              <option value="">
                {tipo === "FINAL" ? "Resultado final" : "Preliminar"}
              </option>
              {tipo === "FINAL" ? (
                <option value="PRELIMINAR">Resultado preliminar</option>
              ) : (
                <option value="FINAL">Final (após recursos)</option>
              )}
            </select>
          </Campo>
        ) : null}
        <button
          type="button"
          className="btn"
          data-acao="copiar-sei"
          data-tour="classificacao-copiar-sei"
          disabled={!ultima}
          onClick={copiarParaSei}
        >
          <i className="fa-solid fa-copy" aria-hidden="true" /> Copiar para o
          SEI
        </button>
        <button
          type="button"
          className="btn secondary"
          data-acao="ver-documento"
          data-tour="classificacao-ver-documento"
          disabled={!ultima}
          onClick={abrirDocumento}
        >
          <i className="fa-solid fa-eye" aria-hidden="true" /> Como fica no SEI
        </button>
        {[
          ["docx", "Baixar DOCX"],
          ["pdf", "PDF"],
          ["xlsx", "XLSX"],
        ].map(([formato = "", rotulo]) => (
          <button
            key={formato}
            type="button"
            className="btn secondary"
            data-exportar={formato}
            disabled={!ultima}
            onClick={() => exportar(formato)}
          >
            {rotulo}
          </button>
        ))}
        {tipo === "CONVOCACAO" && aoAbrirAgenda ? (
          <button
            type="button"
            className="btn secondary"
            data-acao="abrir-agenda"
            data-tour="classificacao-abrir-agenda"
            onClick={aoAbrirAgenda}
          >
            <i className="fa-solid fa-calendar-days" aria-hidden="true" />{" "}
            Agenda das entrevistas
          </button>
        ) : null}
        {e.podeEditar && ultima && !ultima.publicada ? (
          <button
            type="button"
            className="btn secondary"
            data-acao="publicar"
            disabled={
              (ultima.pendencias ?? 0) > 0 || Boolean(defasada) || marcando
            }
            onClick={marcarComoPublicada}
          >
            {marcando ? "Publicando…" : "Marcar como publicada"}
          </button>
        ) : null}
        {tipo === "FINAL" && e.podeEditar && ultima ? (
          <button
            type="button"
            className="btn secondary"
            data-acao="publicar-aprovados"
            data-tour="classificacao-publicar-aprovados"
            disabled={
              (ultima.pendencias ?? 0) > 0 ||
              Boolean(defasada) ||
              Boolean(publicando)
            }
            onClick={abrirPublicacaoDeAprovados}
          >
            <i className="fa-solid fa-user-check" aria-hidden="true" /> Publicar
            como lista de aprovados
          </button>
        ) : null}
        {desempate
          ? [
              ["xlsx", "Relatório de desempate (XLSX)"],
              ["pdf", "Relatório de desempate (PDF)"],
            ].map(([formato = "", rotulo]) => (
              <button
                key={formato}
                type="button"
                className="btn secondary"
                data-desempate={formato}
                onClick={() => void exportarDesempate(formato)}
              >
                {rotulo}
              </button>
            ))
          : null}
      </div>
      {e.erroDaConvocacao ? (
        <ErroAoCarregar
          className="classificacao-erro-convocacao"
          oQue="a convocação do edital"
          mensagem={e.erroDaConvocacao}
          aoTentar={() => void estado.recarregarConvocacao()}
        />
      ) : null}
      {ultima ? (
        <p className="status-discreto" data-geracao={ultima.id}>
          Gerada em {dataHora(ultima.gerada_em)}
          {ultima.por ? ` por ${ultima.por}` : ""} · regra:{" "}
          {rotuloDaVersaoNaLista(dados?.regra?.versoes, ultima.versao_regra)} ·
          SHA-256 {String(ultima.hash || "").slice(0, 12)}…
          {ultima.publicada ? " · publicada" : ""}
        </p>
      ) : null}
      {defasada && !ultima?.publicada ? (
        <Aviso tom="warning" papel="status" className="classificacao-defasada">
          {textoDaDefasagem(defasada, ultima)}
        </Aviso>
      ) : null}
      {desatualizada ? (
        <Aviso
          tom="warning"
          papel="status"
          className="classificacao-desatualizada"
        >
          Há recursos aprovados depois desta lista — gere de novo.
        </Aviso>
      ) : null}
      {relatorio === "preparando" ? (
        <p
          className="status-discreto"
          role="status"
          data-desempate-preparo="preparando"
        >
          Relatório de desempate sendo preparado…
        </p>
      ) : null}
      {relatorio === "esgotado" ? (
        <Aviso
          tom="warning"
          papel="alert"
          className="classificacao-desempate-esgotado"
        >
          <p>
            O relatório de desempate ainda não ficou pronto. Tente de novo em
            alguns minutos; se continuar, avise o suporte.
          </p>
          <button
            type="button"
            className="btn secondary"
            data-acao="tentar-desempate"
            onClick={() => setTentativaDoPreparo((n) => n + 1)}
          >
            Tentar de novo
          </button>
        </Aviso>
      ) : null}
      {relatorio === "nao_confere" ? (
        <Aviso
          tom="warning"
          papel="status"
          className="classificacao-desempate-nao-confere"
        >
          {defasada
            ? "O relatório de desempate não saiu: os dados mudaram desde esta geração — gere de novo."
            : "O cálculo em Python não confere com esta lista e o relatório de desempate não saiu — avise o suporte."}
        </Aviso>
      ) : null}
      {relatorio === "falhou" ? (
        <Aviso
          tom="warning"
          papel="status"
          className="classificacao-desempate-falhou"
        >
          O relatório de desempate não pôde ser preparado — gere de novo ou
          avise o suporte.
        </Aviso>
      ) : null}
      {calculo ? (
        <CalculoPeloPython
          calculo={calculo}
          tentar={e.podeEditar && !e.gerando ? () => void gerar() : null}
        />
      ) : null}
      {publicando ? (
        <ModalDePublicacaoDeAprovados
          estado={estado}
          registro={publicando}
          resultado={resultado}
          analises={analises}
          aoFechar={() => setPublicando(null)}
        />
      ) : null}
      {documento?.retrato ? (
        <DocumentoDoSei
          estado={estado}
          podeEditar={e.podeEditar}
          registrado={{ ...documento, retrato: documento.retrato }}
          lista={
            tipo === "CONVOCACAO" && lista === "eliminados" ? "todas" : lista
          }
          fase={fase || null}
          aoFechar={() => setDocumento(null)}
        />
      ) : null}
    </section>
  );
}

/* O tipo de lista e o recorte na URL; a busca pelo nome fica fora dela. */
const FILTROS_DAS_LISTAS: EsquemaDosFiltros<
  "tipo" | "vaga" | "lista" | "situacao" | "busca"
> = Object.freeze({
  tipo: {
    padrao: "",
    aceita: (tipo: string) => TIPOS_DE_LISTA.some(([valor]) => valor === tipo),
  },
  vaga: { padrao: RECORTE_VAZIO.vaga },
  lista: { padrao: RECORTE_VAZIO.lista },
  situacao: {
    padrao: "",
    aceita: (situacao: string) =>
      SITUACOES_DO_RECORTE.some((s) => s.valor === situacao),
  },
  busca: { padrao: "", naUrl: false },
});

export function Listas({
  estado,
  e,
  calcular,
  aoAbrirAgenda,
  confirmar = (mensagem) => globalThis.confirm?.(mensagem) ?? true,
}: {
  estado: EstadoDaClassificacao;
  e: SnapshotDaClassificacao;
  calcular: (
    dados: DadosDaClassificacao,
    tipo: TipoDeLista,
  ) => ResultadoDoMotor;
  aoAbrirAgenda?: () => void;
  confirmar?: (mensagem: string) => boolean;
}) {
  /*
    O tipo de lista e o recorte (vaga, lista, situação) vão na URL; a busca
    pelo nome, não. Sem filtro na URL, vale o guardado na sessão da aba, por
    edital (volta no F5). Até a pessoa escolher, a lista acompanha a fase do
    edital.
  */
  const [filtros, mudarFiltros] = usarFiltrosNaUrl(FILTROS_DAS_LISTAS, {
    sessao: chaveDoRecorte(e.editalId),
  });
  const escolhido = (filtros.tipo || null) as TipoDeLista | null;
  const setEscolhido = (tipo: TipoDeLista) => mudarFiltros({ tipo });
  const recorte = useMemo(() => normalizarRecorte(filtros), [filtros]);
  const setRecorte = (
    novo: RecorteDasListas | ((atual: RecorteDasListas) => RecorteDasListas),
  ) =>
    mudarFiltros((atual) => {
      const r =
        typeof novo === "function" ? novo(normalizarRecorte(atual)) : novo;
      return { ...r, situacao: r.situacao ?? "" };
    });
  const [copiado, setCopiado] = useState("");
  const [aberto, setAberto] = useState("");
  const [pendencia, setPendencia] = useState<PendenciaDeEmpate | null>(null);
  const [registros, setRegistros] = useState<
    Partial<Record<TipoDeLista, ListaRegistrada>>
  >({});
  const dados = e.dados;
  const regra = dados?.regra?.configuracao || null;
  const tipo = escolhido || listaDaFase(dados);

  const resultado = useMemo(
    () => (dados && regra ? calcular(dados, tipo) : null),
    [dados, regra, tipo, calcular],
  );
  // A busca acha pelo código da inscrição também (a lista não o mostra).
  const codigos = useMemo(
    () =>
      new Map(
        (dados?.candidatos || []).map((c) => [
          String(c.analise_id ?? ""),
          String(c.codigo ?? ""),
        ]),
      ),
    [dados?.candidatos],
  );
  const vagas = useMemo(
    () => recortarResultado(resultado, recorte, codigos),
    [resultado, recorte, codigos],
  );
  const empates = useMemo(
    () =>
      new Map(
        (resultado?.pendencias || []).flatMap((p) =>
          p.candidatos.map((c) => [c.analiseId, p] as const),
        ),
      ),
    [resultado],
  );
  const acoesDasPessoas: AcoesDaPessoa = {
    codigos,
    empates,
    podeEditar: e.podeEditar,
    aoResolver: setPendencia,
    aoCopiar: (codigo) =>
      void copiarTexto(codigo).then((ok) =>
        setCopiado(
          ok
            ? `Código ${codigo} copiado.`
            : "Não foi possível copiar o código.",
        ),
      ),
  };
  const rotulosDasModalidades = useMemo(
    () =>
      Object.fromEntries(
        normalizarRegra(regra).modalidades.map((m) => [
          m.codigo,
          m.codigo === "AC" ? "AC" : m.nome,
        ]),
      ),
    [regra],
  );
  const explicacao = aberto && resultado ? resultado.explicacoes[aberto] : null;

  const trocarTipo = (novo: string) => {
    if (
      novo !== "PRELIMINAR" &&
      novo !== "CONVOCACAO" &&
      novo !== "ENTREVISTA" &&
      novo !== "FINAL"
    )
      return;
    setEscolhido(novo);
    setAberto("");
  };
  // Os números da faixa: cada um, o total da lista que ele abre (o mesmo recorte).
  const contagens = useMemo(
    () =>
      Object.fromEntries(
        SITUACOES_DA_FAIXA.map(({ valor }) => [
          valor,
          resultado
            ? pessoasDoRecorte(
                recortarResultado(
                  resultado,
                  { ...recorte, situacao: valor },
                  codigos,
                ),
              )
            : null,
        ]),
      ) as Record<string, number | null>,
    [resultado, recorte, codigos],
  );
  const linhasDaTabela = useMemo(() => linhasDasVagas(vagas), [vagas]);
  const [recolhidas, setRecolhidas] = useState(() => new Set<string>());
  const cabecalhosDasVagas = useMemo(
    () => new Map(vagas.map((v) => [v.chave, v])),
    [vagas],
  );

  return (
    <div className="classificacao-listas" data-tour="classificacao-listas">
      <FaixaDeSituacao
        rotulo="Situação da lista"
        tour="classificacao-kpis"
        className="classificacao-faixa"
        itens={SITUACOES_DA_FAIXA.filter(
          (s) =>
            s.sempre ||
            (contagens[s.valor] ?? 0) > 0 ||
            (recorte.situacao ?? "") === s.valor,
        ).map((s): ItemDaFaixa => ({
          chave: s.valor || "todos",
          rotulo: s.rotulo,
          valor:
            e.carregandoEdital || !dados ? null : (contagens[s.valor] ?? 0),
          tom: s.tom,
          ativo: (recorte.situacao ?? "") === s.valor,
          titulo: s.valor
            ? `Mostrar ${s.rotulo.toLowerCase()}`
            : "Mostrar todos",
          aoClicar: () =>
            setRecorte((atual) => ({
              ...atual,
              situacao:
                (atual.situacao ?? "") === s.valor || !s.valor ? "" : s.valor,
            })),
        }))}
      >
        <Segmentado
          rotulo="Lista"
          className="classificacao-tipos"
          opcoes={TIPOS_DE_LISTA.flatMap(([valor, rotulo]) =>
            valor && rotulo ? [{ valor, rotulo }] : [],
          )}
          valor={tipo}
          aoMudar={trocarTipo}
        />
        {resultado ? (
          <span>
            {formatNumberBR(resultado.totais.vagas)}{" "}
            {resultado.totais.vagas === 1 ? "vaga" : "vagas"}
          </span>
        ) : null}
        {resultado?.dataCorte ? (
          <span className="status-discreto">
            Data de corte da idade: {dataBR(resultado.dataCorte)}
          </span>
        ) : null}
      </FaixaDeSituacao>
      {dados && !regra ? (
        <Aviso tom="warning" papel="status">
          Este edital ainda não tem regra de classificação.
        </Aviso>
      ) : null}
      {resultado ? (
        <>
          <Avisos
            resultado={resultado}
            podeEditar={e.podeEditar}
            aoResolver={setPendencia}
          />
          <Acoes
            key={tipo}
            tipo={tipo}
            e={e}
            resultado={resultado}
            registro={registros[tipo] || null}
            estado={estado}
            aoGerado={(novo) => setRegistros((r) => ({ ...r, [tipo]: novo }))}
            aoCarregarRegistro={(novo) =>
              setRegistros((r) => ({ ...r, [tipo]: { ...r[tipo], ...novo } }))
            }
            aoAbrirAgenda={aoAbrirAgenda}
            confirmar={confirmar}
          />
          <CardDaLista
            rotulo="Pessoas da lista"
            tour="classificacao-lista"
            className="classificacao-lista"
          >
            <BarraDaLista
              rotulo="Encontrar a pessoa"
              tour="classificacao-filtros"
              className="classificacao-filtros"
              busca={{
                valor: recorte.busca,
                aoMudar: (busca) => setRecorte({ ...recorte, busca }),
                placeholder: "Buscar por nome ou código",
                rotulo: "Buscar candidato pelo nome ou código",
                acao: "buscar-candidato",
              }}
              quantos={filtrosAtivosDoRecorte(recorte)}
              aoLimpar={() => setRecorte({ ...RECORTE_VAZIO })}
              quantosSecundarios={
                (recorte.lista !== "geral" ? 1 : 0) + (recorte.situacao ? 1 : 0)
              }
              secundarios={
                <>
                  <Campo rotulo="Lista">
                    <select
                      value={recorte.lista}
                      data-acao="filtro-lista"
                      onChange={(ev) =>
                        setRecorte({ ...recorte, lista: ev.target.value })
                      }
                    >
                      <option value="geral">Classificação geral</option>
                      {normalizarRegra(regra)
                        .modalidades.filter((m) => m.lista_propria)
                        .map((m) => (
                          <option key={m.codigo} value={m.codigo}>
                            {m.nome}
                          </option>
                        ))}
                    </select>
                  </Campo>
                  <Campo rotulo="Situação">
                    <select
                      data-acao="filtro-situacao"
                      value={recorte.situacao ?? ""}
                      onChange={(ev) =>
                        setRecorte({ ...recorte, situacao: ev.target.value })
                      }
                    >
                      {SITUACOES_DO_RECORTE.map((s) => (
                        <option key={s.valor} value={s.valor}>
                          {s.rotulo}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </>
              }
            >
              <select
                aria-label="Vaga"
                data-acao="filtro-vaga"
                value={recorte.vaga}
                onChange={(ev) =>
                  setRecorte({ ...recorte, vaga: ev.target.value })
                }
              >
                <option value="">Todas as vagas</option>
                {resultado.vagas.map((v) => (
                  <option key={v.chave} value={v.chave}>
                    {[v.codigo, v.cargo, v.lotacao].filter(Boolean).join(" - ")}
                  </option>
                ))}
              </select>
            </BarraDaLista>
            <TabelaDaLista
              rotulo="Classificação"
              classeDaTabela="classificacao-tabela"
              colunas={COLUNAS_DA_TABELA}
              carregado
              itens={linhasDaTabela}
              chaveDoRecorte={`${tipo}:${JSON.stringify(recorte)}`}
              vazio={
                filtrosAtivosDoRecorte(recorte)
                  ? "Nenhuma pessoa com esses filtros."
                  : "Ninguém nesta lista ainda."
              }
              grupo={{
                chave: vagaDaLinha,
                cabecalho: (chave, quantos) => (
                  <CabecalhoDaVaga
                    vaga={cabecalhosDasVagas.get(chave)}
                    quantos={quantos}
                  />
                ),
                recolhidos: recolhidas,
                aoAlternar: (chave) =>
                  setRecolhidas((atual) => {
                    const nova = new Set(atual);
                    if (nova.has(chave)) nova.delete(chave);
                    else nova.add(chave);
                    return nova;
                  }),
              }}
              linha={(linha) => (
                <LinhaDaClassificacao
                  key={`${linha.tipo}:${linha.vaga}:${linha.l.analiseId}`}
                  linha={linha}
                  casas={resultado.casas}
                  rotulosDasModalidades={rotulosDasModalidades}
                  aoAbrir={setAberto}
                  acoes={acoesDasPessoas}
                />
              )}
            />
          </CardDaLista>
          {copiado ? <Aviso papel="status">{copiado}</Aviso> : null}
        </>
      ) : e.carregandoEdital ? (
        <CarregandoConteudo rotulo="Carregando as listas…" linhas={3} />
      ) : null}
      {explicacao && resultado ? (
        <GavetaDoCandidato
          explicacao={explicacao}
          vaga={resultado.vagas.find((v) => v.chave === explicacao.vaga)}
          rotulosDasModalidades={rotulosDasModalidades}
          casas={resultado.casas}
          podeEditar={e.podeEditar}
          aoSalvarHora={estado.salvarHoraDeNascimento}
          aoFechar={() => setAberto("")}
        />
      ) : null}
      {pendencia ? (
        <ModalDeDesempate
          pendencia={pendencia}
          estado={estado}
          aoFechar={() => setPendencia(null)}
        />
      ) : null}
    </div>
  );
}
