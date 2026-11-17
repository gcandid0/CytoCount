import { useState } from "react";
import { APP_VERSION } from "../lib/api";
import { CITACAO_BIBTEX, CITACAO_OFICIAL } from "../lib/i18n";
import { CheckIcon, CopyIcon, InfoIcon, MicroscopeIcon, XIcon } from "./Icons";

export default function ModalSobre({
  onFechar,
  onReabrirBoasVindas,
  onNotificar,
}: {
  onFechar: () => void;
  onReabrirBoasVindas?: () => void;
  onNotificar?: (msg: string, tipo?: "sucesso" | "erro" | "info") => void;
}) {
  const [copiadoAbnt, setCopiadoAbnt] = useState(false);
  const [copiadoBib, setCopiadoBib] = useState(false);

  const copiar = async (texto: string, tipo: "abnt" | "bib") => {
    try {
      await navigator.clipboard.writeText(texto);
      if (tipo === "abnt") {
        setCopiadoAbnt(true);
        setTimeout(() => setCopiadoAbnt(false), 2500);
      } else {
        setCopiadoBib(true);
        setTimeout(() => setCopiadoBib(false), 2500);
      }
      onNotificar?.("Citação copiada para a área de transferência!", "sucesso");
    } catch {
      // Ignora
    }
  };

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <InfoIcon size={18} />
            <h2>Sobre o CytoCount</h2>
          </div>
          <button type="button" className="modal-close" onClick={onFechar}>
            <XIcon size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="about-hero">
            <div>
              <h3>CytoCount Desktop</h3>
              <p className="about-version">
                Versão {APP_VERSION} · Arquitetura Tauri v2 + Python Scientific Sidecar
              </p>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>
                Autor: <b>Gabriel Candido Messias dos Santos</b>
              </p>
            </div>
          </div>

          <p className="about-desc">
            Plataforma científica desktop para segmentação morfológica watershed, limiarização
            adaptativa de Otsu e quantificação de viabilidade celular por microscopia de
            fluorescência (DAPI / Calceína-AM / Iodeto de Propídio) com intervalo de confiança
            binomial de Wilson 95%.
          </p>

          <div className="citation-section">
            <div className="citation-header">
              <span>Como citar em artigos, dissertações e teses</span>
              <button
                type="button"
                className="btn-copy-mini"
                onClick={() => copiar(CITACAO_OFICIAL, "abnt")}
              >
                {copiadoAbnt ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                <span style={{ marginLeft: 4 }}>
                  {copiadoAbnt ? "Copiado" : "Copiar Citação"}
                </span>
              </button>
            </div>
            <pre className="citation-code">{CITACAO_OFICIAL}</pre>
          </div>

          <div className="citation-section">
            <div className="citation-header">
              <span>Entrada BibTeX (LaTeX / Overleaf)</span>
              <button
                type="button"
                className="btn-copy-mini"
                onClick={() => copiar(CITACAO_BIBTEX, "bib")}
              >
                {copiadoBib ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                <span style={{ marginLeft: 4 }}>
                  {copiadoBib ? "Copiado" : "Copiar BibTeX"}
                </span>
              </button>
            </div>
            <pre className="citation-code">{CITACAO_BIBTEX}</pre>
          </div>

          {onReabrirBoasVindas && (
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  onFechar();
                  onReabrirBoasVindas();
                }}
              >
                <MicroscopeIcon size={14} />
                <span>Abrir Tela de Boas-vindas</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
