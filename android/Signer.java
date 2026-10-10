import com.android.apksig.ApkSigner;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/** Signs an APK with APK Signature Scheme v2 using a PKCS12 keystore. */
public class Signer {
  public static void main(String[] a) throws Exception {
    if (a[0].equals("verify")) {
      com.android.apksig.ApkVerifier.Result r = new com.android.apksig.ApkVerifier.Builder(new File(a[1])).build().verify();
      System.out.println("verified=" + r.isVerified() + " v1=" + r.isVerifiedUsingV1Scheme() + " v2=" + r.isVerifiedUsingV2Scheme());
      for (Object e : r.getErrors()) System.out.println("error: " + e);
      System.exit(r.isVerified() ? 0 : 1);
    }
    String in = a[0], out = a[1], ks = a[2], alias = a[3], pass = a[4];
    KeyStore store = KeyStore.getInstance("PKCS12");
    try (FileInputStream f = new FileInputStream(ks)) { store.load(f, pass.toCharArray()); }
    PrivateKey key = (PrivateKey) store.getKey(alias, pass.toCharArray());
    X509Certificate cert = (X509Certificate) store.getCertificate(alias);
    ApkSigner.SignerConfig signer =
        new ApkSigner.SignerConfig.Builder("CERT", key, Collections.singletonList(cert)).build();
    new ApkSigner.Builder(Collections.singletonList(signer))
        .setInputApk(new File(in))
        .setOutputApk(new File(out))
        .setMinSdkVersion(24)
        .setV1SigningEnabled(false)   // v2 is enough for Android 7.0+ (minSdk 24)
        .setV2SigningEnabled(true)
        .build()
        .sign();
    System.out.println("signed " + out);
  }
}
