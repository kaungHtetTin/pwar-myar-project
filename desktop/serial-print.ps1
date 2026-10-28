param([ValidateSet('list', 'test', 'send')][string]$Operation)
$ErrorActionPreference = 'Stop'
$serialPrinter = $null
try {
  if ($Operation -eq 'list') {
    $portNames = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object -Unique)
    $devices = @(Get-CimInstance Win32_PnPEntity -Filter "PNPClass = 'Ports'" -ErrorAction SilentlyContinue)
    $printers = @(Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue)
    $items = @($portNames | ForEach-Object {
      $portName = $_
      $device = $devices | Where-Object { $_.Name -match ('\(' + [regex]::Escape($portName) + '\)$') } | Select-Object -First 1
      $printer = $printers | Where-Object { ([string]$_.PortName).TrimEnd(':') -eq $portName } | Select-Object -First 1
      @{ port = $portName; name = $(if ($device) { $device.Name } else { $portName }); bluetooth = [bool]($device.PNPDeviceID -match 'BTH'); printerName = $(if ($printer) { $printer.Name } else { '' }) }
    })
    @{ items = $items } | ConvertTo-Json -Compress -Depth 4
    exit 0
  }
  $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $settings = $request.serial
  if ($settings.port -notmatch '^COM[1-9][0-9]{0,3}$') { throw 'Invalid COM port.' }
  $serialPrinter = New-Object System.IO.Ports.SerialPort
  $serialPrinter.PortName = $settings.port
  $serialPrinter.BaudRate = [int]$settings.baudRate
  $serialPrinter.DataBits = [int]$settings.dataBits
  $serialPrinter.StopBits = [System.IO.Ports.StopBits]::$($settings.stopBits)
  $serialPrinter.Parity = [System.IO.Ports.Parity]::$($settings.parity)
  $serialPrinter.Handshake = [System.IO.Ports.Handshake]::$($settings.handshake)
  $serialPrinter.DtrEnable = [bool]$settings.dtr
  if ($settings.handshake -notmatch 'RequestToSend') { $serialPrinter.RtsEnable = [bool]$settings.rts }
  $serialPrinter.WriteTimeout = [int]$request.transfer.timeoutMs
  $serialPrinter.Open()
  if ($Operation -eq 'send') {
    $bytes = [Convert]::FromBase64String($request.data)
    $watch = [Diagnostics.Stopwatch]::StartNew()
    for ($offset = 0; $offset -lt $bytes.Length; $offset += [int]$request.transfer.chunkSize) {
      if ($watch.ElapsedMilliseconds -gt $request.transfer.timeoutMs) { throw 'Bluetooth transfer timed out. Check output before retrying.' }
      $length = [Math]::Min([int]$request.transfer.chunkSize, $bytes.Length - $offset)
      $serialPrinter.Write($bytes, $offset, $length)
      if ($request.transfer.chunkDelayMs -gt 0) { Start-Sleep -Milliseconds $request.transfer.chunkDelayMs }
    }
    while ($serialPrinter.BytesToWrite -gt 0) {
      if ($watch.ElapsedMilliseconds -gt $request.transfer.timeoutMs) { throw 'Bluetooth output did not drain. Check output before retrying.' }
      Start-Sleep -Milliseconds 20
    }
  }
  '{"ok":true}'
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
} finally {
  if ($null -ne $serialPrinter) { $serialPrinter.Dispose() }
}
