import { useEffect, useRef, useState } from "react";
import { Idioma } from "../lib/i18n";
import { CheckIcon, ChevronDownIcon } from "./Icons";

interface Props {
  idiomaAtual: Idioma;
  onMudarIdioma: (novo: Idioma) => void;
}

export function BandeiraBrasil({ width = 18, height = 13 }: { width?: number; height?: number }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 20 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        borderRadius: "2px",
        display: "block",
        flexShrink: 0,
        boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.15)",
      }}
      aria-label="Bandeira do Brasil"
    >
      <rect width="20" height="14" rx="2" fill="#009B3A" />
      <polygon points="10,2.2 17.8,7 10,11.8 2.2,7" fill="#FEDF00" />
      <circle cx="10" cy="7" r="3" fill="#002776" />
      <path
        d="M 7.3 7.3 Q 10 5.8 12.7 7.1"
        stroke="#FFFFFF"
        strokeWidth="0.65"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function BandeiraEUA({ width = 18, height = 13 }: { width?: number; height?: number }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 20 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        borderRadius: "2px",
        display: "block",
        flexShrink: 0,
        boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.15)",
      }}
      aria-label="Flag of the United States"
    >
      <rect width="20" height="14" rx="2" fill="#B22234" />
      <rect y="1.08" width="20" height="1.08" fill="#FFFFFF" />
      <rect y="3.23" width="20" height="1.08" fill="#FFFFFF" />
      <rect y="5.38" width="20" height="1.08" fill="#FFFFFF" />
      <rect y="7.54" width="20" height="1.08" fill="#FFFFFF" />
      <rect y="9.69" width="20" height="1.08" fill="#FFFFFF" />
      <rect y="11.85" width="20" height="1.08" fill="#FFFFFF" />
      <rect width="8.5" height="7.54" fill="#3C3B6E" />
      <circle cx="1.8" cy="1.6" r="0.45" fill="#FFFFFF" />
      <circle cx="4.25" cy="1.6" r="0.45" fill="#FFFFFF" />
      <circle cx="6.7" cy="1.6" r="0.45" fill="#FFFFFF" />
      <circle cx="3.0" cy="3.77" r="0.45" fill="#FFFFFF" />
      <circle cx="5.5" cy="3.77" r="0.45" fill="#FFFFFF" />
      <circle cx="1.8" cy="5.9" r="0.45" fill="#FFFFFF" />
      <circle cx="4.25" cy="5.9" r="0.45" fill="#FFFFFF" />
      <circle cx="6.7" cy="5.9" r="0.45" fill="#FFFFFF" />
    </svg>
  );
}

export function BandeiraEspanha({ width = 18, height = 13 }: { width?: number; height?: number }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 20 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        borderRadius: "2px",
        display: "block",
        flexShrink: 0,
        boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.15)",
      }}
      aria-label="Bandera de España"
    >
      <rect width="20" height="14" rx="2" fill="#AA151B" />
      <rect y="3.5" width="20" height="7" fill="#F1BF00" />
      <rect
        x="4.5"
        y="5.2"
        width="2.6"
        height="3.4"
        rx="0.6"
        fill="#AA151B"
        stroke="#B8860B"
        strokeWidth="0.4"
      />
      <circle cx="5.8" cy="4.6" r="0.6" fill="#F1BF00" />
      <rect x="5.1" y="6.0" width="1.4" height="1.8" fill="#F1BF00" />
    </svg>
  );
}

interface OpcaoIdioma {
  id: Idioma;
  label: string;
  codigo: string;
  Bandeira: (props: { width?: number; height?: number }) => JSX.Element;
}

const OPCOES: OpcaoIdioma[] = [
  { id: "pt", label: "Português", codigo: "PT", Bandeira: BandeiraBrasil },
  { id: "en", label: "English", codigo: "EN", Bandeira: BandeiraEUA },
  { id: "es", label: "Español", codigo: "ES", Bandeira: BandeiraEspanha },
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
        <span className="lang-flag">
          <selecionado.Bandeira width={18} height={13} />
        </span>
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
                  <span className="lang-flag">
                    <opcao.Bandeira width={18} height={13} />
                  </span>
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
