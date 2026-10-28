# PwarMyar Desktop

## Release 1.0.2

Windows portable builds are available for x64 and ia32. This release includes
automatic Bluetooth printer selection, UTF-8 serial helper output and the
Windows thermal printer settings fallback described below.

Bluetooth Settings discovers ports automatically on entry. When exactly one
Bluetooth COM port is associated with an installed Windows printer queue and no
port is already selected, PwarMyar selects it. Multiple identified printers appear
by name in a picker. Save remembers the selection on this device. Existing port
selections are preserved; refresh discovers newly paired printers. Unidentified
ports remain available under Manual port selection, since an arbitrary Bluetooth
serial port may be incoming or belong to a different device. Pair the printer and
install its Windows queue first for automatic identification.

Thermal Windows jobs that explicitly fail with `Invalid printer settings` now
retry once on the same queue using its default paper form and monochrome output.
Set the queue's matching roll width in Windows Printing preferences. A4/A5 and
custom label sizes retain explicit media; cancellation, timeout and other failures
do not retry. Bluetooth helper output uses UTF-8 and plain text to preserve device
names and avoid exposing PowerShell CLIXML in errors.

## Printing (0.2.10)

Save and Check Connection now share the standard 36-pixel settings button
height and right-aligned footer spacing. This UI release does not address the
reported packaged-app receipt-loading failure.

The cutter control aligns with the receipt-copies input. Save and connection
check use a separate shaded action area with primary and secondary buttons.

Web and desktop Settings now have separate Receipt (content, layout, preview)
and Printer (destination, connection, paper, test print) sections. The printer
form uses compact checkboxes, wrapping actions, and a frame-bound scroll area.
Switching sections resets that section's scroll position.

The settings screen now shows everyday controls only: connection, destination,
paper, copies, color/orientation, print-dialog preference, and automatic cutting.
TCP host/port and Bluetooth port appear only for the relevant connection.
The optional A4 document printer remains available.

When Save or Test Print is used, hidden technical options return to defaults:
automatic DPI and print-head width, 100% scale, single-sided, standard raster
images, 3 feed lines, 30-second timeout, 512-byte chunks/10-ms delay, and Bluetooth
9600/8/N/1 with no flow control. A4 uses printable-area margins; thermal uses no
page margins. Merely opening Settings does not change a saved profile.

Configure **Settings → Printer** and use **Save printer settings
on this device**. Settings live in this Windows user's local
`%APPDATA%/mkpos-desktop/desktop-config.json`, not on the shared server.
Copying the portable executable to another computer does not copy this profile.
Existing Windows printer names and emulator URLs migrate when saved.

| Connection | Configuration |
| --- | --- |
| Windows driver: Canon/Epson/thermal/installed Bluetooth queue | Printer, paper, copies, color, orientation, dialog vs silent printing |
| ESC/POS TCP: network/Wi-Fi/emulator | Host/IP, port, paper, copies, cutter |
| Bluetooth Classic SPP | Paired outgoing COM port, paper, copies, cutter |
| A4 statements/barcode lists | Separate local Windows queue (blank = Windows default), using the saved Windows output options |

### Device isolation and server rollout

Paper, left/right margins, header alignment, font sizes and line spacing are saved
with the local printer profile. They override server layout on every receipt,
including online/offline reprints. Existing shared layout is only a migration
default until the device saves its profile. Shop identity, footer wording and
receipt content toggles stay shared. Desktop shared-settings saves never include
the printer name or local layout fields.

**Deploy the updated Laravel SettingsController.php with this release.**
Paper/alignment validation now permits omitted fields and preserves their shared
values. On an older server, the dedicated local Save/Test Print buttons work,
but general shared-settings Save rejects the missing required fields and explains
the server update. Do not work around this by sending local printer settings to
the shared server.

### Setup and limits

- Windows: install the model's driver and confirm a Windows test page. Select A4
  for office documents or the matching receipt roll width. Model-specific
  trays, quality, ink modes and borderless settings stay
  in the Windows driver. PwarMyar does not install drivers or change OS defaults.
- Microsoft Print to PDF / Adobe PDF: built-in Save as PDF preserves receipt
  dimensions, orientation and scale. Physical options (copies, DPI, duplex,
  trays) do not apply. Long thermal PDFs paginate at 1000 mm.
- TCP: use a raw ESC/POS-capable endpoint on a trusted network, commonly port
  9100. Traffic is unencrypted. CrossEscPos on this computer uses 127.0.0.1 and
  its listener port. Office printers do not automatically understand ESC/POS.
- Bluetooth: pair in Windows and select the **outgoing** SPP COM port. Refresh
  COM ports lists existing Windows serial devices, not nearby Bluetooth devices.
  BLE-only and proprietary non-ESC/POS protocols are not supported. Use a
  Windows driver or a model-specific integration for those devices.
- The bundled serial helper uses Windows PowerShell and .NET System.IO.Ports,
  without changing system execution policy or opening a visible console.
  Settings and binary data use stdin, never executable command interpolation.
  Enterprise policies blocking PowerShell may require Windows-driver mode.
- ESC/POS images preserve Myanmar fonts without text-code-page settings.
  Automatic head width is 384 dots for 50/58 mm and 576 for 80/85 mm, using
  GS v 0 raster images. Models requiring different image commands or head widths
  need model-specific troubleshooting or a Windows driver. Cutter is off by default.
- Transfers use paced 512-byte chunks and a 30-second timeout by default.
  Direct rendering is limited to 16000 CSS
  pixels. One print/check runs at a time; failed transfers are never retried.
- Check connection opens/closes the destination without print data. Test Print
  saves the current local setup and sends one synthetic receipt (subject to
  configured copies). Submitted means transport/queue submission, not proof of
  physical output. Check the printer before retrying an uncertain job.

### Verification

`npm --prefix desktop test` covers configuration, device isolation, Windows
options, encoding, TCP, and mocked serial operations.
`npm --prefix frontend test` covers forms, payload isolation and local layout.
`node desktop/scripts/printing-smoke.cjs` checks native settings screenshots,
PDF sizes/fonts, long TCP raster, and Bluetooth rendering with an injected serial
transport. Add `--emulator` to send one synthetic local emulator test.

Physical Canon/Epson and Bluetooth output still need model-specific testing.
COM discovery and mocked serial tests are not physical Bluetooth print tests.
The build verifies the renderer, printing modules and external serial helper.

References: [Windows serial API](https://learn.microsoft.com/en-us/dotnet/api/system.io.ports.serialport),
[Electron printing](https://www.electronjs.org/docs/latest/api/web-contents#contentsprintoptions-callback),
[Epson ESC *](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/esc_asterisk.html).

The desktop shell always loads its bundled React renderer, so it does not depend on a separately deployed `/app/` URL. The configured Laravel server is used only for the API, session, connectivity checks, and offline-sale synchronization. When startup cannot reach `/api/health`, the same bundled renderer opens the offline POS and reads products from a local SQLite database in Electron's user-data directory.

## Mode switching

- When the Laravel server is reachable, the user can switch from Online mode to Offline POS and back again.
- When the server becomes unreachable while Online mode is open, the desktop app switches to Offline POS automatically.
- Online mode cannot be selected while the server is unreachable.
- Online API calls pass through the Electron main process. Laravel session and CSRF cookies stay in Electron's protected cookie jar, including multipart payment screenshots and backup restores.
- When connectivity returns, Offline POS remains open so a cart is not discarded. **Go online & sync** becomes available and the user decides when to leave Offline POS.
- These controls exist only in Electron. The browser SPA remains online-only.

## Offline workflow

1. Sign in online with an active subscription and `Sell` page access.
2. The desktop app downloads active products, categories, sale settings, and prices. It refreshes the cache every five minutes and after relevant online edits.
3. If the server is unavailable at the next startup, only Offline POS is shown. Offline sales are fully paid, have no customer credit, and intentionally ignore cached/server stock.
4. Each completed offline sale opens the same configurable receipt preview used online. It can be printed through Electron's native print dialog immediately or reopened later from **Invoices**.
5. Reconnect and choose **Go online & sync**. Pending sales are submitted oldest first before normal online pages are available.
6. Deleted/changed products, changed prices, and insufficient stock mark only that local record as failed. The loop continues, and the failed row remains available to retry. Network/server interruptions leave the current row pending and pause the loop.

The server endpoint is idempotent by `offline_sale_uuid`, so retrying a request that already reached the server does not deduct stock twice.

## Development and builds

### Printing changes in 0.2.5

- Focusing Printer Name shows all discovered Windows queues and the local ESC/POS emulator; typing filters the list. Arrow keys and Enter select a printer. Custom local emulator ports remain editable.
- Microsoft Print to PDF and Adobe PDF selections use the built-in PDF exporter and a Save dialog, preserving thermal widths or A4 without depending on driver-specific custom forms. Cancelling does not save a file or submit a Windows job.
- Print errors omit Electron's IPC wrapper and display the full message.
- `node scripts/printing-smoke.cjs` checks the picker, native PDF output for both installed PDF queue names, all receipt widths, bundled fonts, pagination, and long ESC/POS raster output using synthetic data.

The bundled server is `https://www.pwarmyar.com/public`. Set
`MKPOS_SERVER_URL` only when intentionally targeting another deployment. After
first launch the editable copy is `desktop-config.json` under Electron's
user-data directory. Existing copies that still point to the former
`127.0.0.1:8000` development server are migrated to the production server.

The server URL is the backend public root, not a frontend path. The desktop app
never appends `/app/` and does not require the web build to be deployed.

```powershell
cd desktop
npm install
npm test
npm run dev
npm run dist:portable
```

`dist:portable` produces Windows x64 and 32-bit (`ia32`) portable executables under `release/electron`.

You can also double-click `build-mkpos-portable.cmd` in the project root to install dependencies, run desktop tests, and create the portable application. For automation without the final pause, run `build-mkpos-portable.cmd --no-pause`.
