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
import java.util.*;
import java.util.concurrent.TimeUnit;

public final class MainActivity extends AppCompatActivity {
    private static final int INK=0xff102640, MUTED=0xff536174, PAPER=0xfff5f7fb, LINE=0xffe4e9f0;
    private AcademyRepository repo;
    private LinearLayout root,body,nav,results;
    private ScrollView scroll;
    private EditText subjectSearch;
    private TextView searchCount;
    private String tab="subjects",subjectId="",query="",pendingCode="";
    private int scrollPosition;
    private String renderedPage="";
    private PracticeTemplate practice;
    private final Map<String,Integer> scrollOffsets=new LinkedHashMap<>();
    private final Map<String,WorkInfo> work=new HashMap<>();
    private final ActivityResultLauncher<ScanOptions> scanner=registerForActivityResult(new ScanContract(),result->{
        if(result.getContents()!=null)openCode(result.getContents());
    });
    private final ActivityResultLauncher<String> cameraPermission=registerForActivityResult(new ActivityResultContracts.RequestPermission(),granted->{
        if(granted)launchScanner(); else message("Camera access is off","You can still enter a subject code or browse the catalog. Enable camera access in Android settings whenever you want to scan.");
    });
    @Override public void onCreate(Bundle state) {
        super.onCreate(state); repo=((AcademyApp)getApplication()).repository();
        if(state!=null) { tab=state.getString("tab","subjects"); subjectId=state.getString("subject",""); query=state.getString("query",""); scrollPosition=state.getInt("scroll",0);Bundle positions=state.getBundle("scroll_positions");if(positions!=null)for(String key:positions.keySet())scrollOffsets.put(key,positions.getInt(key));scrollOffsets.put(tab+":"+subjectId,scrollPosition); }
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
        if(state==null&&pendingCode.isEmpty()&&getIntent().getData()==null&&!new AccountVault(this).token().isEmpty())startActivity(new Intent(this,WorkspaceActivity.class));
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        state.putString("tab",tab);state.putString("subject",subjectId);state.putString("query",query);
        state.putInt("scroll",scroll==null?0:scroll.getScrollY());rememberScroll();Bundle positions=new Bundle();for(Map.Entry<String,Integer> position:scrollOffsets.entrySet())positions.putInt(position.getKey(),position.getValue());state.putBundle("scroll_positions",positions);super.onSaveInstanceState(state);
    }
    private void navigate(String target) { if(tab.equals(target)&&subjectId.isEmpty())return;tab=target;subjectId="";hideKeyboard();render(); }
    // Public tabs share one header, navigation row and scroll viewport.
    private void ensureShell(){
        if(root!=null)return;
        root=column();root.setBackgroundColor(PAPER);setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root,(v,insets)->{
            androidx.core.graphics.Insets bars=insets.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.displayCutout());
            v.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;
        });
        ViewCompat.requestApplyInsets(root);
        LinearLayout header=row();header.setBackgroundColor(Color.WHITE);header.setPadding(dp(20),dp(14),dp(16),dp(10));
        ImageView logo=new ImageView(this);logo.setImageResource(R.drawable.ic_academy);logo.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        header.addView(logo,new LinearLayout.LayoutParams(dp(38),dp(38)));
        LinearLayout brand=column();brand.setPadding(dp(12),0,dp(4),0);
        TextView brandLine=text("AERONAUTICAL",11,INK,true),brandName=text("Open Academy",19,INK,true);
        for(TextView line:new TextView[]{brandLine,brandName}){line.setSingleLine(true);line.setEllipsize(android.text.TextUtils.TruncateAt.END);brand.addView(line);}
        header.addView(brand,new LinearLayout.LayoutParams(0,-2,1));
        // UI — header actions must wrap their width; full-width card buttons collapse the weighted brand.
        Button account=button("Sign in",false,v->startActivity(new Intent(this,WorkspaceActivity.class)));account.setGravity(Gravity.CENTER);header.addView(account,new LinearLayout.LayoutParams(-2,-2));root.addView(header,new LinearLayout.LayoutParams(-1,-2));
        scroll=new ScrollView(this);scroll.setFillViewport(true);
        body=column();body.setPadding(dp(20),dp(16),dp(20),dp(24));scroll.setOverScrollMode(View.OVER_SCROLL_NEVER);android.widget.FrameLayout.LayoutParams pane=new android.widget.FrameLayout.LayoutParams(getResources().getDisplayMetrics().widthPixels>dp(760)?dp(760):-1,-2,Gravity.TOP|Gravity.CENTER_HORIZONTAL);scroll.addView(body,pane);
        root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        nav=row();nav.setPadding(dp(12),dp(7),dp(12),dp(7));nav.setBackgroundColor(Color.WHITE);
        navButton("Subjects","subjects");navButton("Scan QR","scan");navButton("Downloads","downloads");root.addView(nav);
        scroll.setOnScrollChangeListener((v,x,y,oldX,oldY)->scrollPosition=y);
        scroll.setFocusableInTouchMode(true);scroll.setDescendantFocusability(ViewGroup.FOCUS_BEFORE_DESCENDANTS);
    }
    private void rememberScroll(){
        if(scroll==null||renderedPage.isEmpty())return;
        scrollOffsets.put(renderedPage,scroll.getScrollY());
        if(scrollOffsets.size()>32)scrollOffsets.remove(scrollOffsets.keySet().iterator().next());
    }
    private void render() {
        if(isFinishing()||isDestroyed())return;
        rememberScroll();ensureShell();renderedPage=tab+":"+subjectId;
        int restore=scrollOffsets.getOrDefault(renderedPage,0);body.removeAllViews();scroll.requestFocus();
        if(repo.catalog==null) { body.addView(text("Preparing your library",28,INK,true));gap(body,16);ProgressBar loading=new ProgressBar(this);loading.setContentDescription("Loading library");body.addView(loading);body.addView(text(repo.notice,15,MUTED,false)); }
        else if(tab.equals("scan"))scanScreen();
        else if(tab.equals("downloads"))downloadScreen();
        else if(!subjectId.isEmpty())subjectScreen();
        else subjectsScreen();
        for(int i=0;i<nav.getChildCount();i++){Button button=(Button)nav.getChildAt(i);boolean active=tab.equals(button.getTag());if(button.isSelected()!=active){button.setSelected(active);button.setBackground(ripple(active?0xfffff2cc:Color.TRANSPARENT));}}
        androidx.core.view.OneShotPreDrawListener.add(scroll,()->scroll.scrollTo(0,restore));
    }
    private void subjectsScreen() {
        body.addView(text("Subjects",28,INK,true));gap(body,12);
        EditText search=input("Search subjects or materials",query);subjectSearch=search;search.setContentDescription("Search subjects and materials");search.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH);search.setOnEditorActionListener((v,action,event)->{if(action==android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH){hideKeyboard();search.clearFocus();return true;}return false;});body.addView(search);gap(body,12);
        searchCount=text("",13,MUTED,false);body.addView(searchCount);gap(body,12);
        results=column();body.addView(results);listSubjects();
        search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int c,int f){} public void onTextChanged(CharSequence s,int a,int b,int c){query=s.toString();listSubjects();}public void afterTextChanged(Editable e){}});
        gap(body,16);catalogNotice();
        Button refresh=button(repo.busy?"Refreshing…":"Refresh catalog",false,v->refresh());refresh.setEnabled(!repo.busy);body.addView(refresh);
        body.addView(button("Help",false,v->showHelp()));
    }
    private void listSubjects() {
        results.removeAllViews();String q=query.trim().toLowerCase(Locale.ROOT);int count=0;
        for(Catalog.Subject subject:repo.catalog.subjects) {
            boolean match=(subject.code+" "+subject.title+" "+subject.description).toLowerCase(Locale.ROOT).contains(q);
            for(Catalog.Resource r:subject.resources)match|=(r.title+" "+r.module).toLowerCase(Locale.ROOT).contains(q);
            if(!match)continue;count++;
            LinearLayout card=card(Color.WHITE);card.addView(text(subject.title,20,INK,true));gap(card,8);card.addView(text("Code "+subject.code+(repo.catalog.demo?" · 8 lessons · 16 assessments":" · "+subject.resources.size()+" materials")+(subject.retired?" · Retired":""),12,MUTED,false));gap(card,12);TextView summary=text(subject.description,14,MUTED,false);summary.setMaxLines(3);summary.setEllipsize(android.text.TextUtils.TruncateAt.END);card.addView(summary);gap(card,8);
            card.addView(button("Open subject",false,v->{subjectId=subject.id;scrollPosition=0;hideKeyboard();render();scroll.scrollTo(0,0);}));
            results.addView(card);gap(results,12);
        }
        searchCount.setText(count+" "+(count==1?"subject":"subjects")+(q.isEmpty()?" available":" found"));
        if(count==0){LinearLayout empty=card(Color.WHITE);empty.addView(text("No matching subjects",20,INK,true));gap(empty,8);empty.addView(text("Try a subject code, title, or shorter search.",16,MUTED,false));empty.addView(button("Clear search",false,v->subjectSearch.setText("")));results.addView(empty);}
    }
    private void subjectScreen() {
        Catalog.Subject subject=repo.catalog.subject(subjectId);
        if(subject==null){subjectId="";subjectsScreen();return;}
        body.addView(button("‹  All subjects",false,v->navigate("subjects")));gap(body,12);
        body.addView(text("Code "+subject.code,12,MUTED,false));gap(body,8);body.addView(text(subject.title,26,INK,true));gap(body,12);
        body.addView(text(subject.description,16,MUTED,false));gap(body,14);
        if(repo.catalog.demo){practiceSubject();return;}
        if(subject.retired)body.addView(text("This subject is retired. Your previously saved PDFs remain in Downloads.",16,MUTED,false));
        String module="";
        for(Catalog.Resource r:subject.resources) {
            if(!module.equals(r.module)){module=r.module;gap(body,24);body.addView(text(module,18,INK,true));gap(body,12);}
            LinearLayout card=card(Color.WHITE);card.addView(text(r.title,20,INK,true));gap(card,6);card.addView(text(r.description,14,MUTED,false));gap(card,10);
            AcademyRepository.Download d=repo.download(r.id);WorkInfo info=work.get(r.id);boolean active=info!=null&&!info.getState().isFinished();
            String status=d==null?"Not saved":d.revision==r.revision?"Available offline · "+size(d.bytes):"Saved revision "+d.revision+" · Update available";
            card.addView(text(status+" · Revision "+r.revision,12,MUTED,false));gap(card,12);
            if(d!=null)card.addView(button("Read PDF",true,v->openPdf(d)));
            if(!r.plainText.isEmpty())card.addView(button("Read text",false,v->{
                TextView notes=text(r.plainText,18,INK,false);notes.setTextIsSelectable(true);notes.setPadding(dp(20),dp(16),dp(20),dp(16));ReadingText.apply(notes);
                ScrollView reader=new ScrollView(this);reader.addView(notes);
                new AlertDialog.Builder(this).setTitle(r.title).setView(reader).setPositiveButton("Close",null).show();
            }));
            if(r.downloadable) {
                Button save=button(active?"Saving PDF…":d==null?"Save PDF":d.revision!=r.revision?"Update PDF":"Saved",d==null,v->enqueue(r));
                save.setEnabled(!active&&(d==null||d.revision!=r.revision));card.addView(save);
            }
            if(active){int percent=info.getProgress().getInt("percent",-1);ProgressBar transfer=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);transfer.setMax(100);transfer.setIndeterminate(percent<0);if(percent>=0)transfer.setProgress(percent);transfer.setContentDescription(percent<0?"Saving PDF":"Saving PDF · "+percent+" percent");card.addView(transfer,new LinearLayout.LayoutParams(-1,dp(8)));}
            if(active)card.addView(button("Cancel download",false,v->WorkManager.getInstance(this).cancelUniqueWork("download-"+r.id)));
            if(info!=null&&info.getState()==WorkInfo.State.FAILED&&(d==null||d.revision!=r.revision))card.addView(text(info.getOutputData().getString("error")==null?"Download failed. Try again.":info.getOutputData().getString("error"),14,0xff943b26,false));
            if(!r.source.startsWith("asset://"))card.addView(button("Open online ↗",false,v->openOnline(r.source)));
            gap(card,12);card.addView(text(r.license,12,MUTED,false));body.addView(card);gap(body,14);
        }

    }
    // UI — bundled course entries use Read/Take actions, never the legacy handout cards.
    private void practiceSubject(){
        try{
            if(practice==null)try(java.io.InputStream in=getAssets().open("subject-template.json")){practice=new PracticeTemplate(AcademyRepository.readText(in,256*1024));}
            String period="";
            for(PracticeTemplate.Entry entry:practice.entries){
                if(!period.equals(entry.period)){period=entry.period;gap(body,24);body.addView(text(period,18,INK,true));gap(body,12);}
                LinearLayout card=card(Color.WHITE);card.addView(text(entry.title,20,INK,true));gap(card,8);
                card.addView(button(PracticeTemplate.action(entry.kind,""),false,v->{
                    if(entry.kind.equals("material"))readText(entry.title,entry.reading);
                    else if(BuildConfig.DEBUG)startActivity(new Intent(this,WorkspaceActivity.class).putExtra("open_practice",true).putExtra("practice_entry",entry.key).putExtra("practice_subject",practice.key));
                    else message("Sign in required","Open your enrolled subject to take this assessment.");
                }));body.addView(card);gap(body,14);
            }
        }catch(Exception e){body.addView(text("Practice subject unavailable. Close and reopen the app.",16,MUTED,false));}
    }
    private void readText(String title,String reading){
        TextView notes=text(reading,18,INK,false);notes.setTextIsSelectable(true);notes.setPadding(dp(20),dp(16),dp(20),dp(16));ReadingText.apply(notes);ScrollView reader=new ScrollView(this);reader.addView(notes);
        new AlertDialog.Builder(this).setTitle(title).setView(reader).setPositiveButton("Close",null).show();
    }
    private void scanScreen() {
        body.addView(text("Scan QR",28,INK,true));gap(body,16);
        LinearLayout frame=card(0xfffff7df);frame.setGravity(Gravity.CENTER);
        ImageView mark=new ImageView(this);mark.setImageResource(R.drawable.ic_scan);mark.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);frame.addView(mark,new LinearLayout.LayoutParams(dp(108),dp(108)));gap(frame,24);
        frame.addView(button("Scan QR",true,v->{
            if(!getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)){message("No camera available","Enter the subject code below or browse Subjects.");return;}
            if(ContextCompat.checkSelfPermission(this,Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)launchScanner();else cameraPermission.launch(Manifest.permission.CAMERA);
        }));body.addView(frame);gap(body,28);
        body.addView(text("Subject code",19,INK,true));gap(body,8);
        EditText entry=input("For example, A","");entry.setContentDescription("Subject code or Academy QR text");body.addView(entry);
        body.addView(button("Open subject",true,v->openCode(entry.getText().toString())));gap(body,12);
        body.addView(text("Template code: A. Courses require sign-in.",14,MUTED,false));
    }
    private void downloadScreen() {
        body.addView(text("Downloads",28,INK,true));gap(body,16);
        List<AcademyRepository.Download> copies=repo.downloads();
        if(copies.isEmpty()){
            LinearLayout empty=card(Color.WHITE);empty.addView(text("No downloads",22,INK,true));empty.addView(button("Explore subjects",true,v->navigate("subjects")));body.addView(empty);
        }
        for(AcademyRepository.Download d:copies) {
            LinearLayout card=card(Color.WHITE);card.addView(text(d.title,21,INK,true));gap(card,8);card.addView(text("PDF · "+size(d.bytes)+" · Revision "+d.revision,13,MUTED,false));
            card.addView(button("Read PDF",true,v->openPdf(d)));card.addView(button("Remove",false,v->new AlertDialog.Builder(this).setTitle("Remove this PDF?").setMessage("This removes the copy on this phone. The instructor’s original is kept.").setNegativeButton("Keep",null).setPositiveButton("Remove",(a,b)->repo.delete(d)).show()));body.addView(card);gap(body,14);
        }
        for(Map.Entry<String,WorkInfo> item:work.entrySet())if(!item.getValue().getState().isFinished()) {
            String id=item.getKey();int percent=item.getValue().getProgress().getInt("percent",-1);
            body.addView(text("Saving "+id+(percent>=0?" · "+percent+"%":" · waiting or downloading"),14,INK,false));
            body.addView(button("Cancel "+id,false,v->WorkManager.getInstance(this).cancelUniqueWork("download-"+id)));
        }
        catalogNotice();
    }
    private void catalogNotice(){String notice=repo.notice;if(notice.startsWith("Refresh failed")||notice.startsWith("Could not")||notice.startsWith("Offline index")||notice.contains("cleanup"))body.addView(text(notice,13,0xff943b26,false));}
    private void enqueue(Catalog.Resource r) {
        Data data=new Data.Builder().putString("id",r.id).putString("title",r.title).putString("url",r.url).putString("sha256",r.sha256).putInt("revision",r.revision).build();
        OneTimeWorkRequest.Builder builder=new OneTimeWorkRequest.Builder(DownloadWorker.class).setInputData(data).addTag("academy-download").addTag("resource:"+r.id).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,10,TimeUnit.SECONDS);
        if(!r.url.startsWith("asset://"))builder.setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build());
        WorkManager.getInstance(this).enqueueUniqueWork("download-"+r.id,ExistingWorkPolicy.KEEP,builder.build());
    }
    private void openCode(String raw) {
        String protectedId=QrRouter.protectedSubject(raw);
        if(!protectedId.isEmpty()){
            startActivity(new Intent(this,WorkspaceActivity.class).putExtra("subject_id",protectedId).putExtra("qr_enrol",true));return;
        }
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
        new AlertDialog.Builder(this).setTitle("Open online resource?").setMessage("This opens your browser or Drive app. Internet and organization sign-in may be required.").setNegativeButton("Cancel",null).setPositiveButton("Open",(a,b)->{
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
    // UI — section spacing and hanging numbered steps; build diagnostics stay separate.
    private void showHelp() {
        LinearLayout content=column();content.setPadding(dp(24),dp(8),dp(24),dp(20));
        content.addView(text("Get started",18,INK,true));gap(content,12);
        helpStep(content,"1.","Choose a subject or scan its QR.");helpStep(content,"2.","Tap Read to open a lesson.");helpStep(content,"3.","Sign in to take assessments and view results.");
        gap(content,24);content.addView(text("Practice template",18,INK,true));gap(content,8);content.addView(text("Code A opens AE 101. Practice content requires instructor review before institutional use.",15,MUTED,false));
        gap(content,24);content.addView(text("Privacy and storage",18,INK,true));gap(content,8);content.addView(text("Camera access is used only for scanning. No advertising or analytics.",15,MUTED,false));gap(content,12);content.addView(text("Uninstalling or clearing app storage removes local copies. Exported copies cannot be revoked.",15,MUTED,false));
        gap(content,24);content.addView(text("Catalog",18,INK,true));gap(content,8);content.addView(text(repo.notice,14,MUTED,false));
        Button build=button("Build details",false,v->message("Build details","Version\n"+BuildConfig.VERSION_NAME+"\n\nSource\n"+BuildConfig.SOURCE_COMMIT));content.addView(build);
        ScrollView reader=new ScrollView(this);reader.addView(content);AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Help").setView(reader).setPositiveButton("Close",null).setNeutralButton("Catalog",(d,w)->configureCatalog()).create();dialog.setOnShowListener(d->{dialog.getButton(AlertDialog.BUTTON_POSITIVE).setAllCaps(false);dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setAllCaps(false);});dialog.show();
    }
    private void helpStep(LinearLayout parent,String number,String instruction){
        LinearLayout line=row();line.setGravity(Gravity.TOP);line.addView(text(number,16,INK,true),new LinearLayout.LayoutParams(dp(28),-2));line.addView(text(instruction,16,INK,false),new LinearLayout.LayoutParams(0,-2,1));LinearLayout.LayoutParams space=new LinearLayout.LayoutParams(-1,-2);space.setMargins(0,0,0,dp(12));parent.addView(line,space);
    }
    private void message(String title,String message){new AlertDialog.Builder(this).setTitle(title).setMessage(message).setPositiveButton("OK",null).show();}
    private void navButton(String label,String target){Button b=button(label,false,v->navigate(target));b.setGravity(Gravity.CENTER);b.setTag(target);nav.addView(b,new LinearLayout.LayoutParams(0,-2,1));}
    private LinearLayout column(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    private LinearLayout row(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.HORIZONTAL);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
    private LinearLayout card(int color){LinearLayout l=column();int pad=getResources().getDimensionPixelSize(R.dimen.academy_card_padding);l.setPadding(pad,pad,pad,pad);l.setBackground(shape(color));return l;}
    private android.graphics.drawable.Drawable ripple(int color){return new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(0x18102640),shape(color),shape(Color.WHITE));}
    private GradientDrawable shape(int color){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(12));if(color==Color.WHITE)d.setStroke(dp(1),LINE);return d;}
    private TextView text(String value,int sp,int color,boolean bold){TextView t=new TextView(this);t.setText(value);t.setTextSize(sp>=28?26:sp);t.setGravity(Gravity.START);t.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);t.setTextColor(color);if(bold&&sp>=20)ViewCompat.setAccessibilityHeading(t,true);t.setIncludeFontPadding(false);t.setLineSpacing(dp(2),1.16f);if(bold)t.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));return t;}
    private Button button(String label,boolean primary,View.OnClickListener action){Button b=new Button(this);b.setText(label);b.setGravity(primary?Gravity.CENTER:Gravity.START|Gravity.CENTER_VERTICAL);b.setTextSize(15);b.setMinWidth(0);b.setMinimumWidth(0);b.setAllCaps(false);b.setMinHeight(dp(48));b.setMinimumHeight(dp(48));b.setIncludeFontPadding(false);b.setPadding(primary?dp(16):0,dp(10),primary?dp(16):0,dp(10));LinearLayout.LayoutParams spacing=new LinearLayout.LayoutParams(-1,-2);spacing.setMargins(0,dp(4),0,dp(4));b.setLayoutParams(spacing);b.setTextColor(new android.content.res.ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{}},new int[]{0xff7b8798,primary?Color.WHITE:INK}));b.setBackground(ripple(primary?INK:Color.TRANSPARENT));b.setOnClickListener(action);return b;}
    private EditText input(String hint,String value){EditText e=new EditText(this);e.setText(value);e.setHint(hint);e.setTextSize(16);e.setSingleLine(true);e.setMinHeight(dp(52));e.setIncludeFontPadding(false);e.setPadding(dp(14),dp(14),dp(14),dp(14));GradientDrawable outline=shape(0xfffafbfd);outline.setStroke(dp(1),0xffb6c2d2);e.setBackground(outline);e.setOnFocusChangeListener((v,focused)->outline.setStroke(dp(focused?2:1),focused?INK:0xffb6c2d2));e.setTextColor(INK);e.setHintTextColor(MUTED);return e;}
    private void gap(LinearLayout parent,int height){View spacer=new View(this);parent.addView(spacer,new LinearLayout.LayoutParams(1,dp(height)));}
    private void hideKeyboard(){View focus=getCurrentFocus();if(focus!=null)((InputMethodManager)getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(focus.getWindowToken(),0);}
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    private static String size(long bytes){return bytes>=1024*1024?String.format(Locale.ROOT,"%.1f MB",bytes/(1024.0*1024)):Math.max(1,bytes/1024)+" KB";}
}
