import { ReactNode, useEffect } from "react";
import { XIcon } from "./Icons";

interface ModalProps {
  titulo: string;
  subtitulo?: string;
  icone?: ReactNode;
  larguraMax?: number | string;
  onFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
}

export default function Modal({
  titulo,
  subtitulo,
  icone,
  larguraMax = 720,
  onFechar,
  children,
  rodape,
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onFechar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onFechar]);

  const maxW = typeof larguraMax === "number" ? `${larguraMax}px` : larguraMax;

  return (
    <div className="modal-backdrop" onClick={onFechar} role="dialog" aria-modal="true">
      <div
        className="modal-card modal-unificado"
        style={{ maxWidth: maxW }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-left">
            {icone && <span className="modal-header-icon">{icone}</span>}
            <div>
              <h2 className="modal-title">{titulo}</h2>
              {subtitulo && <p className="modal-subtitle">{subtitulo}</p>}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-icon btn-ghost modal-close-btn"
            onClick={onFechar}
            aria-label="Fechar"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="modal-body modal-scrollable">{children}</div>

        {rodape && <div className="modal-footer">{rodape}</div>}
      </div>
    </div>
  );
}
