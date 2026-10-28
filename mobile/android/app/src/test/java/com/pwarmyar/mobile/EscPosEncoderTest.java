package com.pwarmyar.mobile;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.Arrays;

public class EscPosEncoderTest {
    @Test public void encodesBlackBitsMostSignificantFirst() {
        int[] pixels = new int[8]; Arrays.fill(pixels, 0xffffffff); pixels[0] = 0xff000000; pixels[7] = 0xff000000;
        assertArrayEquals(new byte[]{29,118,48,0,1,0,1,0,(byte)129}, EscPosEncoder.stripe(pixels, 8, 1));
    }
    @Test public void transparentPixelsAreWhite() {
        assertEquals(0, EscPosEncoder.stripe(new int[8], 8, 1)[8]);
    }
    @Test public void encodes256RowsLittleEndian() {
        byte[] stripe = EscPosEncoder.stripe(new int[576 * 256], 576, 256);
        assertEquals(72, stripe[4]); assertEquals(0, stripe[6]); assertEquals(1, stripe[7]); assertEquals(8 + 72 * 256, stripe.length);
    }
    @Test(expected = IllegalArgumentException.class) public void rejectsUnalignedWidth() { EscPosEncoder.stripe(new int[9], 9, 1); }
    @Test(expected = IllegalArgumentException.class) public void rejectsWrongPixelCount() { EscPosEncoder.stripe(new int[1], 8, 1); }
}
