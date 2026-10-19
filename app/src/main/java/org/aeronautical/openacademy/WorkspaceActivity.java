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
    private static final int INK=0xff102640,MUTED=0xff536174,PAPER=0xffffffff,GOLD=0xffb17b0f,LINE=0xffe4e9f0;
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private LearningApi api;
    private LinearLayout body;
    private ScrollView workspaceScroll;
    private String renderedPage="";
    private boolean scrollToEntriesEnd;
    private TextView status;
    private JSONObject account,course,report,learner;
    private JSONArray available=new JSONArray();
    private String learnerId="",reportSubject="",draftKey="",qrSubject="";
    private boolean formOpen,uploadAllowed;
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
    private void enterSubjectCode(){LinearLayout form=column();EditText code=field(form,"Subject QR text or subject ID","",false);new AlertDialog.Builder(this).setTitle("Enter subject code").setView(form).setNegativeButton("Cancel",null).setPositiveButton("Check eligibility",(d,w)->handleSubjectQr(code.getText().toString())).show();}
    private void handleSubjectQr(String raw){String id=org.aeronautical.openacademy.core.QrRouter.protectedSubject(raw);if(id.isEmpty()){showText("Check subject QR","Use a protected subject QR issued by your instructor. Public A/B/C sample codes are available in Public samples.");return;}qrSubject=id;selected=id;screen="subjects";learnerId="";load();}
    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);api=new LearningApi(this);
        String requested=getIntent().getStringExtra("subject_id");if(requested!=null&&requested.matches("[a-f0-9-]{36}"))selected=requested;if(getIntent().getBooleanExtra("qr_enrol",false))qrSubject=selected;
        if(saved!=null){scannerActive=saved.getBoolean("scanner",false);pendingUploadVersion=saved.getInt("upload_version",0);qrSubject=saved.getString("qr_subject","");selected=saved.getString("selected","");screen=saved.getString("screen","subjects");pendingUpload=saved.getString("upload","");exportPath=saved.getString("export","");pickerActive=saved.getBoolean("picker",false);accountOffset=saved.getInt("offset",0);learnerId=saved.getString("learner","");rosterOffset=saved.getInt("roster",0);discoverOffset=saved.getInt("discover",0);reportSubject=saved.getString("report_subject","");}
        getOnBackPressedDispatcher().addCallback(this,new androidx.activity.OnBackPressedCallback(true){public void handleOnBackPressed(){if(!learnerId.isEmpty()){learnerId="";load();}else if(screen.equals("learners")){screen="subjects";load();}else if(!selected.isEmpty()||!screen.equals("subjects")){selected="";screen="subjects";load();}else finish();}});
        if(saved!=null&&saved.containsKey("entry_editor"))try{restoreEditor=new JSONObject(saved.getString("entry_editor"));}catch(Exception ignored){}
        render();if(!pickerActive&&!scannerActive)load();
    }
    @Override protected void onSaveInstanceState(Bundle out){try{if(editorText!=null)out.putString("entry_editor",editorSnapshot().toString());else if(restoreEditor!=null)out.putString("entry_editor",restoreEditor.toString());}catch(Exception ignored){}if(draftInput!=null)api.vault.saveDraft(draftKey,draftInput.getText().toString());out.putBoolean("scanner",scannerActive);out.putInt("upload_version",pendingUploadVersion);out.putString("qr_subject",qrSubject);out.putString("learner",learnerId);out.putInt("roster",rosterOffset);out.putInt("discover",discoverOffset);out.putString("report_subject",reportSubject);out.putString("selected",selected);out.putString("screen",screen);out.putString("upload",pendingUpload);out.putString("export",exportPath);out.putBoolean("picker",pickerActive);out.putInt("offset",accountOffset);super.onSaveInstanceState(out);}
    @Override protected void onResume(){super.onResume();if(api!=null&&account!=null&&!busy&&!pickerActive&&!scannerActive&&!formOpen&&draftInput==null&&!account.optBoolean("must_change_password"))load();}
    @Override protected void onDestroy(){io.shutdown();super.onDestroy();}
    private boolean admin(){return account!=null&&account.optString("role").equals("admin");}
    private boolean creator(){return account!=null&&!account.optString("role").equals("student");}
    private void perform(Action action,Done done){
        if(busy||isDestroyed())return;busy=true;if(status!=null)status.setText("Working…");
        io.execute(()->{
            try{JSONObject result=action.run();runOnUiThread(()->{if(isDestroyed())return;busy=false;try{done.accept(result);}catch(Exception e){error(e);}if(status!=null&&!busy)status.setText("");});}
            catch(Exception e){runOnUiThread(()->{if(isDestroyed())return;busy=false;if(e instanceof LearningApi.Failure&&((LearningApi.Failure)e).status==404){course=null;report=null;learner=null;learnerId="";selected="";screen="subjects";render();}if(e instanceof LearningApi.Failure&&((LearningApi.Failure)e).status==401){api.vault.clear();account=null;course=null;subjects=new JSONArray();selected="";render();}error(e);});}
        });
    }
    private void error(Exception e){if(editorDialog!=null&&editorDialog.isShowing()&&e instanceof LearningApi.Failure&&((LearningApi.Failure)e).status==401)editorDialog.dismiss();if(editorDialog!=null&&editorDialog.isShowing()){editorDialog.setCancelable(true);editorDialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(true);editorDialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);}if(status!=null)status.setText("Request not completed");new AlertDialog.Builder(this).setTitle("Please check").setMessage(e.getMessage()==null?"Connection unavailable. Try again.":e.getMessage()).setPositiveButton("OK",null).show();}
    private void load(){
        if(pickerActive||scannerActive)return;
        final String qr=qrSubject,id=qr.isEmpty()?selected:qr,view=screen,studentId=learnerId;final int offset=accountOffset,roster=rosterOffset,browse=discoverOffset;
        perform(()->{
            if(api.vault.token().isEmpty())return new JSONObject().put("signed_out",true);
            JSONObject me=api.request("GET","/v1/me",null),a=me.getJSONObject("account");
            if(a.optBoolean("must_change_password"))return me;
            if(!qr.isEmpty()){
                if(a.optString("role").equals("student"))try{api.request("POST","/v1/subjects/"+qr+"/enrol",new JSONObject().put("source","qr"));me.put("qr_enrolled",true);}catch(LearningApi.Failure e){if(e.status==404)me.put("qr_denied",true);else throw e;}
                me.put("qr_done",true);
            }
            me.put("subjects",api.request("GET","/v1/subjects",null).getJSONArray("subjects"));
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
            uploadAllowed=r.optJSONObject("capabilities")!=null&&r.optJSONObject("capabilities").optBoolean("material_upload");report=r.optJSONObject("report");learner=r.optJSONObject("learner");available=r.optJSONArray("available")==null?new JSONArray():r.getJSONArray("available");account=r.optJSONObject("account");course=r.optJSONObject("course");subjects=r.optJSONArray("subjects")==null?new JSONArray():r.getJSONArray("subjects");announcements=r.optJSONArray("announcements")==null?new JSONArray():r.getJSONArray("announcements");accounts=r.optJSONArray("accounts")==null?new JSONArray():r.getJSONArray("accounts");if(r.optBoolean("qr_done"))qrSubject="";if(r.optBoolean("qr_enrolled"))selected=id;if(r.optBoolean("course_unavailable")||r.optBoolean("qr_denied"))selected="";render();if(restoreEditor!=null&&account!=null&&!account.optBoolean("must_change_password")&&course!=null&&!selected.isEmpty()&&selected.equals(restoreEditor.optString("subject_id",selected))&&!formOpen){JSONObject draft=restoreEditor;entryComposer(draft.optJSONObject("item"));}if(r.optBoolean("qr_denied"))showText("Not eligible for this subject","Ask your instructor to add your administrator-verified student ID, or select All students. Administratively removed access requires administrator restoration.");else if(r.optBoolean("qr_enrolled"))Toast.makeText(this,"Enrollment confirmed",Toast.LENGTH_SHORT).show();if(r.optBoolean("course_unavailable"))new AlertDialog.Builder(this).setTitle("Subject unavailable").setMessage("This subject is unavailable or you need enrollment. Use Enroll subjects from the menu if enrollment is open, or contact your administrator.").setPositiveButton("OK",null).show();
        });
    }
    private void render(){
        LinearLayout root=column();root.setBackgroundColor(PAPER);setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root,(v,insets)->{androidx.core.graphics.Insets b=insets.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.displayCutout());v.setPadding(b.left,b.top,b.right,b.bottom);return insets;});ViewCompat.requestApplyInsets(root);
        String page=screen+":"+selected;int prior=workspaceScroll!=null&&page.equals(renderedPage)?workspaceScroll.getScrollY():0;renderedPage=page;
        ScrollView scroll=new ScrollView(this);workspaceScroll=scroll;boolean bottom=scrollToEntriesEnd;scrollToEntriesEnd=false;scroll.post(()->{if(bottom)scroll.fullScroll(View.FOCUS_DOWN);else scroll.scrollTo(0,prior);});body=column();body.setPadding(dp(24),dp(20),dp(24),dp(40));scroll.addView(body);root.addView(scroll,new LinearLayout.LayoutParams(-1,-1));
        if(account!=null)body.addView(button("☰  Menu",false,this::showMenu),new LinearLayout.LayoutParams(-2,-2));else body.addView(button("‹  Public samples",false,v->finish()));label("Open Academy",30,true);status=label(busy?"Working…":"",13,false);
        if(pickerActive){label("Choose your file to continue.",16,false);return;}
        if(account==null){signIn();return;}
        if(api.isTest())label("LOCAL TEST · data stays on this device",14,true);
        label(account.optString("name")+" · "+account.optString("role"),15,false);if(!account.isNull("student_number"))label("Student ID · "+account.optString("student_number"),13,false);
        if(account.optBoolean("must_change_password")){passwordForm(true);return;}
        if(screen.equals("accounts")&&admin())accountsScreen();else if(screen.equals("news"))newsScreen();else if(screen.equals("enroll")&&!creator())enrollScreen();else if(screen.equals("learners")&&creator())learnersScreen();else if(screen.equals("results")&&!creator())resultsScreen();else if(course!=null&&!selected.isEmpty())courseScreen();else subjectList();
    }
    private void showMenu(View anchor){
        PopupMenu menu=new PopupMenu(this,anchor,android.view.Gravity.START);
        menu.getMenu().add(0,1,0,"My subjects");menu.getMenu().add(0,11,1,"Scan subject QR");menu.getMenu().add(0,12,2,"Enter subject code");
        if(!creator()){menu.getMenu().add(0,2,1,"Enroll subjects");menu.getMenu().add(0,3,2,"My results");}
        if(creator()&&!selected.isEmpty()){menu.getMenu().add(0,4,3,"Students & compliance");menu.getMenu().add(0,13,3,"Edit subject text");}
        if(!selected.isEmpty()&&course!=null){menu.getMenu().add(0,14,3,"Subject QR");if(creator()){menu.getMenu().add(0,15,3,"Enrollment eligibility");if(admin())menu.getMenu().add(0,16,3,"Enroll or remove student");}}
        menu.getMenu().add(0,5,4,"Announcements");if(admin())menu.getMenu().add(0,6,5,"Accounts");
        menu.getMenu().add(0,7,6,"Refresh");menu.getMenu().add(0,8,7,"Change password");menu.getMenu().add(0,9,8,"Public samples / QR scanner");menu.getMenu().add(0,10,9,"Sign out");
        menu.setOnMenuItemClickListener(item->{if(busy)return true;int id=item.getItemId();
            if(id==14)showSubjectQr();else if(id==15)eligibilityForm(selected);else if(id==16)enrollmentForm();else if(id==13){if(course!=null)editSubjectText(course.optJSONObject("subject"));}else if(id==11)scanSubject();else if(id==12)enterSubjectCode();else if(id==7)load();else if(id==8)passwordForm(false);else if(id==9)finish();else if(id==10)signOut();else{
                learnerId="";if(id!=4)selected="";screen=id==2?"enroll":id==3?"results":id==4?"learners":id==5?"news":id==6?"accounts":"subjects";load();
            }return true;
        });menu.show();
    }
    private void signOut(){
        perform(()->{JSONObject result=new JSONObject();try{api.request("POST","/v1/auth/logout",new JSONObject());}catch(Exception e){result.put("warning",true);}finally{api.vault.clear();api.clearProtectedCache();}return result;},r->{account=null;qrSubject="";selected="";learnerId="";course=null;report=null;learner=null;subjects=new JSONArray();render();if(r.optBoolean("warning"))new AlertDialog.Builder(this).setTitle("Signed out on this device").setMessage("Server sign-out could not be confirmed. The server session remains subject to its inactivity and expiry limits.").setPositiveButton("OK",null).show();});
    }

    private void signIn(){
        label("Your subjects. Your next step.",22,true);label("Use the account supplied by your administrator. Public sample materials remain available without an account.",16,false);
        CheckBox local=new CheckBox(this);local.setText("Local test accounts · no server needed");local.setTextColor(INK);local.setMinHeight(dp(56));
        local.setChecked(BuildConfig.DEBUG&&(api.vault.base().isEmpty()||api.isTest()));if(BuildConfig.DEBUG)body.addView(local);
        EditText server=field(body,"Organization HTTPS server",api.isTest()?"":api.vault.base(),false),email=field(body,"Email","",false),password=field(body,"Password","",true);email.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);email.setAutofillHints(View.AUTOFILL_HINT_EMAIL_ADDRESS);password.setAutofillHints(View.AUTOFILL_HINT_PASSWORD);
        LinearLayout testPanel=column();testPanel.addView(txt("Local test logins: admin / admin · instructor / instructor · student / student",14,false));
        if(BuildConfig.DEBUG)body.addView(testPanel);
        Runnable mode=()->{server.setVisibility(local.isChecked()?View.GONE:View.VISIBLE);testPanel.setVisibility(local.isChecked()?View.VISIBLE:View.GONE);email.setHint(local.isChecked()?"Username":"Email");email.setInputType(local.isChecked()?InputType.TYPE_CLASS_TEXT:InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);};mode.run();local.setOnCheckedChangeListener((b,checked)->{password.setText("");email.setText("");mode.run();});
        body.addView(button("Sign in",true,v->{
            try{
                String base=BuildConfig.DEBUG&&local.isChecked()?TestWorkspace.BASE:LearningApi.validateBase(server.getText().toString());JSONObject data=new JSONObject().put("email",email.getText().toString().trim()).put("password",password.getText().toString());password.setText("");
                perform(()->{api.vault.setBase(base);JSONObject r=api.request("POST","/v1/auth/login",data);api.vault.save(r.getString("token"));return r;},r->{account=r.getJSONObject("account");screen="subjects";accountOffset=0;rosterOffset=0;discoverOffset=0;selected="";learnerId="";course=null;report=null;learner=null;if(account.optBoolean("must_change_password"))render();else load();});
            }catch(Exception e){error(e);}
        }));
        if(BuildConfig.DEBUG)body.addView(button("Reset local test data",false,v->new AlertDialog.Builder(this).setTitle("Reset local test workspace?").setMessage("Deletes this device’s test work and restores admin/admin, instructor/instructor and student/student.").setNegativeButton("Keep data",null).setPositiveButton("Reset",(d,w)->perform(()->{api.resetTest();return new JSONObject();},r->{email.setText("admin");password.setText("");Toast.makeText(this,"Default test accounts restored",Toast.LENGTH_LONG).show();})).show()));
        body.addView(button("Need an account or password reset?",false,v->new AlertDialog.Builder(this).setTitle("Contact your administrator").setMessage("Account registration, access changes, and temporary password resets are managed by your administrator. There is no public self-registration.").setPositiveButton("OK",null).show()));
        label("Connect only to your organization’s verified address. Account roles and material access are enforced by the server.",13,false);
    }
    private void passwordForm(boolean required){
        LinearLayout form=column();EditText old=field(form,"Current password","",true),next=field(form,"New passphrase (15+ characters)","",true),confirm=field(form,"Confirm new passphrase","",true);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle(required?"Change temporary password":"Change password").setView(form).setCancelable(!required).setNegativeButton(required?"Sign out":"Cancel",(d,w)->{if(required){api.vault.clear();account=null;render();}}).setPositiveButton("Change",null).create();
        dialog.setOnShowListener(v->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(w->{
            if(!next.getText().toString().equals(confirm.getText().toString())){confirm.setError("Passwords must match");return;}
            if(next.length()<15){next.setError("Use at least 15 characters");return;}
            try{JSONObject data=new JSONObject().put("current_password",old.getText().toString()).put("new_password",next.getText().toString());perform(()->api.request("POST","/v1/auth/password",data),r->{api.vault.clear();api.clearProtectedCache();account=null;dialog.dismiss();render();Toast.makeText(this,"Password changed. Sign in again.",Toast.LENGTH_LONG).show();});}catch(Exception e){error(e);}
        }));dialog.show();
    }
    private void subjectList(){
        gap();label("My subjects",24,true);if(creator())body.addView(button("Create subject",true,v->subjectForm()));
        if(!creator()&&subjects.length()==0)body.addView(button("Scan subject QR",true,v->scanSubject()));
        if(subjects.length()==0)label(creator()?"No subjects yet. Create your first subject.":"No enrolled subjects yet. Scan your instructor’s subject QR to check eligibility and enroll.",16,false);
        for(int n=0;n<subjects.length();n++){
            JSONObject s=subjects.optJSONObject(n);LinearLayout card=card();card.addView(txt(s.optString("title"),22,true));card.addView(linkedText(s.optString("description"),15,url->openSubjectLink(s,url)));if(!creator())progress(card,s.optJSONObject("summary"));
            card.addView(button("Open subject",true,v->{selected=s.optString("id");screen="subjects";load();}));body.addView(card);gap();
        }
        if(creator()&&announcements.length()>0){label("Latest announcement",18,true);JSONObject a=announcements.optJSONObject(0);label(a.optString("title"),17,true);label(a.optString("body"),15,false);}
    }
    private void subjectForm(){
        if(admin())perform(()->api.request("GET","/v1/admin/accounts",null),r->showSubjectForm(r.getJSONArray("accounts")));
        else showSubjectForm(new JSONArray());
    }
    private void showSubjectForm(JSONArray available){
        LinearLayout form=column();EditText title=field(form,"Subject title","",false),description=field(form,"Subject text · paste web links","",false);description.setSingleLine(false);
        java.util.List<String> ownerIds=new java.util.ArrayList<>(),ownerNames=new java.util.ArrayList<>();ownerIds.add(account.optString("id"));ownerNames.add("Owned by me");
        for(int i=0;i<available.length();i++){JSONObject a=available.optJSONObject(i);if(a.optString("role").equals("instructor")&&a.optString("status").equals("active")){ownerIds.add(a.optString("id"));ownerNames.add(a.optString("name")+" · "+a.optString("email"));}}
        Spinner owner=new Spinner(this);owner.setContentDescription("Subject owner");owner.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,ownerNames));if(admin())form.addView(owner);
        new AlertDialog.Builder(this).setTitle("Create subject").setView(form).setNegativeButton("Cancel",null).setPositiveButton("Create",(d,w)->{
            try{JSONObject data=new JSONObject().put("title",title.getText().toString()).put("description",description.getText().toString());if(admin())data.put("owner_id",ownerIds.get(owner.getSelectedItemPosition()));perform(()->api.request("POST","/v1/subjects",data),r->{selected=r.getString("id");load();});}catch(Exception e){error(e);}
        }).show();
    }
    private void editSubjectText(JSONObject subject){
        LinearLayout form=column();EditText title=field(form,"Subject title",subject.optString("title"),false),notes=field(form,"Subject text · paste web links",subject.optString("description"),false);notes.setSingleLine(false);notes.setMinLines(4);notes.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(1000)});ScrollView scroll=new ScrollView(this);scroll.addView(form);formOpen=true;
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Edit subject").setView(scroll).setNegativeButton("Cancel",null).setPositiveButton("Save",null).create();dialog.setOnDismissListener(d->formOpen=false);dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{JSONObject data=new JSONObject().put("title",title.getText().toString()).put("description",notes.getText().toString()).put("expected_description",subject.optString("description")).put("expected_title",subject.optString("title"));perform(()->api.request("POST","/v1/subjects/"+subject.optString("id"),data),r->{dialog.dismiss();load();});}catch(Exception e){error(e);}}));dialog.show();
    }
    private void courseScreen(){
        JSONObject subject=course.optJSONObject("subject");label(subject.optString("title"),26,true);body.addView(linkedText(subject.optString("description"),15,url->openSubjectLink(subject,url)));
        if(!creator()){progress(body,course.optJSONObject("summary"));body.addView(button("View results & feedback",false,v->{screen="results";render();}));}
        JSONArray items=course.optJSONArray("items");
        if(items.length()==0)label(creator()?"Tap + to add your first entry.":"No learning entries yet.",16,false);
        for(int n=0;n<items.length();n++){
            JSONObject item=items.optJSONObject(n);LinearLayout card=card();String kind=item.optString("kind"),id=item.optString("id");final boolean manage=admin()||account.optString("id").equals(item.optString("owner_id"));final boolean textMaterial=kind.equals("material")&&item.optString("material_mode").equals("text");
            String type=(item.optString("assessment_type").equals("examination")?"examination":kind).toUpperCase(java.util.Locale.ROOT)+(item.optBoolean("published")?"":" · Draft");
            if(creator()){
                LinearLayout tools=new LinearLayout(this);tools.setGravity(android.view.Gravity.CENTER_VERTICAL);TextView handle=txt("⠿",24,true);handle.setGravity(android.view.Gravity.CENTER);handle.setContentDescription("Hold to drag entry: "+item.optString("title"));tools.addView(handle,new LinearLayout.LayoutParams(dp(48),dp(48)));tools.addView(txt(type,12,false),new LinearLayout.LayoutParams(0,-2,1));
                Button more=button("⋮",false,v->entryMenu(v,item));more.setContentDescription("Entry options: "+item.optString("title"));tools.addView(more,new LinearLayout.LayoutParams(dp(48),dp(48)));card.addView(tools);handle.setOnLongClickListener(v->{if(busy)return false;return v.startDragAndDrop(android.content.ClipData.newPlainText("academy-entry",id),new View.DragShadowBuilder(v),id,0);});entryDropTarget(card,id);
            }else card.addView(txt(type,12,false));
            if(!textMaterial)card.addView(txt(item.optString("title"),21,true));card.addView(linkedText(item.optString("body"),textMaterial?18:16,url->openItemLink(item,url)));
            if(kind.equals("material")&&!item.optString("material_mode").equals("text")){
                if(item.optBoolean("has_file")&&uploadAllowed){
                    card.addView(button("Read PDF",true,v->perform(()->new JSONObject().put("path",api.material(id,false).getAbsolutePath()),r->startActivity(new Intent(this,PdfActivity.class).putExtra("secure_path",r.getString("path")).putExtra("title",item.optString("title")).putExtra("allow_export",manage).putExtra("item_id",id)))));
                    if(manage)card.addView(button("Download own material",false,v->perform(()->new JSONObject().put("path",api.material(id,true).getAbsolutePath()),r->{exportPath=r.getString("path");pickerActive=true;exporter.launch("academy-material.pdf");})));
                }else card.addView(txt(uploadAllowed?"PDF has not been uploaded yet.":"File storage is unavailable. Ask the instructor to add a web link instead.",14,false));
                if(manage&&uploadAllowed)card.addView(button("Upload / replace PDF",false,v->{if(busy)return;pendingUpload=id;pendingUploadVersion=item.optInt("edit_version");pickerActive=true;picker.launch(new String[]{"application/pdf"});}));
            }
            if(kind.equals("quiz")&&!creator()){
                JSONObject attempt=item.optJSONObject("attempt");
                if(attempt!=null)card.addView(txt("Submitted · Score "+attempt.optInt("score")+" / 1",16,true));
                else{
                    RadioGroup choices=new RadioGroup(this);JSONArray options=item.optJSONArray("options");
                    for(int i=0;i<options.length();i++){RadioButton option=new RadioButton(this);option.setId(View.generateViewId());option.setTag(i);option.setText(options.optString(i));option.setTextSize(16);choices.addView(option);}card.addView(choices);
                    card.addView(button("Submit quiz",true,v->{
                        View chosen=choices.findViewById(choices.getCheckedRadioButtonId());if(chosen==null){Toast.makeText(this,"Choose an answer first",Toast.LENGTH_SHORT).show();return;}
                        int choice=(Integer)chosen.getTag();new AlertDialog.Builder(this).setTitle("Submit this answer?").setMessage("One submission is allowed for this quiz version.").setNegativeButton("Review",null).setPositiveButton("Submit",(d,w)->{
                            try{JSONObject data=new JSONObject().put("choice",choice);String key=UUID.nameUUIDFromBytes((account.optString("id")+":"+id+":"+item.optInt("revision")).getBytes(StandardCharsets.UTF_8)).toString();perform(()->api.request("POST","/v1/items/"+id+"/quiz",data,key),r->load());}catch(Exception e){error(e);}
                        }).show();
                    }));
                }
            }else if(!creator()&&kind.equals("activity")){
                JSONObject submission=item.optJSONObject("submission");
                if(submission==null)card.addView(button("Write & submit output",true,v->submitOutput(item)));
                else{card.addView(txt(submission.isNull("score")?"Submitted · awaiting assessment":"Result: "+submission.optDouble("score")+" / 100",16,true));card.addView(txt(submission.optString("feedback"),15,false));card.addView(button("View my submission",false,v->showText("My submitted output",submission.optString("output"))));}
            }else if(!creator())card.addView(button(item.optBoolean("completed")?"Read · undo":"Mark as read",false,v->{try{JSONObject data=new JSONObject().put("completed",!item.optBoolean("completed"));perform(()->api.request("POST","/v1/items/"+id+"/complete",data),r->load());}catch(Exception e){error(e);}}));
            body.addView(card);gap();
        }
        if(creator()){Button add=button("+",true,v->entryComposer(null));add.setTextSize(28);add.setContentDescription("Add entry");entryDropTarget(add,"");body.addView(add);}
    }
    private void showSubjectQr(){
        if(course==null)return;JSONObject subject=course.optJSONObject("subject");try{
            android.graphics.Bitmap bitmap=new com.journeyapps.barcodescanner.BarcodeEncoder().encodeBitmap("aoa://subject/"+subject.optString("id"),com.google.zxing.BarcodeFormat.QR_CODE,720,720);ImageView qr=new ImageView(this);qr.setImageBitmap(bitmap);qr.setAdjustViewBounds(true);qr.setContentDescription("Subject QR for "+subject.optString("title"));qr.setPadding(dp(24),dp(24),dp(24),dp(24));new AlertDialog.Builder(this).setTitle(subject.optString("title")).setView(qr).setPositiveButton("Close",null).show();
        }catch(Exception e){error(e);}
    }
    private void entryMenu(View anchor,JSONObject item){
        PopupMenu menu=new PopupMenu(this,anchor);boolean manage=admin()||account.optString("id").equals(item.optString("owner_id"));if(manage)menu.getMenu().add(0,1,0,"Edit");menu.getMenu().add(0,2,1,"Move up");menu.getMenu().add(0,3,2,"Move down");if(manage)menu.getMenu().add(0,4,3,"Delete");
        menu.setOnMenuItemClickListener(action->{if(busy)return true;int id=action.getItemId();if(id==1)entryComposer(item);else if(id==4)deleteEntry(item);else{JSONArray items=course.optJSONArray("items");for(int i=0;i<items.length();i++)if(items.optJSONObject(i).optString("id").equals(item.optString("id"))){int to=i+(id==2?-1:1);if(to>=0&&to<items.length())moveEntry(item.optString("id"),items.optJSONObject(to).optString("id"),id==3);break;}}return true;});menu.show();
    }
    private void deleteEntry(JSONObject item){
        new AlertDialog.Builder(this).setTitle("Delete entry?").setMessage("Remove this entry from the subject? Submitted records are retained.").setNegativeButton("Keep",null).setPositiveButton("Delete",(d,w)->{try{JSONObject data=new JSONObject().put("archived",true).put("expected_edit_version",item.optInt("edit_version"));perform(()->api.request("POST","/v1/items/"+item.optString("id"),data),r->load());}catch(Exception e){error(e);}}).show();
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
    private JSONObject editorSnapshot()throws Exception{return new JSONObject().put("subject_id",selected).put("item",editorItem==null?JSONObject.NULL:editorItem).put("type",editorType.getSelectedItemPosition()).put("text",editorText.getText().toString()).put("choice1",editorChoice1.getText().toString()).put("choice2",editorChoice2.getText().toString()).put("answer",editorAnswer.getSelectedItemPosition()).put("pdf",editorPdf);}
    private void entryComposer(JSONObject item){
        if(busy||formOpen)return;JSONObject saved=restoreEditor;restoreEditor=null;editorItem=item;editorPdf=saved==null?"":saved.optString("pdf");
        LinearLayout form=column();Spinner type=new Spinner(this);editorType=type;String[] kinds=uploadAllowed?new String[]{"Material / links","Quiz","Written activity","Written examination","PDF"}:new String[]{"Material / links","Quiz","Written activity","Written examination"};type.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,kinds));type.setContentDescription("Entry type");form.addView(type);
        int chosen=item==null?0:item.optString("kind").equals("quiz")?1:item.optString("kind").equals("activity")?(item.optString("assessment_type").equals("examination")?3:2):item.optString("material_mode").equals("file")?4:0;if(saved!=null)chosen=saved.optInt("type",chosen);type.setSelection(Math.min(chosen,kinds.length-1));type.setEnabled(item==null);
        editorText=field(form,"Text, instructions or web link",saved==null?(item==null?"":item.optString("body")):saved.optString("text"),false);editorText.setSingleLine(false);editorText.setMinLines(5);editorText.setMaxLines(12);editorText.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(12000)});
        LinearLayout quiz=column();form.addView(quiz);JSONArray options=item==null?null:item.optJSONArray("options");editorChoice1=field(quiz,"Choice 1",saved==null?(options==null?"":options.optString(0)):saved.optString("choice1"),false);editorChoice2=field(quiz,"Choice 2",saved==null?(options==null?"":options.optString(1)):saved.optString("choice2"),false);editorAnswer=new Spinner(this);editorAnswer.setContentDescription("Correct answer");editorAnswer.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"Correct: choice 1","Correct: choice 2"}));editorAnswer.setSelection(Math.min(1,saved==null?(item==null?0:item.optInt("correct_index")):saved.optInt("answer")));quiz.addView(editorAnswer);if(item!=null){editorChoice1.setEnabled(false);editorChoice2.setEnabled(false);editorAnswer.setEnabled(false);if(options!=null&&options.length()>2){editorChoice1.setVisibility(View.GONE);editorChoice2.setVisibility(View.GONE);editorAnswer.setVisibility(View.GONE);for(int i=0;i<options.length();i++)quiz.addView(txt((i+1)+". "+options.optString(i)+(i==item.optInt("correct_index")?" · Correct":""),15,false));}quiz.addView(txt("Create a new quiz to change choices or the answer.",13,false));}
        LinearLayout pdf=column();form.addView(pdf);editorFile=txt(editorPdf.isEmpty()?(item!=null&&item.optBoolean("has_file")?"Current PDF attached":"Choose a PDF"):"PDF selected",14,false);pdf.addView(editorFile);Button attach=button("Choose PDF",false,v->{try{pickerActive=true;entryFilePicker.launch(new String[]{"application/pdf"});}catch(RuntimeException e){pickerActive=false;error(e);}});pdf.addView(attach);
        EditText entryText=editorText;Runnable fields=()->{int index=type.getSelectedItemPosition();quiz.setVisibility(index==1?View.VISIBLE:View.GONE);pdf.setVisibility(index==4?View.VISIBLE:View.GONE);entryText.setHint(index==1?"Quiz question":index>=2&&index<=3?"Instructions":"Material text or web link");};fields.run();type.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onItemSelected(AdapterView<?> p,View v,int position,long id){fields.run();}public void onNothingSelected(AdapterView<?> p){}});
        ScrollView scroll=new ScrollView(this);scroll.addView(form);formOpen=true;AlertDialog dialog=new AlertDialog.Builder(this).setTitle(item==null?"New entry":"Edit entry").setView(scroll).setNegativeButton("Cancel",null).setPositiveButton("Done",null).create();
        dialog.setOnDismissListener(d->{formOpen=false;editorText=null;editorFile=null;editorType=null;editorChoice1=null;editorChoice2=null;editorAnswer=null;editorItem=null;editorPdf="";editorDialog=null;});
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{
            String text=editorText.getText().toString().trim();if(text.isEmpty()){editorText.setError("Enter your entry text");return;}int index=type.getSelectedItemPosition();String pdfUri=editorPdf;boolean isPdf=index==4;if(isPdf&&pdfUri.isEmpty()&&(item==null||!item.optBoolean("has_file"))){editorFile.setText("Choose a PDF before Done");return;}
            JSONObject data=new JSONObject().put("title",materialTitle(text)).put("body",text).put("published",!isPdf||pdfUri.isEmpty());if(item==null){data.put("kind",new String[]{"material","quiz","activity","examination","material"}[index]);if(index==0||isPdf)data.put("material_mode",isPdf?"file":"text");if(index==1){String a=editorChoice1.getText().toString().trim(),b=editorChoice2.getText().toString().trim();if(a.isEmpty()||b.isEmpty()){editorChoice1.setError("Enter both choices");return;}data.put("options",new JSONArray().put(a).put(b)).put("correct_index",editorAnswer.getSelectedItemPosition());}}else data.put("expected_edit_version",item.optInt("edit_version"));
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
        if(m==null)return;int percent=m.optInt("completion_percent");parent.addView(txt(percent+"% complete · "+m.optInt("completed")+" / "+m.optInt("total")+" items",16,true));
        ProgressBar bar=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);bar.setMax(100);bar.setProgress(percent);bar.setProgressTintList(android.content.res.ColorStateList.valueOf(GOLD));bar.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(LINE));bar.setContentDescription("Completion "+percent+" percent");parent.addView(bar,new LinearLayout.LayoutParams(-1,dp(14)));
        parent.addView(txt("Read "+m.optInt("read_percent")+"% (self-reported) · Submitted "+m.optInt("submitted")+" / "+m.optInt("required"),14,false));
    }
    private void enrollScreen(){
        label("Enroll subjects",24,true);label("Only subjects you are eligible to join appear here. You can also scan your instructor’s QR.",15,false);
        if(available.length()==0)label("No open subjects on this page. Ask your administrator about restricted subjects.",16,false);
        for(int i=0;i<available.length();i++){JSONObject s=available.optJSONObject(i);LinearLayout c=card();c.addView(txt(s.optString("title"),21,true));c.addView(button("Enroll",true,v->new AlertDialog.Builder(this).setTitle("Enroll in "+s.optString("title")+"?").setNegativeButton("Cancel",null).setPositiveButton("Enroll",(d,w)->perform(()->api.request("POST","/v1/subjects/"+s.optString("id")+"/enrol",new JSONObject()),r->{selected=s.optString("id");screen="subjects";discoverOffset=0;load();})).show()));body.addView(c);gap();}
        if(discoverOffset>0)body.addView(button("Previous subjects",false,v->{discoverOffset=Math.max(0,discoverOffset-100);load();}));if(available.length()==100)body.addView(button("More subjects",false,v->{discoverOffset+=100;load();}));
    }
    private void resultsScreen(){
        label("My results",24,true);
        if(course==null||selected.isEmpty()){
            for(int i=0;i<subjects.length();i++){JSONObject s=subjects.optJSONObject(i);body.addView(button(s.optString("title"),false,v->{selected=s.optString("id");load();}));}
            if(subjects.length()==0)label("Enroll in a subject to see your results.",16,false);return;
        }
        label(course.optJSONObject("subject").optString("title"),20,true);progress(body,course.optJSONObject("summary"));label("Completion tracks participation. Grades are separate; no course pass/fail is inferred.",14,false);
        JSONArray items=course.optJSONArray("items");
        for(int i=0;i<items.length();i++){
            JSONObject item=items.optJSONObject(i);if(item.optString("kind").equals("material"))continue;
            LinearLayout c=card();c.addView(txt(item.optString("title"),20,true));JSONObject q=item.optJSONObject("attempt"),w=item.optJSONObject("submission");
            c.addView(txt(q!=null?"Quiz result: "+q.optInt("score")+" / 1":w==null?"Not submitted":w.isNull("score")?"Submitted · awaiting assessment":"Result: "+w.optDouble("score")+" / 100",16,true));
            if(w!=null){c.addView(txt(w.optString("feedback").isEmpty()?"No feedback yet":w.optString("feedback"),15,false));c.addView(button("View my submission",false,v->showText("My output",w.optString("output"))));}body.addView(c);gap();
        }
        body.addView(button("Back to learning items",true,v->{screen="subjects";render();}));
    }
    private void submitOutput(JSONObject item){
        final String key=account.optString("id")+":"+item.optString("id")+":"+item.optInt("revision");
        LinearLayout form=column();form.addView(txt("Submit written work once for this version. Review your answer before submitting. Drafts stay encrypted on this device until sign-out.",14,false));
        EditText output=field(form,"Your written output",api.vault.draft(key),false);output.setSingleLine(false);output.setMinLines(5);output.setMaxLines(12);output.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(12000)});draftInput=output;draftKey=key;
        ScrollView scroll=new ScrollView(this);scroll.addView(form);boolean[] submitted={false};
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle(item.optString("title")).setView(scroll).setNegativeButton("Save draft",null).setPositiveButton("Submit final output",null).create();
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
                if(!item.optString("output").isEmpty()){c.addView(button("Read submitted output",false,v->showText(item.optString("title"),item.optString("output"))));c.addView(txt(item.optString("feedback"),15,false));c.addView(button(item.isNull("score")?"Assess output":"Edit assessment",true,v->gradeOutput(item)));}body.addView(c);gap();
            }
            body.addView(button("Back to roster",false,v->{learnerId="";load();}));return;
        }
        JSONArray rows=report.optJSONArray("learners");label(report.optInt("total")+" enrolled students · page starts at "+(rosterOffset+1),15,false);label("Compliance = submitted / required assessments. Reading is self-reported. No due dates or automatic pass/fail.",14,false);
        body.addView(button("Export this roster page to Excel",true,v->new AlertDialog.Builder(this).setTitle("Export confidential student data?").setMessage("This Excel file covers up to 100 students on this roster page, with current published revisions. Save only to approved organization storage. Exported files cannot be revoked.").setNegativeButton("Cancel",null).setPositiveButton("Choose location",(d,w)->{reportSubject=selected;pickerActive=true;excelExporter.launch("academy-progress-page-"+(rosterOffset/100+1)+".xlsx");}).show()));
        if(rows.length()==0)label("No enrolled students on this page.",16,false);
        for(int i=0;i<rows.length();i++){JSONObject row=rows.optJSONObject(i),student=row.optJSONObject("student"),m=row.optJSONObject("summary");LinearLayout c=card();c.addView(txt(student.optString("name")+" · "+(student.isNull("student_number")?"ID unassigned":student.optString("student_number")),20,true));progress(c,m);c.addView(txt("Compliance "+m.optInt("compliance_percent")+"% · Awaiting assessment "+m.optInt("awaiting_assessment"),15,false));c.addView(button("Review work & results",true,v->{learnerId=student.optString("id");load();}));body.addView(c);gap();}
        if(rosterOffset>0)body.addView(button("Previous students",false,v->{rosterOffset=Math.max(0,rosterOffset-100);load();}));if(!report.isNull("next_offset"))body.addView(button("Next students",false,v->{rosterOffset=report.optInt("next_offset");load();}));
    }
    private void eligibilityForm(String id){
        perform(()->api.request("GET","/v1/subjects/"+id+"/eligibility",null),policy->{
            LinearLayout form=column();form.addView(txt("IDs must match the student’s administrator-managed account. Saving a narrower rule removes automatic enrollments that no longer qualify. Administrator and pre-update enrollments remain.",15,false));
            CheckBox all=new CheckBox(this);all.setText("All students");all.setTextColor(INK);all.setMinHeight(dp(56));all.setChecked(policy.optBoolean("all_students"));form.addView(all);
            JSONArray numbers=policy.optJSONArray("student_numbers");StringBuilder existing=new StringBuilder();for(int i=0;i<numbers.length();i++){if(i>0)existing.append("\n");existing.append(numbers.optString(i));}
            EditText ids=field(form,"Eligible student IDs · one per line",existing.toString(),false);ids.setSingleLine(false);ids.setMinLines(4);ids.setMaxLines(10);ids.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(33000)});ids.setEnabled(!all.isChecked());all.setOnCheckedChangeListener((b,checked)->ids.setEnabled(!checked));
            form.addView(txt("Leave All students unchecked and the list empty to close automatic enrollment. Up to 1,000 IDs; leading zeros are kept.",14,false));
            ScrollView scroll=new ScrollView(this);scroll.addView(form);formOpen=true;
            AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Enrollment eligibility").setView(scroll).setNegativeButton("Cancel",null).setPositiveButton("Save eligibility",null).create();dialog.setOnDismissListener(d->formOpen=false);
            dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{JSONArray allowed=new JSONArray();if(!all.isChecked())for(String line:ids.getText().toString().split("[\\s,;]+")){if(!line.isEmpty())allowed.put(line);}JSONObject data=new JSONObject().put("all_students",all.isChecked()).put("student_numbers",allowed).put("expected_revision",policy.optInt("revision"));perform(()->api.request("POST","/v1/subjects/"+id+"/eligibility",data),r->{dialog.dismiss();load();});}catch(Exception e){error(e);}}));dialog.show();
        });
    }
    private void setStudentNumber(JSONObject a){
        LinearLayout form=column();EditText number=field(form,"Verified student ID",a.isNull("student_number")?"":a.optString("student_number"),false);form.addView(txt("Verify against official records. Correcting an ID ends sessions and removes its old eligibility grants and automatic enrollments. Administrator and pre-update enrollments remain.",14,false));
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Assign student ID").setView(form).setNegativeButton("Cancel",null).setPositiveButton("Save verified ID",null).create();
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{String value=number.getText().toString().trim().toUpperCase(java.util.Locale.ROOT);if(!value.matches("[A-Z0-9][A-Z0-9-]{2,31}")){number.setError("Use 3–32 letters, digits or hyphens");return;}JSONObject data=new JSONObject().put("student_number",value);perform(()->api.request("POST","/v1/admin/accounts/"+a.optString("id"),data),r->{dialog.dismiss();load();});}catch(Exception e){error(e);}}));dialog.show();
    }
    private void gradeOutput(JSONObject item){
        LinearLayout form=column();EditText score=field(form,"Score (0–100)",item.isNull("score")?"":String.valueOf(item.optDouble("score")),false);score.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);EditText feedback=field(form,"Feedback (up to 1000 characters)",item.optString("feedback"),false);feedback.setSingleLine(false);feedback.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(1000)});
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Assess "+item.optString("title")).setView(form).setNegativeButton("Cancel",null).setPositiveButton("Save assessment",null).create();
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{double n=Double.parseDouble(score.getText().toString());if(!Double.isFinite(n)||n<0||n>100)throw new IllegalArgumentException("Enter a score from 0 to 100.");JSONObject data=new JSONObject().put("score",n).put("feedback",feedback.getText().toString()).put("expected_graded_at",item.opt("graded_at"));perform(()->api.request("POST","/v1/submissions/"+item.optString("submission_id")+"/grade",data),r->{dialog.dismiss();load();});}catch(Exception e){score.setError("Enter a score from 0 to 100.");}}));dialog.show();
    }
    private void showText(String title,String text){ScrollView scroll=new ScrollView(this);TextView view=txt(text,16,false);view.setPadding(dp(20),dp(12),dp(20),dp(20));view.setTextIsSelectable(true);scroll.addView(view);new AlertDialog.Builder(this).setTitle(title).setView(scroll).setPositiveButton("Close",null).show();}
    private interface LinkAction {void open(String url);}
    private TextView linkedText(String text,int sp,LinkAction action){
        android.text.SpannableStringBuilder content=new android.text.SpannableStringBuilder();int end=0;
        for(org.aeronautical.openacademy.core.KnowledgeLinks.Link link:org.aeronautical.openacademy.core.KnowledgeLinks.inText(text)){
            content.append(text,end,link.start);int start=content.length();content.append(link.label).append(" ↗");content.setSpan(new android.text.style.ClickableSpan(){@Override public void onClick(View v){if(!busy)action.open(link.url);}@Override public void updateDrawState(android.text.TextPaint paint){paint.setColor(INK);paint.setUnderlineText(true);}},start,content.length(),android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);end=link.end;
        }
        content.append(text,end,text.length());TextView view=txt("",sp,false);view.setText(content);view.setMovementMethod(android.text.method.LinkMovementMethod.getInstance());view.setHighlightColor(0xfffff0c4);return view;
    }
    private void openItemLink(JSONObject item,String url){try{openExternal(url,()->api.request("POST","/v1/items/"+item.optString("id")+"/open-link",new JSONObject().put("url",url).put("expected_revision",item.optInt("revision"))));}catch(Exception e){error(e);}}
    private void openSubjectLink(JSONObject subject,String url){try{openExternal(url,()->api.request("POST","/v1/subjects/"+subject.optString("id")+"/open-link",new JSONObject().put("url",url).put("expected_description",subject.optString("description"))));}catch(Exception e){error(e);}}
    private void openExternal(String raw,Action check){
        org.aeronautical.openacademy.core.KnowledgeLinks.require(raw);
        perform(check,result->{String destination=result.getString("url");org.aeronautical.openacademy.core.KnowledgeLinks.require(destination);try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(destination)).addCategory(Intent.CATEGORY_BROWSABLE));}catch(android.content.ActivityNotFoundException e){showText("No app available","Install or enable a browser or the host's application, then tap the link again.");}});
    }
    private String materialTitle(String text){String first=text.trim().split("\\R",2)[0];java.util.List<org.aeronautical.openacademy.core.KnowledgeLinks.Link> links=org.aeronautical.openacademy.core.KnowledgeLinks.inText(first);if(!links.isEmpty()&&links.get(0).start==0)return links.get(0).label;return first.length()>100?first.substring(0,100):first;}
    private void accountsScreen(){
        label("Accounts",24,true);body.addView(button("Register account",true,v->registerAccount()));
        for(int n=0;n<accounts.length();n++){
            JSONObject a=accounts.optJSONObject(n);LinearLayout card=card();card.addView(txt(a.optString("name"),20,true));card.addView(txt(a.optString("email")+" · "+a.optString("role")+" · "+a.optString("status"),14,false));
            if(a.optString("role").equals("student"))card.addView(button(a.isNull("student_number")?"Assign verified student ID":"Student ID · "+a.optString("student_number"),false,v->setStudentNumber(a)));
            card.addView(button("Manage access",false,v->new AlertDialog.Builder(this).setTitle(a.optString("email")).setItems(new String[]{a.optString("status").equals("active")?"Suspend account":"Reactivate account","Change role","Reset temporary password","Delete account"},(d,w)->{
                if(w==0)confirmStatus(a,a.optString("status").equals("active")?"suspended":"active");else if(w==1)changeRole(a);else if(w==2)resetPassword(a);else confirmStatus(a,"deleted");
            }).show()));body.addView(card);gap();
        }
        if(accountOffset>0)body.addView(button("Previous accounts",false,v->{accountOffset=Math.max(0,accountOffset-100);load();}));if(accounts.length()==100)body.addView(button("Next accounts",false,v->{accountOffset+=100;load();}));
    }
    private void registerAccount(){
        LinearLayout form=column();EditText name=field(form,"Name","",false),email=field(form,"Email","",false),password=field(form,"Temporary passphrase (15+ characters)","",true);EditText studentNumber=field(form,"Student ID number (student accounts)","",false);Spinner role=new Spinner(this);role.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"student","instructor","admin"}));form.addView(role);
        form.addView(txt("Give the temporary passphrase to the intended user through your organization’s approved channel. They must change it on first sign-in.",14,false));
        ScrollView scroll=new ScrollView(this);scroll.addView(form);AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Register account").setView(scroll).setNegativeButton("Cancel",null).setPositiveButton("Create",null).create();
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{JSONObject data=new JSONObject().put("name",name.getText().toString()).put("email",email.getText().toString()).put("password",password.getText().toString()).put("role",role.getSelectedItem().toString());if(role.getSelectedItem().toString().equals("student")){String number=studentNumber.getText().toString().trim().toUpperCase(java.util.Locale.ROOT);if(!number.matches("[A-Z0-9][A-Z0-9-]{2,31}")){studentNumber.setError("Use the verified ID: 3–32 letters, digits or hyphens");return;}data.put("student_number",number);}perform(()->api.request("POST","/v1/admin/accounts",data),r->{password.setText("");dialog.dismiss();load();});}catch(Exception e){error(e);}}));dialog.show();
    }
    private void confirmStatus(JSONObject a,String state){
        LinearLayout form=column();form.addView(txt(state.equals("deleted")?"This removes account access, personal details, and learning records. Authored materials remain for administrator review.":"This change ends all current sessions for the account.",16,false));
        EditText confirm=state.equals("deleted")?field(form,"Type the account email to confirm","",false):null;
        new AlertDialog.Builder(this).setTitle(state.equals("deleted")?"Delete account?":"Change account access?").setView(form).setNegativeButton("Cancel",null).setPositiveButton("Confirm",(d,w)->{try{JSONObject data=new JSONObject().put("status",state);if(confirm!=null)data.put("confirm_email",confirm.getText().toString());perform(()->api.request("POST","/v1/admin/accounts/"+a.optString("id"),data),r->load());}catch(Exception e){error(e);}}).show();
    }
    private void changeRole(JSONObject a){new AlertDialog.Builder(this).setTitle("Change account role").setItems(new String[]{"student","instructor","admin"},(d,w)->new AlertDialog.Builder(this).setTitle("Confirm role change").setMessage("Set "+a.optString("email")+" to "+new String[]{"student","instructor","admin"}[w]+"? Current sessions will end.").setNegativeButton("Cancel",null).setPositiveButton("Change",(x,y)->{try{JSONObject data=new JSONObject().put("role",new String[]{"student","instructor","admin"}[w]);perform(()->api.request("POST","/v1/admin/accounts/"+a.optString("id"),data),r->load());}catch(Exception e){error(e);}}).show()).show();}
    private void resetPassword(JSONObject a){LinearLayout form=column();EditText password=field(form,"New temporary passphrase","",true);new AlertDialog.Builder(this).setTitle("Reset temporary password").setView(form).setNegativeButton("Cancel",null).setPositiveButton("Reset",(d,w)->{try{JSONObject data=new JSONObject().put("password",password.getText().toString());perform(()->api.request("POST","/v1/admin/accounts/"+a.optString("id")+"/password",data),r->{Toast.makeText(this,"Reset. Deliver the temporary password privately.",Toast.LENGTH_LONG).show();load();});}catch(Exception e){error(e);}}).show();}
    private void enrollmentForm(){
        perform(()->api.request("GET","/v1/admin/accounts",null),r->{
            JSONArray all=r.getJSONArray("accounts"),students=new JSONArray();java.util.List<String> names=new java.util.ArrayList<>();for(int i=0;i<all.length();i++){JSONObject a=all.getJSONObject(i);if(a.optString("role").equals("student")&&a.optString("status").equals("active")){students.put(a);names.add(a.optString("name")+" · "+a.optString("email"));}}
            if(students.length()==0){Toast.makeText(this,"Register an active student first",Toast.LENGTH_LONG).show();return;}
            new AlertDialog.Builder(this).setTitle("Choose student").setItems(names.toArray(new String[0]),(d,w)->new AlertDialog.Builder(this).setTitle(names.get(w)).setItems(new String[]{"Enroll in this subject","Remove from this subject"},(x,y)->{try{JSONObject data=new JSONObject().put("student_id",students.getJSONObject(w).getString("id")).put("subject_id",selected).put("enrolled",y==0);perform(()->api.request("POST","/v1/admin/enrolments",data),result->load());}catch(Exception e){error(e);}}).show()).show();
        });
    }
    private void newsScreen(){
        label("Announcements",24,true);if(admin())body.addView(button("New global announcement",true,v->{LinearLayout form=column();EditText title=field(form,"Title","",false),text=field(form,"Announcement","",false);text.setSingleLine(false);new AlertDialog.Builder(this).setTitle("Global announcement").setView(form).setNegativeButton("Cancel",null).setPositiveButton("Publish",(d,w)->{try{JSONObject data=new JSONObject().put("title",title.getText().toString()).put("body",text.getText().toString());perform(()->api.request("POST","/v1/announcements",data),r->{screen="news";load();});}catch(Exception e){error(e);}}).show();}));
        for(int n=0;n<announcements.length();n++){JSONObject a=announcements.optJSONObject(n);LinearLayout card=card();card.addView(txt(a.optString("title"),21,true));card.addView(txt(a.optString("body"),16,false));if(admin())card.addView(button("Archive announcement",false,v->new AlertDialog.Builder(this).setTitle("Archive announcement?").setNegativeButton("Keep",null).setPositiveButton("Archive",(d,w)->perform(()->api.request("DELETE","/v1/announcements/"+a.optString("id"),null),r->load())).show()));body.addView(card);gap();}
    }
    private LinearLayout column(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    private LinearLayout row(){LinearLayout l=column();return l;}
    private LinearLayout card(){LinearLayout l=column();l.setPadding(dp(22),dp(24),dp(22),dp(24));l.setBackground(shape(Color.WHITE));return l;}
    private TextView txt(String text,int sp,boolean bold){TextView t=new TextView(this);t.setText(text);t.setTextSize(sp);t.setTextColor(bold?INK:MUTED);t.setLineSpacing(dp(4),1);t.setPadding(0,dp(bold?8:4),0,dp(bold?12:8));if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;}
    private TextView label(String text,int sp,boolean bold){TextView t=txt(text,sp,bold);body.addView(t);return t;}
    private EditText field(LinearLayout parent,String hint,String value,boolean secret){EditText e=new EditText(this);e.setHint(hint);e.setContentDescription(hint);e.setText(value);e.setTextSize(16);e.setTextColor(INK);e.setHintTextColor(MUTED);e.setSingleLine(true);e.setMinHeight(dp(58));GradientDrawable outline=shape(Color.WHITE);outline.setStroke(dp(1),0xff7d8da1);e.setBackground(outline);LinearLayout.LayoutParams fieldSpace=new LinearLayout.LayoutParams(-1,-2);fieldSpace.setMargins(0,dp(8),0,dp(8));e.setLayoutParams(fieldSpace);e.setPadding(dp(14),dp(10),dp(14),dp(10));if(secret)e.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);parent.addView(e);return e;}
    private Button button(String text,boolean primary,View.OnClickListener click){Button b=new Button(this);b.setText(text);b.setAllCaps(false);b.setTextSize(15);b.setMinHeight(dp(56));b.setMinimumHeight(dp(56));b.setPadding(dp(18),dp(12),dp(18),dp(12));LinearLayout.LayoutParams spacing=new LinearLayout.LayoutParams(-1,-2);spacing.setMargins(0,dp(6),0,dp(6));b.setLayoutParams(spacing);b.setTextColor(primary?Color.WHITE:INK);b.setBackground(shape(primary?INK:Color.TRANSPARENT));b.setOnClickListener(v->{if(!busy)click.onClick(v);});return b;}
    private GradientDrawable shape(int color){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(16));if(color==Color.WHITE)d.setStroke(dp(1),LINE);return d;}
    private void gap(){Space s=new Space(this);body.addView(s,new LinearLayout.LayoutParams(1,dp(24)));}
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
}
