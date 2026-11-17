import { useState } from "react";
import { APP_VERSION } from "../lib/api";
import { Idioma, TEXTOS } from "../lib/i18n";
import { baixarEInstalarAtualizacao, InfoAtualizacao } from "../lib/updater";
import { CheckIcon, DownloadIcon, RefreshCwIcon } from "./Icons";
import Modal from "./Modal";

export default function ModalAtualizacao({
  info,
  idioma = "pt",
  onFechar,
  onNotificar,
}: {
  info: InfoAtualizacao;
  idioma?: Idioma;
  onFechar: () => void;
  onNotificar?: (msg: string, tipo?: "sucesso" | "erro" | "info") => void;
}) {
  const t = TEXTOS[idioma];
  const [baixando, setBaixando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [progressoPct, setProgressoPct] = useState(0);
  const [bytesBaixados, setBytesBaixados] = useState(0);
  const [bytesTotal, setBytesTotal] = useState(0);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  const handleAtualizar = async () => {
    if (!info.updateHandle) return;
    try {
      setBaixando(true);
      setErroMsg(null);
      await baixarEInstalarAtualizacao(info.updateHandle, (p) => {
        setProgressoPct(p.pct);
        setBytesBaixados(p.baixadoBytes);
        setBytesTotal(p.totalBytes);
      });
      setConcluido(true);
      onNotificar?.(t.update_ready_restart, "sucesso");
    } catch (e) {
      setBaixando(false);
      const msg = e instanceof Error ? e.message : String(e);
      setErroMsg(msg);
      onNotificar?.(`Erro ao atualizar: ${msg}`, "erro");
    }
  };

  const formatarMB = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1);
  };

  return (
    <Modal
      titulo={t.update_available_title}
      subtitulo={`CytoCount v${info.versao} (Versão instalada: v${APP_VERSION})`}
      icone={<RefreshCwIcon size={20} />}
      larguraMax={560}
      onFechar={onFechar}
      rodape={
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            width: "100%",
          }}
        >
          {!concluido && !baixando && (
            <button type="button" className="btn-secondary" onClick={onFechar}>
              {t.update_btn_later}
            </button>
          )}
          {!concluido && (
            <button
              type="button"
              className="btn-primary"
              disabled={baixando}
              onClick={handleAtualizar}
              style={{ width: "auto", minWidth: 160 }}
            >
              <DownloadIcon size={15} />
              <span>{baixando ? `${progressoPct}%...` : t.update_btn_install}</span>
            </button>
          )}
        </div>
      }
    >
      <div className="update-modal-body">
        {erroMsg && (
          <div className="quality-warning-banner" style={{ marginBottom: 16 }}>
            <strong>Falha na atualização:</strong> {erroMsg}
          </div>
        )}

        {concluido ? (
          <div
            className="update-status-success"
            style={{
              padding: "24px 16px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#064e3b",
                color: "#34d399",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckIcon size={28} />
            </div>
            <h4 style={{ margin: 0, fontSize: 15, color: "#34d399" }}>
              {t.update_ready_restart}
            </h4>
          </div>
        ) : baixando ? (
          <div className="update-progress-container" style={{ padding: "16px 0" }}>
            <p style={{ marginBottom: 10, fontSize: 13, color: "#8b9bb4" }}>
              {t.update_downloading}{" "}
              {bytesTotal > 0 &&
                `(${formatarMB(bytesBaixados)} MB / ${formatarMB(bytesTotal)} MB)`}
            </p>
            <div
              className="update-progress-bar-bg"
              style={{
                width: "100%",
                height: 10,
                background: "#1e293b",
                borderRadius: 5,
                overflow: "hidden",
              }}
            >
              <div
                className="update-progress-bar-fill"
                style={{
                  width: `${Math.max(4, progressoPct)}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #10b981, #34d399)",
                  transition: "width 0.2s ease",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 12,
                color: "#34d399",
                fontFamily: "monospace",
                display: "block",
                marginTop: 8,
              }}
            >
              {progressoPct}% concluído
            </span>
          </div>
        ) : (
          <div className="update-details" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span
                className="mono-tag"
                style={{
                  background: "#064e3b",
                  color: "#34d399",
                  borderColor: "#059669",
                  fontWeight: 600,
                }}
              >
                Nova versão: v{info.versao}
              </span>
              <span className="mono-tag">Instalada: v{APP_VERSION}</span>
              {info.data && (
                <span className="mono-tag" style={{ opacity: 0.75 }}>
                  {info.data.slice(0, 10)}
                </span>
              )}
            </div>

            {info.notas ? (
              <div
                className="update-notes-box"
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid #1e293b",
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                <strong style={{ fontSize: 13, color: "#e2e8f0" }}>
                  O que há de novo:
                </strong>
                <p
                  style={{
                    whiteSpace: "pre-line",
                    margin: "8px 0 0",
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "#94a3b8",
                  }}
                >
                  {info.notas}
                </p>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#8b9bb4", margin: "4px 0" }}>
                Uma nova versão com melhorias e correções está disponível para instalação automática.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
