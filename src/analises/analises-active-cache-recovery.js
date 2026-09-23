const ACTIVE_CACHE_KEY_PATTERN = /^agsus_analises_cache_v1_v\d+_.+_ativo$/;

function clearInvalidActiveCaches() {
  try {
    const keys = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && ACTIVE_CACHE_KEY_PATTERN.test(key)) keys.push(key);
    }

    keys.forEach((key) => {
      try {
        const cached = JSON.parse(localStorage.getItem(key) || "null");
        const hasRows =
          cached && Array.isArray(cached.rows) && cached.rows.length > 0;
        if (!hasRows) localStorage.removeItem(key);
      } catch (error) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn(
      "Não foi possível validar o cache local de Análises Ativas:",
      error,
    );
  }
}

clearInvalidActiveCaches();
