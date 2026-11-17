package org.aeronautical.openacademy;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Public navigation uses only reading metadata; submission still requires an authorized account. */
public final class PracticeTemplate {
    public final String key;
    public final List<Entry> entries;
    public static final class Entry {
        public final String key, title, kind, period, reading;
        Entry(JSONObject source,String period)throws Exception {
            key=source.getString("key");title=source.getString("title");kind=source.getString("kind");this.period=period;
            reading=kind.equals("material")?source.getString("body"):"";
        }
    }
    public PracticeTemplate(String raw)throws Exception {
        JSONObject source=new JSONObject(raw);key=source.getString("key");List<Entry> list=new ArrayList<>();
        list.add(new Entry(source.getJSONObject("overview"),"Course overview"));JSONArray periods=source.getJSONArray("periods");
        for(int n=0;n<periods.length();n++){JSONObject period=periods.getJSONObject(n);JSONArray items=period.getJSONArray("entries");for(int j=0;j<items.length();j++)list.add(new Entry(items.getJSONObject(j),period.getString("name")));}
        entries=Collections.unmodifiableList(list);
    }
    // UI — one vocabulary for public and account subject actions.
    public static String action(String kind,String assessmentType) {
        if(kind.equals("examination")||assessmentType.equals("examination"))return "Take examination";
        if(kind.equals("quiz"))return "Take quiz";
        if(kind.equals("activity"))return "Take activity";
        return "Read";
    }
}
