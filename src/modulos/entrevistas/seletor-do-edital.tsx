import { useEffect, useState } from "react";
import { SeloDeTreinamento } from "../../componentes/selo-de-treinamento.tsx";
import { marcaDoEdital } from "../../lib/conducao-de-entrevista.ts";
import {
  editalEscolhido,
  sufixoDeTreinamento,
} from "../../lib/edital-de-treinamento.ts";
import { Aviso } from "../../ui/index.ts";
import { LiberacaoDoEdital } from "./conducao.tsx";
import type { EstadoDaConducao, EstadoDaConducaoComAcoes } from "./tipos.ts";

/*
  O edital de "Conduzir entrevistas", compacto, numa linha logo abaixo do
  topo (como na Avaliação documental): o seletor e, ao lado, o selo
  Treinamento. O administrador global tem, dentro do próprio seletor, a
  opção de mostrar também os editais fora da janela (concluídos ou ainda sem
  janela) — e a liberação de um edital fora da janela. Recarregar é o
  "Atualizar" do topo. Os erros vêm logo abaixo, com "Tentar novamente" (os dos roteiros
  ficam em Preparar, onde eles aparecem).
*/

const MOSTRAR_TODOS = "__mostrar-todos__";
const SO_NA_JANELA = "__so-na-janela__";

export function SeletorDoEdital({
  conducao,
  e,
  doPainel = [],
}: {
  conducao: EstadoDaConducaoComAcoes;
  e: EstadoDaConducao;
  doPainel?: unknown[];
}) {
  const { editais } = e;
  const [editar, setEditar] = useState(false);
  const [situacao, setSituacao] = useState<
    "PREVISTA" | "NAO_PREVISTA" | "NAO_INFORMADA"
  >("NAO_INFORMADA");
  const [motivo, setMotivo] = useState("");
  useEffect(() => {
    setEditar(false);
    setMotivo("");
  }, [e.editalId]);
  const escolhido = editalEscolhido(editais.lista, e.editalId);
  const item = editais.lista.find((m) => m.id === e.editalId);
  const vazio = editais.carregado && !editais.lista.length;
  const recarregarEditais = (todos = editais.todos) =>
    void conducao.carregarEditais(e.area, doPainel, { todos });

  return (
    <>
      <section
        className="ui-card entrevistas-seletor-do-edital"
        aria-label="Edital"
        data-tour="entrevistas-conduzir-edital"
      >
        <label className="entrevistas-seletor-campo">
          <span className="entrevistas-seletor-rotulo">Edital</span>
          <select
            id="entrevistasEdital"
            data-tour="entrevistas-conduzir-seletor-edital"
            value={e.editalId}
            disabled={editais.carregando}
            onChange={(ev) => {
              const valor = ev.target.value;
              if (valor === MOSTRAR_TODOS || valor === SO_NA_JANELA) {
                recarregarEditais(valor === MOSTRAR_TODOS);
                return;
              }
              conducao.abrirFicha(null);
              void conducao.abrirEdital(valor);
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
                {[m.edital, m.unidade].filter(Boolean).join(" · ")}
                {m.comEntrevistas ? " · com entrevistas" : ""}
                {marcaDoEdital(m) ? ` · ${marcaDoEdital(m)}` : ""}
                {sufixoDeTreinamento(m)}
              </option>
            ))}
            {editais.admin ? (
              <optgroup label="Mais editais">
                {editais.todos ? (
                  <option value={SO_NA_JANELA}>
                    Mostrar só os editais na janela da entrevista
                  </option>
                ) : (
                  <option value={MOSTRAR_TODOS}>
                    Mostrar também os concluídos e fora da janela
                  </option>
                )}
              </optgroup>
            ) : null}
          </select>
        </label>
        <SeloDeTreinamento edital={escolhido} className={undefined} />
        {e.editalId && e.previsao && !e.carregandoEdital ? (
          <span
            className="entrevistas-seletor-marca"
            role="status"
            title={e.previsao.motivo || "Etapa ainda não confirmada"}
          >
            {e.previsao.situacao === "NAO_PREVISTA"
              ? "Entrevistas não previstas"
              : e.previsao.situacao === "PREVISTA"
                ? "Entrevistas previstas"
                : "Entrevistas: não informado"}
          </span>
        ) : null}
        {e.editalId && e.previsao?.pode_alterar && !e.carregandoEdital ? (
          <button
            type="button"
            className="btn secondary small"
            onClick={() => {
              setSituacao(e.previsao?.situacao || "NAO_INFORMADA");
              setMotivo("");
              setEditar(!editar);
            }}
          >
            Classificar etapa
          </button>
        ) : null}
        {editais.admin && editais.todos ? (
          <span className="entrevistas-seletor-marca">
            Todos os editais da área
          </span>
        ) : null}
        {e.carregandoEdital ? (
          <span className="entrevistas-seletor-carregando" role="status">
            <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />{" "}
            Abrindo o edital…
          </span>
        ) : null}
      </section>
      {editar && e.previsao?.pode_alterar && e.editalId ? (
        <form
          className="ui-card"
          onSubmit={(ev) => {
            ev.preventDefault();
            void conducao
              .definirPrevisao(situacao, motivo)
              .then((resultado) => {
                if (resultado.ok) setEditar(false);
              });
          }}
        >
          <label>
            Etapa de entrevista
            <select
              aria-label="Etapa de entrevista"
              value={situacao}
              onChange={(ev) => setSituacao(ev.target.value as typeof situacao)}
            >
              <option value="NAO_INFORMADA">Não informado</option>
              <option value="PREVISTA">Prevista no edital</option>
              <option value="NAO_PREVISTA">Não prevista no edital</option>
            </select>
          </label>
          <label>
            Justificativa (conferir o edital oficial)
            <textarea
              aria-label="Justificativa da classificação"
              value={motivo}
              onChange={(ev) => setMotivo(ev.target.value)}
              minLength={5}
              maxLength={500}
              required
            />
          </label>
          <button
            type="submit"
            className="btn primary small"
            disabled={Boolean(e.acao) || motivo.trim().length < 5}
          >
            Salvar
          </button>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => setEditar(false)}
          >
            Cancelar
          </button>
        </form>
      ) : null}
      {editais.admin && item ? (
        <LiberacaoDoEdital
          key={e.editalId}
          conducao={conducao}
          item={item}
          ocupado={Boolean(e.acao)}
          doPainel={doPainel}
        />
      ) : null}
      {vazio && editais.erro ? (
        <Aviso tom={editais.erro.startsWith("Não foi") ? "danger" : "info"}>
          {editais.erro}{" "}
          {editais.erro.startsWith("Não foi") ? (
            <button
              type="button"
              className="btn secondary small"
              onClick={() => recarregarEditais()}
            >
              Tentar novamente
            </button>
          ) : null}
        </Aviso>
      ) : null}
      {e.erroDoEdital ? (
        <Aviso tom="danger" papel="alert">
          Não foi possível abrir o edital: {e.erroDoEdital}{" "}
          <button
            type="button"
            className="btn secondary small"
            onClick={() => void conducao.recarregarEdital()}
          >
            Tentar novamente
          </button>
        </Aviso>
      ) : null}
    </>
  );
}
