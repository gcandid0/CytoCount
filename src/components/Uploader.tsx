import { useRef, useState } from "react";
import { Idioma, TEXTOS } from "../lib/i18n";
import { selecionarPastaEListarImagens } from "../lib/api";
import { FolderOpenIcon, LayersIcon, PlusCircleIcon, XIcon } from "./Icons";

const EXTENSOES_ACEITAS = [".bmp", ".png", ".jpg", ".jpeg", ".tif", ".tiff"];

interface Props {
  onArquivosSelecionados: (arquivos: File[]) => void;
  onCarregarExemplo?: () => void;
  onAbrirMergeCanais?: () => void;
  onErroToast?: (msg: string) => void;
  desabilitado: boolean;
  arquivosSelecionados: File[];
  nomesProcessados?: Set<string>;
  idioma: Idioma;
}

export default function Uploader({
  onArquivosSelecionados,
  onCarregarExemplo,
  onAbrirMergeCanais,
  onErroToast,
  desabilitado,
  arquivosSelecionados,
  nomesProcessados,
  idioma,
}: Props) {
  const [arrastando, setArrastando] = useState(false);
  const [carregandoPasta, setCarregandoPasta] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const t = TEXTOS[idioma];

  const filtrarImagens = (files: FileList | File[]) => {
    return Array.from(files).filter((f) => {
      const lower = f.name.toLowerCase();
      return EXTENSOES_ACEITAS.some((ext) => lower.endsWith(ext));
    });
  };

  const adicionarLista = (novos: File[]) => {
    if (novos.length === 0) return;
    const existentes = new Set(arquivosSelecionados.map((f) => `${f.name}_${f.size}`));
    const unicos = novos.filter((f) => !existentes.has(`${f.name}_${f.size}`));
    onArquivosSelecionados([...arquivosSelecionados, ...unicos]);
  };

  const handleSelecionarPastaNativa = async () => {
    if (desabilitado || carregandoPasta) return;
    setCarregandoPasta(true);
    try {
      const arquivosNativos = await selecionarPastaEListarImagens();
      if (arquivosNativos !== null) {
        if (arquivosNativos.length === 0) {
          onErroToast?.("Nenhuma imagem compatível (.png, .tif, .bmp, .jpg) encontrada na pasta.");
        } else {
          adicionarLista(arquivosNativos);
        }
        return;
      }
      folderRef.current?.click();
    } catch (e) {
      onErroToast?.(`Erro ao ler pasta: ${e}`);
    } finally {
      setCarregandoPasta(false);
    }
  };

  const remover = (idx: number) => {
    const novo = arquivosSelecionados.filter((_, i) => i !== idx);
    onArquivosSelecionados(novo);
  };

  const qtd = arquivosSelecionados.length;
  const labelContagem =
    qtd === 1 ? t.files_selected_one : `${qtd} ${t.files_selected_many}`;

  return (
    <>
      <div
        id="dropzone"
        className={`dropzone${arrastando ? " dragover" : ""}${desabilitado ? " disabled" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!desabilitado) setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          if (desabilitado) return;
          adicionarLista(filtrarImagens(e.dataTransfer.files));
        }}
        onClick={() => !desabilitado && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={EXTENSOES_ACEITAS.join(",")}
          hidden
          disabled={desabilitado}
          onChange={(e) => {
            if (e.target.files) adicionarLista(filtrarImagens(e.target.files));
            e.target.value = "";
          }}
        />
        <input
          ref={folderRef}
          type="file"
          multiple
          // @ts-expect-error webkitdirectory fallback
          webkitdirectory=""
          directory=""
          hidden
          disabled={desabilitado}
          onChange={(e) => {
            if (e.target.files) adicionarLista(filtrarImagens(e.target.files));
            e.target.value = "";
          }}
        />
        <svg viewBox="0 0 24 24" className="dropzone-icon" aria-hidden="true">
          <path
            d="M12 16V4M12 4l-4 4M12 4l4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p>
          <strong>{t.drop_title_bold}</strong> {t.drop_title_rest}
        </p>
        <span className="dropzone-hint">{t.drop_hint}</span>
      </div>

      <div className="upload-actions-row">
        <button
          type="button"
          className="btn btn-secondary btn-upload-sub"
          disabled={desabilitado}
          onClick={() => inputRef.current?.click()}
        >
          <PlusCircleIcon size={14} />
          <span>{t.btn_add_files}</span>
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-upload-sub"
          disabled={desabilitado || carregandoPasta}
          onClick={handleSelecionarPastaNativa}
        >
          <FolderOpenIcon size={14} />
          <span>{carregandoPasta ? "..." : t.btn_add_folder}</span>
        </button>
      </div>

      {onAbrirMergeCanais && (
        <button
          type="button"
          className="btn btn-secondary btn-upload-merge"
          disabled={desabilitado}
          onClick={onAbrirMergeCanais}
        >
          <LayersIcon size={14} />
          <span>{t.btn_merge_channels}</span>
        </button>
      )}

      {onCarregarExemplo && (
        <div className="sample-discrete-row">
          <button
            type="button"
            className="sample-discrete-link"
            disabled={desabilitado}
            onClick={onCarregarExemplo}
          >
            {t.link_load_sample}
          </button>
        </div>
      )}

      {qtd > 0 && (
        <>
          <div className="file-list-header">
            <span>{labelContagem}</span>
            {!desabilitado && (
              <button
                type="button"
                className="btn btn-ghost btn-sm file-clear-all"
                onClick={() => onArquivosSelecionados([])}
              >
                {t.clear_list}
              </button>
            )}
          </div>
          <ul className="file-list">
            {arquivosSelecionados.map((f, i) => {
              const processado = nomesProcessados?.has(f.name);
              return (
                <li key={`${f.name}-${i}`}>
                  <span
                    className={`file-status-dot ${processado ? "done" : "pending"}`}
                    title={processado ? "Processado" : "Pendente"}
                  />
                  <span className="file-item-name" title={f.name}>
                    {f.name}
                  </span>
                  {!desabilitado && (
                    <button
                      type="button"
                      className="file-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        remover(i);
                      }}
                      aria-label={`Remover ${f.name}`}
                    >
                      <XIcon size={12} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
