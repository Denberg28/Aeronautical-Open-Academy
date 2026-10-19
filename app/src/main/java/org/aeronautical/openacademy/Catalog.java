package org.aeronautical.openacademy;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.aeronautical.openacademy.core.UrlPolicy;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class Catalog {
    public final long version;
    public final String title;
    public final boolean demo;
    public final List<Subject> subjects;
    private Catalog(long version, String title, boolean demo, List<Subject> subjects) {
        this.version=version; this.title=title; this.demo=demo;
        this.subjects=Collections.unmodifiableList(subjects);
    }
    public static final class Subject {
        public final String id, code, title, description;
        public final boolean retired;
        public final List<Resource> resources;
        Subject(JSONObject j, Set<String> ids, boolean bundled) throws JSONException {
            id=id(j, "id", ids); code=text(j,"code",32); title=text(j,"title",160);
            description=text(j,"description",600); retired=j.optBoolean("retired",false);
            JSONArray a=j.getJSONArray("resources");
            if(a.length()>200) throw new JSONException("Too many resources.");
            List<Resource> r=new ArrayList<>();
            for(int i=0;i<a.length();i++) r.add(new Resource(a.getJSONObject(i),ids,bundled));
            resources=Collections.unmodifiableList(r);
        }
    }
    public static final class Resource {
        public final String id,title,module,description,source,url,sha256,license,plainText;
        public final int revision;
        public final boolean downloadable;
        Resource(JSONObject j, Set<String> ids, boolean bundled) throws JSONException {
            id=id(j,"id",ids); title=text(j,"title",160); module=text(j,"module",120);
            description=text(j,"description",1000); license=text(j,"license",240);
            source=text(j,"source",2048); url=j.optString("downloadUrl","");
            revision=(int)whole(j,"revision",Integer.MAX_VALUE); downloadable=j.optBoolean("downloadable",false);
            sha256=j.optString("sha256","");
            plainText=j.optString("text","");
            if(plainText.length()>12000)throw new JSONException("Text companion exceeds 12000 characters; split into modules.");
            if(revision<1 || (!sha256.isEmpty()&&!sha256.matches("[a-fA-F0-9]{64}"))) throw new JSONException("Invalid resource version/checksum.");
            if(!validSource(source,bundled) || (downloadable && !validSource(url,bundled))) throw new JSONException("Unsupported content source.");
            if(downloadable && !"application/pdf".equals(j.optString("mimeType"))) throw new JSONException("Only PDF offline copies are supported in this version.");
        }
        public String fileKey() { return id+"-r"+revision; }
        private static boolean validSource(String s,boolean bundled) {
            return UrlPolicy.allowed(s) || (bundled&&s.matches("asset://materials/[a-z0-9-]+\\.pdf"));
        }
    }
    public static Catalog parse(String raw, boolean bundled) throws JSONException {
        JSONObject j=new JSONObject(raw);
        if(whole(j,"schemaVersion",Integer.MAX_VALUE)!=1) throw new JSONException("Unsupported catalog format.");
        long version=whole(j,"version",Long.MAX_VALUE);
        if(version<1) throw new JSONException("Invalid catalog version.");
        JSONArray a=j.getJSONArray("subjects");
        if(a.length()<1||a.length()>100) throw new JSONException("Catalog must contain 1–100 subjects.");
        Set<String> ids=new HashSet<>(); List<Subject> subjects=new ArrayList<>();
        for(int i=0;i<a.length();i++) subjects.add(new Subject(a.getJSONObject(i),ids,bundled));
        return new Catalog(version,text(j,"title",160),bundled,subjects);
    }
    public Subject subject(String id) { for(Subject s:subjects) if(s.id.equals(id)) return s; return null; }
    public Set<String> subjectIds() { Set<String> ids=new HashSet<>(); for(Subject s:subjects) ids.add(s.id); return ids; }
    public void validateUpdate(Catalog next) throws java.io.IOException {
        java.util.Map<String,Resource> old=new java.util.HashMap<>();
        for(Subject s:subjects)for(Resource r:s.resources)old.put(r.id,r);
        for(Subject s:next.subjects)for(Resource r:s.resources) {
            Resource previous=old.get(r.id);
            if(previous==null)continue;
            if(r.revision<previous.revision)throw new java.io.IOException("Resource revision moved backwards. Ask your instructor to correct the catalog.");
            if(r.revision==previous.revision&&(!r.url.equals(previous.url)||!r.sha256.equals(previous.sha256)))
                throw new java.io.IOException("Resource content changed without a revision update. Ask your instructor to increment its revision.");
        }
    }
    private static String id(JSONObject j,String key,Set<String> ids) throws JSONException {
        String s=j.getString(key);
        if(!s.matches("[a-z0-9][a-z0-9-]{0,47}")||!ids.add(s)) throw new JSONException("Invalid or duplicate ID.");
        return s;
    }
    private static String text(JSONObject j,String key,int max) throws JSONException {
        String s=j.getString(key).trim();
        if(s.isEmpty()||s.length()>max) throw new JSONException("Invalid "+key+".");
        return s;
    }
    private static long whole(JSONObject j,String key,long max) throws JSONException {
        Object value=j.get(key);
        if(!(value instanceof Integer)&&!(value instanceof Long))throw new JSONException("Expected integer "+key+".");
        long n=((Number)value).longValue();
        if(n<1||n>max)throw new JSONException("Invalid "+key+".");
        return n;
    }
}
