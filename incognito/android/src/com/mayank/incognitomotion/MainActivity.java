package com.mayank.incognitomotion;

import android.animation.ArgbEvaluator;
import android.animation.ValueAnimator;
import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.view.animation.PathInterpolator;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Full-screen host for the Google → Incognito prototype. The page lives in
 * assets/index.html (the self-contained incognito-android.html); this activity
 * only gives it a window, keeps the system bars in step with Chrome's colours
 * and routes the back button into the page.
 */
public class MainActivity extends Activity {

    private static final int BASE = 0xff1f1f1f;

    private WebView web;
    private int statusColor = BASE;
    private int navColor = BASE;
    private ValueAnimator bars;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setBackgroundDrawable(new ColorDrawable(BASE));
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(BASE);
        window.setNavigationBarColor(BASE);

        web = new WebView(this);
        web.setBackgroundColor(BASE);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // Keep the design's exact type scale whatever the system font size.
        settings.setTextZoom(100);

        web.addJavascriptInterface(new Bridge(), "AndroidChrome");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // The prototype's links are placeholders; never navigate away.
                return true;
            }
        });

        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    /** Called from the page when Chrome switches between normal and Incognito. */
    public final class Bridge {
        @JavascriptInterface
        public void setBars(final String status, final String navigation) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    animateBars(Color.parseColor(status), Color.parseColor(navigation));
                }
            });
        }
    }

    private void animateBars(final int toStatus, final int toNav) {
        if (bars != null) {
            bars.cancel();
        }
        final int fromStatus = statusColor;
        final int fromNav = navColor;
        final ArgbEvaluator argb = new ArgbEvaluator();

        bars = ValueAnimator.ofFloat(0f, 1f);
        bars.setDuration(600);
        bars.setInterpolator(new PathInterpolator(0.2f, 0f, 0f, 1f));
        bars.addUpdateListener(new ValueAnimator.AnimatorUpdateListener() {
            @Override
            public void onAnimationUpdate(ValueAnimator animation) {
                float f = animation.getAnimatedFraction();
                statusColor = (Integer) argb.evaluate(f, fromStatus, toStatus);
                navColor = (Integer) argb.evaluate(f, fromNav, toNav);
                getWindow().setStatusBarColor(statusColor);
                getWindow().setNavigationBarColor(navColor);
            }
        });
        bars.start();
    }

    @Override
    public void onBackPressed() {
        // Back first leaves Incognito (or closes the menu); only then the app.
        web.evaluateJavascript("window.IncognitoPrototype ? IncognitoPrototype.back() : false",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String handled) {
                        if (!"true".equals(handled)) {
                            finish();
                        }
                    }
                });
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
