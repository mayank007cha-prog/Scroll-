import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;

import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/**
 * Signs an APK with APK Signature Scheme v2 (apksig) and verifies it. v1 (JAR)
 * signing is unnecessary from Android 7.0 (minSdk 24) and apksig 2.3.0's v1
 * signer no longer runs on current JDKs.
 * Usage: java -cp apksig.jar Sign.java in.apk out.apk keystore password alias
 */
public class Sign {
    public static void main(String[] args) throws Exception {
        File in = new File(args[0]);
        File out = new File(args[1]);
        char[] password = args[3].toCharArray();

        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream f = new FileInputStream(args[2])) {
            ks.load(f, password);
        }
        PrivateKey key = (PrivateKey) ks.getKey(args[4], password);
        X509Certificate cert = (X509Certificate) ks.getCertificate(args[4]);

        ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder(
                "CERT", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(signer))
                .setInputApk(in)
                .setOutputApk(out)
                .setMinSdkVersion(24)
                .setV1SigningEnabled(false)
                .setV2SigningEnabled(true)
                .build()
                .sign();

        ApkVerifier.Result result = new ApkVerifier.Builder(out).build().verify();
        System.out.println("verified=" + result.isVerified()
                + " v1=" + result.isVerifiedUsingV1Scheme()
                + " v2=" + result.isVerifiedUsingV2Scheme());
        if (!result.isVerified()) {
            for (Object e : result.getErrors()) System.out.println("error: " + e);
            System.exit(1);
        }
    }
}
