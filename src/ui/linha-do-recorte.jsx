/*
  O recorte ativo de uma tela (`.ui-recorte`): uma linha que diz quais filtros
  estão valendo ("Recorte ativo: Edital: X · Parecer: Apto") ou "Sem filtros".
  `ativos` é `[[campo, rótulo, valor]]`, o mesmo dos chips. Os filhos entram
  abaixo da linha (as marcas de prazo de Recursos). Usada por Recursos e
  Entrevistas.
*/
export function textoDoRecorte(ativos) {
  return ativos.length
    ? `Recorte ativo: ${ativos.map(([, rotulo, valor]) => `${rotulo}: ${valor}`).join(" · ")}`
    : "Sem filtros";
}

export function LinhaDoRecorte({ ativos, children }) {
  return (
    <section className="ui-card ui-recorte" aria-label="Recorte ativo">
      <p className="ui-recorte-texto" data-recorte="">
        {textoDoRecorte(ativos)}
      </p>
      {children}
    </section>
  );
}
