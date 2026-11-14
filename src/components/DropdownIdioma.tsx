import { useEffect, useRef, useState } from "react";
import { Idioma } from "../lib/i18n";
import { CheckIcon, ChevronDownIcon } from "./Icons";

interface Props {
  idiomaAtual: Idioma;
  onMudarIdioma: (novo: Idioma) => void;
}

const OPCOES: { id: Idioma; label: string; bandeira: string }[] = [
  { id: "pt", label: "PT · Português", bandeira: "🇧🇷" },
  { id: "en", label: "EN · English", bandeira: "🇺🇸" },
  { id: "es", label: "ES · Español", bandeira: "🇪🇸" },
];

export default function DropdownIdioma({ idiomaAtual, onMudarIdioma }: Props) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selecionado = OPCOES.find((o) => o.id === idiomaAtual) || OPCOES[0];

  useEffect(() => {
    if (!aberto) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [aberto]);

  return (
    <div className="custom-lang-dropdown" ref={containerRef}>
      <button
        type="button"
        className={`custom-lang-trigger ${aberto ? "active" : ""}`}
        onClick={() => setAberto(!aberto)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-label="Selecionar idioma"
      >
        <span className="lang-flag">{selecionado.bandeira}</span>
        <span className="lang-label">{selecionado.label}</span>
        <ChevronDownIcon size={12} className={`lang-chevron ${aberto ? "rotated" : ""}`} />
      </button>

      {aberto && (
        <div className="custom-lang-menu" role="listbox">
          {OPCOES.map((opcao) => {
            const ativo = opcao.id === idiomaAtual;
            return (
              <button
                key={opcao.id}
                type="button"
                role="option"
                aria-selected={ativo}
                className={`custom-lang-item ${ativo ? "selected" : ""}`}
                onClick={() => {
                  onMudarIdioma(opcao.id);
                  setAberto(false);
                }}
              >
                <div className="custom-lang-item-content">
                  <span className="lang-flag">{opcao.bandeira}</span>
                  <span className="lang-name">{opcao.label}</span>
                </div>
                {ativo && <CheckIcon size={13} className="custom-lang-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
