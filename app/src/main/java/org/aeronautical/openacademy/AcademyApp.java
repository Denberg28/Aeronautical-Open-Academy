package org.aeronautical.openacademy;

import android.app.Application;

public final class AcademyApp extends Application {
    private AcademyRepository repository;
    @Override public void onCreate() {
        super.onCreate(); repository=new AcademyRepository(this);
        final long started=System.currentTimeMillis();
        repository.io.execute(()->{java.io.File[] old=new java.io.File(getCacheDir(),"protected-pdf").listFiles();if(old!=null)for(java.io.File f:old)if(f.lastModified()<started)f.delete();});
    }
    public AcademyRepository repository() { return repository; }
}
