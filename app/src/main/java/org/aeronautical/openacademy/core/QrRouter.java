package org.aeronautical.openacademy.core;

import java.net.URI;
import java.util.Locale;
import java.util.Set;

/** QR values identify catalog entries; they never grant file or network access. */
public final class QrRouter {
    private QrRouter() {}
    public static String protectedSubject(String raw) {
        if(raw==null||raw.length()>512)return "";
        String value=raw.trim().toLowerCase(Locale.ROOT);
        if(value.startsWith("aoa://subject/"))value=value.substring(14);
        return value.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")?value:"";
    }
    public static String subject(String raw, Set<String> known) {
        if (raw == null || raw.length() > 512) throw new IllegalArgumentException("Code is empty or too long.");
        String id = raw.trim().toLowerCase(Locale.ROOT);
        if (id.startsWith("aoa://")) {
            try {
                URI uri = new URI(id);
                if (!"subject".equals(uri.getHost()) || uri.getRawQuery() != null || uri.getRawFragment() != null || uri.getUserInfo() != null || uri.getPort() != -1)
                    throw new IllegalArgumentException("Use a subject QR issued by the Academy.");
                id = uri.getRawPath().replaceFirst("^/", "");
            } catch (java.net.URISyntaxException e) { throw new IllegalArgumentException("Invalid subject QR."); }
        }
        if (!id.matches("[a-z0-9][a-z0-9-]{0,47}")) throw new IllegalArgumentException("Enter a subject code such as A.");
        if (!known.contains(id)) throw new IllegalArgumentException("Subject not in this catalog. Refresh it or check the code.");
        return id;
    }
}
