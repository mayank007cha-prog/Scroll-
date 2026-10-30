.class final Lcom/focuslens/app/BackCallback;
.super Ljava/lang/Object;
.source "BackCallback"

.implements Landroid/webkit/ValueCallback;

# Receives the page's answer to a back press: "y" when it handled it, anything else to leave the app.

.field private final activity:Lcom/focuslens/app/MainActivity;

.method constructor <init>(Lcom/focuslens/app/MainActivity;)V
    .registers 2
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    iput-object p1, p0, Lcom/focuslens/app/BackCallback;->activity:Lcom/focuslens/app/MainActivity;
    return-void
.end method

.method public onReceiveValue(Ljava/lang/Object;)V
    .registers 4
    if-eqz p1, :leave
    invoke-virtual {p1}, Ljava/lang/Object;->toString()Ljava/lang/String;
    move-result-object v0
    const-string v1, "y"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v0
    if-nez v0, :handled
    :leave
    iget-object v0, p0, Lcom/focuslens/app/BackCallback;->activity:Lcom/focuslens/app/MainActivity;
    invoke-virtual {v0}, Lcom/focuslens/app/MainActivity;->leave()V
    :handled
    return-void
.end method
