import { KeyboardIcon } from "./Icons";
import Modal from "./Modal";

export default function ModalAtalhos({ onFechar }: { onFechar: () => void }) {
  const atalhos = [
    { tecla: "Enter", acao: "Processar lote de imagens selecionadas" },
    { tecla: "Ctrl + Z", acao: "Desfazer última edição manual de célula" },
    { tecla: "Ctrl + Y", acao: "Refazer edição manual de célula" },
    { tecla: "Esc", acao: "Cancelar ROI ou fechar janelas" },
    { tecla: "← / →", acao: "Navegar entre amostras processadas" },
    { tecla: "Scroll do Mouse", acao: "Zoom In / Zoom Out no viewer" },
    { tecla: "Ctrl + S", acao: "Salvar projeto (.cytoproj)" },
    { tecla: "Ctrl + O", acao: "Abrir projeto (.cytoproj)" },
    { tecla: "Ctrl + M", acao: "Mesclar Canais (DAPI / FITC / PI)" },
    { tecla: "Ctrl + P", acao: "Relatório Executivo / PDF" },
    { tecla: "F1", acao: "Abrir Guia & Tutorial" },
  ];

  return (
    <Modal
      titulo="Atalhos de Teclado"
      icone={<KeyboardIcon size={20} />}
      larguraMax={720}
      onFechar={onFechar}
    >
      <div className="shortcuts-grid">
        {atalhos.map((a) => (
          <div key={a.tecla} className="shortcut-card">
            <kbd className="shortcut-kbd">{a.tecla}</kbd>
            <span className="shortcut-desc">{a.acao}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
