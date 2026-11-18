package org.aeronautical.openacademy;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.widget.*;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import org.json.JSONArray;
import org.aeronautical.openacademy.testing.TestWorkspace;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** One account workspace with role-specific actions; the API remains authoritative. */
public final class WorkspaceActivity extends AppCompatActivity {
    private static final int INK=0xff102640,MUTED=0xff536174,PAPER=0xfff5f7fb,GOLD=0xffb17b0f,LINE=0xffe4e9f0;
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private LearningApi api;
    private LinearLayout body;
    private SubjectHeader subjectHeader;
    private ScrollView workspaceScroll;
    private String renderedPage="";
    private boolean scrollToEntriesEnd;
    private SubjectBoard subjectBoard;
    private android.os.Parcelable subjectListState;
    // Workspace shell: keep chrome mounted; replace only the center content.
    private android.widget.FrameLayout contentPane;
    private LinearLayout navigation;
    private TextView brand;
    private Button menuButton,syncButton;
    private String navigationRole="";
    private final java.util.Map<String,Button> tabs=new java.util.LinkedHashMap<>();
    private final java.util.Map<String,Integer> scrollOffsets=new java.util.LinkedHashMap<>();
    private Runnable revealProgress;
    private ProgressBar activityProgress;
    private final java.util.Set<Button> actionButtons=java.util.Collections.newSetFromMap(new java.util.WeakHashMap<Button,Boolean>());
    private JSONObject account,course,report,learner;
    private JSONArray available=new JSONArray();
    private String learnerId="",reportSubject="",draftKey="",qrSubject="";
    private boolean formOpen,uploadAllowed,formsAllowed;
    private ChoiceFormEditor editorForm;
    private AlertDialog choiceDialog;
    private final java.util.List<RadioGroup> formGroups=new java.util.ArrayList<>();
    private String activeFormId="",pendingFormId="",formDraftKey="";
    private boolean formSubmitted,pendingPractice;
    private String pendingPracticeEntry="",pendingPracticeSubject="";
    private int rosterOffset,discoverOffset;
    private EditText draftInput;
    private JSONArray subjects=new JSONArray(),announcements=new JSONArray(),accounts=new JSONArray();
    private String selected="",screen="subjects",pendingUpload="";
    private String exportPath="";
    private boolean busy,pickerActive,scannerActive;
    private int pendingUploadVersion;
    private int accountOffset;
    private interface Action {JSONObject run()throws Exception;}
    private interface Done {void accept(JSONObject value)throws Exception;}
    private final ActivityResultLauncher<String[]> picker=registerForActivityResult(new ActivityResultContracts.OpenDocument(),uri->{
        pickerActive=false;
        if(uri==null){pendingUpload="";load();return;}
        final String id=pendingUpload;pendingUpload="";
        perform(()->{api.upload(id,pendingUploadVersion,getContentResolver().openInputStream(uri));return new JSONObject();},r->load());
    });
    private final ActivityResultLauncher<String> exporter=registerForActivityResult(new ActivityResultContracts.CreateDocument("application/pdf"),uri->{
        pickerActive=false;final String path=exportPath;exportPath="";
        if(uri==null){if(!path.isEmpty())new File(path).delete();load();return;}
        perform(()->{
            File file=new File(path);String parent=new File(getCacheDir(),"protected-pdf").getCanonicalPath()+File.separator;
            if(!file.getCanonicalPath().startsWith(parent))throw new IOException("Export file is unavailable.");
            try(InputStream in=new FileInputStream(file);OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new IOException("Cannot write to this location.");LearningApi.copyBounded(in,out,50L*1024*1024);}finally{file.delete();}
            return new JSONObject();
        },r->{Toast.makeText(this,"PDF saved to your chosen location",Toast.LENGTH_LONG).show();load();});
    });
    private final ActivityResultLauncher<String> excelExporter=registerForActivityResult(new ActivityResultContracts.CreateDocument("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),uri->{
        pickerActive=false;final String id=reportSubject;reportSubject="";final int offset=rosterOffset;
        if(uri==null){load();return;}
        perform(()->{api.exportReport(id,offset,uri);return new JSONObject();},r->{Toast.makeText(this,"Excel report saved. Keep student data private.",Toast.LENGTH_LONG).show();load();});
    });
    private final ActivityResultLauncher<com.journeyapps.barcodescanner.ScanOptions> scanner=registerForActivityResult(new com.journeyapps.barcodescanner.ScanContract(),result->{scannerActive=false;if(result.getContents()!=null)handleSubjectQr(result.getContents());else load();});
    private final ActivityResultLauncher<String> cameraPermission=registerForActivityResult(new ActivityResultContracts.RequestPermission(),allowed->{scannerActive=false;if(allowed)launchScanner();else enterSubjectCode();});
    private void scanSubject(){
        if(!getPackageManager().hasSystemFeature(android.content.pm.PackageManager.FEATURE_CAMERA_ANY)){enterSubjectCode();return;}
        if(androidx.core.content.ContextCompat.checkSelfPermission(this,android.Manifest.permission.CAMERA)==android.content.pm.PackageManager.PERMISSION_GRANTED)launchScanner();else{scannerActive=true;cameraPermission.launch(android.Manifest.permission.CAMERA);}
    }
    private void launchScanner(){com.journeyapps.barcodescanner.ScanOptions options=new com.journeyapps.barcodescanner.ScanOptions().setDesiredBarcodeFormats(com.journeyapps.barcodescanner.ScanOptions.QR_CODE).setPrompt("Scan your instructor's subject QR").setBeepEnabled(false).setOrientationLocked(false);try{scannerActive=true;scanner.launch(options);}catch(RuntimeException e){scannerActive=false;enterSubjectCode();}}
    private void enterSubjectCode(){LinearLayout form=formColumn();EditText code=field(form,"Subject QR text or subject ID","",false);AcademyTypography.dialog(this).setTitle("Enter subject code").setView(formScroll(form)).setNegativeButton("Cancel",null).setPositiveButton("Check eligibility",(d,w)->handleSubjectQr(code.getText().toString())).show();}
    private void handleSubjectQr(String raw){String id=org.aeronautical.openacademy.core.QrRouter.protectedSubject(raw);if(id.isEmpty()){showText("Check subject QR","Use a protected subject QR issued by your instructor. The public template uses code A in Public samples.");return;}qrSubject=id;selected=id;screen="subjects";learnerId="";load();}
    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);if(!BuildConfig.SCREEN_CAPTURE_ALLOWED)getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);api=new LearningApi(this);
        pendingPractice=getIntent().getBooleanExtra("open_practice",false);
        pendingPracticeEntry=getIntent().getStringExtra("practice_entry")==null?"":getIntent().getStringExtra("practice_entry");pendingPracticeSubject=getIntent().getStringExtra("practice_subject")==null?"":getIntent().getStringExtra("practice_subject");
        String requested=getIntent().getStringExtra("subject_id");if(requested!=null&&requested.matches("[a-f0-9-]{36}"))selected=requested;if(getIntent().getBooleanExtra("qr_enrol",false))qrSubject=selected;
        if(saved!=null){scannerActive=saved.getBoolean("scanner",false);pendingUploadVersion=saved.getInt("upload_version",0);qrSubject=saved.getString("qr_subject","");selected=saved.getString("selected","");screen=saved.getString("screen","subjects");pendingUpload=saved.getString("upload","");exportPath=saved.getString("export","");pickerActive=saved.getBoolean("picker",false);accountOffset=saved.getInt("offset",0);learnerId=saved.getString("learner","");rosterOffset=saved.getInt("roster",0);discoverOffset=saved.getInt("discover",0);reportSubject=saved.getString("report_subject","");}
        getOnBackPressedDispatcher().addCallback(this,new androidx.activity.OnBackPressedCallback(true){public void handleOnBackPressed(){if(!learnerId.isEmpty()){learnerId="";load();}else if(screen.equals("learners")){screen="subjects";load();}else if(!selected.isEmpty()||!screen.equals("subjects")){selected="";screen="subjects";load();}else finish();}});
        if(saved!=null&&saved.containsKey("entry_editor"))try{restoreEditor=new JSONObject(saved.getString("entry_editor"));}catch(Exception ignored){}
        if(saved!=null){subjectListState=saved.getParcelable("subject_list_state");Bundle positions=saved.getBundle("scroll_positions");if(positions!=null)for(String key:positions.keySet())scrollOffsets.put(key,positions.getInt(key));}
        if(saved!=null){pendingFormId=saved.getString("open_form_id","");pendingPractice=saved.getBoolean("open_practice",pendingPractice);pendingPracticeEntry=saved.getString("practice_entry",pendingPracticeEntry);pendingPracticeSubject=saved.getString("practice_subject",pendingPracticeSubject);}
        render();if(!pickerActive&&!scannerActive)load();
    }
    @Override protected void onSaveInstanceState(Bundle out){saveChoiceDraft();out.putBoolean("open_practice",pendingPractice);out.putString("practice_entry",pendingPracticeEntry);out.putString("practice_subject",pendingPracticeSubject);out.putString("open_form_id",activeFormId.isEmpty()?pendingFormId:activeFormId);rememberScroll();Bundle positions=new Bundle();for(java.util.Map.Entry<String,Integer> position:scrollOffsets.entrySet())positions.putInt(position.getKey(),position.getValue());out.putBundle("scroll_positions",positions);if(subjectBoard!=null){subjectBoard.flush();out.putParcelable("subject_list_state",subjectBoard.layoutState());}try{if(editorText!=null)out.putString("entry_editor",editorSnapshot().toString());else if(restoreEditor!=null)out.putString("entry_editor",restoreEditor.toString());}catch(Exception ignored){}if(draftInput!=null)api.vault.saveDraft(draftKey,draftInput.getText().toString());out.putBoolean("scanner",scannerActive);out.putInt("upload_version",pendingUploadVersion);out.putString("qr_subject",qrSubject);out.putString("learner",learnerId);out.putInt("roster",rosterOffset);out.putInt("discover",discoverOffset);out.putString("report_subject",reportSubject);out.putString("selected",selected);out.putString("screen",screen);out.putString("upload",pendingUpload);out.putString("export",exportPath);out.putBoolean("picker",pickerActive);out.putInt("offset",accountOffset);super.onSaveInstanceState(out);}
    @Override protected void onResume(){super.onResume();if(api!=null&&account!=null&&!busy&&!pickerActive&&!scannerActive&&!formOpen&&draftInput==null&&!account.optBoolean("must_change_password"))load();}
    @Override protected void onPause(){saveChoiceDraft();if(subjectBoard!=null)subjectBoard.flush();super.onPause();}
    @Override protected void onDestroy(){if(activityProgress!=null&&revealProgress!=null)activityProgress.removeCallbacks(revealProgress);if(subjectBoard!=null)subjectBoard.dispose();io.shutdown();super.onDestroy();}
    private boolean admin(){return account!=null&&account.optString("role").equals("admin");}
    private boolean creator(){return account!=null&&!account.optString("role").equals("student");}
    private void perform(Action action,Done done){
        if(busy||isDestroyed())return;busy=true;if(subjectBoard!=null)subjectBoard.setDragEnabled(false);setStatus("Working…");
        io.execute(()->{
            try{JSONObject result=action.run();runOnUiThread(()->{if(isDestroyed())return;busy=false;if(subjectBoard!=null)subjectBoard.setDragEnabled(true);try{done.accept(result);}catch(Exception e){error(e);}if(!busy)setStatus("");});}
            catch(Exception e){runOnUiThread(()->{if(isDestroyed())return;busy=false;if(subjectBoard!=null)subjectBoard.setDragEnabled(true);if(e instanceof LearningApi.Failure&&((LearningApi.Failure)e).status==404){course=null;report=null;learner=null;learnerId="";selected="";screen="subjects";render();}if(e instanceof LearningApi.Failure&&((LearningApi.Failure)e).status==401&&account!=null){api.vault.clear();api.clearProtectedCache();account=null;course=null;subjects=new JSONArray();selected="";scrollOffsets.clear();renderedPage="";render();}error(e);});}
        });
    }
    private void error(Exception e){if(choiceDialog!=null&&choiceDialog.isShowing()){if(e instanceof LearningApi.Failure&&(((LearningApi.Failure)e).status==401||((LearningApi.Failure)e).status==404))choiceDialog.dismiss();else{choiceDialog.setCancelable(true);choiceDialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);choiceDialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(true);}}if(editorDialog!=null&&editorDialog.isShowing()&&e instanceof LearningApi.Failure&&((LearningApi.Failure)e).status==401)editorDialog.dismiss();if(editorDialog!=null&&editorDialog.isShowing()){editorDialog.setCancelable(true);editorDialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(true);editorDialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);}setStatus("Request not completed");AcademyTypography.dialog(this).setTitle("Please check").setMessage(e.getMessage()==null?"Connection unavailable. Try again.":e.getMessage()).setPositiveButton("OK",null).show();}
    private void load(){load(false);}
    // Sync — Revalidate the account, then refresh current authorized records atomically in the UI.
    private void load(boolean sync){
        if(pickerActive||scannerActive||subjectBoard!=null&&subjectBoard.isDragging())return;
        final String qr=qrSubject,id=qr.isEmpty()?selected:qr,view=screen,studentId=learnerId;final int offset=accountOffset,roster=rosterOffset,browse=discoverOffset;
        perform(()->{
            if(api.vault.token().isEmpty())return new JSONObject().put("signed_out",true);
            JSONObject me=api.request("GET","/v1/me",null),a=me.getJSONObject("account");
            if(sync&&!a.optBoolean("must_change_password")){api.request("GET","/v1/sync",null);me.put("synced",true);}
            if(a.optBoolean("must_change_password"))return me;
            if(!qr.isEmpty()){
                if(a.optString("role").equals("student"))try{api.request("POST","/v1/subjects/"+qr+"/enrol",new JSONObject().put("source","qr"));me.put("qr_enrolled",true);}catch(LearningApi.Failure e){if(e.status==404)me.put("qr_denied",true);else throw e;}
                me.put("qr_done",true);
            }
            me.put("subjects",orderedSubjects(api.request("GET","/v1/subjects",null).getJSONArray("subjects"),a));
            me.put("announcements",api.request("GET","/v1/announcements",null).getJSONArray("announcements"));
            if(!id.isEmpty()&&!me.optBoolean("qr_denied"))try{me.put("course",api.request("GET","/v1/subjects/"+id,null));}catch(LearningApi.Failure e){if(e.status==404)me.put("course_unavailable",true);else throw e;}
            if(a.getString("role").equals("admin")&&view.equals("accounts"))me.put("accounts",api.request("GET","/v1/admin/accounts?offset="+offset,null).getJSONArray("accounts"));
            if(view.equals("enroll"))me.put("available",api.request("GET","/v1/subjects/discover?offset="+browse,null).getJSONArray("subjects"));
            if(view.equals("learners")&&!id.isEmpty()){
                me.put("report",api.request("GET","/v1/subjects/"+id+"/learners?offset="+roster,null));
                if(!studentId.isEmpty())me.put("learner",api.request("GET","/v1/subjects/"+id+"/learners/"+studentId,null));
            }
            return me;
        },r->{
            formsAllowed=r.optJSONObject("capabilities")!=null&&r.optJSONObject("capabilities").optBoolean("choice_forms");uploadAllowed=r.optJSONObject("capabilities")!=null&&r.optJSONObject("capabilities").optBoolean("material_upload");report=r.optJSONObject("report");learner=r.optJSONObject("learner");available=r.optJSONArray("available")==null?new JSONArray():r.getJSONArray("available");account=r.optJSONObject("account");course=r.optJSONObject("course");subjects=r.optJSONArray("subjects")==null?new JSONArray():r.getJSONArray("subjects");announcements=r.optJSONArray("announcements")==null?new JSONArray():r.getJSONArray("announcements");accounts=r.optJSONArray("accounts")==null?new JSONArray():r.getJSONArray("accounts");if(r.optBoolean("qr_done"))qrSubject="";if(r.optBoolean("qr_enrolled"))selected=id;if(r.optBoolean("course_unavailable")||r.optBoolean("qr_denied"))selected="";if(openPendingPractice())return;render();if(!pendingPracticeEntry.isEmpty()&&api.isTest()&&course!=null&&!formOpen){String entry=pendingPracticeEntry;pendingPracticeEntry="";JSONArray items=course.optJSONArray("items");for(int n=0;n<items.length();n++){JSONObject item=items.getJSONObject(n);if(entry.equals(item.optString("template_entry_key"))&&item.has("questions")){openChoiceForm(item.getString("id"));return;}}showText("Assessment unavailable","This practice entry was removed or changed. Choose another assessment in the subject.");}if(!pendingFormId.isEmpty()&&account!=null&&course!=null&&!formOpen){String resume=pendingFormId;pendingFormId="";openChoiceForm(resume);}if(restoreEditor!=null&&account!=null&&(!creator()||!account.optString("id").equals(restoreEditor.optString("account_id"))))restoreEditor=null;if(restoreEditor!=null&&account!=null&&!account.optBoolean("must_change_password")&&course!=null&&!selected.isEmpty()&&selected.equals(restoreEditor.optString("subject_id",selected))&&!formOpen){JSONObject draft=restoreEditor;entryComposer(draft.optJSONObject("item"));}if(r.optBoolean("synced"))Toast.makeText(this,api.isTest()?"Local test data refreshed":"Synced · materials, results and progress updated",Toast.LENGTH_SHORT).show();if(r.optBoolean("qr_denied"))showText("Not eligible for this subject","Ask your instructor to add your administrator-verified student ID, or select All students. Administratively removed access requires administrator restoration.");else if(r.optBoolean("qr_enrolled"))Toast.makeText(this,"Enrollment confirmed",Toast.LENGTH_SHORT).show();if(r.optBoolean("course_unavailable"))AcademyTypography.dialog(this).setTitle("Subject unavailable").setMessage("This subject is unavailable or you need enrollment. Use Enroll subjects from the menu if enrollment is open, or contact your administrator.").setPositiveButton("OK",null).show();
        });
    }
    // Navigation — preserve the requested practice entry across sign-in and rotation.
    private boolean openPendingPractice()throws Exception {
        if(!pendingPractice||account==null||account.optBoolean("must_change_password"))return false;
        pendingPractice=false;
        if(!api.isTest()){pendingPracticeEntry="";showText("Local practice subject","This template uses Local test accounts. Sign out and sign in with a local test account to take its assessments.");return false;}
        for(int n=0;n<subjects.length();n++){
            JSONObject practice=subjects.getJSONObject(n);String key=practice.optString("template_key");
            if(!key.isEmpty()&&(pendingPracticeSubject.isEmpty()||key.equals(pendingPracticeSubject))){selected=practice.getString("id");screen="subjects";load();return true;}
        }
        pendingPracticeEntry="";showText("Practice subject unavailable","This account has no access to the practice subject. Choose an enrolled subject or contact the administrator.");return false;
    }
    // Shell geometry stays fixed during requests and tab changes.
    private void ensureShell(){
        if(contentPane!=null)return;
        LinearLayout root=column();root.setBackgroundColor(PAPER);setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root,(v,insets)->{androidx.core.graphics.Insets bars=insets.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.displayCutout());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;});ViewCompat.requestApplyInsets(root);
        LinearLayout header=new LinearLayout(this);header.setGravity(android.view.Gravity.CENTER_VERTICAL);header.setPadding(dp(20),dp(8),dp(12),dp(8));header.setBackgroundColor(Color.WHITE);
        brand=txt("Open Academy",22,true);brand.setMaxLines(1);brand.setEllipsize(android.text.TextUtils.TruncateAt.END);ViewCompat.setAccessibilityHeading(brand,true);header.addView(brand,new LinearLayout.LayoutParams(0,-2,1));
        menuButton=button("☰",false,v->{if(account==null)finish();else showMenu(v);});menuButton.setPadding(0,0,0,0);menuButton.setGravity(android.view.Gravity.CENTER);header.addView(menuButton,new LinearLayout.LayoutParams(dp(48),dp(48)));syncButton=button("Sync",false,v->{if(account!=null&&!busy&&!formOpen&&draftInput==null)load(true);else if(account!=null)Toast.makeText(this,"Finish or close your current form before syncing.",Toast.LENGTH_SHORT).show();});syncButton.setContentDescription("Sync current materials, results and progress");header.addView(syncButton,new LinearLayout.LayoutParams(-2,dp(48)));root.addView(header);
        activityProgress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);activityProgress.setIndeterminate(true);activityProgress.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(GOLD));activityProgress.setVisibility(View.INVISIBLE);root.addView(activityProgress,new LinearLayout.LayoutParams(-1,dp(3)));
        revealProgress=()->{if(busy)activityProgress.setVisibility(View.VISIBLE);};
        subjectHeader=new SubjectHeader(this);root.addView(subjectHeader,new LinearLayout.LayoutParams(-1,-2));
        contentPane=new android.widget.FrameLayout(this);root.addView(contentPane,new LinearLayout.LayoutParams(-1,0,1));
        navigation=new LinearLayout(this);navigation.setPadding(dp(8),dp(4),dp(8),dp(4));navigation.setBackgroundColor(Color.WHITE);root.addView(navigation,new LinearLayout.LayoutParams(-1,-2));
    }
    private void rememberScroll(){
        if(workspaceScroll==null||renderedPage.isEmpty())return;
        scrollOffsets.put(renderedPage,workspaceScroll.getScrollY());
        if(scrollOffsets.size()>32)scrollOffsets.remove(scrollOffsets.keySet().iterator().next());
    }
    private void render(){
        ensureShell();rememberScroll();subjectHeader.setVisibility(View.GONE);syncButton.setVisibility(account==null?View.GONE:View.VISIBLE);
        String nextPage=account==null?"sign-in":screen+":"+selected+":"+learnerId;
        if(subjectBoard!=null){if(account!=null)subjectListState=subjectBoard.layoutState();else subjectListState=null;subjectBoard.dispose();subjectBoard=null;}
        contentPane.removeAllViews();renderedPage=nextPage;
        menuButton.setText(account==null?"‹":"☰");menuButton.setContentDescription(account==null?"Back to samples":"Menu");
        brand.setText(account!=null&&api.isTest()?"Open Academy · Test":"Open Academy");updateNavigation();
        ScrollView scroll=new ScrollView(this);scroll.setId(R.id.subject_content);workspaceScroll=scroll;boolean bottom=scrollToEntriesEnd;scrollToEntriesEnd=false;
        body=column();body.setPadding(AcademyTypography.inset(this),getResources().getDimensionPixelSize(R.dimen.academy_content_gap),AcademyTypography.inset(this),dp(24));scroll.setFillViewport(true);scroll.setOverScrollMode(View.OVER_SCROLL_NEVER);scroll.setVerticalScrollBarEnabled(true);
        // Restore before drawing to avoid a visible jump from the top.
        scroll.setFocusableInTouchMode(true);scroll.setDescendantFocusability(android.view.ViewGroup.FOCUS_BEFORE_DESCENDANTS);scroll.requestFocus();
        android.widget.FrameLayout.LayoutParams pane=new android.widget.FrameLayout.LayoutParams(getResources().getDisplayMetrics().widthPixels>dp(760)?dp(760):-1,-2,android.view.Gravity.TOP|android.view.Gravity.CENTER_HORIZONTAL);scroll.addView(body,pane);contentPane.addView(scroll,new android.widget.FrameLayout.LayoutParams(-1,-1));
        int prior=scrollOffsets.getOrDefault(nextPage,0);androidx.core.view.OneShotPreDrawListener.add(scroll,()->{if(bottom)scroll.fullScroll(View.FOCUS_DOWN);else scroll.scrollTo(0,prior);});
        if(pickerActive){label("Choose a file.",16,false);return;}
        if(account==null){signIn();return;}
        if(account.optBoolean("must_change_password")){passwordForm(true);return;}
        if(screen.equals("accounts")&&admin())accountsScreen();else if(screen.equals("news"))newsScreen();else if(screen.equals("enroll")&&!creator())enrollScreen();else if(screen.equals("learners")&&creator())learnersScreen();else if(screen.equals("results")&&!creator())resultsScreen();else if(course!=null&&!selected.isEmpty())courseScreen();else subjectList();
    }
    private void updateNavigation(){
        String role=account==null||account.optBoolean("must_change_password")?"":account.optString("role");
        if(!role.equals(navigationRole)||tabs.isEmpty()){
            navigationRole=role;navigation.removeAllViews();tabs.clear();
            if(!role.isEmpty()){workspaceTab("Subjects","subjects");workspaceTab("News","news");if(role.equals("admin"))workspaceTab("Accounts","accounts");else if(role.equals("student"))workspaceTab("Results","results");}
        }
        navigation.setVisibility(role.isEmpty()?View.GONE:View.VISIBLE);
        for(java.util.Map.Entry<String,Button> entry:tabs.entrySet()){
            boolean active=entry.getKey().equals(screen)||entry.getKey().equals("subjects")&&(screen.equals("learners")||screen.equals("enroll"));Button tab=entry.getValue();
            if(tab.isSelected()!=active){tab.setSelected(active);tab.setBackground(ripple(active?0xfffff2cc:Color.TRANSPARENT));}
        }
    }
    private void workspaceTab(String title,String target){
        Button tab=button(title,false,v->{if(screen.equals(target)&&selected.isEmpty())return;selected="";learnerId="";screen=target;load();});
        tab.setGravity(android.view.Gravity.CENTER);tab.setContentDescription(title);navigation.addView(tab,new LinearLayout.LayoutParams(0,-2,1));tabs.put(target,tab);
    }
    private void showMenu(View anchor){
        PopupMenu menu=new PopupMenu(this,anchor,android.view.Gravity.START);
        menu.getMenu().add(account.optString("name")+" · "+account.optString("role")).setEnabled(false);if(!account.isNull("student_number"))menu.getMenu().add("ID "+account.optString("student_number")).setEnabled(false);
        menu.getMenu().add(0,1,0,"My subjects");menu.getMenu().add(0,11,1,"Scan subject QR");menu.getMenu().add(0,12,2,"Enter subject code");
        if(!creator()){menu.getMenu().add(0,2,1,"Enroll subjects");menu.getMenu().add(0,3,2,"My results");}
        if(creator()&&!selected.isEmpty()){menu.getMenu().add(0,4,3,"Students & compliance");menu.getMenu().add(0,13,3,"Edit subject text");}
        if(!selected.isEmpty()&&course!=null){menu.getMenu().add(0,14,3,"Subject QR");if(creator()){menu.getMenu().add(0,15,3,"Enrollment eligibility");if(admin())menu.getMenu().add(0,16,3,"Enroll or remove student");}}
        menu.getMenu().add(0,5,4,"Announcements");if(admin())menu.getMenu().add(0,6,5,"Accounts");
        menu.getMenu().add(0,7,6,"Sync");menu.getMenu().add(0,8,7,"Change password");menu.getMenu().add(0,9,8,"Public samples / QR scanner");menu.getMenu().add(0,10,9,"Sign out");menu.getMenu().add(0,17,10,"Sign out all devices");
        menu.setOnMenuItemClickListener(item->{if(busy)return true;int id=item.getItemId();
            if(id==17)signOutAll();else if(id==14)showSubjectQr();else if(id==15)eligibilityForm(selected);else if(id==16)enrollmentForm();else if(id==13){if(course!=null)editSubjectText(course.optJSONObject("subject"));}else if(id==11)scanSubject();else if(id==12)enterSubjectCode();else if(id==7)load(true);else if(id==8)passwordForm(false);else if(id==9)finish();else if(id==10)signOut();else{
                learnerId="";if(id!=4)selected="";screen=id==2?"enroll":id==3?"results":id==4?"learners":id==5?"news":id==6?"accounts":"subjects";load();
            }return true;
        });menu.show();
    }
    private void signOutAll(){
        perform(()->api.request("POST","/v1/auth/logout-all",new JSONObject()),r->{api.vault.clear();api.clearProtectedCache();account=null;course=null;report=null;learner=null;subjects=new JSONArray();selected="";scrollOffsets.clear();render();Toast.makeText(this,"Signed out on all devices",Toast.LENGTH_LONG).show();});
    }
    private void signOut(){
        perform(()->{JSONObject result=new JSONObject();try{api.request("POST","/v1/auth/logout",new JSONObject());}catch(Exception e){result.put("warning",true);}finally{api.vault.clear();api.clearProtectedCache();}return result;},r->{account=null;qrSubject="";selected="";learnerId="";course=null;report=null;learner=null;subjects=new JSONArray();scrollOffsets.clear();renderedPage="";subjectListState=null;render();if(r.optBoolean("warning"))AcademyTypography.dialog(this).setTitle("Signed out on this device").setMessage("Server sign-out could not be confirmed. The server session remains subject to its inactivity and expiry limits.").setPositiveButton("OK",null).show();});
    }

    private void signIn(){
        label("Sign in",22,true);
        CheckBox local=new CheckBox(this);AcademyTypography.style(local,16,false);local.setText("Local test accounts");local.setTextColor(INK);local.setMinHeight(dp(56));
        local.setChecked(BuildConfig.DEBUG&&(api.vault.base().isEmpty()||api.isTest()));if(BuildConfig.DEBUG)body.addView(local);
        EditText server=field(body,"Organization HTTPS server",api.isTest()?"":api.vault.base(),false),email=field(body,"Email","",false),password=field(body,"Password","",true);email.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);email.setAutofillHints(View.AUTOFILL_HINT_EMAIL_ADDRESS);password.setAutofillHints(View.AUTOFILL_HINT_PASSWORD);
        LinearLayout testPanel=column();testPanel.addView(txt("Username = password: admin, instructor or student",13,false));
        if(BuildConfig.DEBUG)body.addView(testPanel);
        Runnable mode=()->{server.setVisibility(local.isChecked()?View.GONE:View.VISIBLE);((View)server.getTag()).setVisibility(server.getVisibility());testPanel.setVisibility(local.isChecked()?View.VISIBLE:View.GONE);((TextView)email.getTag()).setText(local.isChecked()?"Username":"Email");email.setContentDescription(local.isChecked()?"Username":"Email");email.setInputType(local.isChecked()?InputType.TYPE_CLASS_TEXT:InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);};mode.run();local.setOnCheckedChangeListener((b,checked)->{password.setText("");email.setText("");mode.run();});
        CheckBox reveal=new CheckBox(this);reveal.setText("Show password");AcademyTypography.style(reveal,14,false);reveal.setTextColor(INK);reveal.setMinHeight(dp(48));reveal.setOnCheckedChangeListener((b,checked)->{int cursor=password.getSelectionStart();password.setTransformationMethod(checked?android.text.method.HideReturnsTransformationMethod.getInstance():android.text.method.PasswordTransformationMethod.getInstance());password.setSelection(Math.max(0,cursor));});body.addView(reveal);
        Button signIn=button("Sign in",true,v->{
            try{
                if(email.getText().toString().trim().isEmpty()){email.setError(local.isChecked()?"Enter your username":"Enter your email");email.requestFocus();return;}if(password.length()==0){password.setError("Enter your password");password.requestFocus();return;}
                String base=BuildConfig.DEBUG&&local.isChecked()?TestWorkspace.BASE:LearningApi.validateBase(server.getText().toString());JSONObject data=new JSONObject().put("email",email.getText().toString().trim()).put("password",password.getText().toString());
                perform(()->{api.vault.setBase(base);JSONObject r=api.request("POST","/v1/auth/login",data);api.vault.save(r.getString("token"));return r;},r->{password.setText("");account=r.getJSONObject("account");screen="subjects";accountOffset=0;rosterOffset=0;discoverOffset=0;selected="";learnerId="";course=null;report=null;learner=null;if(account.optBoolean("must_change_password"))render();else load();});
            }catch(Exception e){error(e);}
        });body.addView(signIn);password.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_DONE);password.setOnEditorActionListener((v,action,event)->{if(action==android.view.inputmethod.EditorInfo.IME_ACTION_DONE){signIn.performClick();return true;}return false;});
        if(BuildConfig.DEBUG)body.addView(button("Reset local test data",false,v->AcademyTypography.dialog(this).setTitle("Reset local test workspace?").setMessage("Deletes this device’s test work and restores admin/admin, instructor/instructor and student/student.").setNegativeButton("Keep data",null).setPositiveButton("Reset",(d,w)->perform(()->{api.resetTest();return new JSONObject();},r->{email.setText("admin");password.setText("");Toast.makeText(this,"Default test accounts restored",Toast.LENGTH_LONG).show();})).show()));
        body.addView(button("Need an account or password reset?",false,v->AcademyTypography.dialog(this).setTitle("Contact your administrator").setMessage("Account registration, access changes, and temporary password resets are managed by your administrator. There is no public self-registration.").setPositiveButton("OK",null).show()));
        
    }
    private void passwordForm(boolean required){
        LinearLayout form=formColumn();EditText old=field(form,"Current password","",true),next=field(form,"New passphrase (15+ characters)","",true),confirm=field(form,"Confirm new passphrase","",true);
        AlertDialog dialog=AcademyTypography.dialog(this).setTitle(required?"Change temporary password":"Change password").setView(formScroll(form)).setCancelable(!required).setNegativeButton(required?"Sign out":"Cancel",(d,w)->{if(required){api.vault.clear();account=null;render();}}).setPositiveButton("Change",null).create();
        dialog.setOnShowListener(v->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(w->{
            if(!next.getText().toString().equals(confirm.getText().toString())){confirm.setError("Passwords must match");return;}
            if(next.length()<15){next.setError("Use at least 15 characters");return;}
            try{JSONObject data=new JSONObject().put("current_password",old.getText().toString()).put("new_password",next.getText().toString());perform(()->api.request("POST","/v1/auth/password",data),r->{api.vault.clear();api.clearProtectedCache();account=null;dialog.dismiss();render();Toast.makeText(this,"Password changed. Sign in again.",Toast.LENGTH_LONG).show();});}catch(Exception e){error(e);}
        }));dialog.show();
    }
    private String subjectOrderKey(JSONObject a){return UUID.nameUUIDFromBytes((api.vault.base()+":"+a.optString("id")).getBytes(StandardCharsets.UTF_8)).toString();}
    private JSONArray orderedSubjects(JSONArray source,JSONObject a)throws Exception{
        String raw=getSharedPreferences("subject-order",MODE_PRIVATE).getString(subjectOrderKey(a),"");java.util.List<String> current=new java.util.ArrayList<>();java.util.Map<String,JSONObject> byId=new java.util.HashMap<>();for(int i=0;i<source.length();i++){JSONObject subject=source.getJSONObject(i);current.add(subject.getString("id"));byId.put(subject.getString("id"),subject);}JSONArray result=new JSONArray();java.util.List<String> merged=org.aeronautical.openacademy.core.SubjectOrder.merge(java.util.Arrays.asList(raw.split(",")),current);for(String id:merged)result.put(byId.get(id));String normalized=String.join(",",merged);if(!normalized.equals(raw))getSharedPreferences("subject-order",MODE_PRIVATE).edit().putString(subjectOrderKey(a),normalized).apply();return result;
    }
    private void saveSubjectOrder(String key,java.util.List<String> ids){
        getSharedPreferences("subject-order",MODE_PRIVATE).edit().putString(key,String.join(",",ids)).apply();
    }
    private void subjectList(){
        label("Subjects",24,true);
        if(subjects.length()==0)label(creator()?"No subjects yet.":"No subjects yet.",15,false);
        if(!creator()&&subjects.length()==0)body.addView(button("Scan subject QR",true,v->scanSubject()));
        LinearLayout footer=column();footer.setPadding(dp(20),0,dp(20),dp(24));if(creator())footer.addView(addButton("Create subject",v->subjectForm()));
        ScrollView old=workspaceScroll;old.removeView(body);contentPane.removeView(old);workspaceScroll=null;
        String key=subjectOrderKey(account);SubjectBoard board=new SubjectBoard(this,subjects,body,footer,this::subjectRow,ids->saveSubjectOrder(key,ids));subjectBoard=board;android.widget.FrameLayout.LayoutParams space=new android.widget.FrameLayout.LayoutParams(getResources().getDisplayMetrics().widthPixels>dp(760)?dp(760):-1,-1,android.view.Gravity.CENTER_HORIZONTAL);contentPane.addView(board,space);board.restoreLayout(subjectListState);subjectListState=null;
    }
    private SubjectBoard.Row subjectRow(JSONObject subject){
        LinearLayout card=card(),line=new LinearLayout(this);line.setGravity(android.view.Gravity.TOP);TextView handle=txt("≡",22,false);handle.setGravity(android.view.Gravity.CENTER);handle.setPadding(0,0,0,0);handle.setContentDescription("Hold to move subject: "+subject.optString("title"));line.addView(handle,new LinearLayout.LayoutParams(dp(48),dp(48)));
        LinearLayout content=column();content.addView(txt(subject.optString("title"),19,true));if(!subject.optString("description").isEmpty()){TextView detail=linkedText(subject.optString("description"),14,url->openSubjectLink(subject,url));detail.setMaxLines(3);detail.setEllipsize(android.text.TextUtils.TruncateAt.END);content.addView(detail);}if(!creator())progress(content,subject.optJSONObject("summary"));line.addView(content,new LinearLayout.LayoutParams(0,-2,1));
        Button options=button("⋮",false,v->{PopupMenu menu=new PopupMenu(this,v);menu.getMenu().add(0,1,0,"Open");menu.getMenu().add(0,2,1,"Move up");menu.getMenu().add(0,3,2,"Move down");menu.setOnMenuItemClickListener(item->{if(busy)return true;if(item.getItemId()==1)openSubject(subject);else if(subjectBoard!=null)subjectBoard.move(subject.optString("id"),item.getItemId()==2?-1:1);return true;});menu.show();});options.setPadding(0,0,0,0);options.setGravity(android.view.Gravity.CENTER);options.setContentDescription("Subject options: "+subject.optString("title"));line.addView(options,new LinearLayout.LayoutParams(dp(48),dp(48)));card.addView(line);
        card.setClickable(true);card.setBackground(ripple(Color.WHITE));card.setOnClickListener(v->{if(!busy)openSubject(subject);});handle.setOnClickListener(v->Toast.makeText(this,"Hold the handle to move this subject",Toast.LENGTH_SHORT).show());return new SubjectBoard.Row(card,handle);
    }
    private void openSubject(JSONObject subject){selected=subject.optString("id");screen="subjects";load();}
    private void subjectForm(){
        if(admin())perform(()->api.request("GET","/v1/admin/accounts",null),r->showSubjectForm(r.getJSONArray("accounts")));
        else showSubjectForm(new JSONArray());
    }
    private void showSubjectForm(JSONArray available){
        LinearLayout form=formColumn();EditText title=field(form,"Subject title","",false),description=field(form,"Subject text · paste web links","",false);description.setSingleLine(false);
        java.util.List<String> ownerIds=new java.util.ArrayList<>(),ownerNames=new java.util.ArrayList<>();ownerIds.add(account.optString("id"));ownerNames.add("Owned by me");
        for(int i=0;i<available.length();i++){JSONObject a=available.optJSONObject(i);if(a.optString("role").equals("instructor")&&a.optString("status").equals("active")){ownerIds.add(a.optString("id"));ownerNames.add(a.optString("name")+" · "+a.optString("email"));}}
        Spinner owner=spinner();owner.setContentDescription("Subject owner");owner.setAdapter(choiceAdapter(ownerNames));if(admin())form.addView(owner);
        AcademyTypography.dialog(this).setTitle("Create subject").setView(formScroll(form)).setNegativeButton("Cancel",null).setPositiveButton("Create",(d,w)->{
            try{JSONObject data=new JSONObject().put("title",title.getText().toString()).put("description",description.getText().toString());if(admin())data.put("owner_id",ownerIds.get(owner.getSelectedItemPosition()));perform(()->api.request("POST","/v1/subjects",data),r->{selected=r.getString("id");load();});}catch(Exception e){error(e);}
        }).show();
    }
    private void editSubjectText(JSONObject subject){
        LinearLayout form=formColumn();EditText title=field(form,"Subject title",subject.optString("title"),false),notes=field(form,"Subject text · paste web links",subject.optString("description"),false);notes.setSingleLine(false);notes.setMinLines(4);notes.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(1000)});ScrollView scroll=new ScrollView(this);scroll.addView(form);formOpen=true;
        AlertDialog dialog=AcademyTypography.dialog(this).setTitle("Edit subject").setView(scroll).setNegativeButton("Cancel",null).setPositiveButton("Save",null).create();dialog.setOnDismissListener(d->formOpen=false);dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{JSONObject data=new JSONObject().put("title",title.getText().toString()).put("description",notes.getText().toString()).put("expected_description",subject.optString("description")).put("expected_title",subject.optString("title"));perform(()->api.request("POST","/v1/subjects/"+subject.optString("id"),data),r->{dialog.dismiss();load();});}catch(Exception e){error(e);}}));dialog.show();
    }
    private void courseScreen(){
        JSONObject subject=course.optJSONObject("subject"),summary=course.optJSONObject("summary");
        Integer completion=!creator()&&summary!=null?summary.optInt("completion_percent"):null;
        String detail=summary==null?"":"Reading "+summary.optInt("read_percent")+"% self-reported; submitted "+summary.optInt("submitted")+" of "+summary.optInt("required");
        subjectHeader.bind(subject.optString("title"),completion,detail,()->{selected="";learnerId="";screen="subjects";load();},()->showSubjectDetails(subject));
        JSONArray items=course.optJSONArray("items");
        if(items.length()==0)label(creator()?"No entries yet.":"No learning entries yet.",16,false);
        for(int n=0;n<items.length();n++){
            JSONObject item=items.optJSONObject(n);LinearLayout card=card();String kind=item.optString("kind"),id=item.optString("id");final boolean manage=admin()||account.optString("id").equals(item.optString("owner_id"));final boolean textMaterial=kind.equals("material")&&item.optString("material_mode").equals("text");
            String type=(item.optString("assessment_type").equals("examination")?"examination":kind).toUpperCase(java.util.Locale.ROOT)+(item.optBoolean("published")?"":" · Draft");
            if(creator()){
                LinearLayout tools=new LinearLayout(this);tools.setGravity(android.view.Gravity.CENTER_VERTICAL);TextView handle=txt("⠿",24,true);handle.setGravity(android.view.Gravity.CENTER);handle.setPadding(0,0,0,0);handle.setContentDescription("Hold to drag entry: "+item.optString("title"));tools.addView(handle,new LinearLayout.LayoutParams(dp(48),dp(48)));tools.addView(txt(type,12,false),new LinearLayout.LayoutParams(0,-2,1));
                Button more=button("⋮",false,v->entryMenu(v,item));more.setPadding(0,0,0,0);more.setGravity(android.view.Gravity.CENTER);more.setContentDescription("Entry options: "+item.optString("title"));tools.addView(more,new LinearLayout.LayoutParams(dp(48),dp(48)));card.addView(tools);handle.setOnLongClickListener(v->{if(busy)return false;return v.startDragAndDrop(android.content.ClipData.newPlainText("academy-entry",id),new View.DragShadowBuilder(v),id,0);});entryDropTarget(card,id);
            }else card.addView(txt(type,12,false));
            card.addView(txt(item.optString("title"),20,true));if(!textMaterial&&!item.has("questions"))card.addView(linkedText(item.optString("body"),16,url->openItemLink(item,url)));
            if(textMaterial){if(item.optBoolean("completed"))card.addView(txt("Completed",14,false));Button read=button("Read",false,v->openReading(id));read.setContentDescription("Read "+item.optString("title"));card.addView(read);}
            if(kind.equals("material")&&!item.optString("material_mode").equals("text")){
                if(item.optBoolean("has_file")&&uploadAllowed){
                    card.addView(button("Read",true,v->perform(()->new JSONObject().put("path",api.material(id,false).getAbsolutePath()),r->startActivity(new Intent(this,PdfActivity.class).putExtra("secure_path",r.getString("path")).putExtra("title",item.optString("title")).putExtra("allow_export",manage).putExtra("item_id",id)))));
                    if(manage)card.addView(button("Save PDF",false,v->perform(()->new JSONObject().put("path",api.material(id,true).getAbsolutePath()),r->{exportPath=r.getString("path");pickerActive=true;exporter.launch("academy-material.pdf");})));
                }else card.addView(txt(uploadAllowed?"PDF has not been uploaded yet.":"File storage is unavailable. Ask the instructor to add a web link instead.",14,false));
                if(manage&&uploadAllowed)card.addView(button("Upload PDF",false,v->{if(busy)return;pendingUpload=id;pendingUploadVersion=item.optInt("edit_version");pickerActive=true;picker.launch(new String[]{"application/pdf"});}));
            }
            if(item.has("questions")){
                JSONObject result=item.optJSONObject("form_result");card.addView(txt(result==null?item.optJSONArray("questions").length()+(item.optJSONArray("questions").length()==1?" question":" questions"):formResult(result),15,result!=null));
                card.addView(button(creator()?"Preview":result==null?PracticeTemplate.action(kind,item.optString("assessment_type")):"Review",result==null&&!creator(),v->openChoiceForm(id)));
            }else if(kind.equals("quiz")&&!creator()){
                JSONObject attempt=item.optJSONObject("attempt");
                if(attempt!=null)card.addView(txt("Submitted · Score "+attempt.optInt("score")+" / 1",16,true));
                else{
                    RadioGroup choices=new RadioGroup(this);JSONArray options=item.optJSONArray("options");
                    for(int i=0;i<options.length();i++){RadioButton option=new RadioButton(this);option.setId(View.generateViewId());option.setTag(i);option.setText(options.optString(i));AcademyTypography.style(option,16,false);option.setMinHeight(dp(48));option.setPadding(dp(8),dp(8),dp(8),dp(8));choices.addView(option);}card.addView(choices);
                    card.addView(button("Submit quiz",true,v->{
                        View chosen=choices.findViewById(choices.getCheckedRadioButtonId());if(chosen==null){Toast.makeText(this,"Choose an answer first",Toast.LENGTH_SHORT).show();return;}
                        int choice=(Integer)chosen.getTag();AcademyTypography.dialog(this).setTitle("Submit this answer?").setMessage("One submission is allowed for this quiz version.").setNegativeButton("Review",null).setPositiveButton("Submit",(d,w)->{
                            try{JSONObject data=new JSONObject().put("choice",choice);String key=UUID.nameUUIDFromBytes((account.optString("id")+":"+id+":"+item.optInt("revision")).getBytes(StandardCharsets.UTF_8)).toString();perform(()->api.request("POST","/v1/items/"+id+"/quiz",data,key),r->load());}catch(Exception e){error(e);}
                        }).show();
                    }));
                }
            }else if(!creator()&&kind.equals("activity")){
                JSONObject submission=item.optJSONObject("submission");
                if(submission==null)card.addView(button("Write answer",true,v->submitOutput(item)));
                else{card.addView(txt(submission.isNull("score")?"Awaiting grade":"Result: "+submission.optDouble("score")+" / 100",16,true));card.addView(txt(submission.optString("feedback"),15,false));card.addView(button("My answer",false,v->showText("My submitted output",submission.optString("output"))));}
            }else if(!creator()&&!textMaterial)card.addView(button(item.optBoolean("completed")?"Read · undo":"Mark as read",false,v->{try{JSONObject data=new JSONObject().put("completed",!item.optBoolean("completed"));perform(()->api.request("POST","/v1/items/"+id+"/complete",data),r->load());}catch(Exception e){error(e);}}));
            body.addView(card);gap();
        }
        if(creator()){Button add=addButton("Add entry",v->entryComposer(null));entryDropTarget(add,"");body.addView(add);}
    }
    private String formResult(JSONObject result){return result.optInt("correct")+" / "+result.optInt("total")+" correct · "+new java.text.DecimalFormat("0.##").format(result.optDouble("score"))+"%";}
    private void showSubjectDetails(JSONObject subject){
        LinearLayout detail=formColumn();detail.addView(txt(subject.optString("title"),20,true));detail.addView(linkedText(subject.optString("description"),16,url->openSubjectLink(subject,url)));
        AcademyTypography.dialog(this).setTitle("Subject details").setView(formScroll(detail)).setPositiveButton("Close",null).show();
    }
    // Reading — open current authorized text on demand; keep the course cards compact.
    private void openReading(String id){
        perform(()->api.request("GET","/v1/items/"+id,null),r->{
            JSONObject item=r.getJSONObject("item");if(!item.optString("kind").equals("material")||!item.optString("material_mode").equals("text"))throw new IllegalArgumentException("Refresh this lesson before reading.");
            LinearLayout reading=formColumn();TextView text=linkedText(item.optString("body"),16,url->openItemLink(item,url));text.setId(R.id.reading_text);reading.addView(text);
            AlertDialog.Builder dialog=AcademyTypography.dialog(this).setTitle(item.optString("title")).setView(formScroll(reading)).setPositiveButton("Close",null);
            if(!creator())dialog.setNeutralButton(item.optBoolean("completed")?"Mark unread":"Mark as read",(d,w)->{try{JSONObject data=new JSONObject().put("completed",!item.optBoolean("completed"));perform(()->api.request("POST","/v1/items/"+id+"/complete",data),value->load());}catch(Exception e){error(e);}});
            dialog.show();
        });
    }
    private JSONArray choiceAnswers(){JSONArray values=new JSONArray();for(RadioGroup group:formGroups){View chosen=group.findViewById(group.getCheckedRadioButtonId());values.put(chosen==null?-1:(Integer)chosen.getTag());}return values;}
    private void saveChoiceDraft(){if(account!=null&&!api.vault.token().isEmpty()&&!formSubmitted&&!activeFormId.isEmpty()&&!formDraftKey.isEmpty())api.vault.saveDraft(formDraftKey,choiceAnswers().toString());}
    private void openChoiceForm(String id){
        if(formOpen)return;
        perform(()->api.request("GET","/v1/items/"+id,null),r->showChoiceForm(r.getJSONObject("item")));
    }
    private void showChoiceForm(JSONObject item)throws Exception{
        if(!item.has("questions"))throw new IllegalArgumentException("Refresh this assessment before answering.");
        JSONArray questions=item.getJSONArray("questions");JSONObject result=item.optJSONObject("form_result");boolean review=creator()||result!=null;
        activeFormId=item.getString("id");formDraftKey=account.getString("id")+":"+activeFormId+":"+item.getInt("revision");formSubmitted=review;formGroups.clear();
        JSONArray selected=result==null?null:result.optJSONArray("answers");if(!review)try{selected=new JSONArray(api.vault.draft(formDraftKey));}catch(Exception ignored){}
        LinearLayout form=formColumn();if(result!=null)form.addView(txt(formResult(result),20,true));
        for(int n=0;n<questions.length();n++){
            JSONObject question=questions.getJSONObject(n);TextView prompt=txt((n+1)+". "+question.getString("prompt"),18,true);ReadingText.apply(prompt);form.addView(prompt);RadioGroup choices=new RadioGroup(this);
            for(int j=0;j<question.getJSONArray("options").length();j++){
                RadioButton option=new RadioButton(this);option.setId(View.generateViewId());option.setTag(j);option.setText(question.getJSONArray("options").getString(j));AcademyTypography.style(option,16,false);option.setTextColor(INK);option.setMinHeight(dp(48));option.setPadding(dp(8),dp(10),dp(8),dp(10));option.setEnabled(!review);choices.addView(option);
                if((creator()&&question.optInt("correct_index",-1)==j)||(!creator()&&selected!=null&&selected.optInt(n,-1)==j))option.setChecked(true);
            }
            form.addView(choices);formGroups.add(choices);Space gap=new Space(this);form.addView(gap,new LinearLayout.LayoutParams(1,dp(20)));
        }
        ScrollView scroll=formScroll(form);AlertDialog dialog=AcademyTypography.dialog(this).setTitle(item.optString("title")).setView(scroll).setNegativeButton(review?null:"Cancel",null).setPositiveButton(review?"Close":"Submit",null).create();choiceDialog=dialog;formOpen=true;
        dialog.setOnDismissListener(d->{saveChoiceDraft();formOpen=false;choiceDialog=null;activeFormId="";formDraftKey="";formGroups.clear();});
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
            if(review){dialog.dismiss();return;}if(busy)return;JSONArray answers=choiceAnswers();
            for(int n=0;n<answers.length();n++)if(answers.optInt(n,-1)<0){formGroups.get(n).requestFocus();scroll.smoothScrollTo(0,formGroups.get(n).getTop());Toast.makeText(this,"Answer question "+(n+1),Toast.LENGTH_SHORT).show();return;}
            AcademyTypography.dialog(this).setTitle("Submit answers?").setMessage("You can submit once for this form version.").setNegativeButton("Review",null).setPositiveButton("Submit",(a,b)->{try{
                saveChoiceDraft();JSONObject data=new JSONObject().put("answers",answers).put("expected_revision",item.getInt("revision"));String id=item.getString("id"),key=UUID.nameUUIDFromBytes((account.getString("id")+":"+id+":"+item.getInt("revision")).getBytes(StandardCharsets.UTF_8)).toString();
                dialog.setCancelable(false);dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(false);
                perform(()->api.request("POST","/v1/items/"+id+"/answers",data,key),response->{formSubmitted=true;api.vault.removeDraft(formDraftKey);dialog.dismiss();load();showText("Result",formResult(response.getJSONObject("result")));});
            }catch(Exception e){error(e);}}).show();
        }));dialog.show();
    }
    private void showSubjectQr(){
        if(course==null)return;JSONObject subject=course.optJSONObject("subject");try{
            android.graphics.Bitmap bitmap=new com.journeyapps.barcodescanner.BarcodeEncoder().encodeBitmap("aoa://subject/"+subject.optString("id"),com.google.zxing.BarcodeFormat.QR_CODE,720,720);ImageView qr=new ImageView(this);qr.setImageBitmap(bitmap);qr.setAdjustViewBounds(true);qr.setContentDescription("Subject QR for "+subject.optString("title"));qr.setPadding(dp(24),dp(24),dp(24),dp(24));AcademyTypography.dialog(this).setTitle(subject.optString("title")).setView(qr).setPositiveButton("Close",null).show();
        }catch(Exception e){error(e);}
    }
    private void entryMenu(View anchor,JSONObject item){
        PopupMenu menu=new PopupMenu(this,anchor);boolean manage=admin()||account.optString("id").equals(item.optString("owner_id"));if(manage)menu.getMenu().add(0,1,0,"Edit");menu.getMenu().add(0,2,1,"Move up");menu.getMenu().add(0,3,2,"Move down");if(manage)menu.getMenu().add(0,4,3,"Delete");
        menu.setOnMenuItemClickListener(action->{if(busy)return true;int id=action.getItemId();if(id==1)entryComposer(item);else if(id==4)deleteEntry(item);else{JSONArray items=course.optJSONArray("items");for(int i=0;i<items.length();i++)if(items.optJSONObject(i).optString("id").equals(item.optString("id"))){int to=i+(id==2?-1:1);if(to>=0&&to<items.length())moveEntry(item.optString("id"),items.optJSONObject(to).optString("id"),id==3);break;}}return true;});menu.show();
    }
    private void deleteEntry(JSONObject item){
        AcademyTypography.dialog(this).setTitle("Delete entry?").setMessage("Remove this entry from the subject? Submitted records are retained.").setNegativeButton("Keep",null).setPositiveButton("Delete",(d,w)->{try{JSONObject data=new JSONObject().put("archived",true).put("expected_edit_version",item.optInt("edit_version"));perform(()->api.request("POST","/v1/items/"+item.optString("id"),data),r->load());}catch(Exception e){error(e);}}).show();
    }
    private void entryDropTarget(View view,String target){
        view.setOnDragListener((v,event)->{
            if(!(event.getLocalState() instanceof String)||!creator())return false;String source=(String)event.getLocalState();
            if(event.getAction()==android.view.DragEvent.ACTION_DRAG_LOCATION){if(v.getParent() instanceof LinearLayout&&v.getParent().getParent() instanceof ScrollView){ScrollView scroll=(ScrollView)v.getParent().getParent();int[] a=new int[2],b=new int[2];v.getLocationOnScreen(a);scroll.getLocationOnScreen(b);float y=a[1]+event.getY()-b[1];if(y<dp(80))scroll.smoothScrollBy(0,-dp(24));else if(y>scroll.getHeight()-dp(80))scroll.smoothScrollBy(0,dp(24));}return true;}
            if(event.getAction()==android.view.DragEvent.ACTION_DRAG_ENTERED){v.setAlpha(.65f);return true;}
            if(event.getAction()==android.view.DragEvent.ACTION_DRAG_EXITED||event.getAction()==android.view.DragEvent.ACTION_DRAG_ENDED){v.setAlpha(1);return true;}
            if(event.getAction()==android.view.DragEvent.ACTION_DROP){v.setAlpha(1);if(!busy)moveEntry(source,target,target.isEmpty()||event.getY()>v.getHeight()/2f);return true;}
            return true;
        });
    }
    private void moveEntry(String source,String target,boolean after){
        if(course==null||busy||source.equals(target))return;try{JSONArray items=course.getJSONArray("items");java.util.List<String> ids=new java.util.ArrayList<>();for(int i=0;i<items.length();i++)ids.add(items.getJSONObject(i).getString("id"));java.util.List<String> old=new java.util.ArrayList<>(ids);if(!ids.remove(source))return;int position=target.isEmpty()?ids.size():ids.indexOf(target)+(after?1:0);if(position<0)return;ids.add(position,source);if(ids.equals(old))return;
            JSONObject data=new JSONObject().put("item_ids",new JSONArray(ids)).put("expected_revision",course.getJSONObject("subject").optInt("order_revision",-1));String subjectId=selected;perform(()->api.request("POST","/v1/subjects/"+subjectId+"/order",data),r->load());
        }catch(Exception e){error(e);}
    }
    private EditText editorText,editorChoice1,editorChoice2;
    private Spinner editorType,editorAnswer;
    private JSONObject editorItem,restoreEditor;
    private TextView editorFile;
    private String editorPdf="";
    private final ActivityResultLauncher<String[]> entryFilePicker=registerForActivityResult(new ActivityResultContracts.OpenDocument(),uri->{pickerActive=false;if(uri!=null){editorPdf=uri.toString();if(restoreEditor!=null)try{restoreEditor.put("pdf",editorPdf);}catch(Exception ignored){}try{getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(SecurityException ignored){}if(editorFile!=null)editorFile.setText("PDF selected");}if(!formOpen)load();});
    private JSONObject editorSnapshot()throws Exception{return new JSONObject().put("account_id",account.getString("id")).put("subject_id",selected).put("item",editorItem==null?JSONObject.NULL:editorItem).put("type",editorType.getSelectedItemPosition()).put("text",editorText.getText().toString()).put("choice1",editorChoice1.getText().toString()).put("choice2",editorChoice2.getText().toString()).put("answer",editorAnswer.getSelectedItemPosition()).put("pdf",editorPdf).put("questions",editorForm==null?JSONObject.NULL:editorForm.snapshot());}
    private void entryComposer(JSONObject item){
        if(busy||formOpen||!creator())return;if(item!=null&&!admin()&&!account.optString("id").equals(item.optString("owner_id")))return;JSONObject saved=restoreEditor;restoreEditor=null;editorItem=item;editorPdf=saved==null?"":saved.optString("pdf");
        LinearLayout form=formColumn();Spinner type=spinner();editorType=type;String[] kinds=uploadAllowed?new String[]{"Material / links","Quiz","Activity","Examination","PDF"}:new String[]{"Material / links","Quiz","Activity","Examination"};type.setAdapter(choiceAdapter(kinds));type.setContentDescription("Entry type");form.addView(type);
        int chosen=item==null?0:item.optString("kind").equals("quiz")?1:item.optString("kind").equals("activity")?(item.optString("assessment_type").equals("examination")?3:2):item.optString("material_mode").equals("file")?4:0;if(saved!=null)chosen=saved.optInt("type",chosen);type.setSelection(Math.min(chosen,kinds.length-1));type.setEnabled(item==null);
        editorText=field(form,"Text, instructions or web link",saved==null?(item==null?"":item.optString("body")):saved.optString("text"),false);editorText.setSingleLine(false);editorText.setMinLines(5);editorText.setMaxLines(12);editorText.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(12000)});
        LinearLayout quiz=column();form.addView(quiz);JSONArray options=item==null?null:item.optJSONArray("options");editorChoice1=field(quiz,"Choice 1",saved==null?(options==null?"":options.optString(0)):saved.optString("choice1"),false);editorChoice2=field(quiz,"Choice 2",saved==null?(options==null?"":options.optString(1)):saved.optString("choice2"),false);editorAnswer=spinner();editorAnswer.setContentDescription("Correct answer");editorAnswer.setAdapter(choiceAdapter(new String[]{"Correct: choice 1","Correct: choice 2"}));editorAnswer.setSelection(Math.min(1,saved==null?(item==null?0:item.optInt("correct_index")):saved.optInt("answer")));quiz.addView(editorAnswer);if(item!=null){editorChoice1.setEnabled(false);editorChoice2.setEnabled(false);editorAnswer.setEnabled(false);if(options!=null&&options.length()>2){editorChoice1.setVisibility(View.GONE);((View)editorChoice1.getTag()).setVisibility(View.GONE);editorChoice2.setVisibility(View.GONE);((View)editorChoice2.getTag()).setVisibility(View.GONE);editorAnswer.setVisibility(View.GONE);for(int i=0;i<options.length();i++)quiz.addView(txt((i+1)+". "+options.optString(i)+(i==item.optInt("correct_index")?" · Correct":""),15,false));}quiz.addView(txt("Create a new quiz to change choices or the answer.",13,false));}
        final boolean useForms=formsAllowed&&(item==null||item.has("questions"));
        editorForm=null;if(useForms)try{JSONArray initial=saved!=null?saved.optJSONArray("questions"):item==null?null:item.optJSONArray("questions");editorForm=new ChoiceFormEditor(this,initial,item==null);form.addView(editorForm);}catch(Exception e){error(e);return;}
        LinearLayout pdf=column();form.addView(pdf);editorFile=txt(editorPdf.isEmpty()?(item!=null&&item.optBoolean("has_file")?"Current PDF attached":"Choose a PDF"):"PDF selected",14,false);pdf.addView(editorFile);Button attach=button("Choose PDF",false,v->{try{pickerActive=true;entryFilePicker.launch(new String[]{"application/pdf"});}catch(RuntimeException e){pickerActive=false;error(e);}});pdf.addView(attach);
        EditText entryText=editorText;Runnable fields=()->{int index=type.getSelectedItemPosition();quiz.setVisibility(index==1&&!useForms?View.VISIBLE:View.GONE);if(editorForm!=null)editorForm.setVisibility(index>=1&&index<=3?View.VISIBLE:View.GONE);pdf.setVisibility(index==4?View.VISIBLE:View.GONE);entryText.setMinLines(useForms&&index>=1&&index<=3?2:5);((TextView)entryText.getTag()).setText(useForms&&index>=1&&index<=3?"Title / instructions":index==1?"Quiz question":index>=2&&index<=3?"Instructions":"Material text or web link");};fields.run();type.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onItemSelected(AdapterView<?> p,View v,int position,long id){fields.run();}public void onNothingSelected(AdapterView<?> p){}});
        ScrollView scroll=new ScrollView(this);scroll.addView(form);formOpen=true;AlertDialog dialog=AcademyTypography.dialog(this).setTitle(item==null?"New entry":"Edit entry").setView(scroll).setNegativeButton("Cancel",null).setPositiveButton("Done",null).create();
        dialog.setOnDismissListener(d->{formOpen=false;editorText=null;editorForm=null;editorFile=null;editorType=null;editorChoice1=null;editorChoice2=null;editorAnswer=null;editorItem=null;editorPdf="";editorDialog=null;});
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{
            String text=editorText.getText().toString().trim();if(text.isEmpty()){editorText.setError("Enter your entry text");return;}int index=type.getSelectedItemPosition();String pdfUri=editorPdf;boolean isPdf=index==4;if(isPdf&&pdfUri.isEmpty()&&(item==null||!item.optBoolean("has_file"))){editorFile.setText("Choose a PDF before Done");return;}
            JSONObject data=new JSONObject().put("title",materialTitle(text)).put("body",text).put("published",!isPdf||pdfUri.isEmpty());if(item==null){data.put("kind",new String[]{"material","quiz","activity","examination","material"}[index]);if(index==0||isPdf)data.put("material_mode",isPdf?"file":"text");if(index>=1&&index<=3&&useForms)data.put("questions",editorForm.questions());else if(index==1){String a=editorChoice1.getText().toString().trim(),b=editorChoice2.getText().toString().trim();if(a.isEmpty()||b.isEmpty()){editorChoice1.setError("Enter both choices");return;}data.put("options",new JSONArray().put(a).put(b)).put("correct_index",editorAnswer.getSelectedItemPosition());}}else data.put("expected_edit_version",item.optInt("edit_version"));
            String subjectId=selected;dialog.setCancelable(false);dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(false);dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
            perform(()->{
                String id=item==null?api.request("POST","/v1/subjects/"+subjectId+"/items",data).getString("id"):item.optString("id");if(item!=null&&(!isPdf||pdfUri.isEmpty()))api.request("POST","/v1/items/"+id,data);
                if(isPdf&&!pdfUri.isEmpty())try{JSONObject draft=api.request("GET","/v1/items/"+id,null).getJSONObject("item");api.upload(id,draft.getInt("edit_version"),getContentResolver().openInputStream(Uri.parse(pdfUri)));JSONObject uploaded=api.request("GET","/v1/items/"+id,null).getJSONObject("item");api.request("POST","/v1/items/"+id,new JSONObject().put("title",materialTitle(text)).put("body",text).put("published",true).put("expected_edit_version",uploaded.getInt("edit_version")));}catch(LearningApi.Failure e){if(e.status==401)throw e;return new JSONObject().put("pdf_draft",true);}catch(Exception e){return new JSONObject().put("pdf_draft",true);}
                return new JSONObject();
            },r->{dialog.dismiss();scrollToEntriesEnd=true;load();if(r.optBoolean("pdf_draft"))showText("PDF needs attention","The PDF transfer did not finish. New PDFs remain drafts until uploaded. Use this entry’s menu → Edit, choose the PDF and press Done again.");});
            // Restore editor buttons after failed requests; the dialog remains open for correction.
        }catch(Exception e){error(e);}}));dialog.show();
        // A request error leaves the editor open; allow correction without dismissing it.
        editorDialog=dialog;
    }
    private AlertDialog editorDialog;
    private void progress(LinearLayout parent,JSONObject m){
        if(m==null)return;int percent=m.optInt("completion_percent");parent.addView(txt(percent+"% complete",16,true));
        ProgressBar bar=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);bar.setMax(100);bar.setProgress(percent);bar.setProgressTintList(android.content.res.ColorStateList.valueOf(GOLD));bar.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(LINE));bar.setContentDescription("Completion "+percent+" percent");parent.addView(bar,new LinearLayout.LayoutParams(-1,dp(8)));
        bar.setContentDescription(percent+"% complete; reading "+m.optInt("read_percent")+"% self-reported; submitted "+m.optInt("submitted")+" of "+m.optInt("required"));
    }
    private void enrollScreen(){
        label("Enroll",24,true);
        if(available.length()==0)label("No eligible subjects.",16,false);
        for(int i=0;i<available.length();i++){JSONObject s=available.optJSONObject(i);LinearLayout c=card();c.addView(txt(s.optString("title"),20,true));c.addView(button("Enroll",true,v->AcademyTypography.dialog(this).setTitle("Enroll in "+s.optString("title")+"?").setNegativeButton("Cancel",null).setPositiveButton("Enroll",(d,w)->perform(()->api.request("POST","/v1/subjects/"+s.optString("id")+"/enrol",new JSONObject()),r->{selected=s.optString("id");screen="subjects";discoverOffset=0;load();})).show()));body.addView(c);gap();}
        if(discoverOffset>0)body.addView(button("Previous subjects",false,v->{discoverOffset=Math.max(0,discoverOffset-100);load();}));if(available.length()==100)body.addView(button("More subjects",false,v->{discoverOffset+=100;load();}));
    }
    private void resultsScreen(){
        label("Results",24,true);
        if(course==null||selected.isEmpty()){
            for(int i=0;i<subjects.length();i++){JSONObject s=subjects.optJSONObject(i);body.addView(button(s.optString("title"),false,v->{selected=s.optString("id");load();}));}
            if(subjects.length()==0)label("Enroll in a subject to see your results.",16,false);return;
        }
        label(course.optJSONObject("subject").optString("title"),20,true);progress(body,course.optJSONObject("summary"));label("Completion ≠ grade",13,false);
        JSONArray items=course.optJSONArray("items");
        for(int i=0;i<items.length();i++){
            JSONObject item=items.optJSONObject(i);if(item.optString("kind").equals("material"))continue;
            LinearLayout c=card();c.addView(txt(item.optString("title"),20,true));JSONObject q=item.optJSONObject("attempt"),w=item.optJSONObject("submission"),formResult=item.optJSONObject("form_result");if(formResult!=null){c.addView(txt(formResult(formResult),16,true));c.addView(button("Review",false,v->openChoiceForm(item.optString("id"))));body.addView(c);gap();continue;}
            c.addView(txt(q!=null?"Quiz result: "+q.optInt("score")+" / 1":w==null?"Not submitted":w.isNull("score")?"Awaiting grade":"Result: "+w.optDouble("score")+" / 100",16,true));
            if(w!=null){c.addView(txt(w.optString("feedback").isEmpty()?"No feedback yet":w.optString("feedback"),15,false));c.addView(button("My answer",false,v->showText("My output",w.optString("output"))));}body.addView(c);gap();
        }
        body.addView(button("Back to subject",true,v->{screen="subjects";render();}));
    }
    private void submitOutput(JSONObject item){
        final String key=account.optString("id")+":"+item.optString("id")+":"+item.optInt("revision");
        LinearLayout form=formColumn();form.addView(txt("Submit written work once for this version. Review your answer before submitting. Drafts stay encrypted on this device until sign-out.",14,false));
        EditText output=field(form,"Your written output",api.vault.draft(key),false);output.setSingleLine(false);output.setMinLines(5);output.setMaxLines(12);output.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(12000)});draftInput=output;draftKey=key;
        ScrollView scroll=new ScrollView(this);scroll.addView(form);boolean[] submitted={false};
        AlertDialog dialog=AcademyTypography.dialog(this).setTitle(item.optString("title")).setView(scroll).setNegativeButton("Save draft",null).setPositiveButton("Submit final output",null).create();
        dialog.setOnDismissListener(d->{if(submitted[0])api.vault.removeDraft(key);else if(!api.vault.saveDraft(key,output.getText().toString()))Toast.makeText(this,"Draft could not be saved on this device.",Toast.LENGTH_LONG).show();draftInput=null;draftKey="";});
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
            if(output.getText().toString().trim().isEmpty()){output.setError("Write your output first");return;}
            try{JSONObject data=new JSONObject().put("output",output.getText().toString());api.vault.saveDraft(key,output.getText().toString());perform(()->api.request("POST","/v1/items/"+item.optString("id")+"/submission",data,UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8)).toString()),r->{submitted[0]=true;dialog.dismiss();load();});}catch(Exception e){error(e);}
        }));dialog.show();
    }
    private void learnersScreen(){
        label("Students & compliance",24,true);if(report==null){label("Refresh to load student data.",16,false);return;}
        if(learner!=null&&!learnerId.isEmpty()){
            JSONObject student=learner.optJSONObject("student");label(student.optString("name"),22,true);label((student.isNull("student_number")?"Student ID not assigned":student.optString("student_number"))+" · "+student.optString("email")+" · "+student.optString("status"),14,false);progress(body,learner.optJSONObject("summary"));
            JSONArray items=learner.optJSONArray("items");for(int i=0;i<items.length();i++){
                JSONObject item=items.optJSONObject(i);LinearLayout c=card();c.addView(txt(item.optString("title"),20,true));c.addView(txt(item.optString("status"),16,true));
                if(!item.isNull("score"))c.addView(txt("Score "+item.optDouble("score")+" / "+item.optInt("max_score"),16,true));
                if(item.has("answer"))c.addView(txt("Selected answer: "+item.optString("answer"),15,false));
                if(!item.optString("output").isEmpty()){c.addView(button("Read submitted output",false,v->showText(item.optString("title"),item.optString("output"))));c.addView(txt(item.optString("feedback"),15,false));if(!item.optString("response_mode").equals("choice"))c.addView(button(item.isNull("score")?"Assess output":"Edit assessment",true,v->gradeOutput(item)));}body.addView(c);gap();
            }
            body.addView(button("Back to roster",false,v->{learnerId="";load();}));return;
        }
        JSONArray rows=report.optJSONArray("learners");label(report.optInt("total")+" enrolled students · page starts at "+(rosterOffset+1),15,false);label("Compliance = submitted / required assessments. Reading is self-reported. No due dates or automatic pass/fail.",14,false);
        body.addView(button("Export this roster page to Excel",true,v->AcademyTypography.dialog(this).setTitle("Export confidential student data?").setMessage("This Excel file covers up to 100 students on this roster page, with current published revisions. Save only to approved organization storage. Exported files cannot be revoked.").setNegativeButton("Cancel",null).setPositiveButton("Choose location",(d,w)->{reportSubject=selected;pickerActive=true;excelExporter.launch("academy-progress-page-"+(rosterOffset/100+1)+".xlsx");}).show()));
        if(rows.length()==0)label("No enrolled students on this page.",16,false);
        for(int i=0;i<rows.length();i++){JSONObject row=rows.optJSONObject(i),student=row.optJSONObject("student"),m=row.optJSONObject("summary");LinearLayout c=card();c.addView(txt(student.optString("name")+" · "+(student.isNull("student_number")?"ID unassigned":student.optString("student_number")),20,true));progress(c,m);c.addView(txt("Compliance "+m.optInt("compliance_percent")+"% · Awaiting assessment "+m.optInt("awaiting_assessment"),15,false));c.addView(button("Review work & results",true,v->{learnerId=student.optString("id");load();}));body.addView(c);gap();}
        if(rosterOffset>0)body.addView(button("Previous students",false,v->{rosterOffset=Math.max(0,rosterOffset-100);load();}));if(!report.isNull("next_offset"))body.addView(button("Next students",false,v->{rosterOffset=report.optInt("next_offset");load();}));
    }
    private void eligibilityForm(String id){
        perform(()->api.request("GET","/v1/subjects/"+id+"/eligibility",null),policy->{
            LinearLayout form=formColumn();form.addView(txt("IDs must match the student’s administrator-managed account. Saving a narrower rule removes automatic enrollments that no longer qualify. Administrator and pre-update enrollments remain.",15,false));
            CheckBox all=new CheckBox(this);AcademyTypography.style(all,16,false);all.setText("All students");all.setTextColor(INK);all.setMinHeight(dp(56));all.setChecked(policy.optBoolean("all_students"));form.addView(all);
            JSONArray numbers=policy.optJSONArray("student_numbers");StringBuilder existing=new StringBuilder();for(int i=0;i<numbers.length();i++){if(i>0)existing.append("\n");existing.append(numbers.optString(i));}
            EditText ids=field(form,"Eligible student IDs · one per line",existing.toString(),false);ids.setSingleLine(false);ids.setMinLines(4);ids.setMaxLines(10);ids.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(33000)});ids.setEnabled(!all.isChecked());all.setOnCheckedChangeListener((b,checked)->ids.setEnabled(!checked));
            form.addView(txt("Leave All students unchecked and the list empty to close automatic enrollment. Up to 1,000 IDs; leading zeros are kept.",14,false));
            ScrollView scroll=new ScrollView(this);scroll.addView(form);formOpen=true;
            AlertDialog dialog=AcademyTypography.dialog(this).setTitle("Enrollment eligibility").setView(scroll).setNegativeButton("Cancel",null).setPositiveButton("Save eligibility",null).create();dialog.setOnDismissListener(d->formOpen=false);
            dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{JSONArray allowed=new JSONArray();if(!all.isChecked())for(String line:ids.getText().toString().split("[\\s,;]+")){if(!line.isEmpty())allowed.put(line);}JSONObject data=new JSONObject().put("all_students",all.isChecked()).put("student_numbers",allowed).put("expected_revision",policy.optInt("revision"));perform(()->api.request("POST","/v1/subjects/"+id+"/eligibility",data),r->{dialog.dismiss();load();});}catch(Exception e){error(e);}}));dialog.show();
        });
    }
    private void setStudentNumber(JSONObject a){
        LinearLayout form=formColumn();EditText number=field(form,"Verified student ID",a.isNull("student_number")?"":a.optString("student_number"),false);form.addView(txt("Verify against official records. Correcting an ID ends sessions and removes its old eligibility grants and automatic enrollments. Administrator and pre-update enrollments remain.",14,false));
        AlertDialog dialog=AcademyTypography.dialog(this).setTitle("Assign student ID").setView(formScroll(form)).setNegativeButton("Cancel",null).setPositiveButton("Save verified ID",null).create();
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{String value=number.getText().toString().trim().toUpperCase(java.util.Locale.ROOT);if(!value.matches("[A-Z0-9][A-Z0-9-]{2,31}")){number.setError("Use 3–32 letters, digits or hyphens");return;}JSONObject data=new JSONObject().put("student_number",value);perform(()->api.request("POST","/v1/admin/accounts/"+a.optString("id"),data),r->{dialog.dismiss();load();});}catch(Exception e){error(e);}}));dialog.show();
    }
    private void gradeOutput(JSONObject item){
        LinearLayout form=formColumn();EditText score=field(form,"Score (0–100)",item.isNull("score")?"":String.valueOf(item.optDouble("score")),false);score.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);EditText feedback=field(form,"Feedback (up to 1000 characters)",item.optString("feedback"),false);feedback.setSingleLine(false);feedback.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(1000)});
        AlertDialog dialog=AcademyTypography.dialog(this).setTitle("Assess "+item.optString("title")).setView(formScroll(form)).setNegativeButton("Cancel",null).setPositiveButton("Save assessment",null).create();
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{double n=Double.parseDouble(score.getText().toString());if(!Double.isFinite(n)||n<0||n>100)throw new IllegalArgumentException("Enter a score from 0 to 100.");JSONObject data=new JSONObject().put("score",n).put("feedback",feedback.getText().toString()).put("expected_graded_at",item.opt("graded_at"));perform(()->api.request("POST","/v1/submissions/"+item.optString("submission_id")+"/grade",data),r->{dialog.dismiss();load();});}catch(Exception e){score.setError("Enter a score from 0 to 100.");}}));dialog.show();
    }
    private void showText(String title,String text){ScrollView scroll=new ScrollView(this);TextView view=txt(text,16,false);view.setPadding(AcademyTypography.inset(this),dp(16),AcademyTypography.inset(this),dp(20));view.setId(R.id.reading_text);view.setTextIsSelectable(true);ReadingText.apply(view);scroll.addView(view);AcademyTypography.dialog(this).setTitle(title).setView(scroll).setPositiveButton("Close",null).show();}
    private interface LinkAction {void open(String url);}
    private TextView linkedText(String text,int sp,LinkAction action){
        android.text.SpannableStringBuilder content=new android.text.SpannableStringBuilder();int end=0;
        for(org.aeronautical.openacademy.core.KnowledgeLinks.Link link:org.aeronautical.openacademy.core.KnowledgeLinks.inText(text)){
            content.append(text,end,link.start);int start=content.length();content.append(link.label).append(" ↗");content.setSpan(new android.text.style.ClickableSpan(){@Override public void onClick(View v){if(!busy)action.open(link.url);}@Override public void updateDrawState(android.text.TextPaint paint){paint.setColor(INK);paint.setUnderlineText(true);}},start,content.length(),android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);end=link.end;
        }
        content.append(text,end,text.length());TextView view=txt("",sp,false);view.setText(content);view.setMovementMethod(android.text.method.LinkMovementMethod.getInstance());view.setHighlightColor(0xfffff0c4);ReadingText.apply(view);return view;
    }
    private void openItemLink(JSONObject item,String url){try{openExternal(url,()->api.request("POST","/v1/items/"+item.optString("id")+"/open-link",new JSONObject().put("url",url).put("expected_revision",item.optInt("revision"))));}catch(Exception e){error(e);}}
    private void openSubjectLink(JSONObject subject,String url){try{openExternal(url,()->api.request("POST","/v1/subjects/"+subject.optString("id")+"/open-link",new JSONObject().put("url",url).put("expected_description",subject.optString("description"))));}catch(Exception e){error(e);}}
    // Links — Review unfamiliar destinations, then authorize the current reference immediately before launch.
    private void openExternal(String raw,Action check){
        java.net.URI uri=org.aeronautical.openacademy.core.KnowledgeLinks.require(raw);
        if(org.aeronautical.openacademy.core.KnowledgeLinks.needsConfirmation(uri)){
            String warning=uri.getScheme().equalsIgnoreCase("http")?"Unencrypted HTTP connection.\n\n":"";
            AcademyTypography.dialog(this).setTitle("Open external link?")
                .setMessage(warning+uri.getHost()+"\n\n"+uri.toASCIIString())
                .setNegativeButton("Cancel",null).setPositiveButton("Open",(d,w)->launchExternal(check)).show();
        }else launchExternal(check);
    }
    private void launchExternal(Action check){
        perform(check,result->{
            String destination=result.getString("url");
            org.aeronautical.openacademy.core.KnowledgeLinks.require(destination);
            try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(destination)).addCategory(Intent.CATEGORY_BROWSABLE));}
            catch(android.content.ActivityNotFoundException e){showText("No app available","Install or enable a browser or the host's application, then tap the link again.");}
        });
    }
    private String materialTitle(String text){String first=text.trim().split("\\R",2)[0];java.util.List<org.aeronautical.openacademy.core.KnowledgeLinks.Link> links=org.aeronautical.openacademy.core.KnowledgeLinks.inText(first);if(!links.isEmpty()&&links.get(0).start==0)return links.get(0).label;return first.length()>100?first.substring(0,100):first;}
    private void accountsScreen(){
        label("Accounts",24,true);body.addView(button("Register account",true,v->registerAccount()));
        for(int n=0;n<accounts.length();n++){
            JSONObject a=accounts.optJSONObject(n);LinearLayout card=card();card.addView(txt(a.optString("name"),20,true));card.addView(txt(a.optString("email")+" · "+a.optString("role")+" · "+a.optString("status"),14,false));
            if(a.optString("role").equals("student"))card.addView(button(a.isNull("student_number")?"Assign verified student ID":"Student ID · "+a.optString("student_number"),false,v->setStudentNumber(a)));
            card.addView(button("Manage access",false,v->AcademyTypography.dialog(this).setTitle(a.optString("email")).setItems(new String[]{a.optString("status").equals("active")?"Suspend account":"Reactivate account","Change role","Reset temporary password","Delete account"},(d,w)->{
                if(w==0)confirmStatus(a,a.optString("status").equals("active")?"suspended":"active");else if(w==1)changeRole(a);else if(w==2)resetPassword(a);else confirmStatus(a,"deleted");
            }).show()));body.addView(card);gap();
        }
        if(accountOffset>0)body.addView(button("Previous accounts",false,v->{accountOffset=Math.max(0,accountOffset-100);load();}));if(accounts.length()==100)body.addView(button("Next accounts",false,v->{accountOffset+=100;load();}));
    }
    private void registerAccount(){
        LinearLayout form=formColumn();EditText name=field(form,"Name","",false),email=field(form,"Email","",false),password=field(form,"Temporary passphrase (15+ characters)","",true);EditText studentNumber=field(form,"Student ID number (student accounts)","",false);Spinner role=spinner();role.setAdapter(choiceAdapter(new String[]{"student","instructor","admin"}));form.addView(role);
        form.addView(txt("Give the temporary passphrase to the intended user through your organization’s approved channel. They must change it on first sign-in.",14,false));
        ScrollView scroll=new ScrollView(this);scroll.addView(form);AlertDialog dialog=AcademyTypography.dialog(this).setTitle("Register account").setView(scroll).setNegativeButton("Cancel",null).setPositiveButton("Create",null).create();
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{JSONObject data=new JSONObject().put("name",name.getText().toString()).put("email",email.getText().toString()).put("password",password.getText().toString()).put("role",role.getSelectedItem().toString());if(role.getSelectedItem().toString().equals("student")){String number=studentNumber.getText().toString().trim().toUpperCase(java.util.Locale.ROOT);if(!number.matches("[A-Z0-9][A-Z0-9-]{2,31}")){studentNumber.setError("Use the verified ID: 3–32 letters, digits or hyphens");return;}data.put("student_number",number);}perform(()->api.request("POST","/v1/admin/accounts",data),r->{password.setText("");dialog.dismiss();load();});}catch(Exception e){error(e);}}));dialog.show();
    }
    private void confirmStatus(JSONObject a,String state){
        LinearLayout form=formColumn();form.addView(txt(state.equals("deleted")?"This removes account access, personal details, and learning records. Authored materials remain for administrator review.":"This change ends all current sessions for the account.",16,false));
        EditText confirm=state.equals("deleted")?field(form,"Type the account email to confirm","",false):null;
        AcademyTypography.dialog(this).setTitle(state.equals("deleted")?"Delete account?":"Change account access?").setView(formScroll(form)).setNegativeButton("Cancel",null).setPositiveButton("Confirm",(d,w)->{try{JSONObject data=new JSONObject().put("status",state);if(confirm!=null)data.put("confirm_email",confirm.getText().toString());perform(()->api.request("POST","/v1/admin/accounts/"+a.optString("id"),data),r->load());}catch(Exception e){error(e);}}).show();
    }
    private void changeRole(JSONObject a){AcademyTypography.dialog(this).setTitle("Change account role").setItems(new String[]{"student","instructor","admin"},(d,w)->AcademyTypography.dialog(this).setTitle("Confirm role change").setMessage("Set "+a.optString("email")+" to "+new String[]{"student","instructor","admin"}[w]+"? Current sessions will end.").setNegativeButton("Cancel",null).setPositiveButton("Change",(x,y)->{try{JSONObject data=new JSONObject().put("role",new String[]{"student","instructor","admin"}[w]);perform(()->api.request("POST","/v1/admin/accounts/"+a.optString("id"),data),r->load());}catch(Exception e){error(e);}}).show()).show();}
    private void resetPassword(JSONObject a){LinearLayout form=formColumn();EditText password=field(form,"New temporary passphrase","",true);AcademyTypography.dialog(this).setTitle("Reset temporary password").setView(formScroll(form)).setNegativeButton("Cancel",null).setPositiveButton("Reset",(d,w)->{try{JSONObject data=new JSONObject().put("password",password.getText().toString());perform(()->api.request("POST","/v1/admin/accounts/"+a.optString("id")+"/password",data),r->{Toast.makeText(this,"Reset. Deliver the temporary password privately.",Toast.LENGTH_LONG).show();load();});}catch(Exception e){error(e);}}).show();}
    private void enrollmentForm(){
        perform(()->api.request("GET","/v1/admin/accounts",null),r->{
            JSONArray all=r.getJSONArray("accounts"),students=new JSONArray();java.util.List<String> names=new java.util.ArrayList<>();for(int i=0;i<all.length();i++){JSONObject a=all.getJSONObject(i);if(a.optString("role").equals("student")&&a.optString("status").equals("active")){students.put(a);names.add(a.optString("name")+" · "+a.optString("email"));}}
            if(students.length()==0){Toast.makeText(this,"Register an active student first",Toast.LENGTH_LONG).show();return;}
            AcademyTypography.dialog(this).setTitle("Choose student").setItems(names.toArray(new String[0]),(d,w)->AcademyTypography.dialog(this).setTitle(names.get(w)).setItems(new String[]{"Enroll in this subject","Remove from this subject"},(x,y)->{try{JSONObject data=new JSONObject().put("student_id",students.getJSONObject(w).getString("id")).put("subject_id",selected).put("enrolled",y==0);perform(()->api.request("POST","/v1/admin/enrolments",data),result->load());}catch(Exception e){error(e);}}).show()).show();
        });
    }
    private void newsScreen(){
        label("News",24,true);if(admin())body.addView(button("Post announcement",true,v->{LinearLayout form=formColumn();EditText title=field(form,"Title","",false),text=field(form,"Announcement","",false);text.setSingleLine(false);AcademyTypography.dialog(this).setTitle("Global announcement").setView(formScroll(form)).setNegativeButton("Cancel",null).setPositiveButton("Publish",(d,w)->{try{JSONObject data=new JSONObject().put("title",title.getText().toString()).put("body",text.getText().toString());perform(()->api.request("POST","/v1/announcements",data),r->{screen="news";load();});}catch(Exception e){error(e);}}).show();}));
        if(announcements.length()==0)label("No announcements.",16,false);
        for(int n=0;n<announcements.length();n++){JSONObject a=announcements.optJSONObject(n);LinearLayout card=card();card.addView(txt(a.optString("title"),20,true));card.addView(txt(a.optString("body"),16,false));if(admin())card.addView(button("Archive announcement",false,v->AcademyTypography.dialog(this).setTitle("Archive announcement?").setNegativeButton("Keep",null).setPositiveButton("Archive",(d,w)->perform(()->api.request("DELETE","/v1/announcements/"+a.optString("id"),null),r->load())).show()));body.addView(card);gap();}
    }
    // Delay the indicator for short requests; reserve its height to avoid layout jumps.
    private void setStatus(String value){
        if(subjectHeader!=null)subjectHeader.setActionsEnabled(!busy);
        if(activityProgress!=null){activityProgress.removeCallbacks(revealProgress);activityProgress.setContentDescription(value);if(busy){if(activityProgress.getVisibility()!=View.VISIBLE)activityProgress.postDelayed(revealProgress,150);}else activityProgress.setVisibility(View.INVISIBLE);}
        for(Button action:actionButtons)action.setEnabled(!busy);
    }
    private LinearLayout column(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    private ScrollView formScroll(LinearLayout form){ScrollView scroll=new ScrollView(this);scroll.setOverScrollMode(View.OVER_SCROLL_NEVER);scroll.setClipToPadding(false);scroll.addView(form);return scroll;}
    private LinearLayout formColumn(){LinearLayout l=column();l.setPadding(AcademyTypography.inset(this),dp(16),AcademyTypography.inset(this),dp(20));return l;}
    private LinearLayout row(){return column();}
    private LinearLayout card(){LinearLayout l=column();int pad=getResources().getDimensionPixelSize(R.dimen.academy_card_padding);l.setPadding(pad,pad,pad,pad);l.setBackground(shape(Color.WHITE));return l;}
    private TextView txt(String text,int sp,boolean bold){TextView t=new TextView(this);t.setText(text);AcademyTypography.style(t,Math.min(sp,26),bold);t.setTextColor(bold?INK:MUTED);t.setPadding(0,0,0,dp(8));if(bold&&sp>=20)ViewCompat.setAccessibilityHeading(t,true);ReadingText.apply(t);return t;}
    private TextView label(String text,int sp,boolean bold){TextView t=txt(text,sp,bold);if(bold&&sp>=22)ViewCompat.setAccessibilityHeading(t,true);body.addView(t);return t;}
    private EditText field(LinearLayout parent,String hint,String value,boolean secret){
        TextView caption=txt(hint,14,true);caption.setPadding(0,dp(10),0,dp(4));parent.addView(caption);
        EditText e=new EditText(this);e.setId(View.generateViewId());caption.setLabelFor(e.getId());e.setTag(caption);e.setContentDescription(hint);e.setText(value);AcademyTypography.style(e,16,false);e.setTextColor(INK);e.setHintTextColor(MUTED);e.setSingleLine(true);e.setIncludeFontPadding(false);e.setGravity(android.view.Gravity.TOP|android.view.Gravity.START);e.setMinHeight(dp(52));e.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_NEXT);
        GradientDrawable outline=shape(Color.WHITE);outline.setStroke(dp(1),0xffb6c2d2);e.setBackground(outline);e.setOnFocusChangeListener((v,focused)->outline.setStroke(dp(focused?2:1),focused?INK:0xffb6c2d2));
        LinearLayout.LayoutParams fieldSpace=new LinearLayout.LayoutParams(-1,-2);fieldSpace.setMargins(0,0,0,dp(6));e.setLayoutParams(fieldSpace);e.setPadding(dp(14),dp(14),dp(14),dp(14));if(secret)e.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);parent.addView(e);return e;
    }
    private Button button(String text,boolean primary,View.OnClickListener click){Button b=new Button(this);b.setText(text);b.setGravity((primary?android.view.Gravity.CENTER:android.view.Gravity.START|android.view.Gravity.CENTER_VERTICAL));b.setAllCaps(false);b.setTextSize(15);b.setLineSpacing(0,AcademyTypography.HEADING_LINE_HEIGHT);b.setIncludeFontPadding(false);b.setMinWidth(0);b.setMinimumWidth(0);b.setMinHeight(dp(48));b.setMinimumHeight(dp(48));b.setPadding(primary?dp(16):0,dp(10),primary?dp(16):0,dp(10));LinearLayout.LayoutParams spacing=new LinearLayout.LayoutParams(-1,-2);spacing.setMargins(0,dp(4),0,dp(4));b.setLayoutParams(spacing);b.setTextColor(new android.content.res.ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{}},new int[]{primary?0xffd5dce6:0xff7b8798,primary?Color.WHITE:INK}));b.setEnabled(!busy);actionButtons.add(b);b.setBackground(ripple(primary?INK:Color.TRANSPARENT));b.setOnClickListener(v->{if(!busy)click.onClick(v);});return b;}
    private Button addButton(String description,View.OnClickListener click){Button b=button("+",false,click);b.setTextSize(28);b.setGravity(android.view.Gravity.CENTER);b.setContentDescription(description);return b;}
    private android.graphics.drawable.Drawable ripple(int color){return new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(0x18102640),shape(color),shape(Color.WHITE));}
    private GradientDrawable shape(int color){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(12));if(color==Color.WHITE)d.setStroke(dp(1),LINE);return d;}
    private Spinner spinner(){Spinner spinner=new Spinner(this);spinner.setMinimumHeight(dp(52));GradientDrawable outline=shape(0xfffafbfd);outline.setStroke(dp(1),LINE);spinner.setBackground(outline);spinner.setPadding(dp(8),dp(4),dp(8),dp(4));LinearLayout.LayoutParams space=new LinearLayout.LayoutParams(-1,-2);space.setMargins(0,dp(6),0,dp(6));spinner.setLayoutParams(space);return spinner;}
    private ArrayAdapter<String> choiceAdapter(String[] values){return choiceAdapter(java.util.Arrays.asList(values));}
    private ArrayAdapter<String> choiceAdapter(java.util.List<String> values){return new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,values){
        private View style(View view,boolean dropdown){if(view instanceof TextView){TextView text=(TextView)view;AcademyTypography.style(text,16,false);text.setTextColor(INK);text.setIncludeFontPadding(false);text.setMinHeight(dp(48));text.setPadding(dp(10),dp(12),dp(10),dp(12));text.setSingleLine(!dropdown);text.setMaxLines(dropdown?4:1);text.setEllipsize(android.text.TextUtils.TruncateAt.END);}return view;}
        @Override public View getView(int position,View view,android.view.ViewGroup parent){return style(super.getView(position,view,parent),false);}
        @Override public View getDropDownView(int position,View view,android.view.ViewGroup parent){return style(super.getDropDownView(position,view,parent),true);}
    };}
    private void gap(){Space s=new Space(this);body.addView(s,new LinearLayout.LayoutParams(1,dp(16)));}
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
}
