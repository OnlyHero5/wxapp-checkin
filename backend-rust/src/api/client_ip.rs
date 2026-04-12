use axum::extract::FromRequestParts;
use axum::http::request::Parts;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClientIp(String);

impl ClientIp {
  pub fn as_str(&self) -> &str {
    self.0.as_str()
  }
}

impl<S> FromRequestParts<S> for ClientIp
where
  S: Send + Sync,
{
  type Rejection = std::convert::Infallible;

  async fn from_request_parts(
    parts: &mut Parts,
    _state: &S,
  ) -> Result<Self, Self::Rejection> {
    Ok(Self(resolve_client_ip(parts)))
  }
}

fn resolve_client_ip(parts: &Parts) -> String {
  for header_name in ["x-forwarded-for", "x-real-ip"] {
    let Some(header_value) = parts.headers.get(header_name) else {
      continue;
    };
    let Ok(header_text) = header_value.to_str() else {
      continue;
    };
    let candidate = header_text
      .split(',')
      .next()
      .map(str::trim)
      .filter(|value| !value.is_empty());
    if let Some(ip) = candidate {
      return ip.to_string();
    }
  }
  String::new()
}

#[cfg(test)]
mod tests {
  use super::resolve_client_ip;
  use axum::http::Request;

  #[test]
  fn prefers_first_forwarded_ip_when_proxy_chain_exists() {
    let request = Request::builder()
      .header("x-forwarded-for", "10.8.0.15, 127.0.0.1")
      .body(())
      .expect("request");
    let (parts, _) = request.into_parts();

    assert_eq!(resolve_client_ip(&parts), "10.8.0.15");
  }

  #[test]
  fn falls_back_to_x_real_ip_when_forwarded_header_missing() {
    let request = Request::builder()
      .header("x-real-ip", "10.8.0.21")
      .body(())
      .expect("request");
    let (parts, _) = request.into_parts();

    assert_eq!(resolve_client_ip(&parts), "10.8.0.21");
  }
}
