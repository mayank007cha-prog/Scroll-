package com.mayank.bistroconcept;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    // Immersive sticky + fullscreen + hidden navigation, so the prototype's own status bar shows.
    private static final int IMMERSIVE_FLAGS = 0x1000 | 0x4 | 0x2 | 0x400 | 0x200 | 0x100;

    private WebView web;
    // The page reports its state ("landing", "sheet", "home") through document.title.
    private String pageState = "landing";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        try {
            // LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES (API 28), set reflectively to build against old stubs.
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.getClass().getField("layoutInDisplayCutoutMode").setInt(lp, 1);
            window.setAttributes(lp);
        } catch (Exception ignored) {
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onReceivedTitle(WebView view, String title) {
                pageState = title;
            }
        });
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(IMMERSIVE_FLAGS);
    }

    @Override
    public void onBackPressed() {
        if ("sheet".equals(pageState) || "home".equals(pageState)) {
            web.loadUrl("javascript:window.__back && window.__back()");
        } else {
            super.onBackPressed();
        }
    }
}
