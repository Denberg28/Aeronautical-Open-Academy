package org.aeronautical.openacademy;

import android.content.Context;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;
import androidx.annotation.NonNull;
import androidx.work.Data;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.aeronautical.openacademy.core.TransferPolicy;
import java.io.*;
import java.net.HttpURLConnection;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;

public final class DownloadWorker extends Worker {
    public DownloadWorker(@NonNull Context c,@NonNull WorkerParameters p) { super(c,p); }
    @NonNull @Override public Result doWork() {
        AcademyRepository repo=((AcademyApp)getApplicationContext()).repository();
        File part=null; HttpURLConnection connection=null;
        try {
            repo.awaitReady();
            String id=getInputData().getString("id"), title=getInputData().getString("title"), source=getInputData().getString("url");
            int version=getInputData().getInt("revision",0);
            String checksum=getInputData().getString("sha256");
            if(id==null||title==null||source==null||version<1)throw new IOException("Download request is incomplete.");
            File target=repo.file(id+"-r"+version);
            AcademyRepository.Download existing=repo.download(id);
            if(existing!=null&&existing.revision==version&&target.isFile()) {
                TransferPolicy.validatePdf(target.toPath(),existing.sha); return Result.success();
            }
            part=new File(target.getParentFile(),target.getName()+".part");
            if(part.exists()&&!part.delete())throw new IOException("Cannot restart partial download. Check storage.");
            long expected=-1; InputStream stream;
            if(source.matches("asset://materials/[a-z0-9-]+\\.pdf")) stream=getApplicationContext().getAssets().open(source.substring(8));
            else {
                connection=SafeHttp.open(source); expected=connection.getContentLengthLong();
                if(expected>TransferPolicy.MAX_PDF_BYTES)throw new IOException("This PDF exceeds the 50 MB download limit.");
                stream=connection.getInputStream();
            }
            try(InputStream in=stream) {
                long needed=(expected>0?expected:TransferPolicy.MAX_PDF_BYTES)+2*1024*1024;
                if(target.getParentFile().getUsableSpace()<needed)throw new IOException("Not enough storage. Delete an offline copy and try again.");
                try(FileOutputStream out=new FileOutputStream(part)) {
                    byte[] buffer=new byte[16384]; int n; long total=0,last=0;
                    while((n=in.read(buffer))!=-1) {
                        if(isStopped())throw new IOException("Download cancelled. You can restart it later.");
                        total+=n;
                        if(total>TransferPolicy.MAX_PDF_BYTES)throw new IOException("This PDF exceeds the 50 MB download limit.");
                        out.write(buffer,0,n);
                        if(total-last>=256*1024) {
                            setProgressAsync(new Data.Builder().putInt("percent",expected>0?(int)(total*100/expected):-1).build()); last=total;
                        }
                    }
                    if(expected>=0&&total!=expected)throw new IOException("Download interrupted. Your existing offline copy is kept.");
                    out.getFD().sync();
                }
            }
            if(isStopped())throw new IOException("Download cancelled.");
            TransferPolicy.validatePdf(part.toPath(),checksum);
            try(ParcelFileDescriptor descriptor=ParcelFileDescriptor.open(part,ParcelFileDescriptor.MODE_READ_ONLY);
                PdfRenderer pdf=new PdfRenderer(descriptor)) {
                if(pdf.getPageCount()<1)throw new IOException("The PDF has no readable pages.");
            }
            Files.move(part.toPath(),target.toPath(),StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);
            repo.complete(id,title,version,target);
            return Result.success();
        } catch(Exception e) {
            if(!isStopped()&&getRunAttemptCount()<2&&(e instanceof java.net.SocketTimeoutException||e instanceof java.net.UnknownHostException||e instanceof SafeHttp.TemporaryFailure))return Result.retry();
            return Result.failure(new Data.Builder().putString("error",AcademyRepository.friendly(e)).build());
        } finally {
            if(connection!=null)connection.disconnect();
            if(part!=null&&part.exists())part.delete();
            repo.changed();
        }
    }
}
