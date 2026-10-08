import {
  aplicarRoteiroNaConfiguracao,
  completarMembrosPelaComposicao,
  MODOS_DE_LANCAMENTO,
  novoAvaliador,
} from "../../lib/conducao-de-entrevista.js";
import { rotuloDaVersao } from "../../lib/nome-da-versao.ts";
import type { PendenciaDaConfiguracao } from "../../lib/passos-do-preparar.ts";
import { textoDaPontuacao } from "../../lib/roteiro-de-entrevista.js";
import { Aviso, Campo, Segmentado } from "../../ui/index.js";
import { CompetenciasDoMembro } from "./competencias-do-membro.tsx";
import { BotaoDeLinha, ComposicaoDaBanca, trocarNaLista } from "./partes.jsx";

/*
  A configuração da entrevista do edital, repartida nos passos de Preparar
  (preparar.tsx) sobre UM rascunho só (`rascunhoDaConfiguracao`): o passo 1
  escolhe o roteiro (a versão exata; pré-preenche a banca com o padrão dele)
  e o passo 2 a banca — modo de lançamento, composição e membros, com as
  competências que cada um avalia. Salvar grava tudo de uma vez, pela mesma
  `configurar_entrevista_edital`; a barra mostra a lista do que falta.
*/

export type MembroDoRascunho = {
  chave: string;
  id?: string | null;
  nome: string;
  origem: string;
  banca: string | number;
  perfil: string;
  competencias?: string[] | null;
};

export type OrigemDaBanca = {
  chave: string;
  origem: string;
  quantidade: string | number;
};

export type RascunhoDaConfiguracao = {
  roteiro: string;
  lancamento: string;
  banca: OrigemDaBanca[];
  avaliadores: MembroDoRascunho[];
};

export type RoteiroDaLista = {
  id: string;
  nome?: string;
  versao?: number;
  nome_versao?: string | null;
  ativo?: boolean;
  competencias?: { id: string; nome: string; ordem?: number | null }[] | null;
};

type Mudar = (mudancas: Partial<RascunhoDaConfiguracao>) => void;

export function CampoDoRoteiro({
  r,
  opcoes,
  temNotas,
  erro,
  aoTrocar,
}: {
  r: RascunhoDaConfiguracao;
  opcoes: RoteiroDaLista[];
  temNotas: boolean;
  erro?: string;
  aoTrocar: (novo: RascunhoDaConfiguracao) => void;
}) {
  const escolhido = opcoes.find((x) => x.id === r.roteiro) || null;
  return (
    <div className="entrevistas-grade">
      <Campo
        rotulo="Roteiro do edital"
        obrigatorio
        erro={erro}
        largo
        dica={
          temNotas
            ? "Já há notas lançadas: o roteiro não pode mais ser trocado."
            : escolhido
              ? `${textoDaPontuacao(escolhido)} · ${escolhido.competencias?.length ?? 0} competências`
              : undefined
        }
      >
        <select
          value={r.roteiro}
          data-campo="roteiro-do-edital"
          disabled={temNotas}
          onChange={(e) =>
            aoTrocar(
              aplicarRoteiroNaConfiguracao(
                r,
                opcoes.find((x) => x.id === e.target.value) || null,
              ) as RascunhoDaConfiguracao,
            )
          }
        >
          <option value="">Escolha…</option>
          {opcoes.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome} (
              {rotuloDaVersao({ versao: x.versao, nome: x.nome_versao })})
              {x.ativo === false ? " — versão anterior" : ""}
            </option>
          ))}
        </select>
      </Campo>
    </div>
  );
}

export function CamposDaBanca({
  r,
  competencias,
  erros,
  meuPerfil,
  mudar,
}: {
  r: RascunhoDaConfiguracao;
  competencias: { id: string; nome: string }[];
  erros: Record<string, string>;
  meuPerfil?: string | null;
  mudar: Mudar;
}) {
  return (
    <div className="entrevistas-formulario">
      <h4 className="entrevistas-subtitulo">Como as notas são lançadas</h4>
      <Segmentado
        rotulo="Modo de lançamento das notas"
        opcoes={MODOS_DE_LANCAMENTO}
        valor={r.lancamento}
        aoMudar={(lancamento: string) => mudar({ lancamento })}
      />

      <h4 className="entrevistas-subtitulo">Composição da banca</h4>
      <ComposicaoDaBanca
        valor={r.banca}
        erros={erros}
        aoMudar={(banca: OrigemDaBanca[]) => mudar({ banca })}
      />

      <h4 className="entrevistas-subtitulo">Membros da banca</h4>
      <div className="entrevistas-sublista" aria-label="Membros da banca">
        {r.avaliadores.length ? (
          <ul className="entrevistas-linhas">
            {r.avaliadores.map((a, i) => {
              const p = `avaliador.${a.chave}`;
              const trocar = (campo: string, valor: unknown) =>
                mudar({
                  avaliadores: trocarNaLista(
                    r.avaliadores,
                    a.chave,
                    campo,
                    valor,
                  ) as MembroDoRascunho[],
                });
              return (
                <li
                  key={a.chave}
                  className="entrevistas-linha-membro"
                  aria-label={`Membro ${i + 1}`}
                >
                  <Campo rotulo="Nome" erro={erros[`${p}.nome`]}>
                    <input
                      type="text"
                      value={a.nome}
                      onChange={(e) => trocar("nome", e.target.value)}
                    />
                  </Campo>
                  <Campo rotulo="Origem" erro={erros[`${p}.origem`]}>
                    <input
                      type="text"
                      value={a.origem}
                      list="entrevistasOrigens"
                      onChange={(e) => trocar("origem", e.target.value)}
                    />
                  </Campo>
                  <Campo rotulo="Banca nº" erro={erros[`${p}.banca`]}>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      step="1"
                      value={a.banca}
                      onChange={(e) => trocar("banca", e.target.value)}
                    />
                  </Campo>
                  <Campo
                    rotulo="Perfil no MONITORA (opcional)"
                    erro={erros[`${p}.perfil`]}
                    dica={
                      a.perfil && a.perfil === meuPerfil
                        ? "Ligado ao seu perfil"
                        : undefined
                    }
                  >
                    <input
                      type="text"
                      value={a.perfil}
                      placeholder="Identificador do perfil"
                      onChange={(e) => trocar("perfil", e.target.value.trim())}
                    />
                  </Campo>
                  <span className="entrevistas-competencia-acoes">
                    {meuPerfil && a.perfil !== meuPerfil ? (
                      <button
                        type="button"
                        className="btn secondary small"
                        title="Ligar este membro ao seu perfil"
                        onClick={() => trocar("perfil", meuPerfil)}
                      >
                        Sou eu
                      </button>
                    ) : null}
                    <BotaoDeLinha
                      icone="fa-trash"
                      rotulo={`Tirar ${a.nome || "o membro"} da banca`}
                      desabilitado={false}
                      aoClicar={() =>
                        mudar({
                          avaliadores: r.avaliadores.filter(
                            (x) => x.chave !== a.chave,
                          ),
                        })
                      }
                    />
                  </span>
                  {competencias.length ? (
                    <CompetenciasDoMembro
                      nome={a.nome}
                      competencias={competencias}
                      valor={a.competencias ?? null}
                      erro={erros[`${p}.competencias`]}
                      aoMudar={(valor) => trocar("competencias", valor)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="entrevistas-vazio-linha">Nenhum membro cadastrado.</p>
        )}
        <datalist id="entrevistasOrigens">
          {[...new Set(r.banca.map((b) => b.origem).filter(Boolean))].map(
            (o) => (
              <option key={o} value={o} />
            ),
          )}
        </datalist>
        <div className="entrevistas-em-linha">
          <button
            type="button"
            className="btn secondary small"
            onClick={() =>
              mudar({
                avaliadores: [
                  ...r.avaliadores,
                  novoAvaliador() as MembroDoRascunho,
                ],
              })
            }
          >
            <i className="fa-solid fa-user-plus" aria-hidden="true" /> Membro
          </button>
          {r.banca.length ? (
            <button
              type="button"
              className="btn secondary small"
              onClick={() =>
                mudar({
                  avaliadores: completarMembrosPelaComposicao(
                    r.avaliadores,
                    r.banca,
                  ) as MembroDoRascunho[],
                })
              }
            >
              <i className="fa-solid fa-users" aria-hidden="true" /> Completar
              pela composição
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * A barra do Salvar da configuração: o que falta (clicável: leva ao passo),
 * o erro do banco, Cancelar e Salvar.
 */
export function BarraDaConfiguracao({
  pendencias,
  mostrarPendencias,
  erroDoBanco,
  salvando,
  aoIrAoPasso,
  aoCancelar,
  aoSalvar,
}: {
  pendencias: PendenciaDaConfiguracao[];
  mostrarPendencias: boolean;
  erroDoBanco: string;
  salvando: boolean;
  aoIrAoPasso: (passo: "roteiro" | "banca") => void;
  aoCancelar: (() => void) | null;
  aoSalvar: () => void;
}) {
  return (
    <div
      className="entrevistas-barra-da-configuracao"
      data-tour="entrevistas-preparar-salvar"
    >
      {pendencias.length ? (
        <div
          className="entrevistas-pendencias"
          role={mostrarPendencias ? "alert" : "status"}
          data-destaque={mostrarPendencias ? "sim" : undefined}
        >
          <strong>
            <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />{" "}
            {pendencias.length === 1
              ? "Falta 1 ponto para salvar"
              : `Faltam ${pendencias.length} pontos para salvar`}
          </strong>
          <ul>
            {pendencias.map((p) => (
              <li key={p.chave}>
                <button
                  type="button"
                  className="entrevistas-link"
                  onClick={() => aoIrAoPasso(p.passo)}
                >
                  {p.texto}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="entrevistas-pronto-para-salvar" role="status">
          <i className="fa-solid fa-circle-check" aria-hidden="true" /> Tudo
          certo para salvar.
        </p>
      )}
      {erroDoBanco ? (
        <Aviso tom="danger" papel="alert">
          {erroDoBanco}
        </Aviso>
      ) : null}
      <div className="entrevistas-acoes">
        {aoCancelar ? (
          <button type="button" className="btn secondary" onClick={aoCancelar}>
            Cancelar
          </button>
        ) : null}
        <button
          type="button"
          className="btn"
          data-acao="salvar-configuracao"
          disabled={salvando}
          onClick={aoSalvar}
        >
          <i className="fa-solid fa-floppy-disk" aria-hidden="true" />{" "}
          {salvando ? "Salvando…" : "Salvar configuração"}
        </button>
      </div>
    </div>
  );
}
