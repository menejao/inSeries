/**
 * INSERIES-MY-LIST-REDESIGN-01 — "simplificar o cabecalho... reduzir a altura do Hero...
 * remover o excesso de informacoes": os 6 tiles de contagem (herdados da Fase 11/12 do ticket
 * anterior) saem por completo — essa pagina agora e uma biblioteca pessoal, nao um painel com
 * indicadores. Numeros de cada status continuam visiveis, so que no badge de contagem do
 * proprio cabecalho de cada secao (`MyListGroup`), nao aqui.
 */
export function MyListHeader() {
  return (
    <div>
      <p className="eyebrow">Minha area</p>
      <h1 className="section-title">Minhas Series</h1>
      <p className="section-copy">Sua biblioteca de series.</p>
    </div>
  );
}
