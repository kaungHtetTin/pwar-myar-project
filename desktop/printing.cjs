const { randomUUID } = require('node:crypto');
const { rasterCommands, sendTcpBytes } = require('./escpos.cjs');
const { fromLegacy, normalizeConfig } = require('./printer-config.cjs');
const PAPER_WIDTHS = { '50mm': 50, '58mm': 58, '80mm': 80, '85mm': 85 };
const DOCUMENT_PAPERS = { a5: 'A5', a4: 'A4' };
const EMULATOR_PRINTER = 'escpos://127.0.0.1:9100';

function customPaperDimensions(paperSize) {
  const match = String(paperSize || '').trim().match(/^(\d+(?:\.\d+)?)mm\s+(\d+(?:\.\d+)?)mm$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width >= 15 && width <= 400 && height >= 18 && height <= 600 ? { width, height } : null;
}

function printerNames(printers = []) {
  return printers.map((printer) => String(printer?.name || '').trim()).filter(Boolean);
}

function resolvePrinter(printers, requestedName = '') {
  const name = String(requestedName).trim();
  const printer = name ? printers.find((item) => item.name === name) : printers.find((item) => item.isDefault);
  if (!printer) throw new Error(name
    ? `Printer "${name}" is not installed. Refresh printers in Settings and select an available printer.`
    : 'No default printer is available. Select a printer in Settings or set a Windows default printer.');
  return printer;
}

function dialogPrintOptions({ deviceName, paperSize = '80mm', heightMm = 100, settings = {} } = {}) {
  if (!deviceName) throw new Error('A resolved printer name is required.');
  const customPaper = customPaperDimensions(paperSize);
  if (!DOCUMENT_PAPERS[paperSize] && !PAPER_WIDTHS[paperSize] && !customPaper) throw new Error('Unsupported print paper size.');
  if (!Number.isFinite(heightMm) || heightMm <= 0) throw new Error('Invalid print document height.');
  const config = normalizeConfig({ windows: settings }).windows;
  return {
    silent: config.silent, printBackground: true, deviceName,
    margins: { marginType: config.margins }, landscape: config.landscape, scaleFactor: config.scale,
    copies: config.copies, color: config.color, duplexMode: config.duplex,
    ...(config.dpi ? { dpi: { horizontal: config.dpi, vertical: config.dpi } } : {}),
    // Explicit page dimensions avoid inheriting an unrelated default printer's media.
    // Long receipts paginate at one metre instead of requesting an unbounded roll.
    ...(config.media === 'driver' ? { usePrinterDefaultPageSize: true } : { pageSize: DOCUMENT_PAPERS[paperSize] || {
      width: (customPaper?.width || PAPER_WIDTHS[paperSize]) * 1000,
      height: Math.ceil(customPaper?.height || Math.min(1000, Math.max(30, heightMm))) * 1000,
    } }),
  };
}

function createPrintService({ BrowserWindow, getMainWindow, savePdf, sendSerialBytes, log = () => {}, versions = {}, preparationTimeoutMs = 20000, printTimeoutMs = 300000 }) {
  let busy = false;
  const printDocument = async function(payload) {
    if (busy) throw new Error('Another print job is already active. Finish or cancel it before printing again.');
    const html = String(payload?.html || '');
    if (!html || Buffer.byteLength(html, 'utf8') > 4_000_000) throw new Error('The print document is empty or too large (maximum 4 MB).');
    const paperSize = payload?.paperSize || '80mm';
    const customPaper = customPaperDimensions(paperSize);
    if (!DOCUMENT_PAPERS[paperSize] && !PAPER_WIDTHS[paperSize] && !customPaper) throw new Error('Unsupported print paper size.');
    const config = payload?.printerConfig ? normalizeConfig(payload.printerConfig) : fromLegacy(payload?.printerName);
    const direct = config.connection !== 'windows';
    if (direct && DOCUMENT_PAPERS[paperSize]) throw new Error('Direct ESC/POS supports thermal receipts. Select a Windows printer for A4 or A5 documents.');
    busy = true;
    const jobId = randomUUID();
    let printWindow;
    let timer;
    let stage = 'printer discovery';
    let deviceName = config.connection === 'windows' ? config.windows.printerName : config.connection === 'tcp' ? `${config.tcp.host}:${config.tcp.port}` : config.bluetooth.port;
    let rejectLifecycle;
    const lifecycle = new Promise((_, reject) => { rejectLifecycle = reject; });
    lifecycle.catch(() => {});
    const deadline = (ms, message) => {
      clearTimeout(timer);
      timer = setTimeout(() => rejectLifecycle(new Error(message)), ms);
    };
    try {
      deadline(preparationTimeoutMs, 'Preparing the print document timed out. Please try again.');
      const owner = getMainWindow();
      if (!owner || owner.isDestroyed()) throw new Error('The application window is no longer available.');
      if (!direct) {
        const printers = await Promise.race([owner.webContents.getPrintersAsync(), lifecycle]);
        const printer = resolvePrinter(printers, deviceName);
        deviceName = printer.name;
        log('INFO', 'Printer resolved', { jobId, deviceName, printerStatus: printer.status });
      }
      log('INFO', 'Print job preparing', { jobId, deviceName, paperSize, versions });
      stage = 'document loading';
      printWindow = new BrowserWindow({
        show: false, parent: owner, title: 'PwarMyar Print',
        width: DOCUMENT_PAPERS[paperSize] ? 900 : 440, height: 760, backgroundColor: '#ffffff', autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: false, partition: 'mkpos-print', backgroundThrottling: false },
      });
      printWindow.on('closed', () => rejectLifecycle(Object.assign(new Error('Print window closed.'), { cancelled: true })));
      printWindow.webContents.on('render-process-gone', () => rejectLifecycle(new Error('The print renderer stopped. Please try again.')));
      printWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      printWindow.webContents.on('will-navigate', (event) => event.preventDefault());
      const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; font-src data:; img-src data:; script-src \'none\'">';
      const securedHtml = html.replace(/<head\b[^>]*>/i, (head) => head + csp);
      if (securedHtml === html) throw new Error('The print document must contain a head element.');
      await Promise.race([printWindow.loadURL(`data:text/html;base64,${Buffer.from(securedHtml).toString('base64')}`), lifecycle]);
      stage = 'font and layout preparation';
      const measured = await Promise.race([printWindow.webContents.executeJavaScript(`(async () => {
        await document.fonts.ready;
        await Promise.all(Array.from(document.images, image => image.decode().catch(() => {})));
        const content = document.querySelector('.receipt-shell') || document.body;
        const bounds = content.getBoundingClientRect();
        return { heightMm: Math.ceil(bounds.height * 25.4 / 96) + 1, width: Math.ceil(bounds.width), height: Math.ceil(bounds.height) };
      })()`), lifecycle]);
      if (direct) {
        stage = 'ESC/POS raster rendering';
        if (measured.height > 16000) throw new Error('This receipt is too long for direct ESC/POS. Use Windows printing for this document.');
        const dots = config.thermal.widthDots || ((customPaper?.width || PAPER_WIDTHS[paperSize]) <= 58 ? 384 : 576);
        // Large compositor surfaces can fail on Windows GPUs. Capture bounded
        // viewport strips, then concatenate their BGRA pixels before encoding.
        printWindow.setContentSize(measured.width, 900);
        const bitmaps = [];
        let rasterHeight = 0;
        for (let top = 0; top < measured.height; top += 800) {
          const rows = Math.min(800, measured.height - top);
          const scrollY = await Promise.race([printWindow.webContents.executeJavaScript(`(async () => {
            window.scrollTo(0, ${top});
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            return window.scrollY;
          })()`), lifecycle]);
          const screenshot = await Promise.race([printWindow.webContents.capturePage({ x: 0, y: Math.round(top - scrollY), width: measured.width, height: rows }, { stayHidden: true, stayAwake: true }), lifecycle]);
          const strip = screenshot.resize({ width: dots, quality: 'best' });
          bitmaps.push(strip.toBitmap());
          rasterHeight += strip.getSize().height;
        }
        const raster = { getSize: () => ({ width: dots, height: rasterHeight }), toBitmap: () => Buffer.concat(bitmaps) };
        stage = 'ESC/POS transmission';
        // Each transport owns its deadline and closes the connection/process before
        // rejecting. Never release the print lock while a timed-out sender continues.
        clearTimeout(timer);
        log('INFO', 'Sending ESC/POS receipt', { jobId, connection: config.connection, deviceName, paperSize, pixels: raster.getSize() });
        const bytes = rasterCommands(raster.toBitmap(), dots, rasterHeight, config.thermal);
        if (config.connection === 'bluetooth') {
          if (!sendSerialBytes) throw new Error('Bluetooth serial printing is unavailable in this build.');
          await sendSerialBytes(config, bytes);
        } else await sendTcpBytes(config.tcp, bytes, config.thermal);
        log('INFO', 'Print job submitted', { jobId, deviceName });
        return { ok: true, status: 'submitted', mode: config.connection === 'bluetooth' ? 'bluetooth' : 'escpos', jobId };
      }
      // Windows PDF drivers reject arbitrary roll dimensions. Use Chromium's PDF
      // renderer for these explicit virtual-printer selections, with a Save dialog.
      if (/^(Microsoft Print to PDF|Adobe PDF)$/i.test(deviceName) && savePdf) {
        stage = 'PDF rendering';
        const pdf = await Promise.race([printWindow.webContents.printToPDF({
          printBackground: true, preferCSSPageSize: false,
          landscape: config.windows.landscape, scale: config.windows.scale / 100,
          pageSize: DOCUMENT_PAPERS[paperSize] || {
            width: (customPaper?.width || PAPER_WIDTHS[paperSize]) / 25.4,
            height: (customPaper?.height || Math.ceil(Math.min(1000, Math.max(30, measured.heightMm)))) / 25.4,
          },
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        }), lifecycle]);
        stage = 'PDF save dialog';
        // A user-controlled Save dialog may remain open as long as needed.
        clearTimeout(timer);
        const saved = await savePdf(owner, pdf);
        const status = saved ? 'saved' : 'cancelled';
        log('INFO', `Print job ${status}`, { jobId, deviceName, mode: 'pdf' });
        return { ok: saved, cancelled: !saved, status, mode: 'pdf', jobId };
      }
      const options = dialogPrintOptions({ deviceName, paperSize, heightMm: measured.heightMm, settings: config.windows });
      if (options.usePrinterDefaultPageSize) await Promise.race([printWindow.webContents.insertCSS('@page { size: auto; }'), lifecycle]);
      else if (!DOCUMENT_PAPERS[paperSize]) await Promise.race([printWindow.webContents.insertCSS(`@page { size: ${options.pageSize.width / 1000}mm ${options.pageSize.height / 1000}mm; margin: 0; }`), lifecycle]);
      stage = 'native print dialog';
      log('INFO', 'Opening print dialog', { jobId, deviceName, paperSize, measured, options });
      if (!options.silent) { printWindow.show(); printWindow.focus(); }
      deadline(printTimeoutMs, 'The print dialog did not finish. Check the Windows queue before retrying; the job may already have been submitted.');
      const submit = (printOptions) => Promise.race([new Promise((resolve, reject) => {
        printWindow.webContents.print(printOptions, (success, reason = '') => {
          if (success) resolve({ ok: true, status: 'submitted', jobId });
          else if (/cancel/i.test(reason)) resolve({ ok: false, cancelled: true, status: 'cancelled', jobId });
          else reject(new Error(reason || 'Print job failed'));
        });
      }), lifecycle]);
      let result;
      try {
        result = await submit(options);
      } catch (error) {
        // A rejected settings validation has not submitted a job. Some roll
        // drivers only accept their installed form, rather than a custom length.
        if (!/invalid printer settings/i.test(error.message) || !PAPER_WIDTHS[paperSize] || options.usePrinterDefaultPageSize) throw error;
        const fallback = dialogPrintOptions({ deviceName, paperSize, heightMm: measured.heightMm,
          settings: { ...config.windows, media: 'driver', color: false } });
        await Promise.race([printWindow.webContents.insertCSS('@page { size: auto; }'), lifecycle]);
        log('INFO', 'Using thermal driver default paper after settings rejection', { jobId, deviceName, options: fallback });
        result = await submit(fallback);
      }
      log('INFO', `Print job ${result.status}`, { jobId, deviceName });
      return result;
    } catch (error) {
      if (error.cancelled) return { ok: false, cancelled: true, status: 'cancelled', jobId };
      log('ERROR', 'Print job failed', { jobId, deviceName, paperSize, stage, reason: error.message, versions });
      if (/invalid printer settings/i.test(error.message)) throw new Error(`Windows rejected the settings for "${deviceName}" (${paperSize}). In Windows Printing preferences, select the matching paper width and confirm the printer's port, then print a Windows test page. Reference: ${jobId}`);
      throw error;
    } finally {
      clearTimeout(timer);
      if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
      busy = false;
    }
  };
  printDocument.isBusy = () => busy;
  return printDocument;
}

module.exports = { dialogPrintOptions, printerNames, resolvePrinter, createPrintService, EMULATOR_PRINTER };
