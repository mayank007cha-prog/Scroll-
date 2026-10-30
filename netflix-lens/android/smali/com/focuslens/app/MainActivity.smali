.class public Lcom/focuslens/app/MainActivity;
.super Landroid/app/Activity;
.source "MainActivity"

# A full-screen WebView that shows the prototype from the APK's assets.

.field private web:Landroid/webkit/WebView;

.method public constructor <init>()V
    .registers 1
    invoke-direct {p0}, Landroid/app/Activity;-><init>()V
    return-void
.end method

.method protected onCreate(Landroid/os/Bundle;)V
    .registers 7
    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    # No title bar, black system bars with light icons, black window behind the page
    const/4 v0, 0x1
    invoke-virtual {p0, v0}, Lcom/focuslens/app/MainActivity;->requestWindowFeature(I)Z
    invoke-virtual {p0}, Lcom/focuslens/app/MainActivity;->getWindow()Landroid/view/Window;
    move-result-object v0
    const/high16 v1, -0x1000000
    invoke-virtual {v0, v1}, Landroid/view/Window;->setStatusBarColor(I)V
    invoke-virtual {v0, v1}, Landroid/view/Window;->setNavigationBarColor(I)V
    new-instance v2, Landroid/graphics/drawable/ColorDrawable;
    invoke-direct {v2, v1}, Landroid/graphics/drawable/ColorDrawable;-><init>(I)V
    invoke-virtual {v0, v2}, Landroid/view/Window;->setBackgroundDrawable(Landroid/graphics/drawable/Drawable;)V
    invoke-virtual {v0}, Landroid/view/Window;->getDecorView()Landroid/view/View;
    move-result-object v2
    const/4 v3, 0x0
    invoke-virtual {v2, v3}, Landroid/view/View;->setSystemUiVisibility(I)V

    # WebView
    new-instance v2, Landroid/webkit/WebView;
    invoke-direct {v2, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V
    iput-object v2, p0, Lcom/focuslens/app/MainActivity;->web:Landroid/webkit/WebView;
    invoke-virtual {v2, v1}, Landroid/webkit/WebView;->setBackgroundColor(I)V
    const/4 v3, 0x0
    invoke-virtual {v2, v3}, Landroid/webkit/WebView;->setOverScrollMode(I)V
    invoke-virtual {v2, v3}, Landroid/webkit/WebView;->setVerticalScrollBarEnabled(Z)V
    invoke-virtual {v2, v3}, Landroid/webkit/WebView;->setHorizontalScrollBarEnabled(Z)V

    invoke-virtual {v2}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
    move-result-object v3
    const/4 v4, 0x1
    invoke-virtual {v3, v4}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
    invoke-virtual {v3, v4}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V
    # keep the layout at its designed size even with a large system font
    const/16 v4, 0x64
    invoke-virtual {v3, v4}, Landroid/webkit/WebSettings;->setTextZoom(I)V

    new-instance v3, Landroid/webkit/WebViewClient;
    invoke-direct {v3}, Landroid/webkit/WebViewClient;-><init>()V
    invoke-virtual {v2, v3}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V

    const-string v3, "file:///android_asset/index.html"
    invoke-virtual {v2, v3}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V
    invoke-virtual {p0, v2}, Lcom/focuslens/app/MainActivity;->setContentView(Landroid/view/View;)V
    return-void
.end method

.method protected onResume()V
    .registers 2
    invoke-super {p0}, Landroid/app/Activity;->onResume()V
    iget-object v0, p0, Lcom/focuslens/app/MainActivity;->web:Landroid/webkit/WebView;
    if-eqz v0, :done
    invoke-virtual {v0}, Landroid/webkit/WebView;->onResume()V
    :done
    return-void
.end method

.method protected onPause()V
    .registers 2
    iget-object v0, p0, Lcom/focuslens/app/MainActivity;->web:Landroid/webkit/WebView;
    if-eqz v0, :done
    invoke-virtual {v0}, Landroid/webkit/WebView;->onPause()V
    :done
    invoke-super {p0}, Landroid/app/Activity;->onPause()V
    return-void
.end method

# Back: let the page close the language sheet or quick view first; leave the app only if it didn't.
.method public onBackPressed()V
    .registers 4
    iget-object v0, p0, Lcom/focuslens/app/MainActivity;->web:Landroid/webkit/WebView;
    if-nez v0, :ask
    invoke-super {p0}, Landroid/app/Activity;->onBackPressed()V
    return-void
    :ask
    const-string v1, "(window.focusLensBack && window.focusLensBack()) ? 'y' : 'n'"
    new-instance v2, Lcom/focuslens/app/BackCallback;
    invoke-direct {v2, p0}, Lcom/focuslens/app/BackCallback;-><init>(Lcom/focuslens/app/MainActivity;)V
    invoke-virtual {v0, v1, v2}, Landroid/webkit/WebView;->evaluateJavascript(Ljava/lang/String;Landroid/webkit/ValueCallback;)V
    return-void
.end method

.method leave()V
    .registers 1
    invoke-super {p0}, Landroid/app/Activity;->onBackPressed()V
    return-void
.end method
