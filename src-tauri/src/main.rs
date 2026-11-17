// Ponto de entrada do lado nativo do CytoCount v1.1.0.
//
// Responsabilidades:
// 1. Gerenciar o ciclo de vida do backend Python (sidecar viacell-backend)
//    - Alocação dinâmica de porta (evita conflitos de porta ocupada)
//    - Supervisão ativa com reinício automático (máx. 3 tentativas)
//    - Windows Job Object para encerramento garantido de processos-filhos
//    - Roteamento de logs stdout/stderr e eventos do frontend para arquivo rotativo
// 2. Expor comandos nativos (diálogos de pasta, "Salvar como", config.json, logs e reinício do motor).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::VecDeque;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

struct BackendState {
    port: Arc<Mutex<u16>>,
    child: Arc<Mutex<Option<CommandChild>>>,
    recent_logs: Arc<Mutex<VecDeque<String>>>,
    log_file_path: PathBuf,
    config_file_path: PathBuf,
    consecutive_restarts: Arc<AtomicU32>,
}

#[tauri::command]
fn get_backend_url(state: tauri::State<BackendState>) -> String {
    let p = state.port.lock().map(|l| *l).unwrap_or(8756);
    format!("http://127.0.0.1:{p}")
}

#[tauri::command]
fn get_backend_port(state: tauri::State<BackendState>) -> u16 {
    state.port.lock().map(|l| *l).unwrap_or(8756)
}

#[tauri::command]
fn get_backend_logs(state: tauri::State<BackendState>) -> Vec<String> {
    if let Ok(logs) = state.recent_logs.lock() {
        logs.iter().cloned().collect()
    } else {
        Vec::new()
    }
}

#[tauri::command]
fn get_log_path(state: tauri::State<BackendState>) -> String {
    state.log_file_path.to_string_lossy().to_string()
}

#[tauri::command]
fn registrar_log_frontend(
    state: tauri::State<BackendState>,
    nivel: String,
    mensagem: String,
) -> Result<(), String> {
    let prefix = format!("[frontend:{}]", nivel.to_lowercase());
    log_line(&state.log_file_path, &state.recent_logs, &prefix, &mensagem);
    Ok(())
}

#[tauri::command]
fn abrir_pasta_logs(state: tauri::State<BackendState>) -> Result<(), String> {
    if let Some(parent) = state.log_file_path.parent() {
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("explorer")
                .arg(parent)
                .spawn();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn();
        }
    }
    Ok(())
}

#[tauri::command]
async fn reiniciar_backend(
    app: tauri::AppHandle,
    state: tauri::State<'_, BackendState>,
) -> Result<String, String> {
    log_line(
        &state.log_file_path,
        &state.recent_logs,
        "[main]",
        "Solicitação de reinício manual do motor Python.",
    );

    // Encerra child anterior
    if let Ok(mut lock) = state.child.lock() {
        if let Some(child) = lock.take() {
            let _ = child.kill();
        }
    }

    let nova_porta = find_available_port(8757, 50);
    if let Ok(mut p) = state.port.lock() {
        *p = nova_porta;
    }

    state.consecutive_restarts.store(0, Ordering::SeqCst);

    spawn_sidecar_process(&app, &state, nova_porta)?;

    let url = format!("http://127.0.0.1:{nova_porta}");
    let _ = app.emit("backend-status", serde_json::json!({
        "online": true,
        "url": url,
        "msg": "Motor reiniciado com sucesso."
    }));

    Ok(url)
}

#[tauri::command]
fn get_user_config(state: tauri::State<BackendState>) -> Result<String, String> {
    if state.config_file_path.exists() {
        fs::read_to_string(&state.config_file_path)
            .map_err(|e| format!("Falha ao ler config.json: {e}"))
    } else {
        Ok("{}".to_string())
    }
}

#[tauri::command]
fn save_user_config(
    state: tauri::State<BackendState>,
    config_json: String,
) -> Result<String, String> {
    if let Some(parent) = state.config_file_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&state.config_file_path, config_json.as_bytes())
        .map_err(|e| format!("Falha ao salvar config.json: {e}"))?;
    Ok(state.config_file_path.to_string_lossy().to_string())
}

fn decode_base64_simple(input: &str) -> Result<Vec<u8>, String> {
    let mut out = Vec::with_capacity(input.len() * 3 / 4);
    let mut buf: u32 = 0;
    let mut bits: u8 = 0;

    for b in input.bytes() {
        let val = match b {
            b'A'..=b'Z' => b - b'A',
            b'a'..=b'z' => b - b'a' + 26,
            b'0'..=b'9' => b - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            b'=' => break,
            b' ' | b'\n' | b'\r' | b'\t' => continue,
            _ => return Err(format!("Caractere base64 inválido: {}", b as char)),
        };
        buf = (buf << 6) | (val as u32);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push(((buf >> bits) & 0xFF) as u8);
        }
    }
    Ok(out)
}

#[tauri::command]
fn salvar_arquivo_dialogo(
    state: tauri::State<BackendState>,
    nome_padrao: String,
    conteudo: String,
    eh_base64: bool,
    filtro_nome: String,
    extensao: String,
) -> Result<Option<String>, String> {
    let ext_clean = extensao.trim_start_matches('.').to_string();
    let dialog = rfd::FileDialog::new()
        .set_file_name(&nome_padrao)
        .add_filter(&filtro_nome, &[&ext_clean]);

    let Some(path) = dialog.save_file() else {
        return Ok(None);
    };

    let bytes = if eh_base64 {
        decode_base64_simple(&conteudo)?
    } else {
        conteudo.into_bytes()
    };

    fs::write(&path, &bytes).map_err(|e| {
        let msg = format!("Erro ao gravar arquivo em {}: {e}", path.display());
        log_line(&state.log_file_path, &state.recent_logs, "[erro]", &msg);
        msg
    })?;

    let saved_str = path.to_string_lossy().to_string();
    log_line(
        &state.log_file_path,
        &state.recent_logs,
        "[export]",
        &format!("Arquivo salvo com sucesso em: {saved_str}"),
    );
    Ok(Some(saved_str))
}

#[derive(serde::Serialize)]
struct ArquivoInfo {
    nome: String,
    caminho: String,
    tamanho: u64,
}

#[tauri::command]
fn selecionar_pasta() -> Result<Option<String>, String> {
    let folder = rfd::FileDialog::new()
        .set_title("Selecionar pasta com imagens de microscopia")
        .pick_folder();

    Ok(folder.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
fn listar_imagens_pasta(caminho_pasta: String) -> Result<Vec<ArquivoInfo>, String> {
    let path = std::path::Path::new(&caminho_pasta);
    if !path.is_dir() {
        return Err("O caminho especificado não é uma pasta válida.".to_string());
    }

    let extensoes = ["bmp", "png", "jpg", "jpeg", "tif", "tiff"];
    let mut arquivos = Vec::new();

    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                    if extensoes.iter().any(|&e| e.eq_ignore_ascii_case(ext)) {
                        let nome = p.file_name().unwrap_or_default().to_string_lossy().to_string();
                        let tamanho = entry.metadata().map(|m| m.len()).unwrap_or(0);
                        arquivos.push(ArquivoInfo {
                            nome,
                            caminho: p.to_string_lossy().to_string(),
                            tamanho,
                        });
                    }
                }
            }
        }
    }

    arquivos.sort_by(|a, b| a.nome.to_lowercase().cmp(&b.nome.to_lowercase()));
    Ok(arquivos)
}

#[tauri::command]
fn ler_arquivo_bytes(caminho: String) -> Result<Vec<u8>, String> {
    std::fs::read(&caminho).map_err(|e| format!("Erro ao ler arquivo: {e}"))
}

fn is_port_in_use(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_err()
}

fn is_backend_responsive(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    if let Ok(stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(300)) {
        drop(stream);
        return true;
    }
    false
}

fn find_available_port(start: u16, max_attempts: u16) -> u16 {
    for port in start..(start + max_attempts) {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return port;
        }
    }
    start
}

fn log_line(
    file_path: &PathBuf,
    recent_logs: &Arc<Mutex<VecDeque<String>>>,
    prefix: &str,
    msg: &str,
) {
    let clean_msg = msg.trim_end();
    if clean_msg.is_empty() {
        return;
    }

    let timestamp = chrono_lite_timestamp();
    let formatted = format!("[{timestamp}] {prefix} {clean_msg}");

    if let Ok(mut logs) = recent_logs.lock() {
        if logs.len() >= 150 {
            logs.pop_front();
        }
        logs.push_back(formatted.clone());
    }

    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(file_path) {
        let _ = writeln!(f, "{formatted}");
    }
}

fn chrono_lite_timestamp() -> String {
    match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        Ok(d) => {
            let secs = d.as_secs();
            let hours = (secs / 3600) % 24;
            let mins = (secs / 60) % 60;
            let s = secs % 60;
            format!("{:02}:{:02}:{:02}", hours, mins, s)
        }
        Err(_) => "00:00:00".to_string(),
    }
}

fn instalar_panic_hook(log_file_path: PathBuf) {
    std::panic::set_hook(Box::new(move |info| {
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "desconhecido".into());
        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            (*s).to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Pânico sem mensagem".to_string()
        };
        let msg = format!("[FATAL PANIC] em {location}: {payload}");
        eprintln!("{msg}");
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&log_file_path) {
            let _ = writeln!(f, "[{}] {msg}", chrono_lite_timestamp());
        }
    }));
}

#[cfg(target_os = "windows")]
fn configurar_job_object_cleanup() {
    use std::os::windows::raw::HANDLE;
    #[repr(C)]
    struct IO_COUNTERS {
        read_operation_count: u64,
        write_operation_count: u64,
        other_operation_count: u64,
        read_transfer_count: u64,
        write_transfer_count: u64,
        other_transfer_count: u64,
    }
    #[repr(C)]
    struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
        per_process_user_time_limit: i64,
        per_job_user_time_limit: i64,
        limit_flags: u32,
        minimum_working_set_size: usize,
        maximum_working_set_size: usize,
        active_process_limit: u32,
        affinity: usize,
        priority_class: u32,
        scheduling_class: u32,
    }
    #[repr(C)]
    struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        basic_limit_information: JOBOBJECT_BASIC_LIMIT_INFORMATION,
        io_info: IO_COUNTERS,
        process_memory_limit: usize,
        job_memory_limit: usize,
        peak_process_memory_used: usize,
        peak_job_memory_used: usize,
    }
    extern "system" {
        fn CreateJobObjectW(lp_job_attributes: *mut std::ffi::c_void, lp_name: *const u16) -> HANDLE;
        fn SetInformationJobObject(
            h_job: HANDLE,
            job_object_info_class: u32,
            lp_job_object_info: *mut std::ffi::c_void,
            cb_job_object_info_length: u32,
        ) -> i32;
        fn AssignProcessToJobObject(h_job: HANDLE, h_process: HANDLE) -> i32;
        fn GetCurrentProcess() -> HANDLE;
    }
    unsafe {
        let job = CreateJobObjectW(std::ptr::null_mut(), std::ptr::null());
        if !job.is_null() {
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: u32 = 0x00002000;
            const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION: u32 = 9;
            info.basic_limit_information.limit_flags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            let ok = SetInformationJobObject(
                job,
                JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
                &mut info as *mut _ as *mut std::ffi::c_void,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );
            if ok != 0 {
                let _ = AssignProcessToJobObject(job, GetCurrentProcess());
            }
        }
    }
}

fn spawn_sidecar_process(
    app: &tauri::AppHandle,
    state: &BackendState,
    port: u16,
) -> Result<(), String> {
    let shell = app.shell();
    let sidecar_command = shell
        .sidecar("viacell-backend")
        .map_err(|e| format!("Binário viacell-backend não localizado: {e}"))?;

    let parent_pid = std::process::id().to_string();
    let port_str = port.to_string();
    let cmd = sidecar_command.args(["--port", &port_str, "--parent-pid", &parent_pid]);

    let (mut rx, child) = cmd
        .spawn()
        .map_err(|e| format!("Falha ao spawnar sidecar: {e}"))?;

    let child_pid = child.pid();
    log_line(
        &state.log_file_path,
        &state.recent_logs,
        "[main]",
        &format!("Sidecar iniciado com sucesso (PID: {child_pid}). Porta: {port}."),
    );

    if let Ok(mut lock) = state.child.lock() {
        *lock = Some(child);
    }

    let log_file_for_task = state.log_file_path.clone();
    let logs_for_task = state.recent_logs.clone();
    let app_handle_for_task = app.clone();
    let restart_counter = state.consecutive_restarts.clone();
    let child_holder = state.child.clone();
    let port_state = state.port.clone();

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let s = String::from_utf8_lossy(&bytes);
                    log_line(&log_file_for_task, &logs_for_task, "[backend stdout]", &s);
                    #[cfg(debug_assertions)]
                    print!("[viacell-backend] {}", s);
                }
                CommandEvent::Stderr(bytes) => {
                    let s = String::from_utf8_lossy(&bytes);
                    log_line(&log_file_for_task, &logs_for_task, "[backend stderr]", &s);
                    #[cfg(debug_assertions)]
                    eprint!("[viacell-backend] {}", s);
                }
                CommandEvent::Terminated(term) => {
                    log_line(
                        &log_file_for_task,
                        &logs_for_task,
                        "[main]",
                        &format!("Processo do backend finalizou com código: {:?}", term.code),
                    );

                    let restarts = restart_counter.fetch_add(1, Ordering::SeqCst);
                    if restarts < 3 {
                        log_line(
                            &log_file_for_task,
                            &logs_for_task,
                            "[supervisor]",
                            &format!("Tentativa de auto-reinício {restarts}/3 do motor..."),
                        );
                        let nova_porta = find_available_port(8757, 50);
                        if let Ok(mut p) = port_state.lock() {
                            *p = nova_porta;
                        }

                        let shell = app_handle_for_task.shell();
                        if let Ok(sidecar_cmd) = shell.sidecar("viacell-backend") {
                            let parent_pid_str = std::process::id().to_string();
                            let p_str = nova_porta.to_string();
                            let cmd_r = sidecar_cmd.args(["--port", &p_str, "--parent-pid", &parent_pid_str]);
                            if let Ok((mut rx_new, new_child)) = cmd_r.spawn() {
                                if let Ok(mut lk) = child_holder.lock() {
                                    *lk = Some(new_child);
                                }
                                let _ = app_handle_for_task.emit("backend-status", serde_json::json!({
                                    "online": true,
                                    "url": format!("http://127.0.0.1:{nova_porta}"),
                                    "msg": "Motor reiniciado automaticamente."
                                }));

                                // Loop para a nova instância
                                while let Some(ev) = rx_new.recv().await {
                                    if let CommandEvent::Stdout(b) = ev {
                                        log_line(&log_file_for_task, &logs_for_task, "[backend stdout]", &String::from_utf8_lossy(&b));
                                    } else if let CommandEvent::Stderr(b) = ev {
                                        log_line(&log_file_for_task, &logs_for_task, "[backend stderr]", &String::from_utf8_lossy(&b));
                                    }
                                }
                                return;
                            }
                        }
                    }

                    // Se não reiniciou ou excedeu tentativas:
                    let _ = app_handle_for_task.emit("backend-status", serde_json::json!({
                        "online": false,
                        "code": term.code,
                        "msg": "O motor de análise parou."
                    }));
                }
                CommandEvent::Error(err) => {
                    log_line(&log_file_for_task, &logs_for_task, "[backend error]", &err);
                }
                _ => {}
            }
        }
    });

    Ok(())
}

fn main() {
    #[cfg(target_os = "windows")]
    configurar_job_object_cleanup();

    let child_holder: Arc<Mutex<Option<CommandChild>>> = Arc::new(Mutex::new(None));
    let recent_logs: Arc<Mutex<VecDeque<String>>> = Arc::new(Mutex::new(VecDeque::new()));
    let port_holder: Arc<Mutex<u16>> = Arc::new(Mutex::new(8756));
    let consecutive_restarts: Arc<AtomicU32> = Arc::new(AtomicU32::new(0));

    let child_holder_cleanup = child_holder.clone();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_backend_url,
            get_backend_port,
            get_backend_logs,
            get_log_path,
            registrar_log_frontend,
            abrir_pasta_logs,
            reiniciar_backend,
            get_user_config,
            save_user_config,
            salvar_arquivo_dialogo,
            selecionar_pasta,
            listar_imagens_pasta,
            ler_arquivo_bytes
        ])
        .on_window_event({
            let child_holder = child_holder.clone();
            move |_window, event| {
                if let tauri::WindowEvent::Destroyed = event {
                    if let Ok(mut lock) = child_holder.lock() {
                        if let Some(child) = lock.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .setup({
            let child_holder = child_holder.clone();
            let recent_logs = recent_logs.clone();
            let port_holder = port_holder.clone();
            let consecutive_restarts = consecutive_restarts.clone();

            move |app| {
                let log_dir = app
                    .path()
                    .app_log_dir()
                    .unwrap_or_else(|_| std::env::temp_dir().join("CytoCount"));
                let _ = fs::create_dir_all(&log_dir);
                let log_file_path = log_dir.join("viacell-backend.log");

                instalar_panic_hook(log_file_path.clone());

                let config_dir = app
                    .path()
                    .app_config_dir()
                    .unwrap_or_else(|_| log_dir.clone());
                let _ = fs::create_dir_all(&config_dir);
                let config_file_path = config_dir.join("config.json");

                log_line(
                    &log_file_path,
                    &recent_logs,
                    "[main]",
                    &format!(
                        "Iniciando CytoCount v1.1.0. Log em: {} | Config em: {}",
                        log_file_path.display(),
                        config_file_path.display()
                    ),
                );

                let default_port = 8756;
                let forcar_reuso_dev = std::env::var("CYTOCOUNT_REUSE_DEV_BACKEND").is_ok();
                let (chosen_port, should_spawn) = if forcar_reuso_dev && is_backend_responsive(default_port) {
                    log_line(
                        &log_file_path,
                        &recent_logs,
                        "[main]",
                        &format!("Backend de desenvolvimento detectado na porta {default_port}. Reutilizando instância ativa."),
                    );
                    (default_port, false)
                } else {
                    let port = if is_port_in_use(default_port) {
                        let alternative = find_available_port(8757, 50);
                        log_line(
                            &log_file_path,
                            &recent_logs,
                            "[main]",
                            &format!("Porta padrão {default_port} indisponível ou ocupada por outro processo. Alocada porta limpa {alternative}."),
                        );
                        alternative
                    } else {
                        default_port
                    };
                    (port, true)
                };

                if let Ok(mut p) = port_holder.lock() {
                    *p = chosen_port;
                }

                let backend_state = BackendState {
                    port: port_holder.clone(),
                    child: child_holder.clone(),
                    recent_logs: recent_logs.clone(),
                    log_file_path: log_file_path.clone(),
                    config_file_path,
                    consecutive_restarts,
                };

                if should_spawn {
                    if let Err(e) = spawn_sidecar_process(&app.handle().clone(), &backend_state, chosen_port) {
                        log_line(
                            &log_file_path,
                            &recent_logs,
                            "[erro]",
                            &format!("Falha ao inicializar sidecar: {e}"),
                        );
                    }
                }

                app.manage(backend_state);

                Ok(())
            }
        })
        .build(tauri::generate_context!());

    match app {
        Ok(app) => {
            app.run(move |_app_handle, event| {
                match event {
                    tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                        if let Ok(mut lock) = child_holder_cleanup.lock() {
                            if let Some(child) = lock.take() {
                                let _ = child.kill();
                            }
                        }
                    }
                    _ => {}
                }
            });
        }
        Err(err) => {
            eprintln!("Erro fatal ao inicializar o CytoCount: {err}");
        }
    }
}
