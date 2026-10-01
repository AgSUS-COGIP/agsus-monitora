/*
  O recorte ativo de uma tela (Recursos, Análises curriculares): a frase com
  os filtros aplicados e, embaixo, as marcas do recorte — `{ chave, tom,
  icone, texto }`, com `tom` "sucesso", "alerta" ou "neutro" (o padrão).
  `carregando`: as marcas ficam para depois (a frase já vale).
*/
export function Recorte({ texto, marcas = [], carregando = false }) {
  return (
    <section className="ui-card ui-recorte" aria-label="Recorte ativo">
      <p className="ui-recorte-texto" data-recorte="">
        {texto}
      </p>
      {!carregando && marcas.length ? (
        <div className="ui-recorte-marcas">
          {marcas.map(({ chave, tom, icone, texto: frase }) => (
            <span
              key={chave}
              className="ui-marca"
              data-tom={tom || "neutro"}
              data-marca={chave}
            >
              {icone ? (
                <i className={`fa-solid ${icone}`} aria-hidden="true" />
              ) : null}{" "}
              {frase}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
