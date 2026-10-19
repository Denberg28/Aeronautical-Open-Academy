package org.aeronautical.openacademy.core;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;

public final class TransferPolicy {
    public static final long MAX_PDF_BYTES = 50L * 1024 * 1024;
    public static final int MAX_CATALOG_BYTES = 1024 * 1024;
    private TransferPolicy() {}
    public static void validatePdf(Path path, String expectedSha) throws IOException {
        long size = Files.size(path);
        if (size < 8 || size > MAX_PDF_BYTES) throw new IOException("PDF is empty or exceeds the 50 MB limit.");
        try (InputStream in = Files.newInputStream(path)) {
            byte[] header = new byte[5];
            int offset = 0;
            while (offset < header.length) {
                int n = in.read(header, offset, header.length - offset);
                if (n < 0) break;
                offset += n;
            }
            if (!java.util.Arrays.equals(header, new byte[]{37,80,68,70,45}))
                throw new IOException("This link did not return a PDF. Check Drive access and download permissions.");
        }
        if (expectedSha != null && !expectedSha.isEmpty() && !sha256(path).equalsIgnoreCase(expectedSha))
            throw new IOException("File verification failed. Ask your instructor to update the catalog.");
    }
    public static String sha256(Path path) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream in = Files.newInputStream(path)) {
                byte[] b = new byte[16384]; int n;
                while ((n = in.read(b)) != -1) digest.update(b, 0, n);
            }
            StringBuilder hex = new StringBuilder();
            for (byte value : digest.digest()) hex.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
            return hex.toString();
        } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
