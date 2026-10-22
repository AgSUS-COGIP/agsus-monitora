/*
  O que a Aya mostra para ensinar: a seção "Aprender" do painel (as trilhas
  que o perfil pode fazer, com o progresso de cada uma, recolhidas atrás do
  botão "Aprender" até a pessoa abrir) e a oferta de
  "Primeiros passos" da primeira entrada — um balão perto da arara (ou um
  cartão no painel, se ele estiver aberto), feito uma vez só e sem forçar.
*/

import { useId, useState } from "react";
import { Icone } from "../../../componentes/icone.jsx";
import { passoParaRetomar, rotuloDoProgresso } from "../../../lib/aya-tours.js";

export function SecaoAprender({ trilhas, progresso, aoIniciar, desabilitada }) {
  const [aberta, setAberta] = useState(false);
  const idDaLista = useId();
  if (!trilhas.length) return null;
  return (
    <section className="aya-aprender" aria-label="Aprender">
      <button
        type="button"
        className="aya-aprender__abrir"
        aria-expanded={aberta}
        aria-controls={idDaLista}
        onClick={() => setAberta((valor) => !valor)}
      >
        <Icone nome="graduation-cap" tamanho={16} />
        <span>Aprender</span>
        <Icone nome={aberta ? "chevron-up" : "chevron-down"} tamanho={15} />
      </button>
      <ul className="aya-aprender__lista" id={idDaLista} hidden={!aberta}>
        {trilhas.map((trilha) => {
          const entrada = progresso[trilha.id];
          const total = trilha.passos.length;
          const situacao = rotuloDoProgresso(entrada, total);
          const retomar = passoParaRetomar(entrada, total) > 0;
          return (
            <li key={trilha.id}>
              <button
                type="button"
                className="aya-trilha"
                data-trilha={trilha.id}
                data-concluida={entrada?.concluida ? "sim" : undefined}
                disabled={desabilitada}
                onClick={() => aoIniciar(trilha)}
              >
                <span className="aya-trilha__textos">
                  <span className="aya-trilha__titulo">{trilha.titulo}</span>
                  <span className="aya-trilha__resumo">{trilha.resumo}</span>
                </span>
                <span className="aya-trilha__situacao">
                  {entrada?.concluida ? (
                    <Icone nome="circle-check" tamanho={14} />
                  ) : null}
                  {situacao}
                </span>
                <span className="aya-visualmente-oculto">
                  {retomar ? ", continuar de onde parou" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function OfertaDePrimeirosPassos({
  noPainel = false,
  estilo,
  aoAceitar,
  aoRecusar,
  rotulo = "Primeiros passos",
  destaque = "Primeira vez no MONITORA?",
  texto = "Posso te mostrar o básico em poucos passos.",
}) {
  return (
    <div
      className={
        noPainel
          ? "aya-oferta aya-oferta--painel"
          : "aya-oferta aya-oferta--balao"
      }
      style={noPainel ? undefined : estilo}
      role="region"
      aria-label={rotulo}
    >
      <p className="aya-oferta__texto">
        <strong>{destaque}</strong> {texto}
      </p>
      <div className="aya-oferta__acoes">
        <button type="button" className="aya-oferta__sim" onClick={aoAceitar}>
          Mostrar
        </button>
        <button type="button" className="aya-oferta__nao" onClick={aoRecusar}>
          Agora não
        </button>
      </div>
    </div>
  );
}
