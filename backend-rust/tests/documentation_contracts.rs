use std::fs;
use std::path::PathBuf;

fn repo_file(relative_path: &str) -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    .join("..")
    .join(relative_path)
}

fn read_repo_file(relative_path: &str) -> String {
  fs::read_to_string(repo_file(relative_path))
    .unwrap_or_else(|error| panic!("read {relative_path} failed: {error}"))
}

#[test]
fn compatibility_checklist_should_track_current_official_contract() {
  // 这份兼容清单当前仍被 README 和正式文档显式引用，
  // 因此它不能停留在旧口径，必须至少覆盖最近已经进入正式基线的能力约束。
  let checklist = read_repo_file("docs/plans/2026-03-25-rust-api-compat-checklist.md");

  assert!(
    checklist.contains("keyword"),
    "compatibility checklist should track the activity keyword search contract"
  );
  assert!(
    checklist.contains("自愈") || checklist.contains("自动修复异常签退状态"),
    "compatibility checklist should track the staff self-heal side effect"
  );
}

#[test]
fn docker_docs_should_keep_connection_settings_in_env_file_contract() {
  // Docker 发布口径的核心约束不是“某个端口永远固定”，
  // 而是 host / port / user / password 都集中落在 `.env.docker` 一处管理。
  // 这组断言锁住的是“单一配置入口 + 当前示例值”，避免 README 和部署手册再次各说各话。
  let readme = read_repo_file("README.md");
  let deployment_doc = read_repo_file("docs/DEPLOYMENT.md");

  for content in [&readme, &deployment_doc] {
    assert!(
      content.contains(".env.docker"),
      "docker docs should describe .env.docker as the deployment config entry"
    );
    assert!(
      content.contains("host.docker.internal"),
      "docker docs should explain the current cloud example host"
    );
    assert!(
      content.contains("3317"),
      "docker docs should explain the current cloud example port"
    );
    assert!(
      content.contains("SUDA_UNION_DB_HOST"),
      "docker docs should document host as a config-file field"
    );
    assert!(
      content.contains("SUDA_UNION_DB_PORT"),
      "docker docs should document port as a config-file field"
    );
    assert!(
      content.contains("SUDA_UNION_DB_USER"),
      "docker docs should document user as a config-file field"
    );
    assert!(
      content.contains("SUDA_UNION_DB_PASSWORD"),
      "docker docs should document password as a config-file field"
    );
  }
}

#[test]
fn official_docs_should_describe_keyword_search_contract() {
  // 活动搜索已经是正式实现能力：
  // 前端页面、前端 API 封装和后端 query 契约都已支持 `keyword`。
  // 正式文档必须把这个字段写出来，避免测试、联调和上线说明落后于代码。
  let requirements = read_repo_file("docs/REQUIREMENTS.md");
  let functional_spec = read_repo_file("docs/FUNCTIONAL_SPEC.md");
  let api_spec = read_repo_file("docs/API_SPEC.md");

  assert!(
    requirements.contains("搜索") || requirements.contains("keyword"),
    "requirements should describe the activity search capability"
  );
  assert!(
    functional_spec.contains("搜索"),
    "functional spec should describe the activity search interaction"
  );
  assert!(
    api_spec.contains("keyword"),
    "api spec should document the keyword query parameter"
  );
}

#[test]
fn official_docs_should_describe_staff_self_heal_side_effect() {
  // staff 管理页和名单页现在会在进入页面时自动扫描异常名单，
  // 必要时会调用统一修正接口写入“自动修复异常签退状态”。
  // 这是带写副作用的真实生产行为，正式文档必须显式说明。
  let requirements = read_repo_file("docs/REQUIREMENTS.md");
  let functional_spec = read_repo_file("docs/FUNCTIONAL_SPEC.md");
  let api_spec = read_repo_file("docs/API_SPEC.md");

  assert!(
    requirements.contains("自愈") || requirements.contains("自动修复"),
    "requirements should mention the automatic staff self-heal rule"
  );
  assert!(
    functional_spec.contains("自愈") || functional_spec.contains("自动修复"),
    "functional spec should mention the automatic self-heal flow"
  );
  assert!(
    api_spec.contains("自愈") || api_spec.contains("自动修复异常签退状态"),
    "api spec should describe the automatic attendance-adjustment side effect"
  );
}
