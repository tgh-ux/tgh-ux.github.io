[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$CsvFile = "files.csv",

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$OutputWav = "atlas.wav",

    [Parameter(Mandatory = $true, Position = 2)]
    [string]$OutputTable = "atlas.js"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'


function Read-UInt16LE {
    param([byte[]]$Bytes, [int]$Offset)

    return [BitConverter]::ToUInt16($Bytes, $Offset)
}

function Read-UInt32LE {
    param([byte[]]$Bytes, [int]$Offset)

    return [BitConverter]::ToUInt32($Bytes, $Offset)
}


function Get-WavInfo {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $stream = [System.IO.File]::OpenRead($Path)
    $reader = [System.IO.BinaryReader]::new($stream)

    try {
        # RIFF header
        $riff = [Text.Encoding]::ASCII.GetString(
            $reader.ReadBytes(4)
        )

        if ($riff -ne 'RIFF') {
            throw "'$Path' is not a RIFF WAV file."
        }

        [void]$reader.ReadUInt32()

        $wave = [Text.Encoding]::ASCII.GetString(
            $reader.ReadBytes(4)
        )

        if ($wave -ne 'WAVE') {
            throw "'$Path' is not a WAVE file."
        }

        $fmtFound = $false
        $dataFound = $false

        $audioFormat = 0
        $channels = 0
        $sampleRate = 0
        $byteRate = 0
        $blockAlign = 0
        $bitsPerSample = 0
        $dataOffset = 0
        $dataSize = 0

        while ($stream.Position -lt $stream.Length) {
            $chunkId = [Text.Encoding]::ASCII.GetString(
                $reader.ReadBytes(4)
            )

            if ($chunkId.Length -ne 4) {
                break
            }

            $chunkSize = $reader.ReadUInt32()
            $chunkStart = $stream.Position

            switch ($chunkId) {
                'fmt ' {
                    if ($chunkSize -lt 16) {
                        throw "Invalid fmt chunk in '$Path'."
                    }

                    $audioFormat = $reader.ReadUInt16()
                    $channels = $reader.ReadUInt16()
                    $sampleRate = $reader.ReadUInt32()
                    $byteRate = $reader.ReadUInt32()
                    $blockAlign = $reader.ReadUInt16()
                    $bitsPerSample = $reader.ReadUInt16()

                    # Skip any extra fmt data.
                    $stream.Position = $chunkStart + $chunkSize

                    $fmtFound = $true
                }

                'data' {
                    $dataOffset = $stream.Position
                    $dataSize = $chunkSize

                    # We don't need to read the data now.
                    $stream.Position = $chunkStart + $chunkSize

                    $dataFound = $true
                }

                default {
                    # Ignore LIST, fact, JUNK, bext, etc.
                    $stream.Position = $chunkStart + $chunkSize
                }
            }

            # RIFF chunks are padded to an even byte boundary.
            if (($chunkSize % 2) -ne 0) {
                $stream.Position++
            }

            if ($fmtFound -and $dataFound) {
                break
            }
        }

        if (-not $fmtFound) {
            throw "No fmt chunk found in '$Path'."
        }

        if (-not $dataFound) {
            throw "No data chunk found in '$Path'."
        }

        if ($audioFormat -ne 1) {
            throw "'$Path' is not standard PCM WAV (audio format $audioFormat). " +
                  "This script currently supports PCM WAV files only."
        }

        if ($channels -le 0 -or $sampleRate -le 0 -or $blockAlign -le 0) {
            throw "Invalid WAV format information in '$Path'."
        }

        [PSCustomObject]@{
            Path           = $Path
            AudioFormat    = $audioFormat
            Channels       = $channels
            SampleRate     = $sampleRate
            ByteRate       = $byteRate
            BlockAlign     = $blockAlign
            BitsPerSample  = $bitsPerSample
            DataOffset     = $dataOffset
            DataSize       = [uint64]$dataSize
            Duration       = ([double]$dataSize / [double]$byteRate)
        }
    }
    finally {
        $reader.Dispose()
        $stream.Dispose()
    }
}


function Write-UInt16LE {
    param(
        [System.IO.BinaryWriter]$Writer,
        [uint16]$Value
    )

    $Writer.Write($Value)
}

function Write-UInt32LE {
    param(
        [System.IO.BinaryWriter]$Writer,
        [uint32]$Value
    )

    $Writer.Write($Value)
}


# ---------------------------------------------------------------------------
# Read input CSV
# ---------------------------------------------------------------------------

if (-not (Test-Path -LiteralPath $CsvFile -PathType Leaf)) {
    throw "CSV file not found: $CsvFile"
}

$csvLines = @(
    Get-Content -LiteralPath $CsvFile |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
)

if ($csvLines.Count -eq 0) {
    throw "CSV file is empty."
}

# Support either:
#
#   File
#   foo.wav
#   bar.wav
#
# or a completely headerless CSV:
#
#   foo.wav
#   bar.wav
#
# If there is a "File" header, Import-Csv is used. Otherwise the first
# column of every line is treated as the filename.

$firstLine = $csvLines[0].Trim()

$inputFiles = @()

if ($firstLine -match '^(?i:"?File"?)\s*(,|$)') {
    $rows = Import-Csv -LiteralPath $CsvFile

    foreach ($row in $rows) {
        $value = $row.File

        if (-not [string]::IsNullOrWhiteSpace($value)) {
            $inputFiles += $value.Trim()
        }
    }
}
else {
    foreach ($line in $csvLines) {
        # Take the first CSV field.
        $fields = $line | ConvertFrom-Csv -Header File

        if (-not [string]::IsNullOrWhiteSpace($fields.File)) {
            $inputFiles += $fields.File.Trim()
        }
    }
}

if ($inputFiles.Count -eq 0) {
    throw "No input WAV files were found in '$CsvFile'."
}


# Resolve paths relative to the current working directory.
$resolvedInputs = @()

foreach ($file in $inputFiles) {
    $path = $file

    if (-not [System.IO.Path]::IsPathRooted($path)) {
        $path = Join-Path (Get-Location) $path
    }

    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Input WAV file not found: $file"
    }

    $resolvedInputs += [System.IO.Path]::GetFullPath($path)
}


# ---------------------------------------------------------------------------
# Inspect WAV files
# ---------------------------------------------------------------------------

Write-Host "Inspecting $($resolvedInputs.Count) WAV file(s)..."

$wavFiles = @()

foreach ($path in $resolvedInputs) {
    $info = Get-WavInfo -Path $path
    $wavFiles += $info

    Write-Host ("  {0} - {1:N3}s" -f `
        [System.IO.Path]::GetFileName($path),
        $info.Duration)
}


# All files must have identical PCM parameters.
$reference = $wavFiles[0]

foreach ($info in $wavFiles) {
    if (
        $info.AudioFormat   -ne $reference.AudioFormat -or
        $info.Channels      -ne $reference.Channels -or
        $info.SampleRate    -ne $reference.SampleRate -or
        $info.BlockAlign    -ne $reference.BlockAlign -or
        $info.BitsPerSample -ne $reference.BitsPerSample
    ) {
        throw @"
WAV format mismatch.

Reference:
  Channels:       $($reference.Channels)
  Sample rate:    $($reference.SampleRate)
  Bits/sample:    $($reference.BitsPerSample)
  Block align:    $($reference.BlockAlign)

Mismatching file:
  $($info.Path)
  Channels:       $($info.Channels)
  Sample rate:    $($info.SampleRate)
  Bits/sample:    $($info.BitsPerSample)
  Block align:    $($info.BlockAlign)

All input WAV files must have the same PCM format.
"@
    }
}


# ---------------------------------------------------------------------------
# Prepare output paths
# ---------------------------------------------------------------------------

$outputWavPath = [System.IO.Path]::GetFullPath(
    (Join-Path (Get-Location) $OutputWav)
)

$outputTablePath = [System.IO.Path]::GetFullPath(
    (Join-Path (Get-Location) $OutputTable)
)

# Avoid accidentally using an input file as the output.
foreach ($info in $wavFiles) {
    if ([string]::Equals(
        [System.IO.Path]::GetFullPath($info.Path),
        $outputWavPath,
        [StringComparison]::OrdinalIgnoreCase
    )) {
        throw "Output WAV cannot also be one of the input WAV files."
    }
}

$outputWavDirectory = Split-Path -Parent $outputWavPath
$outputTableDirectory = Split-Path -Parent $outputTablePath

if ($outputWavDirectory -and -not (Test-Path $outputWavDirectory)) {
    New-Item -ItemType Directory -Path $outputWavDirectory -Force | Out-Null
}

if ($outputTableDirectory -and -not (Test-Path $outputTableDirectory)) {
    New-Item -ItemType Directory -Path $outputTableDirectory -Force | Out-Null
}


# ---------------------------------------------------------------------------
# Create output WAV
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "Creating: $outputWavPath"

$outStream = [System.IO.File]::Create($outputWavPath)
$outWriter = [System.IO.BinaryWriter]::new($outStream)

try {
    # We will write the RIFF header now and patch the sizes afterward.
    #
    # Standard PCM WAV:
    #
    # RIFF
    #   WAVE
    #   fmt  (16 bytes)
    #   data (...)

    $outWriter.Write([Text.Encoding]::ASCII.GetBytes('RIFF'))
    $riffSizePosition = $outStream.Position
    $outWriter.Write([uint32]0)

    $outWriter.Write([Text.Encoding]::ASCII.GetBytes('WAVE'))

    # fmt chunk
    $outWriter.Write([Text.Encoding]::ASCII.GetBytes('fmt '))
    $outWriter.Write([uint32]16)

    $outWriter.Write([uint16]$reference.AudioFormat)
    $outWriter.Write([uint16]$reference.Channels)
    $outWriter.Write([uint32]$reference.SampleRate)
    $outWriter.Write([uint32]$reference.ByteRate)
    $outWriter.Write([uint16]$reference.BlockAlign)
    $outWriter.Write([uint16]$reference.BitsPerSample)

    # data chunk
    $outWriter.Write([Text.Encoding]::ASCII.GetBytes('data'))
    $dataSizePosition = $outStream.Position
    $outWriter.Write([uint32]0)

    $outputDataStart = $outStream.Position

    $bufferSize = 1024 * 1024
    $buffer = New-Object byte[] $bufferSize

    $toc = @()
    [double]$currentOffset = 0.0

    foreach ($info in $wavFiles) {
        $inputName = [System.IO.Path]::GetFileNameWithoutExtension($info.Path)

        # JavaScript string escaping.
        $jsKey = $inputName.Replace('\', '\\').Replace('"', '\"')
        $atlasName = [System.IO.Path]::GetFileNameWithoutExtension($OutputWav)
        $atlasName = $atlasName.Replace('\', '\\').Replace('"', '\"')

        $startOffset = $currentOffset
        $endOffset = $currentOffset + $info.Duration

        Write-Host ("  Appending {0} ({1:N3}s -> {2:N3}s)" -f `
            [System.IO.Path]::GetFileName($info.Path),
            $startOffset,
            $endOffset)

        $inStream = [System.IO.File]::OpenRead($info.Path)

        try {
            $inStream.Position = $info.DataOffset

            [uint64]$remaining = $info.DataSize

            while ($remaining -gt 0) {
                $toRead = [int][Math]::Min(
                    [uint64]$buffer.Length,
                    $remaining
                )

                $read = $inStream.Read($buffer, 0, $toRead)

                if ($read -le 0) {
                    throw "Unexpected end of file while reading '$($info.Path)'."
                }

                $outStream.Write($buffer, 0, $read)
                $remaining -= [uint64]$read
            }
        }
        finally {
            $inStream.Dispose()
        }

        $toc += [PSCustomObject]@{
            Key   = $inputName
            Atlas = $atlasName
            Start = $startOffset
            End   = $endOffset
        }

        $currentOffset = $endOffset
    }

    # Total output data size.
    [uint64]$totalDataSize = $outStream.Position - $outputDataStart

    if ($totalDataSize -gt [uint32]::MaxValue) {
        throw "Output WAV exceeds the 4 GB size limit of standard WAV."
    }

    # Patch data chunk size.
    $outStream.Position = $dataSizePosition
    $outWriter.Write([uint32]$totalDataSize)

    # Patch RIFF size.
    #
    # RIFF size = file size - 8
    [uint64]$riffSize = $outStream.Length - 8

    if ($riffSize -gt [uint32]::MaxValue) {
        throw "Output WAV exceeds the 4 GB size limit of standard WAV."
    }

    $outStream.Position = $riffSizePosition
    $outWriter.Write([uint32]$riffSize)
}
finally {
    $outWriter.Dispose()
    $outStream.Dispose()
}


# ---------------------------------------------------------------------------
# Write JavaScript table
# ---------------------------------------------------------------------------

Write-Host "Creating: $outputTablePath"

$lines = @()

foreach ($entry in $toc) {
    $lines += ('"{0}": {{ atlas: "{1}", start: {2:F3}, end: {3:F3} }},' -f `
        $entry.Key.Replace('\', '\\').Replace('"', '\"'),
        $entry.Atlas,
        $entry.Start,
        $entry.End)
}

[System.IO.File]::WriteAllLines(
    $outputTablePath,
    $lines,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "Done."
Write-Host ("Output WAV:   {0}" -f $outputWavPath)
Write-Host ("Output table: {0}" -f $outputTablePath)