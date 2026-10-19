package org.aeronautical.openacademy;

import android.app.Application;

public final class AcademyApp extends Application {
    private AcademyRepository repository;
    @Override public void onCreate() { super.onCreate(); repository=new AcademyRepository(this); }
    public AcademyRepository repository() { return repository; }
}
