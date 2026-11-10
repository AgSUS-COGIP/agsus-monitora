import { useId, useState, useSyncExternalStore } from "react";
import type { JanelaDoApp } from "../../app/ir-para-tela.ts";
import type {
  BlocoDoResumo,
  ItemDoResumo,
  ResumoDoDia,
} from "../../lib/resumo-do-dia.ts";
import {
  BLOCOS_DO_RESUMO,
  ondeDoItem,
  quandoDoItem,
  recortarBloco,
  tituloDoResumo,
  totalDoResumo,
} from "../../lib/resumo-do-dia.ts";
import { Aviso, Modal } from "../../ui/index.ts";
import type { EstadoDoResumoDoDia } from "./estado.ts";
import { resumoDoDia } from "./estado.ts";
import "./resumo-do-dia.css";

/*
  O sininho do topo (src/app/casca/topo.tsx) e o popup do resumo do dia:
  Hoje, Próximos 7 dias e Atrasadas, dos editais e demandas internas de que a
  pessoa é responsável. O sininho só aparece para quem é responsável por
  algo; o número é o total do resumo. Regras em src/lib/resumo-do-dia.ts;
  estado e "abre sozinho ao entrar" em estado.ts.
*/

export function SininhoDoResumo({
  estado = resumoDoDia,
  agora = () => new Date(),
  janela = globalThis.window as JanelaDoApp | undefined,
}: {
  estado?: EstadoDoResumoDoDia;
  agora?: () => Date;
  janela?: JanelaDoApp | undefined;
}) {
  const { resumo, aberto, erro } = useSyncExternalStore(
    estado.assinar,
    estado.obter,
    estado.obter,
  );
  if (!resumo?.responsavel) return null;
  const total = totalDoResumo(resumo);
  const rotulo = total
    ? `Resumo do dia: ${total} ${total === 1 ? "pendência" : "pendências"}`
    : "Resumo do dia";

  return (
    <>
      <button
        id="resumoDoDiaSininho"
        type="button"
        className="resumo-sininho"
        aria-label={rotulo}
        title={rotulo}
        aria-haspopup="dialog"
        onClick={() => estado.abrir()}
      >
        <i className="fa-solid fa-bell" aria-hidden="true" />
        {total ? (
          <span className="resumo-sininho-numero" aria-hidden="true">
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>
      {aberto ? (
        <ModalDoResumo
          resumo={resumo}
          erro={erro}
          agora={agora}
          aoFechar={() => estado.fechar()}
          aoConcluir={(item) => estado.concluir(item)}
          aoMudarPreferencia={(mostrar) =>
            void estado.mudarPreferencia(mostrar)
          }
          aoVerNoCronograma={() => {
            estado.fechar();
            janela?.navigate?.("calendario", { visao: "meus" });
          }}
        />
      ) : null}
    </>
  );
}

function ModalDoResumo({
  resumo,
  erro,
  agora,
  aoFechar,
  aoConcluir,
  aoMudarPreferencia,
  aoVerNoCronograma,
}: {
  resumo: ResumoDoDia;
  erro: string;
  agora: () => Date;
  aoFechar: () => void;
  aoConcluir: (item: ItemDoResumo) => Promise<void> | void;
  aoMudarPreferencia: (mostrar: boolean) => void;
  aoVerNoCronograma: () => void;
}) {
  const idDoTitulo = useId();
  const [concluindo, setConcluindo] = useState("");
  const total = totalDoResumo(resumo);

  return (
    <Modal
      id="resumoDoDia"
      tamanho="medio"
      rotuloId={idDoTitulo}
      aoFechar={aoFechar}
    >
      <h3 id={idDoTitulo}>{tituloDoResumo(resumo.nome, agora())}</h3>
      {total ? (
        BLOCOS_DO_RESUMO.map(({ id, titulo }) => (
          <BlocoDoResumoDoDia
            key={id}
            bloco={id}
            titulo={titulo}
            itens={resumo[id]}
            concluindo={concluindo}
            aoConcluir={(item) => {
              setConcluindo(item.id);
              // Falhou: o botão volta (o erro aparece embaixo) para tentar de novo.
              void Promise.resolve(aoConcluir(item)).finally(() =>
                setConcluindo((atual) => (atual === item.id ? "" : atual)),
              );
            }}
          />
        ))
      ) : (
        <p className="resumo-vazio">
          Nada para hoje nem para os próximos dias.
        </p>
      )}
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}
      <div className="ui-acoes resumo-acoes">
        <label className="resumo-preferencia">
          <input
            id="resumoMostrarAoEntrar"
            type="checkbox"
            checked={resumo.mostrarAoEntrar}
            onChange={(evento) => aoMudarPreferencia(evento.target.checked)}
          />
          Mostrar ao entrar
        </label>
        <button
          id="resumoVerNoCronograma"
          type="button"
          className="btn secondary"
          onClick={aoVerNoCronograma}
        >
          Ver no cronograma
        </button>
        <button
          id="resumoFechar"
          type="button"
          className="btn"
          data-foco-inicial
          onClick={aoFechar}
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
}

function BlocoDoResumoDoDia({
  bloco,
  titulo,
  itens,
  concluindo,
  aoConcluir,
}: {
  bloco: BlocoDoResumo;
  titulo: string;
  itens: readonly ItemDoResumo[];
  concluindo: string;
  aoConcluir: (item: ItemDoResumo) => void;
}) {
  if (!itens.length) return null;
  const { visiveis, mais } = recortarBloco(itens);
  return (
    <section className="resumo-bloco" data-bloco={bloco}>
      <h4>
        {titulo} <span className="resumo-bloco-total">({itens.length})</span>
      </h4>
      <ul>
        {visiveis.map((item) => (
          <li
            key={`${item.tipo}:${item.id}:${item.marco}`}
            className="resumo-item"
            data-cor={item.cor}
          >
            <i
              className="resumo-ponto"
              aria-hidden="true"
              title={item.rotuloDoTipo}
            />
            <span className="resumo-texto">
              <strong>{item.titulo}</strong>
              <span className="resumo-onde">{ondeDoItem(item)}</span>
            </span>
            <span className="resumo-quando">{quandoDoItem(item, bloco)}</span>
            {bloco === "atrasadas" && item.podeConcluir ? (
              <button
                type="button"
                className="btn secondary small"
                data-concluir={item.id}
                disabled={concluindo === item.id}
                onClick={() => aoConcluir(item)}
              >
                Concluir
              </button>
            ) : null}
          </li>
        ))}
        {mais ? <li className="resumo-mais">e mais {mais}</li> : null}
      </ul>
    </section>
  );
}
