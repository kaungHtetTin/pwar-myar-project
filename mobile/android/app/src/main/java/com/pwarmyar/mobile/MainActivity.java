package com.pwarmyar.mobile;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        android.webkit.WebView.enableSlowWholeDocumentDraw();
        registerPlugin(MkposPrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
