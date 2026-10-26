import { useEffect, useRef, useSyncExternalStore } from "react";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { comemorar as comemorarPadrao } from "../../modules/comemoracao.js";
import { GradeDeKpis, Kpi, Modal } from "../../ui/index.ts";
import { Icone } from "../../componentes/icone.tsx";
import {
  fogosDoEncerramento,
  formatarDia,
  formatarInteiro,
  formatarPercentual,
  tituloDeQuemFechou,
  type EncerramentoDoEdital,
} from "../../lib/encerramento-do-edital.ts";
import type { EstadoDoEncerramentoControle } from "./estado.ts";
import "./encerramento-do-edital.css";

/*
  A tela de encerramento do edital: abre uma vez por pessoa e edital quando
  o lote chega a 100% (regra e números do banco; estado em estado.ts). Em
  cima, os totais do edital e o agradecimento à equipe; embaixo, só a parte
  de quem está vendo. Sem ranking, sem números de outras pessoas.

  Os fogos são os do catálogo (src/modules/comemoracao.js): respeitam a
  configuração, a preferência pessoal e prefers-reduced-motion.
*/

type Comemorar = typeof comemorarPadrao;

export function TelaDeEncerramento({
  encerramento: e,
  aoFechar,
}: {
  encerramento: EncerramentoDoEdital;
  aoFechar: () => void;
}) {
  const fechou = e.minha.fechou;
  const tituloId = `encerramento-${e.id}-titulo`;
  return (
    <Modal
      rotuloId={tituloId}
      className="encerramento-modal"
      cartaoClassName="encerramento-cartao"
      aoFechar={aoFechar}
    >
      <div className="encerramento" data-fechou={fechou ? "sim" : undefined}>
        <header className="encerramento-topo">
          <span className="encerramento-icone" aria-hidden="true">
            <Icone nome={fechou ? "star" : "heart"} tamanho={24} />
          </span>
          <h2 id={tituloId}>Edital {e.numero} concluído</h2>
          {fechou ? (
            <p className="encerramento-fechou">
              Você {tituloDeQuemFechou(e.numero)}
            </p>
          ) : null}
        </header>

        <GradeDeKpis>
          <Kpi
            icone="fa-users"
            rotulo="Inscritos"
            valor={formatarInteiro(e.inscritos)}
          />
          <Kpi
            icone="fa-file-circle-check"
            tom="sucesso"
            rotulo="Fichas analisadas"
            valor={formatarInteiro(e.fichas)}
          />
          <Kpi
            icone="fa-calendar-days"
            tom="neutro"
            rotulo="Dias de análise"
            valor={formatarInteiro(e.dias)}
          />
        </GradeDeKpis>

        <p className="encerramento-obrigado">Obrigado, equipe.</p>

        <section className="encerramento-minha" aria-label="Sua parte">
          <h3>Sua parte</h3>
          <dl>
            <div>
              <dt>Fichas que você concluiu</dt>
              <dd>{formatarInteiro(e.minha.fichas)}</dd>
            </div>
            <div>
              <dt>Do total</dt>
              <dd>{formatarPercentual(e.minha.percentual)}</dd>
            </div>
            {e.minha.melhorDia ? (
              <div>
                <dt>Seu melhor dia</dt>
                <dd>
                  {formatarDia(e.minha.melhorDia.dia)}
                  <small>
                    {" "}
                    · {formatarInteiro(e.minha.melhorDia.qt)}{" "}
                    {e.minha.melhorDia.qt === 1 ? "ficha" : "fichas"}
                  </small>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <div className="encerramento-acoes">
          <button
            type="button"
            className="btn"
            data-foco-inicial
            onClick={aoFechar}
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function EncerramentoDoEdital({
  estado,
  comemorar = comemorarPadrao,
}: {
  estado: EstadoDoEncerramentoControle;
  comemorar?: Comemorar;
}) {
  const atual = useSyncExternalStore(estado.assinar, estado.obter);
  const aberto = atual.aberto;
  // Uma vez por tela aberta (o StrictMode roda o efeito duas vezes).
  const comemorados = useRef(new Set<string>());

  useEffect(() => {
    if (!aberto || comemorados.current.has(aberto.id)) return;
    comemorados.current.add(aberto.id);
    const fogos = fogosDoEncerramento(aberto, estado.obter().fogosJaSoltos);
    if (fogos) comemorar(fogos);
  }, [aberto, estado, comemorar]);

  if (!aberto) return null;
  return (
    <TelaDeEncerramento
      encerramento={aberto}
      aoFechar={() => void estado.fechar()}
    />
  );
}

export function montarEncerramentoDoEdital({
  elemento = globalThis.document?.getElementById("encerramentoDoEditalApp"),
  estado,
}: {
  elemento?: HTMLElement | null;
  estado: EstadoDoEncerramentoControle;
}) {
  if (!elemento) return null;
  return montarModulo(elemento, <EncerramentoDoEdital estado={estado} />, {
    nome: "Encerramento do edital",
  });
}
