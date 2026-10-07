export function MarcaLembrai({ variante = 'app', compact = false }) {
  const classe = variante === 'landing' ? `landing-logo${compact ? ' compact' : ''}` : 'marca';
  const classeSimbolo = variante === 'landing' ? 'landing-logo-mark' : 'marca-simbolo';
  const simbolo = variante === 'landing'
    ? <img className="landing-logo-image" src="/favicon.svg" alt="" aria-hidden="true" />
    : '✦';

  return <span className={classe}><span className={classeSimbolo}>{simbolo}</span><span>Lembraí</span></span>;
}
