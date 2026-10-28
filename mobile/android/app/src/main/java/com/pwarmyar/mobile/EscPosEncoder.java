package com.pwarmyar.mobile;
import java.io.ByteArrayOutputStream;
public final class EscPosEncoder {
    private EscPosEncoder() {}
    public static byte[] stripe(int[] pixels, int width, int height) {
        if (width < 8 || width > 832 || width % 8 != 0 || height < 1 || height > 256 || pixels.length != width * height) throw new IllegalArgumentException("Invalid raster dimensions");
        int rowBytes = width / 8;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(29); out.write(118); out.write(48); out.write(0); out.write(rowBytes & 255); out.write(rowBytes >> 8); out.write(height & 255); out.write(height >> 8);
        for (int y = 0; y < height; y++) for (int x = 0; x < width; x += 8) {
            int bits = 0;
            for (int b = 0; b < 8; b++) {
                int p = pixels[y * width + x + b], alpha = p >>> 24;
                int gray = (((p >> 16) & 255) * 299 + ((p >> 8) & 255) * 587 + (p & 255) * 114) / 1000;
                if ((gray * alpha + 255 * (255 - alpha)) / 255 < 180) bits |= 128 >> b;
            }
            out.write(bits);
        }
        return out.toByteArray();
    }
}
