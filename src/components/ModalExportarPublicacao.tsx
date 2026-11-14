import { useState } from "react";
import {
  OpcoesPublicacao,
  ResultadoProcessamento,
  exportarFiguraPublicacaoAPI,
  salvarArquivoComDialogo,
} from "../lib/api";
import { Idioma, TEXTOS } from "../lib/i18n";
import { DownloadIcon, ImageIcon } from "./Icons";
import Modal from "./Modal";

export default function ModalExportarPublicacao({
  amostra,
  idiomaInicial,
  onFechar,
  onNotificar,
}: {
  amostra: ResultadoProcessamento;
  idiomaInicial: Idioma;
  onFechar: () => void;
  onNotificar: (msg: string, tipo?: "sucesso" | "erro" | "info") => void;
}) {
  const [formato, setFormato] = useState<"png" | "tiff" | "pdf" | "svg">("png");
  const [dpi, setDpi] = useState<300 | 600>(300);
  const [idiomaFig, setIdiomaFig] = useState<Idioma>(idiomaInicial);
  const [mostrarContornos, setMostrarContornos] = useState(true);
  const [temaFundo, setTemaFundo] = useState<"escuro" | "claro">("escuro");
  const [paletaDaltonismo, setPaletaDaltonismo] = useState(false);
  const [ladoALado, setLadoALado] = useState(false);
  const [umPorPixel, setUmPorPixel] = useState<string>("0.65");
  const [tamanhoBarraUm, setTamanhoBarraUm] = useState<string>("50");
  const [exportando, setExportando] = useState(false);

  const t = TEXTOS[idiomaInicial];

  const handleExportar = async () => {
    setExportando(true);
    try {
      const umVal = umPorPixel.trim() === "" ? null : Number(umPorPixel.replace(",", "."));
      const barraVal =
        tamanhoBarraUm.trim() === "" ? 50 : Number(tamanhoBarraUm.replace(",", "."));

      const opcoes: OpcoesPublicacao = {
        formato,
        dpi,
        idioma: idiomaFig,
        mostrar_contornos: mostrarContornos,
        tema_fundo: temaFundo,
        paleta_daltonismo: paletaDaltonismo,
        lado_a_lado: ladoALado,
        um_por_pixel: Number.isFinite(umVal) && (umVal ?? 0) > 0 ? umVal : null,
        tamanho_barra_um: Number.isFinite(barraVal) && barraVal > 0 ? barraVal : 50,
      };

      const res = await exportarFiguraPublicacaoAPI(amostra.id, opcoes);
      if (res.erro || !res.conteudo_b64) {
        onNotificar(res.erro ?? "Erro ao gerar figura.", "erro");
        return;
      }

      const ext = res.extensao ?? formato;
      const salvo = await salvarArquivoComDialogo(
        res.nome_sugerido ?? `Figura_${dpi}DPI.${ext}`,
        res.conteudo_b64,
        true,
        `Figura Científica (${dpi} DPI) (*.${ext})`,
        ext
      );

      if (salvo) {
        onNotificar(`${t.toast_saved_at} ${salvo}`, "sucesso");
        onFechar();
      }
    } catch (e) {
      onNotificar(`Erro ao exportar figura: ${e}`, "erro");
    } finally {
      setExportando(false);
    }
  };

  return (
    <Modal
      titulo={
        idiomaInicial === "en"
          ? "Export Publication Figure (300 / 600 DPI)"
          : idiomaInicial === "es"
          ? "Exportar Figura para Publicación (300 / 600 DPI)"
          : "Exportar Figura para Publicação (300 / 600 DPI)"
      }
      subtitulo={`Amostra: ${amostra.relatorio.Arquivo}`}
      icone={<ImageIcon size={20} />}
      larguraMax={720}
      onFechar={onFechar}
      rodape={
        <>
          <button type="button" className="btn btn-ghost" onClick={onFechar}>
            {idiomaInicial === "en" ? "Cancel" : idiomaInicial === "es" ? "Cancelar" : "Cancelar"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={exportando}
            onClick={handleExportar}
          >
            <DownloadIcon size={15} />
            <span>
              {exportando
                ? "Gerando figura..."
                : `Salvar Figura (${dpi} DPI .${formato.toUpperCase()})`}
            </span>
          </button>
        </>
      }
    >
      <p className="modal-lead-text">
        A figura será exportada com metadados físicos de resolução (DPI), legenda TrueType
        acentuada com <b>IC 95% de Wilson</b> e barra de escala micrométrica calibrada.
      </p>

      <div className="pub-form-grid">
        <label className="field">
          <span className="field-label">Formato do Arquivo</span>
          <select
            className="select"
            value={formato}
            onChange={(e) => setFormato(e.target.value as any)}
          >
            <option value="png">PNG sem perda (300/600 DPI)</option>
            <option value="tiff">TIFF Científico LZW/Deflate (300/600 DPI)</option>
            <option value="pdf">PDF Vetorial / Alta Resolução</option>
            <option value="svg">SVG Vetorial Escalável</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">Resolução (Metadata DPI)</span>
          <select
            className="select"
            value={dpi}
            onChange={(e) => setDpi(Number(e.target.value) as 300 | 600)}
          >
            <option value={300}>300 DPI (Padrão Periódicos)</option>
            <option value={600}>600 DPI (Alta Definição / Impressão)</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">Idioma da Legenda na Figura</span>
          <select
            className="select"
            value={idiomaFig}
            onChange={(e) => setIdiomaFig(e.target.value as Idioma)}
          >
            <option value="pt">Português (PT-BR)</option>
            <option value="en">English (EN-US)</option>
            <option value="es">Español (ES)</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">Tema do Painel / Fundo</span>
          <select
            className="select"
            value={temaFundo}
            onChange={(e) => setTemaFundo(e.target.value as "escuro" | "claro")}
          >
            <option value="escuro">Tema Escuro (#0b1215)</option>
            <option value="claro">Tema Claro (Fundo Branco para Artigo)</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">Calibração (µm / pixel)</span>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              className="input"
              placeholder="Ex: 0.65 (vazio = sem barra)"
              value={umPorPixel}
              onChange={(e) => setUmPorPixel(e.target.value)}
            />
            <select
              className="select"
              style={{ width: 120, flexShrink: 0 }}
              value=""
              onChange={(e) => {
                if (e.target.value) setUmPorPixel(e.target.value);
              }}
            >
              <option value="">Objetiva...</option>
              <option value="0.65">10x (0.65)</option>
              <option value="0.325">20x (0.325)</option>
              <option value="0.1625">40x (0.163)</option>
              <option value="">Sem escala</option>
            </select>
          </div>
        </label>

        <label className="field">
          <span className="field-label">Comprimento da Barra de Escala (µm)</span>
          <input
            type="number"
            className="input"
            min={5}
            max={500}
            step={10}
            value={tamanhoBarraUm}
            onChange={(e) => setTamanhoBarraUm(e.target.value)}
          />
        </label>
      </div>

      <div className="pub-toggles-box">
        <label className="field field-row">
          <span className="field-label">Exibir contornos de segmentação nas células</span>
          <span className="switch">
            <input
              type="checkbox"
              checked={mostrarContornos}
              onChange={(e) => setMostrarContornos(e.target.checked)}
            />
            <span className="switch-track"></span>
          </span>
        </label>

        <label className="field field-row">
          <span className="field-label">
            Painel composto lado a lado (<b>A · Original | B · Processada</b>)
          </span>
          <span className="switch">
            <input
              type="checkbox"
              checked={ladoALado}
              onChange={(e) => setLadoALado(e.target.checked)}
            />
            <span className="switch-track"></span>
          </span>
        </label>

        <label className="field field-row">
          <span className="field-label">
            Paleta amigável a daltonismo (Okabe-Ito: Azul-Ciano / Magenta)
          </span>
          <span className="switch">
            <input
              type="checkbox"
              checked={paletaDaltonismo}
              onChange={(e) => setPaletaDaltonismo(e.target.checked)}
            />
            <span className="switch-track"></span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
