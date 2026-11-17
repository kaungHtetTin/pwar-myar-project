package com.pwarmyar.mobile;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

public class ThermalTransferTest {
    private List<byte[]> frames(int rows, int bands) {
        List<byte[]> result = new ArrayList<>(); result.add(new byte[]{27,64});
        int[] pixels = new int[576 * rows]; Arrays.fill(pixels, 0xff000000);
        for (int i = 0; i < bands; i++) result.add(EscPosEncoder.stripe(pixels, 576, rows));
        result.add(new byte[]{27,100,3}); return result;
    }
    private byte[] flatten(List<byte[]> frames) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] frame : frames) out.write(frame);
        return out.toByteArray();
    }
    @Test public void bluetoothProfilesUseSmallBandsAndCompatibilityIsGentler() {
        ThermalTransfer.Policy standard = ThermalTransfer.Policy.forConnection("bluetooth", "standard");
        ThermalTransfer.Policy slower = ThermalTransfer.Policy.forConnection("bluetooth", "compatibility");
        assertEquals(24, standard.bandRows); assertEquals(16, slower.bandRows);
        assertTrue(slower.chunkBytes < standard.chunkBytes);
        assertTrue(slower.chunkDelayMs > standard.chunkDelayMs);
        assertTrue(slower.settleMs > standard.settleMs);
        assertEquals(256, ThermalTransfer.Policy.forConnection("tcp", "standard").bandRows);
    }
    @Test public void consecutiveJobsAndCopiesPreserveEveryByteAndReset() throws Exception {
        for (String mode : new String[]{"standard", "compatibility"}) {
            ThermalTransfer.Policy policy = ThermalTransfer.Policy.forConnection("bluetooth", mode);
            List<byte[]> frames = frames(policy.bandRows, 3);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ThermalTransfer.Progress progress = new ThermalTransfer.Progress(() -> 0);
            ThermalTransfer.send(out, frames, 2, policy, progress, millis -> {});
            ThermalTransfer.send(out, frames, 1, policy, progress, millis -> {});
            ByteArrayOutputStream expected = new ByteArrayOutputStream();
            for (int i = 0; i < 3; i++) expected.write(flatten(frames));
            assertArrayEquals(expected.toByteArray(), out.toByteArray());
            assertEquals(expected.size(), progress.bytesSent());
        }
    }
    @Test public void flushesCompleteFramesAndWaitsBeforeReturningOrNextCopy() throws Exception {
        ThermalTransfer.Policy policy = ThermalTransfer.Policy.forConnection("bluetooth", "standard");
        List<byte[]> frames = frames(policy.bandRows, 2);
        List<String> events = new ArrayList<>();
        ByteArrayOutputStream out = new ByteArrayOutputStream() {
            @Override public void flush() { events.add("flush:" + size()); }
        };
        ThermalTransfer.send(out, frames, 2, policy, new ThermalTransfer.Progress(() -> 0), millis -> {
            events.add("pause:" + millis + ":" + out.size());
        });
        int jobBytes = flatten(frames).length;
        assertTrue(events.contains("flush:2"));
        assertTrue(events.contains("pause:" + policy.resetDelayMs + ":2"));
        assertTrue(events.contains("pause:" + policy.settleMs + ":" + jobBytes));
        assertEquals("pause:" + policy.settleMs + ":" + (jobBytes * 2), events.get(events.size() - 1));
    }
    @Test public void progressingLongJobsAreNotAbortedAfterThirtySeconds() throws Exception {
        ThermalTransfer.Policy policy = ThermalTransfer.Policy.forConnection("bluetooth", "compatibility");
        AtomicLong now = new AtomicLong();
        ThermalTransfer.Progress progress = new ThermalTransfer.Progress(now::get);
        ThermalTransfer.send(new ByteArrayOutputStream(), frames(policy.bandRows, 200), 2, policy, progress, millis -> {
            now.addAndGet(millis); assertFalse(progress.expireIfStalled());
        });
        assertTrue(now.get() > 30000); assertTrue(progress.bytesSent() > 0);
    }
    @Test public void blockedProgressTimesOutAndCannotResumeSilently() throws Exception {
        AtomicLong now = new AtomicLong();
        ThermalTransfer.Progress progress = new ThermalTransfer.Progress(now::get);
        now.set(29999); assertFalse(progress.expireIfStalled());
        progress.wrote(100);
        now.set(59998); assertFalse(progress.expireIfStalled());
        now.set(59999); assertTrue(progress.expireIfStalled());
        progress.touch();
        try { progress.check(); fail("Expired operation cannot resume"); } catch (IOException expected) {}
    }
    @Test public void partialFailureNeverRetriesOrStartsTheNextCopy() throws Exception {
        final int[] calls = {0};
        OutputStream out = new OutputStream() {
            @Override public void write(int value) { fail("Use bounded chunk writes"); }
            @Override public void write(byte[] data, int offset, int count) throws IOException {
                if (++calls[0] == 3) throw new IOException("Injected failure");
                assertTrue(count <= 128);
            }
        };
        try {
            ThermalTransfer.send(out, frames(16, 4), 2,
                ThermalTransfer.Policy.forConnection("bluetooth", "compatibility"),
                new ThermalTransfer.Progress(() -> 0), millis -> {});
            fail("Must report failure");
        } catch (IOException expected) { assertEquals("Injected failure", expected.getMessage()); }
        assertEquals(3, calls[0]);
    }
}
