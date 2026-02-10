param(
  [string]$Profile = $env:SPRING_PROFILES_ACTIVE
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($Profile)) {
  $Profile = "dev"
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=$Profile"
