import { Idioma } from "../lib/i18n";
import { KeyboardIcon } from "./Icons";
import Modal from "./Modal";

export default function ModalAtalhos({
  onFechar,
  idioma = "pt",
}: {
  onFechar: () => void;
  idioma?: Idioma;
}) {
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
    { tecla: "?", acao: "Abrir lista de atalhos de teclado" },
  ];

  return (
    <Modal
      titulo={
        idioma === "en"
          ? "Keyboard Shortcuts"
          : idioma === "es"
          ? "Atajos de Teclado"
          : "Atalhos de Teclado"
      }
      subtitulo="Navegação rápida, edição manual e exportação"
      icone={<KeyboardIcon size={20} />}
      larguraMax={720}
      onFechar={onFechar}
      rodape={
        <button type="button" className="btn btn-primary btn-sm" onClick={onFechar}>
          <span>{idioma === "en" ? "Close" : idioma === "es" ? "Cerrar" : "Fechar"}</span>
        </button>
      }
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
