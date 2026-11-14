import { KeyboardIcon, XIcon } from "./Icons";

export default function ModalAtalhos({ onFechar }: { onFechar: () => void }) {
  const atalhos = [
    { tecla: "Enter", acao: "Processar lote de imagens selecionadas" },
    { tecla: "Ctrl + Z", acao: "Desfazer última edição manual de célula" },
    { tecla: "Ctrl + Y", acao: "Refazer edição manual de célula" },
    { tecla: "Esc", acao: "Cancelar seleção de Região (ROI) ou fechar janelas" },
    { tecla: "Seta Esquerda / Direita", acao: "Navegar entre amostras processadas" },
    { tecla: "Scroll do Mouse", acao: "Zoom In / Zoom Out na imagem inspecionada" },
    { tecla: "Ctrl + S", acao: "Salvar sessão atual como arquivo de projeto (.cytoproj)" },
    { tecla: "Ctrl + O", acao: "Abrir arquivo de projeto salvo (.cytoproj)" },
    { tecla: "Ctrl + M", acao: "Abrir janela de Mesclagem de Canais (DAPI / FITC / PI)" },
    { tecla: "Ctrl + P", acao: "Abrir Relatório Executivo de Impressão / PDF" },
    { tecla: "F1", acao: "Abrir Guia & Tutorial Rápido" },
  ];

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <KeyboardIcon size={18} />
            <h2>Atalhos de Teclado</h2>
          </div>
          <button type="button" className="modal-close" onClick={onFechar}>
            <XIcon size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="shortcuts-list">
            {atalhos.map((a) => (
              <div key={a.tecla} className="shortcut-row">
                <kbd className="shortcut-kbd">{a.tecla}</kbd>
                <span>{a.acao}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
