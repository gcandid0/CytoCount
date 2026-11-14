import { useRef, useState } from "react";
import {
  Parametros,
  ResultadoProcessamento,
  mesclarCanaisAPI,
} from "../lib/api";
import { Idioma } from "../lib/i18n";
import { EyeIcon, LayersIcon, PlusCircleIcon, XIcon } from "./Icons_extra";
import { CheckIcon } from "./Icons";

type CanalAtribuido = "azul" | "verde" | "amarelo" | "multicanal" | "ignorar";

interface ArquivoCanal {
  file: File;
  canal: CanalAtribuido;
  corHex: string;
}

function detectarCanalPorNome(nome: string): { canal: CanalAtribuido; corHex: string } {
  const u = nome.toUpperCase();
  if (/(DAPI|HOECHST|BLUE|AZUL|_C0\b|_CH0\b|_W1\b)/.test(u)) {
    return { canal: "azul", corHex: "#3b82f6" };
  }
  if (/(FITC|GFP|CALCEIN|GREEN|VERDE|LIVE|_C1\b|_CH1\b|_W2\b)/.test(u)) {
    return { canal: "verde", corHex: "#10b981" };
  }
  if (/(PI\b|_PI|RFP|TRITC|ETHIDIUM|RED|VERMELHO|AMARELO|DEAD|_C2\b|_CH2\b|_W3\b)/.test(u)) {
    return { canal: "amarelo", corHex: "#f59e0b" };
  }
  if (/(MULTI|COMPOSITE|MERGE)/.test(u)) {
    return { canal: "multicanal", corHex: "#a855f7" };
  }
  return { canal: "azul", corHex: "#3b82f6" };
}

export default function ModalMesclarCanais({
  onFechar,
  parametros,
  idioma,
  onResultadoMerge,
  onErroToast,
}: {
  onFechar: () => void;
  parametros: Parametros;
  idioma: Idioma;
  onResultadoMerge: (res: ResultadoProcessamento) => void;
  onErroToast: (msg: string) => void;
}) {
  const [itens, setItens] = useState<ArquivoCanal[]>([]);
  const [nomeAmostra, setNomeAmostra] = useState("Merge_Fluorescencia.tif");
  const [previewB64, setPreviewB64] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const adicionarArquivos = (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;

    const canaisPadrao: Array<{ canal: CanalAtribuido; corHex: string }> = [
      { canal: "azul", corHex: "#3b82f6" },
      { canal: "verde", corHex: "#10b981" },
      { canal: "amarelo", corHex: "#f59e0b" },
    ];

    const novos: ArquivoCanal[] = arr.map((f, idx) => {
      const det = detectarCanalPorNome(f.name);
      // Se o nome não tiver sufixo explícito, distribui em ordem Azul, Verde, Amarelo
      const temSufixo = /(DAPI|HOECHST|BLUE|FITC|GFP|CALCEIN|PI|_C0|_C1|_C2|RFP|TRITC)/i.test(
        f.name
      );
      if (temSufixo) return { file: f, ...det };
      const fallback = canaisPadrao[(itens.length + idx) % 3];
      return { file: f, ...fallback };
    });

    const combinados = [...itens, ...novos];
    setItens(combinados);

    if (combinados.length > 0 && nomeAmostra === "Merge_Fluorescencia.tif") {
      const base = combinados[0].file.name
        .replace(/(_DAPI|_FITC|_GFP|_PI|_RFP|_C0|_C1|_C2)?\.[^.]+$/i, "");
      if (base) setNomeAmostra(`${base}_Merge.tif`);
    }
  };

  const atualizarItem = (idx: number, patch: Partial<ArquivoCanal>) => {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const montarArquivosPorCanal = () => {
    const arquivoAzul = itens.find((i) => i.canal === "azul")?.file ?? null;
    const arquivoVerde = itens.find((i) => i.canal === "verde")?.file ?? null;
    const arquivoAmarelo = itens.find((i) => i.canal === "amarelo")?.file ?? null;
    const arquivoMulticanal = itens.find((i) => i.canal === "multicanal")?.file ?? null;
    return { arquivoAzul, arquivoVerde, arquivoAmarelo, arquivoMulticanal };
  };

  const handleGerarPreview = async () => {
    const { arquivoAzul, arquivoVerde, arquivoAmarelo, arquivoMulticanal } =
      montarArquivosPorCanal();
    if (!arquivoAzul && !arquivoVerde && !arquivoAmarelo && !arquivoMulticanal) {
      onErroToast("Atribua ao menos um arquivo a um canal válido.");
      return;
    }
    setCarregando(true);
    try {
      const res = await mesclarCanaisAPI({
        arquivoAzul,
        arquivoVerde,
        arquivoAmarelo,
        arquivoMulticanal,
        apenasPreview: true,
        nomeAmostra,
        parametros,
        idioma,
      });
      if (res.erro) {
        onErroToast(res.erro);
      } else if (res.preview_png_b64) {
        setPreviewB64(res.preview_png_b64);
      }
    } catch (e) {
      onErroToast(`Falha ao gerar pré-visualização: ${e}`);
    } finally {
      setCarregando(false);
    }
  };

  const handleProcessarMerge = async () => {
    const { arquivoAzul, arquivoVerde, arquivoAmarelo, arquivoMulticanal } =
      montarArquivosPorCanal();
    if (!arquivoAzul && !arquivoMulticanal) {
      onErroToast("É necessário atribuir o canal de núcleos (DAPI / Azul) ou um TIFF multicanal.");
      return;
    }
    setCarregando(true);
    try {
      const res = await mesclarCanaisAPI({
        arquivoAzul,
        arquivoVerde,
        arquivoAmarelo,
        arquivoMulticanal,
        apenasPreview: false,
        nomeAmostra,
        parametros,
        idioma,
      });
      if (res.erro) {
        onErroToast(res.erro);
      } else {
        onResultadoMerge(res);
        onFechar();
      }
    } catch (e) {
      onErroToast(`Erro ao processar merge de canais: ${e}`);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div
        className="modal-card modal-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LayersIcon size={18} />
            <h2>Mesclar Canais de Fluorescência (8 / 16-bit)</h2>
          </div>
          <button type="button" className="modal-close" onClick={onFechar}>
            <XIcon size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="field-help" style={{ marginBottom: 12 }}>
            Selecione imagens monocromáticas separadas (ex.: <code>_DAPI</code>,{" "}
            <code>_FITC</code>, <code>_PI</code>, <code>_C0/_C1/_C2</code>) ou um arquivo{" "}
            <b>TIFF multicanal de 16 bits</b>. A faixa dinâmica de 16 bits é preservada durante a segmentação.
          </p>

          <div className="merge-top-controls">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".tif,.tiff,.png,.bmp,.jpg,.jpeg"
              hidden
              onChange={(e) => {
                if (e.target.files) adicionarArquivos(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => inputRef.current?.click()}
            >
              <PlusCircleIcon size={14} />
              <span>Selecionar Arquivos de Canal</span>
            </button>

            <label className="merge-name-field">
              <span>Nome da amostra composta:</span>
              <input
                type="text"
                className="input"
                value={nomeAmostra}
                onChange={(e) => setNomeAmostra(e.target.value)}
              />
            </label>
          </div>

          {itens.length > 0 && (
            <div className="merge-files-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Arquivo</th>
                    <th>Canal Atribuído</th>
                    <th>Cor de Exibição</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it, idx) => (
                    <tr key={`${it.file.name}-${idx}`}>
                      <td>{it.file.name}</td>
                      <td>
                        <select
                          className="select"
                          value={it.canal}
                          onChange={(e) => {
                            const c = e.target.value as CanalAtribuido;
                            const corPadrao =
                              c === "azul"
                                ? "#3b82f6"
                                : c === "verde"
                                ? "#10b981"
                                : c === "amarelo"
                                ? "#f59e0b"
                                : "#a855f7";
                            atualizarItem(idx, { canal: c, corHex: corPadrao });
                          }}
                        >
                          <option value="azul">Núcleos Totais (DAPI / Hoechst / Azul)</option>
                          <option value="verde">Células Vivas (FITC / Calceína / Verde)</option>
                          <option value="amarelo">Células Mortas (PI / Etídio / Amarelo-Vermelho)</option>
                          <option value="multicanal">TIFF Multicanal Completo</option>
                          <option value="ignorar">Ignorar arquivo</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="color"
                          value={it.corHex}
                          onChange={(e) => atualizarItem(idx, { corHex: e.target.value })}
                          className="color-picker-input"
                        />
                      </td>
                      <td className="num">
                        <button
                          type="button"
                          className="file-remove"
                          onClick={() => setItens((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <XIcon size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {previewB64 && (
            <div className="merge-preview-box">
              <h4>Pré-visualização do Merge Composto</h4>
              <img
                src={`data:image/png;base64,${previewB64}`}
                alt="Preview Merge"
                className="merge-preview-img"
              />
            </div>
          )}

          <div className="modal-actions-row">
            <button
              type="button"
              className="btn-secondary"
              disabled={carregando || itens.length === 0}
              onClick={handleGerarPreview}
            >
              <EyeIcon size={15} />
              <span>{carregando ? "Gerando..." : "Pré-visualizar Merge"}</span>
            </button>

            <button
              type="button"
              className="btn-primary"
              disabled={carregando || itens.length === 0}
              style={{ width: "auto", padding: "0 20px" }}
              onClick={handleProcessarMerge}
            >
              <CheckIcon size={15} />
              <span>{carregando ? "Processando..." : "Mesclar e Analisar Amostra"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
