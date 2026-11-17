package com.pwarmyar.mobile;

import android.Manifest;
import android.bluetooth.*;
import android.content.Context;
import android.content.Intent;
import android.graphics.*;
import android.os.*;
import android.print.*;
import android.provider.Settings;
import android.util.AtomicFile;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

@CapacitorPlugin(name = "MkposPrinter", permissions = {@Permission(alias = "bluetooth", strings = {Manifest.permission.BLUETOOTH_CONNECT})})
public class MkposPrinterPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final ScheduledExecutorService watchdog = Executors.newSingleThreadScheduledExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private volatile Closeable connection;
    private WebView printView;
    private PluginCall activeCall;
    private PrintJob systemJob;
    private long started;
    private boolean pageStarted;
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private AtomicFile profileFile() { return new AtomicFile(new File(getContext().getNoBackupFilesDir(), "printer.json")); }
    private JSObject normalize(JSONObject source) throws Exception {
        JSObject c = new JSObject();
        String mode = source.optString("connection", "system"), paper = source.optString("paper", "80mm");
        if (!Arrays.asList("system", "tcp", "bluetooth").contains(mode)) throw new Exception("Choose a supported connection.");
        if (!Arrays.asList("50mm", "58mm", "80mm", "85mm", "a4").contains(paper)) throw new Exception("Choose a supported paper size.");
        if (!mode.equals("system") && paper.equals("a4")) throw new Exception("Direct thermal printing requires thermal paper.");
        String host = source.optString("host", "").trim();
        if (mode.equals("tcp") && (host.isEmpty() || host.length() > 253 || !host.matches("[a-zA-Z0-9][a-zA-Z0-9.-]*"))) throw new Exception("Enter a printer IP or hostname, without a URL or path.");
        int port = source.has("port") ? source.getInt("port") : 9100, copies = source.has("copies") ? source.getInt("copies") : 1;
        if ((source.has("port") && source.getDouble("port") != port) || (source.has("copies") && source.getDouble("copies") != copies)) throw new Exception("Port and copies must be whole numbers.");
        if (port < 1 || port > 65535 || copies < 1 || copies > 10) throw new Exception("Port must be 1–65535 and copies 1–10.");
        String address = source.optString("address", "");
        if (mode.equals("bluetooth") && !BluetoothAdapter.checkBluetoothAddress(address)) throw new Exception("Select a paired Bluetooth printer.");
        String bluetoothMode = source.optString("bluetooth_mode", "standard");
        if (!Arrays.asList("standard", "compatibility").contains(bluetoothMode)) throw new Exception("Choose a supported Bluetooth print mode.");
        c.put("connection", mode); c.put("paper", paper); c.put("host", host); c.put("port", port); c.put("address", address); c.put("copies", copies);
        c.put("bluetooth_mode", bluetoothMode);
        c.put("cut", source.optBoolean("cut", false)); c.put("color", source.optBoolean("color", true)); c.put("landscape", source.optBoolean("landscape", false));
        return c;
    }
    private JSObject readConfig() throws Exception {
        AtomicFile file = profileFile();
        return normalize(file.getBaseFile().exists() ? new JSONObject(new String(file.readFully(), StandardCharsets.UTF_8)) : new JSONObject());
    }
    @PluginMethod public void getConfig(PluginCall call) {
        try { call.resolve(readConfig()); } catch (Exception e) { call.reject("Cannot read this device's printer settings. Save a new configuration."); }
    }
    @PluginMethod public void saveConfig(PluginCall call) {
        if (busy.get()) { call.reject("Finish the current print/check first."); return; }
        try {
            JSObject clean = normalize(call.getObject("config", new JSObject())); AtomicFile file = profileFile(); FileOutputStream stream = null;
            try { stream = file.startWrite(); stream.write(clean.toString().getBytes(StandardCharsets.UTF_8)); file.finishWrite(stream); }
            catch (Exception e) { if (stream != null) file.failWrite(stream); throw e; }
            call.resolve(clean);
        } catch (Exception e) { call.reject("Settings not saved: " + e.getMessage()); }
    }
    @PluginMethod public void openBluetoothSettings(PluginCall call) {
        try { getActivity().startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)); call.resolve(); }
        catch (Exception e) { call.reject("Open Bluetooth pairing from Android Settings."); }
    }
    private boolean permission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 31 && getPermissionState("bluetooth") != PermissionState.GRANTED) { requestPermissionForAlias("bluetooth", call, "bluetoothPermission"); return false; }
        return true;
    }
    @PermissionCallback private void bluetoothPermission(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) { call.reject("Allow Nearby devices permission to use Bluetooth printing."); return; }
        if (call.getMethodName().equals("listPaired")) listPaired(call); else if (call.getMethodName().equals("checkConnection")) checkConnection(call); else print(call);
    }
    private BluetoothAdapter bluetooth() throws Exception {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null || !adapter.isEnabled()) throw new Exception("Enable Bluetooth and pair the printer in Android Settings."); return adapter;
    }
    @PluginMethod public void listPaired(PluginCall call) {
        if (!permission(call)) return;
        try {
            List<BluetoothDevice> devices = new ArrayList<>(bluetooth().getBondedDevices());
            devices.removeIf(d -> d.getType() == BluetoothDevice.DEVICE_TYPE_LE); devices.sort(Comparator.comparing(BluetoothDevice::getAddress));
            int offset = Math.max(0, call.getInt("offset", 0)), limit = Math.min(20, Math.max(1, call.getInt("limit", 10))); JSArray items = new JSArray();
            for (int i = offset; i < Math.min(devices.size(), offset + limit); i++) { BluetoothDevice d = devices.get(i); JSObject item = new JSObject(); item.put("address", d.getAddress()); item.put("name", d.getName() == null ? "Paired device" : d.getName()); items.put(item); }
            JSObject result = new JSObject(); result.put("items", items); result.put("total", devices.size()); call.resolve(result);
        } catch (Exception e) { call.reject(e.getMessage()); }
    }
    @PluginMethod public void checkConnection(PluginCall call) {
        try {
            JSObject c = normalize(call.getObject("config", new JSObject()));
            if (c.getString("connection").equals("system")) { JSObject r = new JSObject(); r.put("message", "Android selects and checks the destination in its print dialog. Use Test Print to open it."); call.resolve(r); return; }
            if (c.getString("connection").equals("bluetooth") && !permission(call)) return;
            if (!busy.compareAndSet(false, true)) { call.reject("Another print/check is active."); return; } transfer(call, c, null);
        } catch (Exception e) { call.reject(e.getMessage()); }
    }
    private void transfer(PluginCall call, JSObject c, List<byte[]> frames) {
        worker.execute(() -> {
            ThermalTransfer.Progress progress = new ThermalTransfer.Progress(SystemClock::elapsedRealtime);
            AtomicReference<Closeable> transport = new AtomicReference<>();
            ScheduledFuture<?> timeout = watchdog.scheduleAtFixedRate(() -> {
                if (progress.expireIfStalled()) {
                    Closeable socket = transport.get();
                    if (socket != null) try { socket.close(); } catch (IOException ignored) {}
                }
            }, 1, 1, TimeUnit.SECONDS);
            long began = SystemClock.elapsedRealtime();
            long plannedBytes = 0;
            if (frames != null) for (byte[] frame : frames) plannedBytes += (long) frame.length * c.optInt("copies", 1);
            Log.i("MkposPrinter", "Transfer start: connection=" + c.getString("connection") + " mode=" + c.getString("bluetooth_mode") + " plannedBytes=" + plannedBytes);
            JSObject result = null; String error = null;
            try {
                OutputStream out;
                if (c.getString("connection").equals("tcp")) { Socket socket = new Socket(); connection = socket; transport.set(socket); progress.check(); socket.connect(new InetSocketAddress(c.getString("host"), c.getInt("port")), 8000); out = socket.getOutputStream(); }
                else {
                    BluetoothDevice device = bluetooth().getRemoteDevice(c.getString("address")); if (device.getBondState() != BluetoothDevice.BOND_BONDED) throw new Exception("Pair this printer first.");
                    BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SPP); connection = socket; transport.set(socket); progress.check(); socket.connect(); out = socket.getOutputStream();
                }
                progress.check(); progress.touch();
                if (frames != null) ThermalTransfer.send(out, frames, c.getInt("copies"),
                    ThermalTransfer.Policy.forConnection(c.getString("connection"), c.getString("bluetooth_mode")), progress, Thread::sleep);
                progress.check();
                result = new JSObject(); result.put("status", frames == null ? "connected" : "sent");
                result.put("message", frames == null ? "Connection available. No receipt was sent; use Test Print to verify output." : "Receipt data sent. Check the printer before printing again.");
                Log.i("MkposPrinter", "Transfer sent: connection=" + c.getString("connection") + " mode=" + c.getString("bluetooth_mode") + " bytes=" + progress.bytesSent() + " elapsedMs=" + (SystemClock.elapsedRealtime() - began));
            } catch (Exception e) {
                error = (progress.expireIfStalled() ? "Printer connection stalled for 30 seconds." : "Cannot communicate with the printer. Check its address, pairing, power and ESC/POS support.") + (frames == null ? "" : " Output may be partial. Check the printer before retrying. If later receipts are garbled, restart the printer and try Compatibility mode.");
                Log.w("MkposPrinter", "Transfer failed: type=" + e.getClass().getSimpleName() + " bytes=" + progress.bytesSent() + " elapsedMs=" + (SystemClock.elapsedRealtime() - began));
            }
            finally { timeout.cancel(false); closeConnection(); busy.set(false); }
            if (error != null) call.reject(error); else call.resolve(result);
        });
    }
    private void closeConnection() { Closeable c = connection; connection = null; if (c != null) try { c.close(); } catch (Exception ignored) {} }
    @PluginMethod public void print(PluginCall call) {
        try {
            JSObject c = readConfig(); if (call.getString("kind", "document").equals("document")) { c.put("connection", "system"); c.put("paper", "a4"); }
            if (c.getString("connection").equals("bluetooth") && !permission(call)) return;
            String html = call.getString("html", "");
            if (html.isEmpty() || html.getBytes(StandardCharsets.UTF_8).length > 4000000 || !html.toLowerCase(Locale.ROOT).contains("<head")) throw new Exception("Invalid or oversized print document (maximum 4 MB).");
            if (!busy.compareAndSet(false, true)) { call.reject("Another print/check is active."); return; } getActivity().runOnUiThread(() -> render(call, c, html));
        } catch (Exception e) { call.reject(e.getMessage()); }
    }
    private void render(PluginCall call, JSObject config, String html) {
        activeCall = call; pageStarted = false;
        try {
            printView = new WebView(getActivity()); printView.setBackgroundColor(Color.WHITE);
            printView.getSettings().setJavaScriptEnabled(true); // Native readiness queries only; CSP blocks page scripts.
            printView.getSettings().setAllowFileAccess(false); printView.getSettings().setAllowContentAccess(false); printView.getSettings().setBlockNetworkLoads(true);
            printView.getSettings().setTextZoom(100);
            printView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
            int dots = config.getString("paper").matches("50mm|58mm") ? 384 : 576;
            int mm = config.getString("paper").equals("a4") ? 210 : Integer.parseInt(config.getString("paper").replace("mm", ""));
            float density = getContext().getResources().getDisplayMetrics().density;
            int renderWidth = Math.round(mm * 96f / 25.4f * density);
            printView.setInitialScale(Math.round(100 * density));
            printView.setHorizontalScrollBarEnabled(false); printView.setVerticalScrollBarEnabled(false);
            // Attach off-screen: visual-state callbacks require a real view hierarchy.
            printView.setTranslationX(-100000); printView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
            ((ViewGroup) getActivity().findViewById(android.R.id.content)).addView(printView, new ViewGroup.LayoutParams(renderWidth, 1));
            printView.measure(View.MeasureSpec.makeMeasureSpec(renderWidth, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(1, View.MeasureSpec.EXACTLY)); printView.layout(0, 0, renderWidth, 1);
            printView.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return true; }
                @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) { if (r.isForMainFrame() && activeCall == call) fail("Could not load the receipt. No print data was sent."); }
                @Override public void onPageFinished(WebView v, String url) { if (!pageStarted && activeCall == call) { pageStarted = true; ready(config, dots); } }
            });
            String csp = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; script-src 'none'\">";
            printView.loadDataWithBaseURL("https://mkpos-print.invalid/", html.replaceFirst("(?i)(<head[^>]*>)", "$1" + csp), "text/html", "UTF-8", null);
            main.postDelayed(() -> { if (activeCall == call && systemJob == null) fail("Preparing the receipt timed out. No print data was sent."); }, 20000);
        } catch (Exception e) { fail("Could not prepare the receipt. No print data was sent."); }
    }
    private void ready(JSObject config, int dots) {
        if (activeCall == null || printView == null) return;
        PluginCall preparing = activeCall;
        printView.evaluateJavascript("JSON.stringify({ready:document.fonts.status==='loaded'&&Array.from(document.images).every(i=>i.complete),height:Math.ceil(document.body.getBoundingClientRect().height),width:innerWidth})", value -> {
            if (activeCall != preparing || printView == null) return;
            try {
                JSONObject metrics = new JSONObject(new org.json.JSONTokener(value).nextValue().toString());
                if (!metrics.getBoolean("ready")) { main.postDelayed(() -> ready(config, dots), 100); return; }
                if (config.getString("connection").equals("system")) { systemPrint(config, metrics.getInt("height")); return; }
                int height = (int) Math.ceil(metrics.getDouble("height") * dots / metrics.getDouble("width"));
                if (height < 1 || height > 16000) { fail("Receipt exceeds the direct-print size limit. Use Android system printing."); return; }
                int renderWidth = printView.getWidth();
                int renderHeight = (int) Math.ceil(metrics.getDouble("height") * renderWidth / metrics.getDouble("width"));
                printView.getLayoutParams().height = renderHeight;
                printView.measure(View.MeasureSpec.makeMeasureSpec(renderWidth, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(renderHeight, View.MeasureSpec.EXACTLY)); printView.layout(0, 0, renderWidth, renderHeight);
                printView.postVisualStateCallback(0, new WebView.VisualStateCallback() {
                    @Override public void onComplete(long id) { if (activeCall == preparing) raster(config, dots, height); }
                });
            } catch (Exception e) { fail("Could not measure the receipt. No print data was sent."); }
        });
    }
    private void raster(JSObject config, int dots, int height) {
        if (activeCall == null || printView == null) return;
        try {
            List<byte[]> frames = new ArrayList<>(); frames.add(new byte[]{27,64});
            int bandRows = ThermalTransfer.Policy.forConnection(config.getString("connection"), config.getString("bluetooth_mode")).bandRows;
            for (int top = 0; top < height; top += bandRows) {
                int rows = Math.min(bandRows, height - top); Bitmap bitmap = Bitmap.createBitmap(dots, rows, Bitmap.Config.ARGB_8888);
                try { Canvas canvas = new Canvas(bitmap); canvas.drawColor(Color.WHITE); canvas.translate(0, -top); float scale = (float) dots / printView.getWidth(); canvas.scale(scale, scale); printView.draw(canvas); int[] pixels = new int[dots * rows]; bitmap.getPixels(pixels, 0, dots, 0, 0, dots, rows); frames.add(EscPosEncoder.stripe(pixels, dots, rows)); }
                finally { bitmap.recycle(); }
            }
            frames.add(config.getBoolean("cut") ? new byte[]{27,100,3,29,86,0} : new byte[]{27,100,3});
            PluginCall call = activeCall; activeCall = null; destroyView(); transfer(call, config, frames);
        } catch (Exception e) { fail("Could not render the thermal receipt. No print data was sent."); }
    }
    private void systemPrint(JSObject config, int cssHeight) throws Exception {
        PrintManager manager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE); if (manager == null) { fail("Android printing is unavailable."); return; }
        PrintAttributes.Builder attributes = new PrintAttributes.Builder();
        if (config.getString("paper").equals("a4")) attributes.setMediaSize(config.getBoolean("landscape") ? PrintAttributes.MediaSize.ISO_A4.asLandscape() : PrintAttributes.MediaSize.ISO_A4);
        else { int mm = Integer.parseInt(config.getString("paper").replace("mm", "")); int mils = (int) Math.ceil(Math.min(1000, Math.max(30, cssHeight * 25.4 / 96)) / 25.4 * 1000); attributes.setMediaSize(new PrintAttributes.MediaSize("MKPOS_RECEIPT", "PwarMyar " + mm + " mm", (int) Math.round(mm / 25.4 * 1000), mils)); attributes.setMinMargins(PrintAttributes.Margins.NO_MARGINS); }
        attributes.setColorMode(config.getBoolean("color") ? PrintAttributes.COLOR_MODE_COLOR : PrintAttributes.COLOR_MODE_MONOCHROME);
        String title = activeCall.getString("title", "PwarMyar Print"); systemJob = manager.print(title, printView.createPrintDocumentAdapter(title), attributes.build()); started = System.currentTimeMillis(); pollJob();
    }
    private void pollJob() {
        if (activeCall == null || systemJob == null) return;
        if (systemJob.isCancelled()) { fail("Printing cancelled. No automatic retry was made."); return; }
        if (systemJob.isFailed()) { fail("Android print job failed. Check the printer before retrying."); return; }
        if (systemJob.isCompleted()) { JSObject result = new JSObject(); result.put("status", "completed"); result.put("message", "Android reports the print job completed."); activeCall.resolve(result); activeCall = null; systemJob = null; destroyView(); busy.set(false); return; }
        if (System.currentTimeMillis() - started > 300000) { systemJob.cancel(); fail("Print status timed out. Check Android's print queue and printer before retrying."); return; }
        main.postDelayed(this::pollJob, 500);
    }
    private void fail(String message) { if (activeCall == null) return; activeCall.reject(message); activeCall = null; systemJob = null; destroyView(); busy.set(false); }
    private void destroyView() { if (printView != null) { printView.stopLoading(); if (printView.getParent() instanceof ViewGroup) ((ViewGroup) printView.getParent()).removeView(printView); printView.destroy(); printView = null; } }
    @Override protected void handleOnDestroy() { main.removeCallbacksAndMessages(null); closeConnection(); if (systemJob != null) systemJob.cancel(); fail("Printing interrupted because the app closed. Check output before retrying."); worker.shutdownNow(); watchdog.shutdownNow(); super.handleOnDestroy(); }
}
