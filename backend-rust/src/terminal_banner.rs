const RESET: &str = "\x1b[0m";
const PURPLE: &str = "\x1b[35m";
const BLUE: &str = "\x1b[34m";
const SUCCESS_LABEL: &str = "[WXAPP-CHECKIN-OK]";
const ERROR_LABEL: &str = "[WXAPP-CHECKIN-ERROR]";

/// 容器日志需要让运维同学一眼扫到“已经就绪”和“哪里失败”。
/// 这里把颜色和标识统一收口，避免 main / API 错误各自手写终端样式。
pub fn print_success(message: impl AsRef<str>) {
  println!("{}", format_success(message.as_ref()));
}

/// 错误日志统一走蓝色标识：
/// - 终端里比 tracing 的普通行更醒目；
/// - Docker 日志采集时也能稳定搜到同一个前缀。
pub fn print_error(stage: impl AsRef<str>, message: impl AsRef<str>) {
  eprintln!("{}", format_error(stage.as_ref(), message.as_ref()));
}

pub fn format_success(message: &str) -> String {
  format!("{PURPLE}{SUCCESS_LABEL}{RESET} {message}")
}

pub fn format_error(stage: &str, message: &str) -> String {
  format!("{BLUE}{ERROR_LABEL}{RESET} {stage}: {message}")
}

#[cfg(test)]
mod tests {
  use super::{format_error, format_success};

  #[test]
  fn success_banner_should_keep_purple_marker() {
    let banner = format_success("数据库连接成功");
    assert!(banner.contains("\x1b[35m[WXAPP-CHECKIN-OK]\x1b[0m"));
    assert!(banner.contains("数据库连接成功"));
  }

  #[test]
  fn error_banner_should_keep_blue_marker() {
    let banner = format_error("启动预检失败", "缺少关键表");
    assert!(banner.contains("\x1b[34m[WXAPP-CHECKIN-ERROR]\x1b[0m"));
    assert!(banner.contains("启动预检失败: 缺少关键表"));
  }
}
