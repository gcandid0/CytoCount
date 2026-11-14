import { useState } from "react";
import { APP_VERSION } from "../lib/api";
import { CITACAO_BIBTEX, CITACAO_OFICIAL, Idioma } from "../lib/i18n";
import {
  CheckIcon,
  CopyIcon,
  InfoIcon,
  LayersIcon,
  MicroscopeIcon,
  SlidersIcon,
} from "./Icons";
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
        setTimeout(() => setCopiadoAbnt(false), 2200);
      } else {
        setCopiadoBib(true);
        setTimeout(() => setCopiadoBib(false), 2200);
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
      // Ignora erro de clipboard se bloqueado pelo browser/os
    }
  };

  const t = {
    pt: {
      titulo: "Sobre o CytoCount",
      subtitulo: `Versão ${APP_VERSION} · Arquitetura Tauri v2 + Python Scientific Sidecar`,
      tagline: "Plataforma Científica Desktop para Quantificação e Segmentação Celular",
      autor: "Desenvolvido por",
      local: "Campinas - SP, Brasil · 2026",
      desc: "O CytoCount é um software científico de alta precisão projetado para quantificação automatizada de viabilidade celular e segmentação morfológica por microscopia de fluorescência tri-canal (DAPI, Calceína-AM e Iodeto de Propídio).",
      cards: [
        {
          titulo: "Motores de Segmentação Híbridos",
          desc: "Algoritmo Watershed clássico baseado em transformadas de distância euclidiana, com suporte avançado aos motores de aprendizado profundo StarDist 2D e Cellpose 2D.",
        },
        {
          titulo: "Delimitação Nuclear & Citoplasma",
          desc: "Identificação precisa de núcleos fluorescentes e particionamento contínuo de citoplasma por diagrama de Voronoi geodésico, extraindo área, circularidade e fluorescência integrada.",
        },
        {
          titulo: "Rigor Estatístico & Validação",
          desc: "Cálculo de viabilidade celular com intervalo de confiança binomial de Wilson (95%), normalização Z-Score e compatibilidade total com ImageJ / Fiji (ROI Zip) e Bio-Formats.",
        },
        {
          titulo: "Privacidade & Execução Local",
          desc: "Processamento 100% offline em hardware local (Rust + Python 3.12). Nenhuma imagem, dado analítico ou informação experimental é transferida para servidores externos.",
        },
      ],
      citacao_abnt_titulo: "Como citar em artigos, dissertações e teses (ABNT / APA):",
      citacao_bib_titulo: "Entrada BibTeX (LaTeX / Overleaf):",
      btn_copiar: "Copiar citação",
      btn_copiar_bib: "Copiar BibTeX",
      copiado: "Copiado!",
      aviso_licenca: "Livre para pesquisa científica e uso acadêmico. Todos os direitos reservados ao autor.",
      btn_boas_vindas: "Tela de Boas-vindas",
      btn_fechar: "Fechar",
    },
    en: {
      titulo: "About CytoCount",
      subtitulo: `Version ${APP_VERSION} · Tauri v2 + Python Scientific Sidecar Architecture`,
      tagline: "Scientific Desktop Platform for Cell Viability Quantification and Segmentation",
      autor: "Developed by",
      local: "Campinas - SP, Brazil · 2026",
      desc: "CytoCount is high-precision scientific software designed for automated cell viability quantification and morphological segmentation via multi-channel fluorescence microscopy (DAPI, Calcein-AM, and Propidium Iodide).",
      cards: [
        {
          titulo: "Hybrid Segmentation Engines",
          desc: "Classical Watershed segmentation based on Euclidean distance transforms, with integrated support for deep learning models StarDist 2D and Cellpose 2D.",
        },
        {
          titulo: "Nuclear & Cytoplasm Delimitation",
          desc: "High-accuracy fluorescent nuclei detection and geodesic Voronoi cytoplasm partitioning with automated extraction of area, circularity, and integrated intensity.",
        },
        {
          titulo: "Statistical Rigor & Validation",
          desc: "Viability estimation with 95% Wilson binomial confidence intervals, Z-score normalization, and full compatibility with ImageJ / Fiji (ROI Zip) and Bio-Formats.",
        },
        {
          titulo: "Privacy & Local Execution",
          desc: "100% offline execution on local machine (Rust + Python 3.12). No images, analytic telemetry, or experimental datasets are ever sent to external cloud servers.",
        },
      ],
      citacao_abnt_titulo: "How to cite in papers, dissertations, and theses (ABNT / APA):",
      citacao_bib_titulo: "BibTeX entry (LaTeX / Overleaf):",
      btn_copiar: "Copy citation",
      btn_copiar_bib: "Copy BibTeX",
      copiado: "Copied!",
      aviso_licenca: "Free for scientific research and academic use. All rights reserved by the author.",
      btn_boas_vindas: "Welcome Screen",
      btn_fechar: "Close",
    },
    es: {
      titulo: "Acerca de CytoCount",
      subtitulo: `Versión ${APP_VERSION} · Arquitectura Tauri v2 + Motor Científico Python`,
      tagline: "Plataforma Científica de Escritorio para Cuantificación y Segmentación Celular",
      autor: "Desarrollado por",
      local: "Campinas - SP, Brasil · 2026",
      desc: "CytoCount es un software científico de alta precisión diseñado para la cuantificación automatizada de viabilidad celular y segmentación morfológica por microscopía de fluorescencia tri-canal (DAPI, Calceína-AM y Yoduro de Propidio).",
      cards: [
        {
          titulo: "Motores de Segmentación Híbridos",
          desc: "Algoritmo Watershed clásico basado en transformadas de distancia euclidiana, con soporte avanzado para los modelos de aprendizaje profundo StarDist 2D y Cellpose 2D.",
        },
        {
          titulo: "Delimitación Nuclear & Citoplasma",
          desc: "Identificación precisa de núcleos fluorescentes y partición continua de citoplasma por diagrama de Voronoi geodésico, extrayendo área, circularidad e intensidad integrada.",
        },
        {
          titulo: "Rigor Estadístico & Validación",
          desc: "Cálculo de viabilidad con intervalo de confianza binomial de Wilson (95%), normalización Z-score y compatibilidad con ImageJ / Fiji (ROI Zip) y Bio-Formats.",
        },
        {
          titulo: "Privacidad & Ejecución Local",
          desc: "Procesamiento 100% local y fuera de línea (Rust + Python 3.12). Ninguna imagen o dato experimental se transmite a servidores externos.",
        },
      ],
      citacao_abnt_titulo: "Cómo citar en publicaciones y tesis (ABNT / APA):",
      citacao_bib_titulo: "Entrada BibTeX (LaTeX / Overleaf):",
      btn_copiar: "Copiar cita",
      btn_copiar_bib: "Copiar BibTeX",
      copiado: "¡Copiado!",
      aviso_licenca: "Libre para investigación científica y uso académico. Todos los derechos reservados por el autor.",
      btn_boas_vindas: "Pantalla de Bienvenida",
      btn_fechar: "Cerrar",
    },
  }[idioma];

  return (
    <Modal
      titulo={t.titulo}
      subtitulo={t.subtitulo}
      icone={<InfoIcon size={20} />}
      larguraMax={760}
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
              <span>{t.btn_boas_vindas}</span>
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={onFechar}>
            <span>{t.btn_fechar}</span>
          </button>
        </div>
      }
    >
      {/* Hero Principal */}
      <div className="about-hero-v2">
        <div className="about-emblem-wrapper" aria-hidden="true">
          <div className="about-emblem-ring">
            <span className="emblem-dot emblem-blue" title="DAPI (Núcleos)" />
            <span className="emblem-dot emblem-green" title="Calceína-AM (Viáveis)" />
            <span className="emblem-dot emblem-yellow" title="Iodeto de Propídio (Mortas)" />
          </div>
        </div>

        <div className="about-hero-text">
          <div className="about-title-row">
            <h3 className="about-app-name">CytoCount</h3>
            <span className="about-badge-version">v{APP_VERSION}</span>
            <span className="about-badge-status">Estável</span>
          </div>
          <p className="about-tagline">{t.tagline}</p>
          <p className="about-author-line">
            {t.autor} <strong className="text-white">Gabriel Candido Messias dos Santos</strong>
            <span className="about-dot-sep">·</span>
            <span className="text-dim">{t.local}</span>
          </p>
        </div>
      </div>

      {/* Descrição Científica */}
      <p className="about-lead-desc">{t.desc}</p>

      {/* Grid de Capacidades Científicas */}
      <div className="about-features-grid">
        {t.cards.map((c, i) => (
          <div key={i} className="about-feature-card">
            <div className="about-feature-header">
              <span className="about-feature-number">0{i + 1}</span>
              <h4 className="about-feature-title">{c.titulo}</h4>
            </div>
            <p className="about-feature-body">{c.desc}</p>
          </div>
        ))}
      </div>

      {/* Seção de Citação Científica Oficial */}
      <div className="citation-container-v2">
        <div className="citation-section">
          <div className="citation-header">
            <span>{t.citacao_abnt_titulo}</span>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => copiar(CITACAO_OFICIAL, "abnt")}
            >
              {copiadoAbnt ? <CheckIcon size={13} className="text-green" /> : <CopyIcon size={13} />}
              <span>{copiadoAbnt ? t.copiado : t.btn_copiar}</span>
            </button>
          </div>
          <pre className="citation-code">{CITACAO_OFICIAL}</pre>
        </div>

        <div className="citation-section">
          <div className="citation-header">
            <span>{t.citacao_bib_titulo}</span>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => copiar(CITACAO_BIBTEX, "bib")}
            >
              {copiadoBib ? <CheckIcon size={13} className="text-green" /> : <CopyIcon size={13} />}
              <span>{copiadoBib ? t.copiado : t.btn_copiar_bib}</span>
            </button>
          </div>
          <pre className="citation-code">{CITACAO_BIBTEX}</pre>
        </div>
      </div>

      {/* Rodapé Interno com Aviso de Licença */}
      <div className="about-license-notice">
        <span>{t.aviso_licenca}</span>
      </div>
    </Modal>
  );
}
