use std::path::PathBuf;

fn repo_file(relative_path: &str) -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    .join("..")
    .join(relative_path)
}

#[test]
fn repository_should_not_keep_obsolete_documentation_and_deploy_assets() {
  // 这些对象都属于当前仓库里最容易误导维护者的历史资产：
  // - `docs/superpowers/**`：实现过程稿，不是正式说明；
  // - `pure-suda-union` 映射清单：迁移期材料；
  // - `design-system/moonshot-checkin/MASTER.md`：和当前项目语义不一致的生成资产；
  // - `web/` 下单独 Docker 方案：当前正式口径已经收口到仓库根目录单容器方案。
  for obsolete_path in [
    "docs/superpowers",
    "docs/plans/2026-03-25-pure-suda-union-mapping-checklist.md",
    "design-system/moonshot-checkin/MASTER.md",
    "web/Dockerfile",
    "web/docker/nginx.conf",
    "web/.dockerignore",
  ] {
    assert!(
      !repo_file(obsolete_path).exists(),
      "obsolete repository asset should be removed: {obsolete_path}"
    );
  }
}
