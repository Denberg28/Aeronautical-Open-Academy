package org.aeronautical.openacademy;

import android.content.Context;
import org.json.JSONObject;
import org.aeronautical.openacademy.core.TransferPolicy;
import java.net.URI;
import java.net.URL;
import java.net.HttpURLConnection;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Account APIs use a separately configured organization origin, with no redirects. */
final class LearningApi {
    final AccountVault vault;
    private final Context context;
    static final class Failure extends IOException {
        final int status;Failure(int status,String message){super(message);this.status=status;}
    }
    LearningApi(Context c){context=c.getApplicationContext();vault=new AccountVault(c);}
    static String validateBase(String raw){
        try{
            URI uri=URI.create(raw.trim());String host=uri.getHost();
            boolean local=BuildConfig.DEBUG&&"http".equals(uri.getScheme())&&("10.0.2.2".equals(host)||"127.0.0.1".equals(host)||"localhost".equals(host));
            if(host==null||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null||(!"".equals(uri.getPath())&&!"/".equals(uri.getPath()))||(!local&&!"https".equals(uri.getScheme())))throw new IllegalArgumentException();
            return raw.trim().replaceAll("/$","");
        }catch(Exception e){throw new IllegalArgumentException("Use your organization’s HTTPS server address, without an API path.");}
    }
    private HttpURLConnection connection(String path,String method,boolean authenticated)throws Exception{
        if(!path.matches("/v1/[a-z0-9/?=&-]+"))throw new IllegalArgumentException("Invalid API action.");
        String base=validateBase(vault.base());HttpURLConnection c=(HttpURLConnection)new URL(base+path).openConnection();
        c.setConnectTimeout(10000);c.setReadTimeout(20000);c.setRequestMethod(method);c.setInstanceFollowRedirects(false);c.setRequestProperty("Accept","application/json");c.setRequestProperty("Accept-Encoding","identity");
        if(authenticated){String token=vault.token();if(token.isEmpty())throw new Failure(401,"Sign in to continue.");c.setRequestProperty("Authorization","Bearer "+token);}
        return c;
    }
    JSONObject request(String method,String path,JSONObject body,String key)throws Exception{
        HttpURLConnection c=connection(path,method,!path.equals("/v1/auth/login"));
        try{
            if(key!=null)c.setRequestProperty("Idempotency-Key",key);
            if(body!=null){byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);c.setRequestProperty("Content-Type","application/json");c.setDoOutput(true);c.setFixedLengthStreamingMode(bytes.length);try(OutputStream out=c.getOutputStream()){out.write(bytes);}}
            int status=c.getResponseCode();InputStream stream=status>=200&&status<300?c.getInputStream():c.getErrorStream();
            String raw;try(InputStream in=stream){raw=in==null?"{}":AcademyRepository.readText(in,8*1024*1024);}
            JSONObject response;
            try{response=new JSONObject(raw);}catch(Exception e){throw new Failure(status,"Server response is unavailable. Check the organization address.");}
            if(status<200||status>=300){if(status==401)vault.clear();throw new Failure(status,response.optString("error","Request unavailable. Try again."));}
            return response;
        }finally{c.disconnect();}
    }
    JSONObject request(String method,String path,JSONObject body)throws Exception{return request(method,path,body,null);}
    void upload(String id,InputStream source)throws Exception{
        // Stage locally to bound the upload and provide a fixed byte length to the server.
        File staged=File.createTempFile("upload-",".pdf",context.getCacheDir());HttpURLConnection c=null;
        try{
            try(InputStream in=source;OutputStream out=new FileOutputStream(staged)){copyBounded(in,out,TransferPolicy.MAX_PDF_BYTES);}
            TransferPolicy.validatePdf(staged.toPath(),"");c=connection("/v1/items/"+id+"/file","POST",true);c.setReadTimeout(150000);c.setRequestProperty("Content-Type","application/pdf");c.setDoOutput(true);c.setFixedLengthStreamingMode(staged.length());
            try(InputStream in=new FileInputStream(staged);OutputStream out=c.getOutputStream()){copyBounded(in,out,TransferPolicy.MAX_PDF_BYTES);}
            int status=c.getResponseCode();if(status<200||status>=300){String message="Upload failed. Check the PDF and connection.";InputStream error=c.getErrorStream();if(error!=null)try(InputStream in=error){message=new JSONObject(AcademyRepository.readText(in,65536)).optString("error",message);}throw new Failure(status,message);}
        }finally{if(c!=null)c.disconnect();staged.delete();}
    }
    File material(String id,boolean download)throws Exception{
        HttpURLConnection c=connection("/v1/items/"+id+"/content"+(download?"?download=1":""),"GET",true);
        File directory=new File(context.getCacheDir(),"protected-pdf");if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Not enough temporary storage.");
        File file=new File(directory,UUID.randomUUID()+".pdf");boolean complete=false;
        try{
            int status=c.getResponseCode();if(status!=200){String message="Material unavailable. Refresh or sign in again.";if(status==401)vault.clear();InputStream error=c.getErrorStream();if(error!=null)try(InputStream in=error){message=new JSONObject(AcademyRepository.readText(in,65536)).optString("error",message);}throw new Failure(status,message);}
            long length=c.getContentLengthLong();if(length>TransferPolicy.MAX_PDF_BYTES)throw new IOException("This material exceeds 50 MB.");
            try(InputStream in=c.getInputStream();OutputStream out=new FileOutputStream(file)){copyBounded(in,out,TransferPolicy.MAX_PDF_BYTES);}
            if(length>=0&&length!=file.length())throw new IOException("Transfer interrupted. Please try again.");
            TransferPolicy.validatePdf(file.toPath(),c.getHeaderField("X-Content-SHA256"));complete=true;return file;
        }finally{c.disconnect();if(!complete)file.delete();}
    }
    void exportReport(String subject,int offset,android.net.Uri destination)throws Exception{
        HttpURLConnection c=connection("/v1/subjects/"+subject+"/export?offset="+offset,"GET",true);
        try{
            int status=c.getResponseCode();if(status!=200){if(status==401)vault.clear();throw new Failure(status,"Report unavailable. Refresh your session and check subject access.");}
            if(!"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".equals(c.getContentType()))throw new IOException("The server did not return an Excel workbook.");
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=c.getInputStream()){copyBounded(in,bytes,16L*1024*1024);}byte[] data=bytes.toByteArray();
            if(data.length<4||data[0]!='P'||data[1]!='K'||(c.getContentLengthLong()>=0&&c.getContentLengthLong()!=data.length))throw new IOException("Report transfer is incomplete. Try again.");
            try(OutputStream out=context.getContentResolver().openOutputStream(destination,"wt")){if(out==null)throw new IOException("Cannot write to this location.");out.write(data);}
        }finally{c.disconnect();}
    }
    static void copyBounded(InputStream in,OutputStream out,long max)throws IOException{
        if(in==null)throw new IOException("File is unavailable.");byte[] buffer=new byte[16384];long total=0;int n;
        while((n=in.read(buffer))!=-1){total+=n;if(total>max)throw new IOException("File exceeds the allowed size.");out.write(buffer,0,n);}
    }
    void clearProtectedCache(){File directory=new File(context.getCacheDir(),"protected-pdf");File[] files=directory.listFiles();if(files!=null)for(File f:files)f.delete();}
}
