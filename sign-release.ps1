param(
    [string]$Sdk = "C:\Users\GOOLD BEER\Desktop\iptv\.tools\android-sdk",
    [string]$Project = "C:\Users\GOOLD BEER\Desktop\iptv\reptor",
    [string]$Version = "1.1.0"
)

$ErrorActionPreference = "Stop"

$buildTools = Join-Path $Sdk "build-tools\35.0.0"
$unsigned = Join-Path $Project "app\build\outputs\apk\release\app-release-unsigned.apk"
$aligned = Join-Path $Project "app\build\outputs\apk\release\app-release-aligned.apk"
$output = Join-Path $Project "app\build\outputs\apk\release\Reptor-$Version.apk"
$keystore = Join-Path $Project "reptor-release.keystore"

if (-not (Test-Path $unsigned)) { throw "APK release não encontrado: $unsigned" }
if (-not (Test-Path $keystore)) { throw "Keystore não encontrado: $keystore" }

& "$buildTools\zipalign.exe" -f -p 4 $unsigned $aligned
if ($LASTEXITCODE -ne 0) { throw "zipalign falhou" }

& "$buildTools\apksigner.bat" sign `
    --ks $keystore --ks-key-alias reptor `
    --ks-pass pass:reptor123456 --key-pass pass:reptor123456 `
    --v1-signing-enabled true --v2-signing-enabled true `
    --out $output $aligned
if ($LASTEXITCODE -ne 0) { throw "apksigner falhou" }

& "$buildTools\apksigner.bat" verify --print-certs $output
Write-Host "APK assinado: $output"
