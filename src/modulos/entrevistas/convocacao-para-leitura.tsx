import { useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  fonteDaConvocacao,
  gruposDaConvocacao,
} from "../../lib/convocacao-da-entrevista.ts";
import { Aviso, Campo, Carregando } from "../../ui/index.ts";
import { ListaDeConvocacao } from "./conducao.tsx";
import { rotuloDoEditalParaConduzir } from "./seletor-do-edital.tsx";
import type { EstadoDaConducaoComAcoes } from "./tipos.ts";

/*
  A convocação para entrevista, só leitura, na Central de convocações (aba
  Convocação da Lista de aprovados). Lê a MESMA loja de Conduzir entrevistas
  (o controlador da tela a entrega, src/modulos/entrevistas/conduzir.tsx):
  os mesmos editais, o mesmo edital aberto e a mesma lista CONVOCACAO da
  Classificação, desenhada por `ListaDeConvocacao` sem as ações. Trocar o
  edital aqui troca o de Conduzir entrevistas, de propósito: é um estado só.

  Convocar e desconvocar continuam em Conduzir entrevistas › Preparar ›
  Convocação, aonde "Convocar em Conduzir entrevistas" leva.
*/

export function ConvocacaoParaLeitura({
  conducao,
  aoAbrirNaConducao,
  acoes,
}: {
  conducao: EstadoDaConducaoComAcoes;
  aoAbrirNaConducao: () => void;
  /** Botões de quem desenha (a central), na mesma linha do "Convocar em…". */
  acoes?: ReactNode;
}) {
  const e = useSyncExternalStore(conducao.assinar, conducao.obter);
  const { editais } = e;
  const dados = e.edital;
  const calculo = e.calculo;
  const fonte = useMemo(
    () => (dados ? fonteDaConvocacao(dados, calculo?.resultado) : null),
    [dados, calculo],
  );
  const grupos = useMemo(
    () =>
      dados && fonte
        ? gruposDaConvocacao(fonte.resultado, dados.convocados)
        : [],
    [dados, fonte],
  );
  const vazio = editais.carregado && !editais.lista.length;

  return (
    <div
      className="central-convocacoes-entrevistas"
      data-bloco="convocacao-para-entrevistas"
      data-tour="central-convocacoes-entrevistas"
    >
      <div className="central-convocacoes-edital">
        <Campo rotulo="Edital da entrevista">
          <select
            value={e.editalId}
            disabled={editais.carregando || Boolean(e.acao)}
            onChange={(ev) => {
              conducao.abrirFicha(null);
              void conducao.abrirEdital(ev.target.value);
            }}
          >
            <option value="">
              {editais.carregando
                ? "Carregando editais…"
                : vazio
                  ? "Nenhum edital na janela da entrevista"
                  : "Escolha o edital…"}
            </option>
            {editais.lista.map((m) => (
              <option key={m.id} value={m.id}>
                {rotuloDoEditalParaConduzir(m)}
              </option>
            ))}
          </select>
        </Campo>
        <div className="central-convocacoes-acoes">
          {dados ? (
            <button
              type="button"
              className="btn"
              data-acao="convocar-em-conduzir"
              onClick={aoAbrirNaConducao}
            >
              <i className="fa-solid fa-bullhorn" aria-hidden="true" />{" "}
              {dados.pode_editar
                ? "Convocar em Conduzir entrevistas"
                : "Abrir em Conduzir entrevistas"}
            </button>
          ) : null}
          {acoes}
        </div>
      </div>
      {editais.erro && !vazio ? (
        <Aviso tom="danger">{editais.erro}</Aviso>
      ) : null}
      {e.erroDoEdital ? <Aviso tom="danger">{e.erroDoEdital}</Aviso> : null}
      {e.carregandoEdital && !dados ? (
        <Carregando>Abrindo o edital…</Carregando>
      ) : null}
      {dados && fonte ? (
        <ListaDeConvocacao
          key={`leitura-${dados.edital?.id}`}
          dados={dados}
          fonte={fonte}
          grupos={grupos}
          calculo={calculo}
          salvando={false}
          ocupado={false}
        />
      ) : null}
    </div>
  );
}
