import { useState } from "react";
import {
  APP_VERSION,
  DiagnosticoBackend,
  salvarArquivoComDialogo,
} from "../lib/api";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  MailIcon,
  MessageSquareIcon,
  XIcon,
} from "./Icons";

export default function ModalFeedback({
  onFechar,
  diagnostico,
  onNotificar,
}: {
  onFechar: () => void;
  diagnostico: DiagnosticoBackend;
  onNotificar: (msg: string, tipo?: "sucesso" | "erro" | "info") => void;
}) {
  const [tipo, setTipo] = useState<"erro" | "sugestao">("erro");
  const [mensagem, setMensagem] = useState("");
  const [email, setEmail] = useState("");
  const [anexarLog, setAnexarLog] = useState(true);
  const [copiado, setCopiado] = useState(false);

  const construirTextoRelatorio = () => {
    const linhas = [
      `=== RELATÓRIO DE FEEDBACK / DIAGNÓSTICO CYTOCOUNT ===`,
      `Versão do Programa: CytoCount v${APP_VERSION}`,
      `Tipo: ${tipo === "erro" ? "Relato de Erro / Bug" : "Sugestão de Melhoria"}`,
      `Data/Hora: ${new Date().toISOString()}`,
      `Sistema / Plataforma: ${navigator.userAgent}`,
      email.trim() ? `E-mail para contato: ${email.trim()}` : `E-mail para contato: (não informado)`,
      ``,
      `--- DESCRIÇÃO DO USUÁRIO ---`,
      mensagem.trim() || "(Sem descrição adicional)",
    ];

    if (anexarLog) {
      linhas.push(
        ``,
        `--- LOGS TÉCNICOS (${diagnostico.logPath || "sessão local"}) ---`,
        ...(diagnostico.logs.length > 0
          ? diagnostico.logs.slice(-40)
          : ["(Nenhum evento de erro registrado no log)"])
      );
    }
    return linhas.join("\n");
  };

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(construirTextoRelatorio());
      setCopiado(true);
      onNotificar("Relatório copiado para a área de transferência!", "sucesso");
      setTimeout(() => setCopiado(false), 3000);
    } catch (e) {
      onNotificar(`Não foi possível copiar automaticamente: ${e}`, "erro");
    }
  };

  const handleSalvarArquivoLocal = async () => {
    try {
      const texto = construirTextoRelatorio();
      const dataStr = new Date().toISOString().slice(0, 10);
      const salvo = await salvarArquivoComDialogo(
        `CytoCount_Relatorio_${tipo}_${dataStr}.txt`,
        texto,
        false,
        "Relatório de Diagnóstico CytoCount (*.txt)",
        "txt"
      );
      if (salvo) {
        onNotificar(`Relatório salvo com sucesso em: ${salvo}`, "sucesso");
      }
    } catch (e) {
      onNotificar(`Erro ao salvar relatório: ${e}`, "erro");
    }
  };

  const handleAbrirEmail = () => {
    try {
      const assunto = encodeURIComponent(
        `[CytoCount v${APP_VERSION}] ${
          tipo === "erro" ? "Relato de Erro" : "Sugestão"
        }`
      );
      // Limita tamanho da URL mailto para evitar bloqueio do cliente de e-mail do sistema
      const corpoCompleto = construirTextoRelatorio();
      const corpoMailto = encodeURIComponent(corpoCompleto.slice(0, 1800));
      window.location.href = `mailto:?subject=${assunto}&body=${corpoMailto}`;
      onNotificar(
        "Cliente de e-mail padrão acionado com o relatório preenchido.",
        "sucesso"
      );
    } catch (e) {
      onNotificar(`Falha ao abrir cliente de e-mail: ${e}`, "erro");
    }
  };

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MessageSquareIcon size={18} />
            <h2>Enviar Feedback ou Relatar Problema</h2>
          </div>
          <button type="button" className="modal-close" onClick={onFechar}>
            <XIcon size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="feedback-grid-2">
            <label className="field">
              <span className="field-label">Tipo de envio</span>
              <select
                className="select"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as "erro" | "sugestao")}
              >
                <option value="erro">Erro / Comportamento inesperado</option>
                <option value="sugestao">Sugestão de melhoria</option>
              </select>
            </label>

            <label className="field">
              <span className="field-label">Seu e-mail (opcional)</span>
              <input
                type="email"
                className="input"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          </div>

          <label className="field" style={{ marginTop: 10 }}>
            <span className="field-label">Mensagem / Passos para reproduzir</span>
            <textarea
              className="input feedback-textarea"
              rows={4}
              placeholder="Descreva o que aconteceu ou sua sugestão para o CytoCount..."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
            />
          </label>

          <label className="welcome-checkbox" style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              checked={anexarLog}
              onChange={(e) => setAnexarLog(e.target.checked)}
            />
            <span>
              Incluir informações do sistema (Versão {APP_VERSION}, SO) e log de diagnóstico
            </span>
          </label>

          <div className="feedback-actions-bar">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopiar}
            >
              {copiado ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
              <span>{copiado ? "Relatório Copiado!" : "Copiar relatório"}</span>
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleSalvarArquivoLocal}
            >
              <DownloadIcon size={15} />
              <span>Salvar relatório (.txt)</span>
            </button>

            <button
              type="button"
              className="btn-primary"
              style={{ width: "auto", padding: "0 16px" }}
              onClick={handleAbrirEmail}
            >
              <MailIcon size={15} />
              <span>Abrir no E-mail (mailto:)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
