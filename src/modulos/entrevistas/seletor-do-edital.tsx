import { SeloDeTreinamento } from "../../componentes/selo-de-treinamento.jsx";
import { marcaDoEdital } from "../../lib/conducao-de-entrevista.js";
import {
  editalEscolhido,
  sufixoDeTreinamento,
} from "../../lib/edital-de-treinamento.js";
import { Aviso } from "../../ui/index.js";
import { LiberacaoDoEdital } from "./conducao.jsx";
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
