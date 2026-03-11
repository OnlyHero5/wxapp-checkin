#!/usr/bin/env bash
set -euo pipefail

# MySQL 官方镜像会在初始化阶段执行 /docker-entrypoint-initdb.d 下的 *.sh/*.sql。
#
# 这里用 shell 脚本调用一次 `bootstrap-prod-schema.sql`，目的是：
# - 显式指定数据库（$MYSQL_DATABASE），避免 SQL 文件里硬编码库名；
# - 避免 bootstrap 脚本为了 docker 额外增加 CREATE DATABASE/USE，从而要求生产账号具备不必要的 CREATE 权限。

echo "[init] bootstrap wxcheckin_ext schema: ${MYSQL_DATABASE}"
mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}" < /docker-entrypoint-initdb.d/bootstrap-prod-schema.sql.disabled

