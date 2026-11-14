import { useState } from "react";
import { APP_VERSION, salvarConfigUsuario } from "../lib/api";
import { Idioma } from "../lib/i18n";
import {
  BookOpenIcon,
  CheckIcon,
  LayersIcon,
  MicroscopeIcon,
  SlidersIcon,
} from "./Icons";
import Modal from "./Modal";

export default function ModalBoasVindas({
  onFechar,
  onAbrirTutorial,
  onCarregarExemplo,
  naoMostrarInicial,
  idioma,
}: {
  onFechar: () => void;
  onAbrirTutorial: () => void;
  onCarregarExemplo: () => void;
  naoMostrarInicial: boolean;
  idioma: Idioma;
}) {
  const [naoMostrar, setNaoMostrar] = useState(naoMostrarInicial);

  const handleConcluir = async (acaoExtra?: () => void) => {
    await salvarConfigUsuario({ hideWelcomeModal: naoMostrar });
    onFechar();
    acaoExtra?.();
  };

  const titulo =
    idioma === "en"
      ? "Welcome to CytoCount"
      : idioma === "es"
      ? "Bienvenido a CytoCount"
      : "Bem-vindo ao CytoCount";

  const subtitulo =
    idioma === "en"
      ? `Version ${APP_VERSION} · Automated Fluorescence Cell Viability Analyzer`
      : idioma === "es"
      ? `Versión ${APP_VERSION} · Analizador Automatizado de Viabilidad Celular`
      : `Versão ${APP_VERSION} · Contagem e Segmentação de Viabilidade por Fluorescência`;

  return (
    <Modal
      titulo={titulo}
      subtitulo={subtitulo}
      icone={<MicroscopeIcon size={20} />}
      larguraMax={720}
      onFechar={() => handleConcluir()}
      rodape={
        <div className="welcome-footer-row">
          <label className="welcome-checkbox">
            <input
              type="checkbox"
              checked={naoMostrar}
              onChange={(e) => setNaoMostrar(e.target.checked)}
            />
            <span>
              {idioma === "en"
                ? "Do not show again on startup"
                : idioma === "es"
                ? "No volver a mostrar al iniciar"
                : "Não mostrar novamente ao abrir o programa"}
            </span>
          </label>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleConcluir()}
          >
            <CheckIcon size={15} />
            <span>
              {idioma === "en"
                ? "Get Started"
                : idioma === "es"
                ? "Comenzar"
                : "Começar"}
            </span>
          </button>
        </div>
      }
    >
      <p className="welcome-lead">
        {idioma === "en"
          ? "Scientific desktop software for automated fluorescence cell viability counting and morphological segmentation (DAPI / Calcein-FITC / Propidium Iodide) with 95% Wilson confidence intervals."
          : idioma === "es"
          ? "Software científico de escritorio para conteo automatizado de viabilidad celular por fluorescencia y segmentación morfológica (DAPI / Calceína-FITC / Yoduro de Propidio) con IC 95% de Wilson."
          : "Software científico desktop para contagem automatizada de viabilidade celular por fluorescência e segmentação morfológica (DAPI / Calceína-FITC / Iodeto de Propídio) com intervalo de confiança de Wilson a 95%."}
      </p>

      <div className="welcome-steps-grid">
        <div className="welcome-step-card">
          <div className="welcome-step-top">
            <span className="welcome-step-num">01</span>
            <span className="welcome-step-icon">
              <LayersIcon size={18} />
            </span>
          </div>
          <h4>
            {idioma === "en"
              ? "Add Images"
              : idioma === "es"
              ? "Añadir Imágenes"
              : "Adicionar Imagens"}
          </h4>
          <p>
            {idioma === "en"
              ? "Import RGB microscopy files (8/16-bit TIFF, PNG, BMP) or merge separate DAPI/FITC/PI channels."
              : idioma === "es"
              ? "Importe archivos RGB (TIFF 8/16-bit, PNG, BMP) o fusione canales DAPI/FITC/PI separados."
              : "Importe arquivos RGB (TIFF 8/16-bit, PNG, BMP) ou mescle canais separados (DAPI, FITC, PI)."}
          </p>
        </div>

        <div className="welcome-step-card">
          <div className="welcome-step-top">
            <span className="welcome-step-num">02</span>
            <span className="welcome-step-icon">
              <SlidersIcon size={18} />
            </span>
          </div>
          <h4>
            {idioma === "en"
              ? "Adjust Parameters"
              : idioma === "es"
              ? "Ajustar Parámetros"
              : "Ajustar Parâmetros"}
          </h4>
          <p>
            {idioma === "en"
              ? "Fine-tune Otsu sensitivity thresholds with real-time preview or define a specific Region of Interest (ROI)."
              : idioma === "es"
              ? "Ajuste los umbrales de sensibilidad Otsu con vista previa en vivo o seleccione una región (ROI)."
              : "Calibre os limiares de sensibilidade Otsu com preview em tempo real ou selecione uma região (ROI)."}
          </p>
        </div>

        <div className="welcome-step-card">
          <div className="welcome-step-top">
            <span className="welcome-step-num">03</span>
            <span className="welcome-step-icon">
              <CheckIcon size={18} />
            </span>
          </div>
          <h4>
            {idioma === "en"
              ? "Process & Export"
              : idioma === "es"
              ? "Procesar y Exportar"
              : "Processar e Exportar"}
          </h4>
          <p>
            {idioma === "en"
              ? "Obtain counts with 95% Wilson CI, perform manual cell curation, and export 300 DPI figures or ImageJ ROIs."
              : idioma === "es"
              ? "Obtenga conteos con IC 95% de Wilson, edición manual de células y figuras a 300 DPI o macros de ImageJ."
              : "Obtenha contagens com IC 95% de Wilson, faça curadoria manual de células e exporte figuras em 300 DPI ou ROIs para o ImageJ."}
          </p>
        </div>
      </div>

      <div className="welcome-links-bar">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => handleConcluir(onAbrirTutorial)}
        >
          <BookOpenIcon size={15} />
          <span>
            {idioma === "en"
              ? "Open Guide & Tutorial"
              : idioma === "es"
              ? "Abrir Guía y Tutorial"
              : "Abrir Guia & Tutorial"}
          </span>
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => handleConcluir(onCarregarExemplo)}
        >
          <MicroscopeIcon size={15} />
          <span>
            {idioma === "en"
              ? "Test with Sample Image"
              : idioma === "es"
              ? "Probar con Imagen de Ejemplo"
              : "Testar com Imagem de Exemplo"}
          </span>
        </button>
      </div>
    </Modal>
  );
}
