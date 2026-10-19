package org.aeronautical.openacademy;

import org.aeronautical.openacademy.core.UrlPolicy;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.IOException;

final class SafeHttp {
    static final class TemporaryFailure extends IOException { TemporaryFailure(String s) { super(s); } }
    private SafeHttp() {}
    static HttpURLConnection open(String raw) throws IOException {
        String current=raw;
        for(int i=0;i<6;i++) {
            UrlPolicy.require(current);
            HttpURLConnection c=(HttpURLConnection)new URL(current).openConnection();
            c.setConnectTimeout(10000); c.setReadTimeout(15000); c.setInstanceFollowRedirects(false);
            c.setRequestProperty("User-Agent","AeronauticalOpenAcademy/0.1");
            c.setRequestProperty("Accept-Encoding","identity");
            try {
                int status=c.getResponseCode();
                if(status>=300&&status<400) {
                    String location=c.getHeaderField("Location");
                    if(location==null) throw new IOException("Content redirect is missing its destination.");
                    current=new URL(new URL(current),location).toString(); c.disconnect(); continue;
                }
                if(status==401||status==403) throw new IOException("Access denied. Ask your instructor to check sharing/download permissions. Sign-in is available in your browser.");
                if(status==404) throw new IOException("Resource unavailable. Refresh the catalog or contact your instructor.");
                if(status==429||status>=500) throw new TemporaryFailure("Content service is busy. Please try again later.");
                if(status!=200) throw new IOException("Content service returned HTTP "+status+". Try again later.");
                return c;
            } catch(IOException|RuntimeException e) { c.disconnect(); throw e; }
        }
        throw new IOException("Too many content redirects. Ask your instructor to check this link.");
    }
}
