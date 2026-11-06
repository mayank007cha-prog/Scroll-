.class final Lcom/focuslens/app/AppBridge;
.super Ljava/lang/Object;
.source "AppBridge"

# Exposed to the page as window.FocusLensApp: lets the full-screen player rotate with the phone.

.field private final activity:Lcom/focuslens/app/MainActivity;

.method constructor <init>(Lcom/focuslens/app/MainActivity;)V
    .registers 2
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    iput-object p1, p0, Lcom/focuslens/app/AppBridge;->activity:Lcom/focuslens/app/MainActivity;
    return-void
.end method

# allowRotate(true): follow the sensor (portrait or landscape); allowRotate(false): back to portrait.
.method public allowRotate(Z)V
    .registers 4
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation
    iget-object v0, p0, Lcom/focuslens/app/AppBridge;->activity:Lcom/focuslens/app/MainActivity;
    if-eqz p1, :portrait
    const/16 v1, 0xa
    goto :set
    :portrait
    const/4 v1, 0x1
    :set
    invoke-virtual {v0, v1}, Lcom/focuslens/app/MainActivity;->setRequestedOrientation(I)V
    return-void
.end method
