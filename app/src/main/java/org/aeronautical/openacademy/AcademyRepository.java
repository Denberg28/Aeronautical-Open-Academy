package org.aeronautical.openacademy;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.AtomicFile;
import androidx.lifecycle.MutableLiveData;
import org.json.JSONArray;
import org.json.JSONObject;
import org.aeronautical.openacademy.core.TransferPolicy;
import org.aeronautical.openacademy.core.UrlPolicy;
import java.io.*;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.CountDownLatch;

public final class AcademyRepository {
    public final MutableLiveData<Integer> changes=new MutableLiveData<>(0);
    public final ExecutorService io=Executors.newSingleThreadExecutor();
    private final Context context;
    private final SharedPreferences prefs;
    private final AtomicFile catalogFile,recordsFile;
    private final Map<String,Download> records=new LinkedHashMap<>();
    private final File directory;
    public volatile Catalog catalog;
    public volatile String notice="Loading your library…";
    public volatile boolean busy;
    private int revision;
    private final CountDownLatch ready=new CountDownLatch(1);
    public static final class Download {
        public final String id,title,key,sha;
        public final int revision;
        public final long bytes;
        Download(JSONObject j) throws Exception {
            id=j.getString("id"); title=j.getString("title"); key=j.getString("key");
            revision=j.getInt("revision"); bytes=j.getLong("bytes"); sha=j.getString("sha256");
            if(!id.matches("[a-z0-9-]{1,48}")||!key.equals(id+"-r"+revision)||!sha.matches("[a-f0-9]{64}")) throw new IOException("Invalid download record.");
        }
        JSONObject json() throws Exception {
            return new JSONObject().put("id",id).put("title",title).put("key",key).put("revision",revision).put("bytes",bytes).put("sha256",sha);
        }
    }
    AcademyRepository(Context c) {
        context=c.getApplicationContext(); prefs=c.getSharedPreferences("academy",Context.MODE_PRIVATE);
        directory=new File(c.getFilesDir(),"downloads");
        catalogFile=new AtomicFile(new File(c.getFilesDir(),"catalog.json"));
        recordsFile=new AtomicFile(new File(c.getFilesDir(),"downloads.json"));
        io.execute(this::load);
    }
    private void load() {
        try {
            if(!directory.isDirectory()&&!directory.mkdirs()) throw new IOException("Cannot create offline storage.");
            // WorkManager workers wait for readiness, so interrupted parts can be removed safely.
            File[] staleParts=directory.listFiles((dir,name)->name.endsWith(".part"));
            if(staleParts!=null)for(File partial:staleParts)partial.delete();
            String raw;
            try(InputStream in=catalogFile.openRead()) { raw=readText(in,TransferPolicy.MAX_CATALOG_BYTES); catalog=Catalog.parse(raw,false); }
            catch(Exception e) {
                try(InputStream in=context.getAssets().open("catalog.json")) { catalog=Catalog.parse(readText(in,TransferPolicy.MAX_CATALOG_BYTES),true); }
            }
            synchronized(this) {
                try(InputStream in=recordsFile.openRead()) {
                    JSONArray a=new JSONArray(readText(in,TransferPolicy.MAX_CATALOG_BYTES));
                    for(int i=0;i<a.length();i++) {
                        Download d=new Download(a.getJSONObject(i)); File file=file(d.key);
                        if(file.isFile()&&file.length()==d.bytes&&TransferPolicy.sha256(file.toPath()).equals(d.sha)) records.put(d.id,d);
                    }
                } catch(Exception e) { notice="Offline index checked; unavailable copies may need downloading again."; }
            }
            notice=catalog.demo?"Sample library · replace with your approved catalog":"Your catalog is ready";
        } catch(Exception e) { notice="Unable to load the library. Close and reopen the app, or check available storage."; }
        ready.countDown(); changed();
    }
    public void awaitReady() throws InterruptedException { ready.await(); }
    public String catalogUrl() { return prefs.getString("catalog_url",""); }
    public long lastSync() { return prefs.getLong("last_sync",0); }
    public void refresh(String url) {
        if(busy) return;
        UrlPolicy.require(url); busy=true; notice="Refreshing catalog…"; changed();
        io.execute(()->{
            HttpURLConnection connection=null;
            try {
                connection=SafeHttp.open(url); String raw;
                try(InputStream in=connection.getInputStream()) { raw=readText(in,TransferPolicy.MAX_CATALOG_BYTES); }
                Catalog next=Catalog.parse(raw,false);
                if(!catalogUrl().isEmpty()&&!catalogUrl().equals(url)) throw new IOException("This installation is already using another catalog. Contact your administrator before switching sources.");
                if(catalog!=null&&!catalog.demo&&next.version<catalog.version) throw new IOException("Older catalog rejected. Ask your instructor for the current version.");
                if(catalog!=null&&!catalog.demo)catalog.validateUpdate(next);
                write(catalogFile,raw);
                prefs.edit().putString("catalog_url",url).putLong("last_sync",System.currentTimeMillis()).commit();
                catalog=next; notice="Catalog updated. Saved PDFs stay available.";
            } catch(Exception e) { notice="Refresh failed; your previous library is kept. "+friendly(e); }
            finally { if(connection!=null) connection.disconnect(); busy=false; changed(); }
        });
    }
    public synchronized List<Download> downloads() { return new ArrayList<>(records.values()); }
    public synchronized Download download(String id) { return records.get(id); }
    public File file(String key) { if(!key.matches("[a-z0-9-]+-r[1-9][0-9]*")) throw new IllegalArgumentException("Invalid storage key"); return new File(directory,key+".pdf"); }
    public synchronized void complete(String id,String title,int version,File ready) throws Exception {
        JSONObject j=new JSONObject().put("id",id).put("title",title).put("key",id+"-r"+version).put("revision",version)
            .put("bytes",ready.length()).put("sha256",TransferPolicy.sha256(ready.toPath()));
        Download next=new Download(j); Download previous=records.put(id,next);
        try { saveRecords(); } catch(Exception e) { if(previous==null)records.remove(id);else records.put(id,previous);throw e; }
        if(previous!=null&&!previous.key.equals(next.key)) file(previous.key).delete();
        changed();
    }
    public void delete(Download d) {
        io.execute(()->{
            synchronized(this) {
                Download current=records.get(d.id);
                if(current==null||!current.key.equals(d.key)) return;
                try {
                    records.remove(d.id);
                    try { saveRecords(); } catch(Exception e) { records.put(d.id,d); throw e; }
                    if(!file(d.key).delete()&&file(d.key).exists()) notice="Copy removed from library; storage cleanup will be retried later.";
                    else notice="Offline copy deleted.";
                } catch(Exception e) { notice="Could not delete this copy. Try again."; }
            }
            changed();
        });
    }
    private void saveRecords() throws Exception {
        JSONArray a=new JSONArray(); for(Download d:records.values())a.put(d.json()); write(recordsFile,a.toString());
    }
    static void write(AtomicFile target,String raw) throws IOException {
        FileOutputStream out=target.startWrite();
        try { out.write(raw.getBytes(StandardCharsets.UTF_8)); target.finishWrite(out); }
        catch(IOException e) { target.failWrite(out);throw e; }
    }
    static String readText(InputStream in,int maximum) throws IOException {
        ByteArrayOutputStream out=new ByteArrayOutputStream(); byte[] buffer=new byte[8192];int n;
        while((n=in.read(buffer))!=-1) { if(out.size()+n>maximum)throw new IOException("Response exceeds the allowed size."); out.write(buffer,0,n); }
        return out.toString(StandardCharsets.UTF_8.name());
    }
    public synchronized void changed() { changes.postValue(++revision); }
    static String friendly(Exception e) {
        if(e instanceof java.net.SocketTimeoutException)return "Connection timed out. Try again on a stronger connection.";
        if(e instanceof java.net.UnknownHostException)return "No connection. You can still use saved materials.";
        if(e instanceof org.json.JSONException)return "Catalog format is invalid. Ask your instructor to validate it.";
        return e.getMessage()==null?"Please try again.":e.getMessage();
    }
}
