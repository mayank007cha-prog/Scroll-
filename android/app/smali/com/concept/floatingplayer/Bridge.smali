.class public Lcom/concept/floatingplayer/Bridge;
.super Ljava/lang/Object;

.field private final activity:Landroid/app/Activity;

.method public constructor <init>(Landroid/app/Activity;)V
    .registers 2
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    iput-object p1, p0, Lcom/concept/floatingplayer/Bridge;->activity:Landroid/app/Activity;
    return-void
.end method

.method public exit()V
    .registers 2
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation
    iget-object v0, p0, Lcom/concept/floatingplayer/Bridge;->activity:Landroid/app/Activity;
    invoke-virtual {v0}, Landroid/app/Activity;->finish()V
    return-void
.end method
