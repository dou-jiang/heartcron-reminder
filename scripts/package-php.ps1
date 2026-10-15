param([string]$OutputPath = '')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (!$OutputPath) { $OutputPath = Join-Path $projectRoot 'releases/HeartCron-PHP-v2.1.0.zip' }
$OutputPath = [IO.Path]::GetFullPath($OutputPath)
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($OutputPath)) | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
# An explicit allowlist keeps local configuration, credentials and dependencies out.
$entries = @('index.php', 'install.php', 'api.php', 'cron.php', 'cron-url.php', '.htaccess', 'README.md', 'php', 'frontend/dist', 'docs/screenshots/php-install.png', 'docs/node-deployment.md')
$archive = [IO.Compression.ZipFile]::Open($OutputPath, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($entry in $entries) {
        $source = Join-Path $projectRoot $entry
        if (!(Test-Path -LiteralPath $source)) { throw "Required deployment file is missing: $entry" }
        $files = if (Test-Path -LiteralPath $source -PathType Container) { Get-ChildItem -LiteralPath $source -Recurse -File } else { Get-Item -LiteralPath $source }
        foreach ($file in $files) {
            $name = $file.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $name, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    }
} finally { $archive.Dispose() }
Write-Output "Created $OutputPath"
