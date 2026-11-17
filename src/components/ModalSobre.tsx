import { useState } from "react";
import { APP_VERSION } from "../lib/api";
import { CITACAO_BIBTEX, CITACAO_OFICIAL, Idioma } from "../lib/i18n";
import { CheckIcon, CopyIcon, InfoIcon, MicroscopeIcon } from "./Icons";
import Modal from "./Modal";

export default function ModalSobre({
  onFechar,
  onReabrirBoasVindas,
  onNotificar,
  idioma = "pt",
}: {
  onFechar: () => void;
  onReabrirBoasVindas?: () => void;
  onNotificar?: (msg: string, tipo?: "sucesso" | "erro" | "info") => void;
  idioma?: Idioma;
}) {
  const [copiadoAbnt, setCopiadoAbnt] = useState(false);
  const [copiadoBib, setCopiadoBib] = useState(false);

  const copiar = async (texto: string, tipo: "abnt" | "bib") => {
    try {
      await navigator.clipboard.writeText(texto);
      if (tipo === "abnt") {
        setCopiadoAbnt(true);
        setTimeout(() => setCopiadoAbnt(false), 2000);
      } else {
        setCopiadoBib(true);
        setTimeout(() => setCopiadoBib(false), 2000);
      }
      onNotificar?.(
        idioma === "en"
          ? "Citation copied to clipboard!"
          : idioma === "es"
          ? "¡Cita copiada al portapapeles!"
          : "Citação copiada para a área de transferência!",
        "sucesso"
      );
    } catch {
      // Ignora
    }
  };

  return (
    <Modal
      titulo={
        idioma === "en"
          ? "About CytoCount"
          : idioma === "es"
          ? "Acerca de CytoCount"
          : "Sobre o CytoCount"
      }
      subtitulo={`Versão ${APP_VERSION} · Tauri v2 + Python Scientific Sidecar`}
      icone={<InfoIcon size={20} />}
      larguraMax={700}
      onFechar={onFechar}
      rodape={
        <div className="welcome-footer-row">
          {onReabrirBoasVindas ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                onFechar();
                onReabrirBoasVindas();
              }}
            >
              <MicroscopeIcon size={14} />
              <span>
                {idioma === "en"
                  ? "Open Welcome Screen"
                  : idioma === "es"
                  ? "Abrir Pantalla de Bienvenida"
                  : "Abrir Tela de Boas-vindas"}
              </span>
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={onFechar}>
            <span>{idioma === "en" ? "Close" : idioma === "es" ? "Cerrar" : "Fechar"}</span>
          </button>
        </div>
      }
    >
      <div className="about-hero">
        <div className="about-logo-circle" aria-hidden="true">
          <span className="dot dot-blue" />
          <span className="dot dot-green" />
          <span className="dot dot-yellow" />
        </div>
        <div>
          <h3>CytoCount Desktop</h3>
          <p className="about-version">
            Versão {APP_VERSION} · Arquitetura Tauri v2 + Python Scientific Sidecar
          </p>
          <p className="about-author">
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
          <span>Como citar em artigos, dissertações e teses (ABNT / Padrão)</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => copiar(CITACAO_OFICIAL, "abnt")}
          >
            {copiadoAbnt ? <CheckIcon size={13} className="text-green" /> : <CopyIcon size={13} />}
            <span>{copiadoAbnt ? "Copiado!" : "Copiar citação"}</span>
          </button>
        </div>
        <pre className="citation-code">{CITACAO_OFICIAL}</pre>
      </div>

      <div className="citation-section">
        <div className="citation-header">
          <span>Entrada BibTeX (LaTeX / Overleaf)</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => copiar(CITACAO_BIBTEX, "bib")}
          >
            {copiadoBib ? <CheckIcon size={13} className="text-green" /> : <CopyIcon size={13} />}
            <span>{copiadoBib ? "Copiado!" : "Copiar BibTeX"}</span>
          </button>
        </div>
        <pre className="citation-code">{CITACAO_BIBTEX}</pre>
      </div>
    </Modal>
  );
}
