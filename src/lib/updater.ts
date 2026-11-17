import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";

export interface InfoAtualizacao {
  disponivel: boolean;
  versao?: string;
  data?: string;
  notas?: string;
  updateHandle?: Update;
}

/**
 * Consulta o endpoint configurado no Tauri para checar se há uma nova versão disponível.
 * Se estiver rodando fora do ambiente Tauri (ex: browser puro em dev), retorna { disponivel: false }.
 */
export async function checarAtualizacao(): Promise<InfoAtualizacao> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return { disponivel: false };
  }

  try {
    const update = await check();
    if (update?.available) {
      return {
        disponivel: true,
        versao: update.version,
        data: update.date,
        notas: update.body,
        updateHandle: update,
      };
    }
    return { disponivel: false };
  } catch (error) {
    console.warn("Verificação de atualizações falhou ou não configurada:", error);
    throw error;
  }
}

/**
 * Baixa e aplica o instalador da nova versão em segundo plano e, ao concluir, reinicia o aplicativo.
 */
export async function baixarEInstalarAtualizacao(
  update: Update,
  onProgresso?: (progresso: { baixadoBytes: number; totalBytes: number; pct: number }) => void
): Promise<void> {
  let baixadoBytes = 0;
  let totalBytes = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        totalBytes = event.data.contentLength ?? 0;
        onProgresso?.({
          baixadoBytes: 0,
          totalBytes,
          pct: 0,
        });
        break;
      case "Progress":
        baixadoBytes += event.data.chunkLength;
        const pct =
          totalBytes > 0
            ? Math.min(100, Math.round((baixadoBytes / totalBytes) * 100))
            : 0;
        onProgresso?.({
          baixadoBytes,
          totalBytes,
          pct,
        });
        break;
      case "Finished":
        onProgresso?.({
          baixadoBytes: totalBytes,
          totalBytes,
          pct: 100,
        });
        // Encerra child backend antes que o instalador tente sobrescrever os arquivos
        invoke("fechar_backend_para_atualizacao").catch(() => {});
        break;
    }
  });

  // Reinicia a aplicação para abrir a nova versão instalada (no macOS/Linux)
  await relaunch();
}
