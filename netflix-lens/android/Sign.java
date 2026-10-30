import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/** Signs an APK with the v2 scheme (enough for minSdk 24) using apksig, then verifies it. */
public class Sign {
  public static void main(String[] a) throws Exception {
    KeyStore ks = KeyStore.getInstance("PKCS12");
    try (FileInputStream in = new FileInputStream(a[2])) { ks.load(in, a[3].toCharArray()); }
    String alias = ks.aliases().nextElement();
    PrivateKey key = (PrivateKey) ks.getKey(alias, a[4].toCharArray());
    X509Certificate cert = (X509Certificate) ks.getCertificate(alias);
    ApkSigner.SignerConfig cfg = new ApkSigner.SignerConfig.Builder("CERT", key, Collections.singletonList(cert)).build();
    new ApkSigner.Builder(Collections.singletonList(cfg))
        .setInputApk(new File(a[0])).setOutputApk(new File(a[1]))
        .setV1SigningEnabled(false).setV2SigningEnabled(true)
        .build().sign();
    ApkVerifier.Result r = new ApkVerifier.Builder(new File(a[1])).build().verify();
    System.out.println("verified=" + r.isVerified() + " v1=" + r.isVerifiedUsingV1Scheme() + " v2=" + r.isVerifiedUsingV2Scheme());
    for (Object e : r.getErrors()) System.out.println("error: " + e);
    for (Object w : r.getWarnings()) System.out.println("warning: " + w);
    if (!r.isVerified()) System.exit(1);
  }
}
