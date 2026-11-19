#requires -Version 7.2

[CmdletBinding(DefaultParameterSetName = "CertificateStore")]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('(?-i:^[a-p]{32}$)')]
    [string]$ChromeExtensionId,

    [Parameter(Mandatory)]
    [ValidatePattern('(?-i:^[a-p]{32}$)')]
    [string]$EdgeExtensionId,

    [Parameter(Mandatory, ParameterSetName = "CertificateStore")]
    [ValidatePattern('^[a-fA-F0-9]{40}$')]
    [string]$CertificateThumbprint,

    [Parameter(Mandatory, ParameterSetName = "SigningService")]
    [string]$SigningDll,

    [Parameter(Mandatory, ParameterSetName = "SigningService")]
    [string]$SigningMetadata,

    [Parameter(Mandatory, ParameterSetName = "Development")]
    [switch]$UnsignedDevelopment,

    [ValidatePattern('^https?://[a-zA-Z0-9./:_-]+$')]
    [string]$TimestampUrl = "http://timestamp.acs.microsoft.com",

    [string]$InnoCompilerPath,
    [string]$SignToolPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Tool {
    param([string]$Executable, [string[]]$ToolArguments)
    & $Executable @ToolArguments
    if ($LASTEXITCODE -ne 0) {
        throw ("{0} terminó con código {1}." -f (Split-Path -Leaf $Executable), $LASTEXITCODE)
    }
}

function Resolve-BuildTool {
    param([string]$ExplicitPath, [string]$Command, [string[]]$Candidates)
    if ($ExplicitPath) {
        if (!(Test-Path -LiteralPath $ExplicitPath -PathType Leaf)) {
            throw ("No existe {0} en la ruta indicada." -f $Command)
        }
        return (Resolve-Path -LiteralPath $ExplicitPath).Path
    }
    $installed = Get-Command $Command -CommandType Application -ErrorAction SilentlyContinue
    if ($installed) { return $installed.Source }
    foreach ($candidate in $Candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
    throw ("No se encontró {0}. Instala la herramienta indicada en packaging/windows/README.md." -f $Command)
}

function Assert-Authenticode {
    param([string]$Path)
    Invoke-Tool $script:signTool @("verify", "/pa", "/tw", $Path)
    $signature = Get-AuthenticodeSignature -LiteralPath $Path
    if ($signature.Status -ne "Valid" -or !$signature.TimeStamperCertificate) {
        throw ("Firma Authenticode o sello de tiempo inválidos en {0}." -f (Split-Path -Leaf $Path))
    }
    if ($CertificateThumbprint -and $signature.SignerCertificate.Thumbprint -ne $CertificateThumbprint) {
        throw ("El certificado usado en {0} no es el configurado." -f (Split-Path -Leaf $Path))
    }
}

if (!$IsWindows) { throw "El instalador para Windows se compila en Windows." }
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$manifest = Get-Content -LiteralPath (Join-Path $repo "manifest.json") -Raw | ConvertFrom-Json
$version = $manifest.version
if ($version -notmatch '^\d+\.\d+\.\d+(\.\d+)?$') {
    throw "manifest.json necesita una versión numérica válida para Windows."
}

$python = (Get-Command python.exe -CommandType Application).Source
Invoke-Tool $python @("-c", "import platform,struct,tkinter; assert struct.calcsize('P') == 8 and platform.machine().lower() in ('amd64', 'x86_64'), 'Se necesita Python x64'")

$programFiles86 = [Environment]::GetFolderPath("ProgramFilesX86")
$programFiles = [Environment]::GetFolderPath("ProgramFiles")
$innoCandidates = @(
    (Join-Path $programFiles "Inno Setup 7\ISCC.exe")
    (Join-Path $programFiles86 "Inno Setup 7\ISCC.exe")
    (Join-Path $programFiles86 "Inno Setup 6\ISCC.exe")
)
$inno = Resolve-BuildTool $InnoCompilerPath "ISCC.exe" $innoCandidates

$signingArguments = @()
if (!$UnsignedDevelopment) {
    $sdk = Join-Path $programFiles86 "Windows Kits\10\bin"
    $sdkVersions = @(Get-ChildItem -LiteralPath $sdk -Directory -ErrorAction SilentlyContinue |
        Where-Object Name -Match '^\d+\.\d+\.\d+\.\d+$' |
        Sort-Object { [version]$_.Name } -Descending)
    $signCandidates = @($sdkVersions | ForEach-Object { Join-Path $_.FullName "x64\signtool.exe" })
    $script:signTool = Resolve-BuildTool $SignToolPath "SignTool.exe" $signCandidates
    if ($PSCmdlet.ParameterSetName -eq "SigningService") {
        $dll = (Resolve-Path -LiteralPath $SigningDll).Path
        $metadata = (Resolve-Path -LiteralPath $SigningMetadata).Path
        $signingArguments = @("/dlib", $dll, "/dmdf", $metadata)
    } else {
        $certificate = Get-Item -LiteralPath ("Cert:\CurrentUser\My\" + $CertificateThumbprint)
        if (!$certificate.HasPrivateKey) { throw "La identidad de firma carece de acceso a la clave privada." }
        $signingArguments = @("/sha1", $CertificateThumbprint)
    }
    $signingArguments = @("sign", "/fd", "SHA256", "/tr", $TimestampUrl, "/td", "SHA256") + $signingArguments
}

$temporary = Join-Path ([IO.Path]::GetTempPath()) ("ghostcookie-win-" + [Guid]::NewGuid().ToString("N"))
$payload = Join-Path $temporary "payload"
$output = Join-Path $temporary "output"
$dist = Join-Path $repo "dist\installers"
$basename = "ghost-cookie-assistant-windows-x64-v$version"
if ($UnsignedDevelopment) { $basename += "-unsigned-dev" }

try {
    $null = New-Item -ItemType Directory -Path $payload, $output, (Join-Path $temporary "spec")
    $ids = Join-Path $temporary "official-extension-ids.json"
    @{ chrome = $ChromeExtensionId; edge = $EdgeExtensionId } |
        ConvertTo-Json -Compress | Set-Content -LiteralPath $ids -Encoding utf8
    $icon = Join-Path $temporary "ghostcookie.ico"
    Invoke-Tool $python @((Join-Path $PSScriptRoot "build-icon.py"), (Join-Path $repo "icons"), $icon)
    $commonArguments = @(
        "-m", "PyInstaller", "--noconfirm", "--onefile", "--noupx",
        "--distpath", $payload, "--workpath", (Join-Path $temporary "build"),
        "--specpath", (Join-Path $temporary "spec"), "--add-data", ("${ids}:."),
        "--hidden-import", "keyring.backends.Windows", "--copy-metadata", "keyring", "--icon", $icon
    )
    Invoke-Tool $python ($commonArguments + @(
        "--console", "--name", "ghostcookie-host", (Join-Path $repo "native\assistant.py")
    ))
    Invoke-Tool $python ($commonArguments + @(
        "--windowed", "--name", "ghostcookie-setup", (Join-Path $repo "native\setup_app.py")
    ))
    Invoke-Tool (Join-Path $payload "ghostcookie-host.exe") @("--help")
    Copy-Item -LiteralPath (Join-Path $repo "LICENSE") -Destination (Join-Path $payload "LICENSE.txt")
    Invoke-Tool $python @((Join-Path $repo "packaging\collect-runtime-notices.py"), (Join-Path $payload "THIRD-PARTY-NOTICES.txt"), "--inno")

    $innoArguments = @(
        "/DReleaseVersion=$version", "/DPayloadDirectory=$payload",
        "/DInstallerBasename=$basename", "/DInstallerIcon=$icon", "/O$output"
    )
    if (!$UnsignedDevelopment) {
        foreach ($name in "ghostcookie-host.exe", "ghostcookie-setup.exe") {
            $exe = Join-Path $payload $name
            Invoke-Tool $script:signTool ($signingArguments + @($exe))
            Assert-Authenticode $exe
        }
        # Inno expands $q to a quote and $f to the quoted installer or uninstaller path.
        $command = (@($script:signTool) + $signingArguments | ForEach-Object {
            '$q' + $_.Replace('$', '$$') + '$q'
        }) -join " "
        $innoArguments += "/DSignedRelease"
        $innoArguments += ('/SghostcookieAuthenticode=' + $command + ' $f')
    }
    Invoke-Tool $inno ($innoArguments + @((Join-Path $PSScriptRoot "GhostCookieAssistant.iss")))
    $installer = Join-Path $output "$basename.exe"
    if (!(Test-Path -LiteralPath $installer -PathType Leaf)) { throw "El instalador no fue generado." }
    if (!$UnsignedDevelopment) { Assert-Authenticode $installer }

    $null = New-Item -ItemType Directory -Force -Path $dist
    $artifact = Join-Path $dist "$basename.exe"
    Move-Item -LiteralPath $installer -Destination $artifact -Force
    $hash = (Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath "$artifact.sha256" -Value "$hash  $basename.exe" -Encoding ascii
    Write-Output $artifact
} finally {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
