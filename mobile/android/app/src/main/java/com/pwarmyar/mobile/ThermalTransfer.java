package com.pwarmyar.mobile;

import java.io.IOException;
import java.io.InterruptedIOException;
import java.io.OutputStream;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;

/** Serial, paced writes. A completed send is not confirmation of paper output. */
public final class ThermalTransfer {
    private ThermalTransfer() {}

    public static final class Policy {
        public final int bandRows, chunkBytes, chunkDelayMs, bandDelayMs, resetDelayMs, settleMs;
        private Policy(int rows, int chunk, int delay, int bandDelay, int resetDelay, int settle) {
            bandRows = rows; chunkBytes = chunk; chunkDelayMs = delay;
            bandDelayMs = bandDelay; resetDelayMs = resetDelay; settleMs = settle;
        }
        public static Policy forConnection(String connection, String mode) {
            if (!"bluetooth".equals(connection)) return new Policy(256, 512, 10, 0, 0, 0);
            return "compatibility".equals(mode)
                ? new Policy(16, 128, 20, 40, 200, 2500)
                : new Policy(24, 256, 10, 20, 100, 1500);
        }
    }

    public static final class Progress {
        public static final long STALL_MS = 30000;
        private final LongSupplier clock;
        private final AtomicLong lastActivity;
        private final AtomicLong bytes = new AtomicLong();
        private final AtomicBoolean expired = new AtomicBoolean();
        public Progress(LongSupplier clock) {
            this.clock = clock; lastActivity = new AtomicLong(clock.getAsLong());
        }
        public void wrote(int count) { bytes.addAndGet(count); touch(); }
        public void touch() { lastActivity.set(clock.getAsLong()); }
        public long bytesSent() { return bytes.get(); }
        public boolean expireIfStalled() {
            if (clock.getAsLong() - lastActivity.get() >= STALL_MS) expired.set(true);
            return expired.get();
        }
        public void check() throws IOException {
            if (expired.get()) throw new IOException("Printer transfer stalled");
            if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException("Printing interrupted");
        }
    }

    @FunctionalInterface public interface Pause { void sleep(long millis) throws InterruptedException; }

    public static void send(OutputStream out, List<byte[]> frames, int copies, Policy policy,
                            Progress progress, Pause pause) throws IOException, InterruptedException {
        if (copies < 1 || copies > 10 || frames.isEmpty()) throw new IllegalArgumentException("Invalid print job");
        for (int copy = 0; copy < copies; copy++) {
            for (int frame = 0; frame < frames.size(); frame++) {
                byte[] data = frames.get(frame);
                for (int offset = 0; offset < data.length; offset += policy.chunkBytes) {
                    progress.check();
                    int count = Math.min(policy.chunkBytes, data.length - offset);
                    out.write(data, offset, count);
                    progress.wrote(count);
                    pause.sleep(policy.chunkDelayMs);
                }
                progress.check();
                out.flush();
                // The reset and each image are separate frames: pause only after
                // the full command payload, never insert bytes inside an image.
                pause.sleep(frame == 0 ? policy.resetDelayMs : policy.bandDelayMs);
            }
            progress.check();
            out.flush();
            // Keep the socket and busy guard held through this conservative wait.
            // It reduces early closure; it is not a printer completion handshake.
            pause.sleep(policy.settleMs);
            progress.check();
        }
    }
}
