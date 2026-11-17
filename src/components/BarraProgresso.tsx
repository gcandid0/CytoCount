import { Idioma, TEXTOS } from "../lib/i18n";

interface Props {
  processadas: number;
  total: number;
  onCancelar?: () => void;
  idioma?: Idioma;
}

export default function BarraProgresso({
  processadas,
  total,
  onCancelar,
  idioma = "pt",
}: Props) {
  const t = TEXTOS[idioma];
  const pct = total > 0 ? Math.round((processadas / total) * 100) : 0;
  return (
    <div className="progress-state">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="progress-text">
        <span className="spinner-mini" />
        {idioma === "en"
          ? `Processing ${processadas}/${total} images… (${pct}%)`
          : idioma === "es"
          ? `Procesando ${processadas}/${total} imágenes… (${pct}%)`
          : `Processando ${processadas}/${total} imagens… (${pct}%)`}
      </p>
      {onCancelar && (
        <button
          type="button"
          className="btn-cancel-proc"
          onClick={onCancelar}
        >
          {t.btn_cancel_process}
        </button>
      )}
    </div>
  );
}
