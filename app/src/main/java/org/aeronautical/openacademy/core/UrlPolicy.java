package org.aeronautical.openacademy.core;

import java.net.URI;
import java.util.Locale;

/** HTTPS destinations are deliberately limited to the documented content providers. */
public final class UrlPolicy {
    private UrlPolicy() {}
    public static boolean allowed(String raw) {
        try {
            URI u = URI.create(raw);
            String h = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.ROOT);
            return raw.length() <= 2048 && "https".equalsIgnoreCase(u.getScheme())
                && u.getUserInfo() == null && (u.getPort() == -1 || u.getPort() == 443)
                && (h.equals("drive.google.com") || h.equals("docs.google.com")
                    || h.equals("drive.usercontent.google.com") || h.endsWith(".googleusercontent.com"));
        } catch (IllegalArgumentException e) { return false; }
    }
    public static void require(String raw) {
        if (!allowed(raw)) throw new IllegalArgumentException("Use an HTTPS Google Drive content link.");
    }
}
