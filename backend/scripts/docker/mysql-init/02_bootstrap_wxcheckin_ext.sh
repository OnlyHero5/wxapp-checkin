#!/usr/bin/env bash

# MySQL 官方镜像会在初始化阶段执行 /docker-entrypoint-initdb.d 下的 *.sh/*.sql。
#
# 这里用 shell 脚本调用一次 `bootstrap-prod-schema.sql`，目的是：
# - 显式指定数据库（$MYSQL_DATABASE），避免 SQL 文件里硬编码库名；
# - 避免 bootstrap 脚本为了 docker 额外增加 CREATE DATABASE/USE，从而要求生产账号具备不必要的 CREATE 权限。
#
# 维护注意：
# - 该脚本会被 MySQL 官方 entrypoint 直接 `source` 到父 shell，而不是启动独立子进程；
# - 因此这里不能再执行 `set -u` 之类会污染父 shell 选项的语句，
#   否则 entrypoint 后续读取位置参数/可选环境变量时会触发 unbound variable，
#   进而让第一次 `docker compose up -d` 在 MySQL 初始化窗口里提前失败。

: "${MYSQL_DATABASE:?MYSQL_DATABASE is required}"
: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}"

echo "[init] bootstrap wxcheckin_ext schema: ${MYSQL_DATABASE}"
mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}" < /docker-entrypoint-initdb.d/bootstrap-prod-schema.sql.disabled
