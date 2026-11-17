package com.pwarmyar.mobile;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.io.*;
import java.net.*;
import java.nio.file.Files;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

/** Run on a disposable emulator. Uses only loopback, no hardware or server sales data. */
@RunWith(AndroidJUnit4.class)
public class PrinterInstrumentedTest {
    static class Call extends PluginCall {
        final CountDownLatch done = new CountDownLatch(1); JSObject result; String error;
        Call(String method, JSObject data) { super(null, "MkposPrinter", "test", method, data); }
        @Override public void resolve(JSObject value) { result = value; done.countDown(); }
        @Override public void reject(String message) { error = message; done.countDown(); }
        void await() throws Exception { assertTrue("Native call timed out", done.await(40, TimeUnit.SECONDS)); assertNull(error, error); }
    }
    @Test public void checkSendsNothingThenReceiptSendsNonBlankRasterThroughTcp() throws Exception {
        assertTrue("Run only on an emulator", android.os.Build.FINGERPRINT.contains("generic") || android.os.Build.MODEL.contains("sdk"));
        File profile = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getNoBackupFilesDir(), "printer.json");
        byte[] original = profile.exists() ? Files.readAllBytes(profile.toPath()) : null;
        ExecutorService receiver = Executors.newSingleThreadExecutor();
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class); ServerSocket server = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))) {
            server.setSoTimeout(40000);
            AtomicReference<MkposPrinterPlugin> ref = new AtomicReference<>();
            scenario.onActivity(activity -> ref.set((MkposPrinterPlugin) activity.getBridge().getPlugin("MkposPrinter").getInstance()));
            MkposPrinterPlugin plugin = ref.get();
            JSObject config = new JSObject(); config.put("connection", "tcp"); config.put("paper", "58mm"); config.put("host", "127.0.0.1"); config.put("port", server.getLocalPort()); config.put("cut", true);
            JSObject settings = new JSObject(); settings.put("config", config);
            Call save = new Call("saveConfig", settings); plugin.saveConfig(save); save.await();
            Future<byte[]> checkBytes = receiver.submit(() -> read(server));
            Call check = new Call("checkConnection", settings); plugin.checkConnection(check); check.await(); assertEquals(0, checkBytes.get(5, TimeUnit.SECONDS).length);
            // A long receipt catches blank off-screen stripes and incorrect scale/clipping.
            String html = "<html><head><meta name='viewport' content='width=device-width'><style>html,body{margin:0;padding:0}body{height:600px}div{height:30px;background:black;width:100%}.end{position:absolute;top:570px}</style></head><body><div></div><div class='end'></div></body></html>";
            JSObject data = new JSObject(); data.put("html", html); data.put("kind", "receipt");
            Future<byte[]> printBytes = receiver.submit(() -> read(server));
            Call print = new Call("print", data); plugin.print(print); print.await();
            byte[] bytes = printBytes.get(5, TimeUnit.SECONDS);
            assertEquals("sent", print.result.getString("status")); assertEquals(27, bytes[0]); assertEquals(64, bytes[1]);
            int index = 2, rows = 0, firstBlack = 0, lastBlack = 0;
            while (bytes[index] == 29 && bytes[index + 1] == 118) {
                int width = (bytes[index + 4] & 255) + ((bytes[index + 5] & 255) << 8);
                int height = (bytes[index + 6] & 255) + ((bytes[index + 7] & 255) << 8);
                assertEquals(48, width); index += 8;
                for (int y = 0; y < height; y++) for (int x = 0; x < width; x++) {
                    int value = bytes[index++] & 255;
                    if (rows + y < 40) firstBlack += Integer.bitCount(value);
                    if (rows + y > 980) lastBlack += Integer.bitCount(value);
                }
                rows += height;
            }
            assertTrue("Physical height is independent of phone density: " + rows, rows > 1000 && rows < 1100);
            assertTrue("First stripe should be black", firstBlack > 10000);
            assertTrue("Receipt ending must render beyond viewport", lastBlack > 10000);
            assertArrayEquals(new byte[]{27,100,3,29,86,0}, java.util.Arrays.copyOfRange(bytes, index, bytes.length));
        } finally {
            receiver.shutdownNow();
            if (original == null) Files.deleteIfExists(profile.toPath()); else Files.write(profile.toPath(), original);
        }
    }
    private byte[] read(ServerSocket server) throws Exception {
        try (Socket socket = server.accept(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            socket.setSoTimeout(40000); byte[] buffer = new byte[4096]; int count;
            while ((count = socket.getInputStream().read(buffer)) != -1) out.write(buffer, 0, count);
            return out.toByteArray();
        }
    }
}
