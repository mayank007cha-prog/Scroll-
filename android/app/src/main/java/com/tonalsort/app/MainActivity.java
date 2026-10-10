package com.tonalsort.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Tonal Sort runs the bundled web game (assets/index.html) full screen,
 * edge to edge behind transparent system bars. The page talks back through
 * a small bridge for system haptics, and Back is handed to the page first.
 */
public class MainActivity extends Activity {

    private static final int WALLPAPER_BLUE = 0xFF0F2C6E;

    private WebView web;
    private float insetTopDp;
    private float insetBottomDp;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        goEdgeToEdge(getWindow());

        web = new WebView(this);
        web.setBackgroundColor(WALLPAPER_BLUE);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setHapticFeedbackEnabled(true);
        web.setLongClickable(false);
        web.setOnLongClickListener(new View.OnLongClickListener() {
            @Override
            public boolean onLongClick(View v) {
                return true; // no text-selection or link menus over the game
            }
        });

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true); // best time
        settings.setAllowFileAccess(true);
        // Lets the page read its own bundled icon pixels to detect their colors.
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setTextZoom(100);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        web.addJavascriptInterface(new Bridge(), "TonalNative");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("file".equals(url.getScheme())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception ignored) {
                    // no app can open it; stay in the game
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pushInsets();
            }
        });

        web.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                float density = getResources().getDisplayMetrics().density;
                int top;
                int bottom;
                if (Build.VERSION.SDK_INT >= 30) {
                    Insets bars = insets.getInsets(
                            WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                    top = bars.top;
                    bottom = bars.bottom;
                } else {
                    top = insets.getSystemWindowInsetTop();
                    bottom = insets.getSystemWindowInsetBottom();
                }
                insetTopDp = top / density;
                insetBottomDp = bottom / density;
                pushInsets();
                return insets;
            }
        });

        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    /** Draw behind the status and navigation bars, with light icons on the dark wallpaper. */
    @SuppressWarnings("deprecation")
    private static void goEdgeToEdge(Window window) {
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false);
        } else {
            window.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
        if (Build.VERSION.SDK_INT >= 29) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30
                    ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                    : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(lp);
        }
    }

    /** CSS px in the WebView are dp, so the insets go over as-is. */
    private void pushInsets() {
        if (web == null) return;
        web.evaluateJavascript(
                "document.documentElement.style.setProperty('--app-inset-t','" + insetTopDp + "px');"
                        + "document.documentElement.style.setProperty('--app-inset-b','" + insetBottomDp + "px');",
                null);
    }

    /** Back closes the menu, puts a lifted icon back, or leaves the game; otherwise exits. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript("window.tonalBack ? tonalBack() : false", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String handled) {
                if (!"true".equals(handled)) {
                    MainActivity.super.onBackPressed();
                }
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** Exposed to the page as window.TonalNative. */
    private final class Bridge {
        @JavascriptInterface
        public void haptic(final String kind) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (web != null) web.performHapticFeedback(feedbackFor(kind));
                }
            });
        }
    }

    /** Map the game's moments to the system's own haptic vocabulary. */
    private static int feedbackFor(String kind) {
        int sdk = Build.VERSION.SDK_INT;
        if ("lift".equals(kind)) {
            return sdk >= 34 ? HapticFeedbackConstants.DRAG_START : HapticFeedbackConstants.CLOCK_TICK;
        }
        if ("drop".equals(kind)) {
            return sdk >= 30 ? HapticFeedbackConstants.GESTURE_END : HapticFeedbackConstants.CONTEXT_CLICK;
        }
        if ("reject".equals(kind)) {
            return sdk >= 30 ? HapticFeedbackConstants.REJECT : HapticFeedbackConstants.LONG_PRESS;
        }
        if ("success".equals(kind)) {
            return sdk >= 30 ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.LONG_PRESS;
        }
        return HapticFeedbackConstants.CLOCK_TICK;
    }
}
