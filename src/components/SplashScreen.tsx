import React, { useEffect, useState } from "react";

interface Props {
  ativo: boolean;
  segundosDecorridos: number;
}

const ETAPAS = [
  "Iniciando motor de visão computacional...",
  "Carregando módulos OpenCV, NumPy e SciPy...",
  "Inicializando filtros de deconvolução e watershed...",
  "Calibrando canais DAPI, Calceína e Iodeto de Propídio...",
  "Ambiente pronto para análise celular.",
];

export default function SplashScreen({ ativo, segundosDecorridos }: Props) {
  const [visivel, setVisivel] = useState(true);
  const [etapaIdx, setEtapaIdx] = useState(0);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setEtapaIdx((prev) => (prev < ETAPAS.length - 1 ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    if (!ativo) {
      const timer = setTimeout(() => setVisivel(false), 600);
      return () => clearTimeout(timer);
    }
  }, [ativo]);

  if (!visivel) return null;

  const progressoEstimado = Math.min(100, Math.max(15, segundosDecorridos * 16 + 20));

  return (
    <div className={`splash-screen-overlay${!ativo ? " fade-out" : ""}`}>
      <div className="splash-card">
        {/* Animação do logotipo circular de microscopia com células fluorescentes */}
        <div className="splash-logo-wrap">
          <div className="splash-orbit-glow"></div>
          <svg className="splash-logo" viewBox="0 0 100 100" fill="none">
            {/* Anel da Placa de Petri / Campo Microscópico */}
            <circle cx="50" cy="50" r="46" stroke="rgba(59, 130, 246, 0.2)" strokeWidth="2" />
            <circle cx="50" cy="50" r="40" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="1" strokeDasharray="4 4" />
            
            {/* Núcleo DAPI Blue */}
            <circle cx="36" cy="40" r="9" fill="#3b82f6" className="pulse-blue">
              <animate attributeName="r" values="9;11;9" dur="2s" repeatCount="indefinite" />
            </circle>

            {/* Célula Viável Calceína Green */}
            <circle cx="62" cy="38" r="8" fill="#10b981" className="pulse-green">
              <animate attributeName="r" values="8;10;8" dur="2.4s" repeatCount="indefinite" />
            </circle>

            {/* Célula Morta PI / Yellow */}
            <circle cx="64" cy="62" r="7.5" fill="#f59e0b" className="pulse-yellow">
              <animate attributeName="r" values="7.5;9.5;7.5" dur="1.8s" repeatCount="indefinite" />
            </circle>

            {/* Célula Viável Adicional */}
            <circle cx="38" cy="64" r="6.5" fill="#10b981" className="pulse-green">
              <animate attributeName="r" values="6.5;8;6.5" dur="2.2s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>

        <h1 className="splash-title">CytoCount</h1>

        {/* Mensagem e Barra de Progresso */}
        <div className="splash-progress-container">
          <div className="splash-message">{ETAPAS[etapaIdx]}</div>
          <div className="splash-bar-bg">
            <div
              className="splash-bar-fill"
              style={{ width: `${progressoEstimado}%` }}
            />
          </div>
          <span className="splash-timer">{segundosDecorridos}s</span>
        </div>
      </div>
    </div>
  );
}
