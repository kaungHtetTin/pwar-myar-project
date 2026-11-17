# Android printing — mobile 0.1.4 / Android 1.3 (build 4)

Open **Settings → Printer**. These settings live in Android's no-backup directory on this device, not Laravel or transferable browser storage. Receipt content/layout remains in Receipt settings. The Printer page and its test receipt do not require an API connection once the app is accessible.

## Supported paths

- **Android print dialog / PDF:** choose an installed Android print service for compatible office printers (including supported Canon/Epson models), or Save as PDF. Select copies and final paper settings in that dialog. Statements and barcode documents always use this path with A4.
- **Bluetooth Classic thermal:** pair the printer in Android Settings, allow Nearby devices when requested, then refresh/select a paired device. Requires Classic SPP and ESC/POS raster support. The list is paired devices, not proof each device is a printer. BLE-only and USB printers are not supported directly.
- **Network thermal / emulator:** enter the printer's reachable IP/hostname and TCP port (normally 9100). A PC emulator needs the PC's LAN address; `127.0.0.1` on the phone refers to the phone. Use a trusted network: raw ESC/POS TCP is not encrypted or authenticated.

Thermal widths: 50/58 mm use a 384-dot raster; 80/85 mm use 576 dots. These defaults fit common print heads, not every model. Direct receipts require `GS v 0` raster support. Myanmar/Latin fonts are embedded and rendered as images. Direct copies are 1–10; automatic cutting defaults off and requires a cutter.

## Repeated Bluetooth receipts

In **Settings > Printer > Bluetooth print mode**, choose **Standard** (default) or **Compatibility (slower)**. This setting stays on the phone with its printer profile; existing profiles default to Standard. No server/API change is required.

Both modes preserve Myanmar/Latin image rendering and use small complete raster blocks. Standard uses 24-row bands, writes up to 256 bytes with 10 ms pacing, pauses 20 ms between image blocks and 100 ms after reset, and holds the connection for 1.5 seconds after each copy. Compatibility uses 16-row bands, writes up to 128 bytes with 20 ms pacing, pauses 40 ms between blocks and 200 ms after reset, and holds the connection for 2.5 seconds after each copy. Flushes happen between complete commands; no padding bytes are inserted into raster payloads. TCP keeps 256-row bands and its existing chunk/pacing defaults.

The busy guard remains active through the final wait and socket closure. These conservative waits reduce early closure and buffer pressure; they do not confirm physical printing or guarantee every printer supports the image command. Failed jobs are never automatically replayed. If a printer is already producing garbage, check the paper and restart the printer before testing the new mode; a software reset cannot reliably repair an interrupted image command.

Diagnostic Android logs use the `MkposPrinter` tag and contain connection/mode, planned/sent byte counts, elapsed time and exception type. Receipt text, customer details and Bluetooth addresses are not logged. Confirm repeated short and long receipts on physical printers before considering hardware acceptance complete.

## Safety and troubleshooting

Check connection only opens/closes a connection; it cannot confirm paper, cutter, protocol compatibility, or physical output. Test print saves the current profile and sends a local Myanmar/Latin sample. Direct-print success means data was sent, not that paper output was verified. Android dialog jobs report Android's completion/cancellation/failure state.

One operation runs at a time. Rendering has a 20-second deadline; connection or transport is stopped after 30 seconds without progress. Long receipts and multiple copies may run longer while writes continue. Failed/partial jobs are never retried automatically. Check paper/output before retrying. A receipt is limited to 4 MB HTML and 16,000 raster rows; use system printing for larger documents. Restarting the app interrupts an active operation.

The native renderer blocks external resources and document scripts. For missing logos, use embedded data images rather than remote image URLs.

## Build and verification

`npm run lint`, `npm test`, `npm run android:apk:debug`.

Native encoder tests: `gradlew.bat testDebugUnitTest` in `android/` with JDK 21 and Android SDK configured. The loopback TCP integration test is emulator-only:

```powershell
.\gradlew.bat connectedDebugAndroidTest '-Pandroid.testInstrumentationRunnerArguments.class=com.pwarmyar.mobile.PrinterInstrumentedTest'
```

The integration test restores the emulator's previous printer profile. It checks that connection checks send no bytes, then verifies raster width, nonblank beginning/end of a long receipt, and feed/cut commands. Physical Bluetooth pairing, manufacturer print services, and real paper output still require hardware acceptance testing.

Debug APKs are for testing. Updating an existing install requires the same signing certificate; do not uninstall an app containing unsynchronized sales just to bypass a signature mismatch.
