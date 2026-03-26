use std::future::pending;
use std::process::ExitCode;
use tokio::net::TcpListener;
use tokio::runtime::Builder;
use tracing::{info, warn};
use wxapp_checkin_backend_rust::api;
use wxapp_checkin_backend_rust::app_state::AppState;
use wxapp_checkin_backend_rust::config::Config;
use wxapp_checkin_backend_rust::error::AppError;

fn main() -> ExitCode {
  if let Err(error) = bootstrap() {
    eprintln!("{error}");
    return ExitCode::from(1);
  }

  ExitCode::SUCCESS
}

fn bootstrap() -> Result<(), AppError> {
  let config = Config::from_env()?;
  init_tracing();

  // 这里显式自己建 tokio runtime，而不是直接用 #[tokio::main]：
  // 目标是把线程数纳入配置，优先服务 400M RAM 的低常驻内存约束。
  let runtime = Builder::new_multi_thread()
    .worker_threads(config.tokio_worker_threads.max(1))
    .enable_all()
    .build()
    .map_err(|error| AppError::internal(format!("创建 tokio runtime 失败：{error}")))?;

  runtime.block_on(async move { run(config).await })
}

async fn run(config: Config) -> Result<(), AppError> {
  let address = config.bind_address();
  let state = AppState::new(config.clone())?;
  let app = api::build_router(state);
  let listener = TcpListener::bind(address)
    .await
    .map_err(|error| AppError::internal(format!("监听地址 {address} 失败：{error}")))?;

  info!(
    server_port = config.server_port,
    tokio_worker_threads = config.tokio_worker_threads,
    mysql_max_connections = config.mysql_max_connections,
    "backend-rust 启动完成"
  );

  axum::serve(listener, app)
    .with_graceful_shutdown(shutdown_signal())
    .await
    .map_err(|error| AppError::internal(format!("axum serve 失败：{error}")))
}

fn init_tracing() {
  let _ = tracing_subscriber::fmt()
    .with_target(false)
    .compact()
    .with_env_filter(
      tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "info,sqlx=warn,tower_http=warn".into()),
    )
    .try_init();
}

/// Docker/Compose 停容器时通常先发 `SIGTERM`，本地前台运行时更常见的是 `CTRL-C`。
/// 这里统一监听两类信号，让 axum 有机会把已接入连接平稳收尾，而不是直接中断。
async fn shutdown_signal() {
  let ctrl_c = async {
    if let Err(error) = tokio::signal::ctrl_c().await {
      warn!(error = %error, "监听 CTRL-C 失败，优雅关停将只依赖其它信号");
      pending::<()>().await;
    }
  };

  #[cfg(unix)]
  let terminate = async {
    match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
      Ok(mut signal) => {
        signal.recv().await;
      }
      Err(error) => {
        warn!(error = %error, "监听 SIGTERM 失败，优雅关停将只依赖 CTRL-C");
        pending::<()>().await;
      }
    }
  };

  #[cfg(not(unix))]
  let terminate = pending::<()>();

  tokio::select! {
    _ = ctrl_c => {}
    _ = terminate => {}
  }

  info!("收到关停信号，开始优雅关停");
}
