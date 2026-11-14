import { BookOpenIcon, MicroscopeIcon } from "./Icons";
import Modal from "./Modal";

export default function ModalTutorial({
  onFechar,
  onCarregarExemplo,
}: {
  onFechar: () => void;
  onCarregarExemplo: () => void;
}) {
  return (
    <Modal
      titulo="Guia Rápido & Metodologia Científica — CytoCount v1.1.0"
      icone={<BookOpenIcon size={20} />}
      larguraMax={760}
      onFechar={onFechar}
    >
      <div className="tutorial-body">
        <div className="tutorial-step">
          <span className="tutorial-badge">1</span>
          <div>
            <h4>Princípio Físico & Segmentação de Canais (Live/Dead Assay)</h4>
            <p>
              O CytoCount analisa três sinais de fluorescência em imagens RGB ou canais
              monocromáticos de 8/16 bits:
            </p>
            <ul>
              <li>
                <b className="text-blue">Canal Azul (DAPI / Hoechst):</b> Marca o DNA de todos os
                núcleos celulares. É segmentado por transformada de distância euclidiana e{" "}
                <b>Watershed Morfológico</b> para separar células próximas.
              </li>
              <li>
                <b className="text-green">Canal Verde (Calceína-AM / FITC):</b> Hidrolisada por
                esterases intracelulares ativas em células com membrana íntegra (<b>Vivas</b>).
              </li>
              <li>
                <b className="text-yellow">Canal Amarelo/Vermelho (Iodeto de Propídio / Etídio):</b>{" "}
                Intercala-se ao DNA quando a membrana plasmática está comprometida (<b>Mortas</b>).
              </li>
            </ul>
          </div>
        </div>

        <div className="tutorial-step">
          <span className="tutorial-badge">2</span>
          <div>
            <h4>Fonte Única da Verdade & Intervalo de Confiança de Wilson 95%</h4>
            <p>
              Todo núcleo segmentado no canal azul é classificado em exatamente uma de três
              classes mutuamente exclusivas: <code>Detectados = Vivas + Mortas + Indeterminadas</code>.
              A viabilidade é reportada com 1 casa decimal acompanhada do{" "}
              <b>Intervalo de Confiança binomial de Wilson a 95%</b>, garantindo rigor estatístico
              mesmo em amostras pequenas ou viabilidades próximas de 0% ou 100%.
            </p>
          </div>
        </div>

        <div className="tutorial-step">
          <span className="tutorial-badge">3</span>
          <div>
            <h4>Curadoria Manual, ROI & Exportação para Publicação</h4>
            <p>
              Use a barra de edição na viewer para <b>Alternar classe</b>,{" "}
              <b>Adicionar célula não detectada</b> ou <b>Excluir falso positivo</b> (com{" "}
              <code>Ctrl+Z</code> / <code>Ctrl+Y</code>). Todas as edições são auditadas no
              relatório e salvas no arquivo <code>.cytoproj</code>. Exporte figuras prontas em{" "}
              <b>300 ou 600 DPI</b> (PNG, TIFF, PDF, SVG) com barra de escala em micrômetros.
            </p>
          </div>
        </div>

        <div className="tutorial-cta">
          <div>
            <h4>Deseja testar o fluxo agora sem imagens próprias?</h4>
            <p>
              Carregue a imagem sintética de fluorescência embutida no pacote para testar ROI,
              edição manual e exportação em 300 DPI.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ width: "auto", padding: "0 18px", whiteSpace: "nowrap" }}
            onClick={() => {
              onFechar();
              onCarregarExemplo();
            }}
          >
            <MicroscopeIcon size={14} />
            <span>Carregar Imagem de Exemplo</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
