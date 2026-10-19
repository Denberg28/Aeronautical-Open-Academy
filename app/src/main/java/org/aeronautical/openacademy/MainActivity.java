package org.aeronautical.openacademy;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.widget.*;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.work.*;
import com.journeyapps.barcodescanner.ScanContract;
import com.journeyapps.barcodescanner.ScanOptions;
import org.aeronautical.openacademy.core.QrRouter;
import org.aeronautical.openacademy.core.UrlPolicy;
import java.text.DateFormat;
import java.util.*;
import java.util.concurrent.TimeUnit;

public final class MainActivity extends AppCompatActivity {
    private static final int INK=0xff173c33, MUTED=0xff52665e, PAPER=0xfff6f7f4, LINE=0xffdfe5df;
    private AcademyRepository repo;
    private LinearLayout root,body,nav,results;
    private ScrollView scroll;
    private String tab="subjects",subjectId="",query="",pendingCode="";
    private int scrollPosition;
    private final Map<String,WorkInfo> work=new HashMap<>();
    private final ActivityResultLauncher<ScanOptions> scanner=registerForActivityResult(new ScanContract(),result->{
        if(result.getContents()!=null)openCode(result.getContents());
    });
    private final ActivityResultLauncher<String> cameraPermission=registerForActivityResult(new ActivityResultContracts.RequestPermission(),granted->{
        if(granted)launchScanner(); else message("Camera access is off","You can still enter a subject code or browse the catalog. Enable camera access in Android settings whenever you want to scan.");
    });
    @Override public void onCreate(Bundle state) {
        super.onCreate(state); repo=((AcademyApp)getApplication()).repository();
        if(state!=null) { tab=state.getString("tab","subjects"); subjectId=state.getString("subject",""); query=state.getString("query",""); scrollPosition=state.getInt("scroll",0); }
        Intent intent=getIntent(); if(intent!=null&&intent.getData()!=null)pendingCode=intent.getData().toString();
        repo.changes.observe(this,ignored->{
            if(repo.catalog!=null&&!pendingCode.isEmpty()) { String code=pendingCode;pendingCode="";openCode(code); }
            else render();
        });
        WorkManager.getInstance(this).getWorkInfosByTagLiveData("academy-download").observe(this,list->{
            work.clear();
            if(list!=null)for(WorkInfo info:list)for(String tag:info.getTags())if(tag.startsWith("resource:")) {
                String id=tag.substring(9); WorkInfo previous=work.get(id);
                if(previous==null||!info.getState().isFinished())work.put(id,info);
            }
            if(repo.catalog!=null&&(tab.equals("downloads")||!subjectId.isEmpty()))render();
        });
        getOnBackPressedDispatcher().addCallback(this,new androidx.activity.OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if(!subjectId.isEmpty()||!tab.equals("subjects"))navigate("subjects");
                else { setEnabled(false);getOnBackPressedDispatcher().onBackPressed(); }
            }
        });
        render();
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        state.putString("tab",tab);state.putString("subject",subjectId);state.putString("query",query);
        state.putInt("scroll",scroll==null?0:scroll.getScrollY());super.onSaveInstanceState(state);
    }
    private void navigate(String target) { tab=target;subjectId="";query="";scrollPosition=0;hideKeyboard();render(); }
    private void render() {
        if(isFinishing()||isDestroyed())return;
        root=column();root.setBackgroundColor(PAPER);setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root,(v,insets)->{
            androidx.core.graphics.Insets bars=insets.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.displayCutout());
            v.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;
        });
        ViewCompat.requestApplyInsets(root);
        LinearLayout header=row();header.setPadding(dp(20),dp(14),dp(16),dp(10));
        ImageView logo=new ImageView(this);logo.setImageResource(R.drawable.ic_academy);logo.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        header.addView(logo,new LinearLayout.LayoutParams(dp(38),dp(38)));
        LinearLayout brand=column();brand.setPadding(dp(12),0,dp(4),0);
        brand.addView(text("AERONAUTICAL",11,INK,true));brand.addView(text("Open Academy",19,INK,true));
        header.addView(brand,new LinearLayout.LayoutParams(0,-2,1));
        Button help=button("Help",false,v->showHelp());header.addView(help);root.addView(header);
        scroll=new ScrollView(this);scroll.setFillViewport(true);
        body=column();body.setPadding(dp(22),dp(14),dp(22),dp(28));scroll.addView(body);
        root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        if(repo.catalog==null) { body.addView(text("Preparing your library",28,INK,true));body.addView(text(repo.notice,15,MUTED,false)); }
        else if(tab.equals("scan"))scanScreen();
        else if(tab.equals("downloads"))downloadScreen();
        else if(!subjectId.isEmpty())subjectScreen();
        else subjectsScreen();
        nav=row();nav.setPadding(dp(12),dp(7),dp(12),dp(7));nav.setBackgroundColor(Color.WHITE);
        navButton("Subjects","subjects");navButton("Scan QR","scan");navButton("Downloads","downloads");root.addView(nav);
        final int restore=scrollPosition;
        scroll.setOnScrollChangeListener((v,x,y,oldX,oldY)->scrollPosition=y);
        scroll.post(()->scroll.scrollTo(0,restore));
    }
    private void subjectsScreen() {
        body.addView(text("YOUR LEARNING SPACE",11,MUTED,true));gap(body,10);
        body.addView(text("Knowledge.\nReady for takeoff.",32,INK,true));gap(body,8);
        body.addView(text("Subjects and materials, wherever you learn.",16,MUTED,false));gap(body,20);
        LinearLayout banner=card(0xffe5efdf);
        banner.addView(text(repo.catalog.demo?"Start with a sample subject":"Your subjects, one scan away",19,INK,true));
        banner.addView(text(repo.catalog.demo?"Explore four sample subjects. Connect your approved catalog when it is ready.":"Scan your instructor’s QR code or choose a subject below.",14,MUTED,false));
        banner.addView(button("Scan a subject QR",true,v->navigate("scan")));body.addView(banner);gap(body,20);
        EditText search=input("Search subjects or materials",query);search.setContentDescription("Search subjects and materials");body.addView(search);gap(body,12);
        results=column();body.addView(results);listSubjects();
        search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int c,int f){} public void onTextChanged(CharSequence s,int a,int b,int c){query=s.toString();listSubjects();}public void afterTextChanged(Editable e){}});
        gap(body,16);body.addView(text(repo.notice,13,MUTED,false));
        if(repo.lastSync()>0)body.addView(text("Last synced "+DateFormat.getDateTimeInstance(DateFormat.SHORT,DateFormat.SHORT).format(new Date(repo.lastSync())),12,MUTED,false));
        body.addView(button(repo.busy?"Refreshing…":"Refresh catalog",false,v->refresh()));
    }
    private void listSubjects() {
        results.removeAllViews();String q=query.trim().toLowerCase(Locale.ROOT);int count=0;
        for(Catalog.Subject subject:repo.catalog.subjects) {
            boolean match=(subject.code+" "+subject.title+" "+subject.description).toLowerCase(Locale.ROOT).contains(q);
            for(Catalog.Resource r:subject.resources)match|=(r.title+" "+r.module).toLowerCase(Locale.ROOT).contains(q);
            if(!match)continue;count++;
            LinearLayout card=card(Color.WHITE);card.addView(text(subject.code+(subject.retired?" · Retired":""),12,MUTED,true));
            card.addView(text(subject.title,21,INK,true));gap(card,5);card.addView(text(subject.description,14,MUTED,false));
            card.addView(button("Open subject · "+subject.resources.size()+" materials",false,v->{subjectId=subject.id;scrollPosition=0;hideKeyboard();render();scroll.scrollTo(0,0);}));
            results.addView(card);gap(results,12);
        }
        if(count==0)results.addView(text("No matching subjects. Try a code such as A or a shorter search.",16,MUTED,false));
    }
    private void subjectScreen() {
        Catalog.Subject subject=repo.catalog.subject(subjectId);
        if(subject==null){subjectId="";subjectsScreen();return;}
        body.addView(button("‹  All subjects",false,v->navigate("subjects")));gap(body,12);
        body.addView(text(subject.code,12,MUTED,true));body.addView(text(subject.title,29,INK,true));gap(body,8);
        body.addView(text(subject.description,16,MUTED,false));gap(body,14);
        body.addView(text("Subject code: "+subject.code+" · aoa://subject/"+subject.id,12,MUTED,false));gap(body,20);
        if(subject.retired)body.addView(text("This subject is retired. Your previously saved PDFs remain in Downloads.",16,MUTED,false));
        String module="";
        for(Catalog.Resource r:subject.resources) {
            if(!module.equals(r.module)){module=r.module;body.addView(text(module,17,INK,true));gap(body,10);}
            LinearLayout card=card(Color.WHITE);card.addView(text(r.title,20,INK,true));gap(card,6);card.addView(text(r.description,14,MUTED,false));gap(card,10);
            AcademyRepository.Download d=repo.download(r.id);WorkInfo info=work.get(r.id);boolean active=info!=null&&!info.getState().isFinished();
            String status=d==null?"Not saved":d.revision==r.revision?"Available offline · "+size(d.bytes):"Saved revision "+d.revision+" · Update available";
            card.addView(text(status+" · Revision "+r.revision,12,MUTED,true));
            if(d!=null)card.addView(button("Read saved PDF",true,v->openPdf(d)));
            if(!r.plainText.isEmpty())card.addView(button("Read text version",false,v->{
                TextView notes=text(r.plainText,18,INK,false);notes.setTextIsSelectable(true);notes.setPadding(dp(20),dp(16),dp(20),dp(16));
                ScrollView reader=new ScrollView(this);reader.addView(notes);
                new AlertDialog.Builder(this).setTitle(r.title).setView(reader).setPositiveButton("Close",null).show();
            }));
            if(r.downloadable) {
                Button save=button(active?"Saving PDF…":d==null?"Save PDF offline":d.revision!=r.revision?"Update offline copy":"Saved on this phone",d==null,v->enqueue(r));
                save.setEnabled(!active&&(d==null||d.revision!=r.revision));card.addView(save);
            }
            if(active)card.addView(button("Cancel download",false,v->WorkManager.getInstance(this).cancelUniqueWork("download-"+r.id)));
            if(info!=null&&info.getState()==WorkInfo.State.FAILED&&(d==null||d.revision!=r.revision))card.addView(text(info.getOutputData().getString("error")==null?"Download failed. Try again.":info.getOutputData().getString("error"),14,0xff943b26,false));
            if(!r.source.startsWith("asset://"))card.addView(button("Open online ↗",false,v->openOnline(r.source)));
            card.addView(text(r.license,11,MUTED,false));body.addView(card);gap(body,14);
        }
        body.addView(text("PDFs are saved only after a complete, verified transfer. Other resources open in your browser.",13,MUTED,false));
    }
    private void scanScreen() {
        body.addView(text("One scan.\nYour next lesson.",32,INK,true));gap(body,12);
        body.addView(text("Scan an Academy subject QR from your instructor. Camera access is used only while scanning.",16,MUTED,false));gap(body,24);
        LinearLayout frame=card(0xffe5efdf);frame.setGravity(Gravity.CENTER);
        ImageView mark=new ImageView(this);mark.setImageResource(R.drawable.ic_scan);mark.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);frame.addView(mark,new LinearLayout.LayoutParams(dp(108),dp(108)));gap(frame,24);
        frame.addView(button("Open camera scanner",true,v->{
            if(!getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)){message("No camera available","Enter the subject code below or browse Subjects.");return;}
            if(ContextCompat.checkSelfPermission(this,Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)launchScanner();else cameraPermission.launch(Manifest.permission.CAMERA);
        }));body.addView(frame);gap(body,28);
        body.addView(text("Have a subject code instead?",19,INK,true));gap(body,8);
        EditText entry=input("For example, A","");entry.setContentDescription("Subject code or Academy QR text");body.addView(entry);
        body.addView(button("Open subject",true,v->openCode(entry.getText().toString())));gap(body,12);
        body.addView(text("Scanning and subject codes work offline with the catalog already on this phone. Unknown codes will never open a website automatically.",14,MUTED,false));
    }
    private void downloadScreen() {
        body.addView(text("Your offline\nflight bag.",32,INK,true));gap(body,12);
        body.addView(text("Completed PDFs stay on this phone until you remove them. No connection needed to read.",16,MUTED,false));gap(body,24);
        List<AcademyRepository.Download> copies=repo.downloads();
        if(copies.isEmpty()){
            LinearLayout empty=card(Color.WHITE);empty.addView(text("Ready when you are",22,INK,true));empty.addView(text("Open a subject and choose Save PDF offline. Completed copies appear here.",15,MUTED,false));empty.addView(button("Explore subjects",true,v->navigate("subjects")));body.addView(empty);
        }
        for(AcademyRepository.Download d:copies) {
            LinearLayout card=card(Color.WHITE);card.addView(text(d.title,21,INK,true));gap(card,8);card.addView(text("PDF · "+size(d.bytes)+" · Revision "+d.revision,13,MUTED,false));
            card.addView(button("Read PDF",true,v->openPdf(d)));card.addView(button("Remove offline copy",false,v->new AlertDialog.Builder(this).setTitle("Remove this PDF?").setMessage("This removes the copy on this phone. The instructor’s original is kept.").setNegativeButton("Keep",null).setPositiveButton("Remove",(a,b)->repo.delete(d)).show()));body.addView(card);gap(body,14);
        }
        for(Map.Entry<String,WorkInfo> item:work.entrySet())if(!item.getValue().getState().isFinished()) {
            String id=item.getKey();int percent=item.getValue().getProgress().getInt("percent",-1);
            body.addView(text("Saving "+id+(percent>=0?" · "+percent+"%":" · waiting or downloading"),14,INK,false));
            body.addView(button("Cancel "+id,false,v->WorkManager.getInstance(this).cancelUniqueWork("download-"+id)));
        }
        gap(body,14);body.addView(text(repo.notice,13,MUTED,false));
    }
    private void enqueue(Catalog.Resource r) {
        Data data=new Data.Builder().putString("id",r.id).putString("title",r.title).putString("url",r.url).putString("sha256",r.sha256).putInt("revision",r.revision).build();
        OneTimeWorkRequest.Builder builder=new OneTimeWorkRequest.Builder(DownloadWorker.class).setInputData(data).addTag("academy-download").addTag("resource:"+r.id).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,10,TimeUnit.SECONDS);
        if(!r.url.startsWith("asset://"))builder.setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build());
        WorkManager.getInstance(this).enqueueUniqueWork("download-"+r.id,ExistingWorkPolicy.KEEP,builder.build());
    }
    private void openCode(String raw) {
        if(repo.catalog==null){pendingCode=raw;return;}
        try { subjectId=QrRouter.subject(raw,repo.catalog.subjectIds());tab="subjects";query="";scrollPosition=0;hideKeyboard();render();scroll.scrollTo(0,0); }
        catch(IllegalArgumentException e){message("Check your subject code",e.getMessage());}
    }
    private void launchScanner() {
        ScanOptions options=new ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("Scan an Academy subject QR").setBeepEnabled(false).setOrientationLocked(false);
        try{scanner.launch(options);}catch(RuntimeException e){message("Scanner unavailable","Enter your subject code instead, or check camera access in Android settings.");}
    }
    private void openPdf(AcademyRepository.Download d) {
        startActivity(new Intent(this,PdfActivity.class).putExtra("key",d.key).putExtra("title",d.title));
    }
    private void openOnline(String raw) {
        if(!UrlPolicy.allowed(raw)){message("Unsupported destination","Ask your instructor to update this resource.");return;}
        new AlertDialog.Builder(this).setTitle("Open Google Drive?").setMessage("This opens your browser or Drive app. Internet and organization sign-in may be required.").setNegativeButton("Cancel",null).setPositiveButton("Open",(a,b)->{
            try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(raw)).addCategory(Intent.CATEGORY_BROWSABLE));}
            catch(android.content.ActivityNotFoundException e){message("No browser available","Install or enable a browser to open online resources.");}
        }).show();
    }
    private void refresh() {
        if(repo.busy)return;
        if(repo.catalogUrl().isEmpty())configureCatalog();else repo.refresh(repo.catalogUrl());
    }
    private void configureCatalog() {
        EditText input=input("HTTPS Google Drive catalog link",repo.catalogUrl());input.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_URI);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Connect instructor catalog").setMessage("Use only a catalog provided by your instructor. This version supports approved files readable without app sign-in. Sharing permissions are never changed by the app.").setView(input).setNegativeButton("Cancel",null).setPositiveButton("Validate & connect",null).create();
        dialog.setOnShowListener(v->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(w->{
            try { String url=input.getText().toString().trim();UrlPolicy.require(url);repo.refresh(url);dialog.dismiss(); }
            catch(IllegalArgumentException e){input.setError(e.getMessage());}
        }));dialog.show();
    }
    private void showHelp() {
        new AlertDialog.Builder(this).setTitle("Learn, wherever you are").setMessage("1. Choose a subject or scan its Academy QR.\n2. Save eligible PDFs while connected.\n3. Read completed copies in Downloads, even offline.\n\nCatalog codes: A, AE-417, C, AMT-412. Samples are demonstrations, not approved course or aircraft maintenance instructions.\n\nCamera is used only to scan. No analytics, advertising, or app accounts. Android uninstall or Clear storage removes saved copies. Previously downloaded copies cannot be remotely revoked.\n\nVersion "+BuildConfig.VERSION_NAME+" · "+BuildConfig.SOURCE_COMMIT).setPositiveButton("Got it",null).setNeutralButton("Catalog setup",(d,w)->configureCatalog()).show();
    }
    private void message(String title,String message){new AlertDialog.Builder(this).setTitle(title).setMessage(message).setPositiveButton("OK",null).show();}
    private void navButton(String label,String target){Button b=button(label,tab.equals(target),v->navigate(target));b.setSelected(tab.equals(target));nav.addView(b,new LinearLayout.LayoutParams(0,-2,1));}
    private LinearLayout column(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    private LinearLayout row(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.HORIZONTAL);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
    private LinearLayout card(int color){LinearLayout l=column();l.setPadding(dp(18),dp(18),dp(18),dp(14));l.setBackground(shape(color));return l;}
    private GradientDrawable shape(int color){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(18));if(color==Color.WHITE)d.setStroke(dp(1),LINE);return d;}
    private TextView text(String value,int sp,int color,boolean bold){TextView t=new TextView(this);t.setText(value);t.setTextSize(sp);t.setTextColor(color);t.setLineSpacing(dp(3),1);if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;}
    private Button button(String label,boolean primary,View.OnClickListener action){Button b=new Button(this);b.setText(label);b.setTextSize(14);b.setAllCaps(false);b.setMinHeight(dp(52));b.setMinimumHeight(dp(52));b.setPadding(dp(14),dp(10),dp(14),dp(10));b.setTextColor(primary?Color.WHITE:INK);b.setBackground(shape(primary?INK:Color.TRANSPARENT));b.setOnClickListener(action);return b;}
    private EditText input(String hint,String value){EditText e=new EditText(this);e.setText(value);e.setHint(hint);e.setTextSize(16);e.setSingleLine(true);e.setMinHeight(dp(54));e.setPadding(dp(16),dp(10),dp(16),dp(10));e.setBackground(shape(Color.WHITE));e.setTextColor(INK);e.setHintTextColor(MUTED);return e;}
    private void gap(LinearLayout parent,int height){View spacer=new View(this);parent.addView(spacer,new LinearLayout.LayoutParams(1,dp(height)));}
    private void hideKeyboard(){View focus=getCurrentFocus();if(focus!=null)((InputMethodManager)getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(focus.getWindowToken(),0);}
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    private static String size(long bytes){return bytes>=1024*1024?String.format(Locale.ROOT,"%.1f MB",bytes/(1024.0*1024)):Math.max(1,bytes/1024)+" KB";}
}
