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
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** One account workspace with role-specific actions; the API remains authoritative. */
public final class WorkspaceActivity extends AppCompatActivity {
    private static final int INK=0xff173c33,MUTED=0xff52665e,PAPER=0xfff6f7f4;
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private LearningApi api;
    private LinearLayout body;
    private TextView status;
    private JSONObject account,course,report,learner;
    private JSONArray available=new JSONArray();
    private String learnerId="",reportSubject="",draftKey="";
    private int rosterOffset,discoverOffset;
    private EditText draftInput;
    private JSONArray subjects=new JSONArray(),announcements=new JSONArray(),accounts=new JSONArray();
    private String selected="",screen="subjects",pendingUpload="";
    private String exportPath="";
    private boolean busy,pickerActive;
    private int accountOffset;
    private interface Action {JSONObject run()throws Exception;}
    private interface Done {void accept(JSONObject value)throws Exception;}
    private final ActivityResultLauncher<String[]> picker=registerForActivityResult(new ActivityResultContracts.OpenDocument(),uri->{
        pickerActive=false;
        if(uri==null){pendingUpload="";load();return;}
        final String id=pendingUpload;pendingUpload="";
        perform(()->{api.upload(id,getContentResolver().openInputStream(uri));return new JSONObject();},r->load());
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
    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);api=new LearningApi(this);
        String requested=getIntent().getStringExtra("subject_id");if(requested!=null&&requested.matches("[a-f0-9-]{36}"))selected=requested;
        if(saved!=null){selected=saved.getString("selected","");screen=saved.getString("screen","subjects");pendingUpload=saved.getString("upload","");exportPath=saved.getString("export","");pickerActive=saved.getBoolean("picker",false);accountOffset=saved.getInt("offset",0);learnerId=saved.getString("learner","");rosterOffset=saved.getInt("roster",0);discoverOffset=saved.getInt("discover",0);reportSubject=saved.getString("report_subject","");}
        getOnBackPressedDispatcher().addCallback(this,new androidx.activity.OnBackPressedCallback(true){public void handleOnBackPressed(){if(!learnerId.isEmpty()){learnerId="";load();}else if(screen.equals("learners")){screen="subjects";load();}else if(!selected.isEmpty()||!screen.equals("subjects")){selected="";screen="subjects";load();}else finish();}});
        render();if(!pickerActive)load();
    }
    @Override protected void onSaveInstanceState(Bundle out){if(draftInput!=null)api.vault.saveDraft(draftKey,draftInput.getText().toString());out.putString("learner",learnerId);out.putInt("roster",rosterOffset);out.putInt("discover",discoverOffset);out.putString("report_subject",reportSubject);out.putString("selected",selected);out.putString("screen",screen);out.putString("upload",pendingUpload);out.putString("export",exportPath);out.putBoolean("picker",pickerActive);out.putInt("offset",accountOffset);super.onSaveInstanceState(out);}
    @Override protected void onDestroy(){io.shutdown();super.onDestroy();}
    private boolean admin(){return account!=null&&account.optString("role").equals("admin");}
    private boolean creator(){return account!=null&&!account.optString("role").equals("student");}
    private void perform(Action action,Done done){
        if(busy)return;busy=true;if(status!=null)status.setText("Working…");
        io.execute(()->{
            try{JSONObject result=action.run();runOnUiThread(()->{if(isDestroyed())return;busy=false;try{done.accept(result);}catch(Exception e){error(e);}if(status!=null&&!busy)status.setText("");});}
            catch(Exception e){runOnUiThread(()->{if(isDestroyed())return;busy=false;if(e instanceof LearningApi.Failure&&((LearningApi.Failure)e).status==404){course=null;report=null;learner=null;learnerId="";selected="";screen="subjects";render();}if(e instanceof LearningApi.Failure&&((LearningApi.Failure)e).status==401){api.vault.clear();account=null;course=null;subjects=new JSONArray();selected="";render();}error(e);});}
        });
    }
    private void error(Exception e){if(status!=null)status.setText("Request not completed");new AlertDialog.Builder(this).setTitle("Please check").setMessage(e.getMessage()==null?"Connection unavailable. Try again.":e.getMessage()).setPositiveButton("OK",null).show();}
    private void load(){
        if(pickerActive)return;
        final String id=selected,view=screen,studentId=learnerId;final int offset=accountOffset,roster=rosterOffset,browse=discoverOffset;
        perform(()->{
            if(api.vault.token().isEmpty())return new JSONObject().put("signed_out",true);
            JSONObject me=api.request("GET","/v1/me",null),a=me.getJSONObject("account");
            if(a.optBoolean("must_change_password"))return me;
            me.put("subjects",api.request("GET","/v1/subjects",null).getJSONArray("subjects"));
            me.put("announcements",api.request("GET","/v1/announcements",null).getJSONArray("announcements"));
            if(!id.isEmpty())try{me.put("course",api.request("GET","/v1/subjects/"+id,null));}catch(LearningApi.Failure e){if(e.status==404)me.put("course_unavailable",true);else throw e;}
            if(a.getString("role").equals("admin")&&view.equals("accounts"))me.put("accounts",api.request("GET","/v1/admin/accounts?offset="+offset,null).getJSONArray("accounts"));
            if(view.equals("enroll"))me.put("available",api.request("GET","/v1/subjects/discover?offset="+browse,null).getJSONArray("subjects"));
            if(view.equals("learners")&&!id.isEmpty()){
                me.put("report",api.request("GET","/v1/subjects/"+id+"/learners?offset="+roster,null));
                if(!studentId.isEmpty())me.put("learner",api.request("GET","/v1/subjects/"+id+"/learners/"+studentId,null));
            }
            return me;
        },r->{
            report=r.optJSONObject("report");learner=r.optJSONObject("learner");available=r.optJSONArray("available")==null?new JSONArray():r.getJSONArray("available");account=r.optJSONObject("account");course=r.optJSONObject("course");subjects=r.optJSONArray("subjects")==null?new JSONArray():r.getJSONArray("subjects");announcements=r.optJSONArray("announcements")==null?new JSONArray():r.getJSONArray("announcements");accounts=r.optJSONArray("accounts")==null?new JSONArray():r.getJSONArray("accounts");if(r.optBoolean("course_unavailable"))selected="";render();if(r.optBoolean("course_unavailable"))new AlertDialog.Builder(this).setTitle("Subject unavailable").setMessage("This subject is unavailable or you need enrollment. Use Enroll subjects from the menu if enrollment is open, or contact your administrator.").setPositiveButton("OK",null).show();
        });
    }
    private void render(){
        LinearLayout root=column();root.setBackgroundColor(PAPER);setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root,(v,insets)->{androidx.core.graphics.Insets b=insets.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.displayCutout());v.setPadding(b.left,b.top,b.right,b.bottom);return insets;});ViewCompat.requestApplyInsets(root);
        ScrollView scroll=new ScrollView(this);body=column();body.setPadding(dp(22),dp(12),dp(22),dp(28));scroll.addView(body);root.addView(scroll,new LinearLayout.LayoutParams(-1,-1));
        if(account!=null)body.addView(button("☰  Menu",false,this::showMenu),new LinearLayout.LayoutParams(-2,-2));else body.addView(button("‹  Public samples",false,v->finish()));label("Open Academy",30,true);status=label(busy?"Working…":"",13,false);
        if(pickerActive){label("Choose your file to continue.",16,false);return;}
        if(account==null){signIn();return;}
        label(account.optString("name")+" · "+account.optString("role"),15,false);
        if(account.optBoolean("must_change_password")){passwordForm(true);return;}
        if(screen.equals("accounts")&&admin())accountsScreen();else if(screen.equals("news"))newsScreen();else if(screen.equals("enroll")&&!creator())enrollScreen();else if(screen.equals("learners")&&creator())learnersScreen();else if(screen.equals("results")&&!creator())resultsScreen();else if(course!=null&&!selected.isEmpty())courseScreen();else subjectList();
    }
    private void showMenu(View anchor){
        PopupMenu menu=new PopupMenu(this,anchor,android.view.Gravity.START);
        menu.getMenu().add(0,1,0,"My subjects");
        if(!creator()){menu.getMenu().add(0,2,1,"Enroll subjects");menu.getMenu().add(0,3,2,"My results");}
        if(creator()&&!selected.isEmpty())menu.getMenu().add(0,4,3,"Students & compliance");
        menu.getMenu().add(0,5,4,"Announcements");if(admin())menu.getMenu().add(0,6,5,"Accounts");
        menu.getMenu().add(0,7,6,"Refresh");menu.getMenu().add(0,8,7,"Change password");menu.getMenu().add(0,9,8,"Public samples / QR scanner");menu.getMenu().add(0,10,9,"Sign out");
        menu.setOnMenuItemClickListener(item->{if(busy)return true;int id=item.getItemId();
            if(id==7)load();else if(id==8)passwordForm(false);else if(id==9)finish();else if(id==10)signOut();else{
                learnerId="";if(id!=4)selected="";screen=id==2?"enroll":id==3?"results":id==4?"learners":id==5?"news":id==6?"accounts":"subjects";load();
            }return true;
        });menu.show();
    }
    private void signOut(){
        perform(()->{JSONObject result=new JSONObject();try{api.request("POST","/v1/auth/logout",new JSONObject());}catch(Exception e){result.put("warning",true);}finally{api.vault.clear();api.clearProtectedCache();}return result;},r->{account=null;selected="";learnerId="";course=null;report=null;learner=null;subjects=new JSONArray();render();if(r.optBoolean("warning"))new AlertDialog.Builder(this).setTitle("Signed out on this device").setMessage("Server sign-out could not be confirmed. The server session remains subject to its inactivity and expiry limits.").setPositiveButton("OK",null).show();});
    }

    private void signIn(){
        label("Your subjects. Your next step.",22,true);label("Use the account supplied by your administrator. Public sample materials remain available without an account.",16,false);
        EditText server=field(body,"Organization HTTPS server",api.vault.base(),false),email=field(body,"Email","",false),password=field(body,"Password","",true);email.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);email.setAutofillHints(View.AUTOFILL_HINT_EMAIL_ADDRESS);password.setAutofillHints(View.AUTOFILL_HINT_PASSWORD);
        body.addView(button("Sign in",true,v->{
            try{
                String base=LearningApi.validateBase(server.getText().toString());JSONObject data=new JSONObject().put("email",email.getText().toString().trim()).put("password",password.getText().toString());password.setText("");
                perform(()->{api.vault.setBase(base);JSONObject r=api.request("POST","/v1/auth/login",data);api.vault.save(r.getString("token"));return r;},r->{account=r.getJSONObject("account");screen="subjects";if(account.optBoolean("must_change_password"))render();else load();});
            }catch(Exception e){error(e);}
        }));
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
        if(subjects.length()==0)label(creator()?"No subjects yet. Create your first subject.":"No enrolled subjects yet. Choose Enroll subjects in the menu, or ask your administrator for access.",16,false);
        for(int n=0;n<subjects.length();n++){
            JSONObject s=subjects.optJSONObject(n);LinearLayout card=card();card.addView(txt(s.optString("title"),22,true));card.addView(txt(s.optString("description"),15,false));if(!creator())progress(card,s.optJSONObject("summary"));
            card.addView(button("Open subject",true,v->{selected=s.optString("id");screen="subjects";load();}));body.addView(card);gap();
        }
        if(creator()&&announcements.length()>0){label("Latest announcement",18,true);JSONObject a=announcements.optJSONObject(0);label(a.optString("title"),17,true);label(a.optString("body"),15,false);}
    }
    private void subjectForm(){
        if(admin())perform(()->api.request("GET","/v1/admin/accounts",null),r->showSubjectForm(r.getJSONArray("accounts")));
        else showSubjectForm(new JSONArray());
    }
    private void showSubjectForm(JSONArray available){
        LinearLayout form=column();EditText title=field(form,"Subject title","",false),description=field(form,"Description","",false);description.setSingleLine(false);
        java.util.List<String> ownerIds=new java.util.ArrayList<>(),ownerNames=new java.util.ArrayList<>();ownerIds.add(account.optString("id"));ownerNames.add("Owned by me");
        for(int i=0;i<available.length();i++){JSONObject a=available.optJSONObject(i);if(a.optString("role").equals("instructor")&&a.optString("status").equals("active")){ownerIds.add(a.optString("id"));ownerNames.add(a.optString("name")+" · "+a.optString("email"));}}
        Spinner owner=new Spinner(this);owner.setContentDescription("Subject owner");owner.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,ownerNames));if(admin())form.addView(owner);
        new AlertDialog.Builder(this).setTitle("Create subject").setView(form).setNegativeButton("Cancel",null).setPositiveButton("Create",(d,w)->{
            try{JSONObject data=new JSONObject().put("title",title.getText().toString()).put("description",description.getText().toString());if(admin())data.put("owner_id",ownerIds.get(owner.getSelectedItemPosition()));perform(()->api.request("POST","/v1/subjects",data),r->{selected=r.getString("id");load();});}catch(Exception e){error(e);}
        }).show();
    }
    private void courseScreen(){
        JSONObject subject=course.optJSONObject("subject");label(subject.optString("title"),26,true);label(subject.optString("description"),15,false);
        if(!creator()){progress(body,course.optJSONObject("summary"));body.addView(button("View results & feedback",false,v->{screen="results";render();}));}
        body.addView(button("Show subject QR",false,v->{try{
            android.graphics.Bitmap bitmap=new com.journeyapps.barcodescanner.BarcodeEncoder().encodeBitmap("aoa://subject/"+subject.optString("id"),com.google.zxing.BarcodeFormat.QR_CODE,720,720);
            ImageView qr=new ImageView(this);qr.setImageBitmap(bitmap);qr.setAdjustViewBounds(true);qr.setContentDescription("Subject QR code for "+subject.optString("title"));qr.setPadding(dp(24),dp(24),dp(24),dp(24));
            new AlertDialog.Builder(this).setTitle(subject.optString("title")).setMessage("Scanning identifies this subject. Enrollment and sign-in are still required.").setView(qr).setPositiveButton("Close",null).show();
        }catch(Exception e){error(e);}}));
        if(creator()){
            body.addView(button("Add learning item",true,v->new AlertDialog.Builder(this).setTitle("Add to subject").setItems(new String[]{"PDF material","Written activity","Quiz (one question)","Written examination"},(d,w)->itemForm(new String[]{"material","activity","quiz","examination"}[w])).show()));
            body.addView(button("Students & compliance",true,v->{screen="learners";learnerId="";rosterOffset=0;load();}));
            body.addView(button(subject.optInt("self_enrol")==1?"Close self-enrollment":"Open self-enrollment",false,v->{final boolean open=subject.optInt("self_enrol")!=1;new AlertDialog.Builder(this).setTitle(open?"Open enrollment?":"Close enrollment?").setMessage(open?"Any active student account can find and join this subject. Materials stay private until enrollment.":"New self-enrollment will stop. Existing enrollments remain.").setNegativeButton("Cancel",null).setPositiveButton("Confirm",(d,w)->{try{JSONObject data=new JSONObject().put("self_enrol",open);perform(()->api.request("POST","/v1/subjects/"+selected,data),r->load());}catch(Exception e){error(e);}}).show();}));
            if(admin())body.addView(button("Enroll or remove student",false,v->enrollmentForm()));
        }
        JSONArray items=course.optJSONArray("items");int done=0;for(int n=0;n<items.length();n++)if(items.optJSONObject(n).optBoolean("completed"))done++;

        if(items.length()==0)label("No published learning items yet.",16,false);
        for(int n=0;n<items.length();n++){
            JSONObject item=items.optJSONObject(n);LinearLayout card=card();String kind=item.optString("kind"),id=item.optString("id");final boolean manage=admin()||account.optString("id").equals(item.optString("owner_id"));
            card.addView(txt((item.optString("assessment_type").equals("examination")?"examination":kind).toUpperCase(java.util.Locale.ROOT)+(item.optBoolean("published")?"":" · Draft"),12,false));card.addView(txt(item.optString("title"),21,true));card.addView(txt(item.optString("body"),16,false));
            if(kind.equals("material")){
                if(item.optBoolean("has_file")){
                    card.addView(button("Read PDF",true,v->perform(()->new JSONObject().put("path",api.material(id,false).getAbsolutePath()),r->startActivity(new Intent(this,PdfActivity.class).putExtra("secure_path",r.getString("path")).putExtra("title",item.optString("title")).putExtra("allow_export",manage).putExtra("item_id",id)))));
                    if(manage)card.addView(button("Download own material",false,v->perform(()->new JSONObject().put("path",api.material(id,true).getAbsolutePath()),r->{exportPath=r.getString("path");pickerActive=true;exporter.launch("academy-material.pdf");})));
                }else card.addView(txt("PDF has not been uploaded yet.",14,false));
                if(manage)card.addView(button("Upload / replace PDF",false,v->{if(busy)return;pendingUpload=id;pickerActive=true;picker.launch(new String[]{"application/pdf"});}));
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
            if(manage)card.addView(button("Edit / publish / archive",false,v->editItem(item)));
            body.addView(card);gap();
        }
    }
    private void progress(LinearLayout parent,JSONObject m){
        if(m==null)return;int percent=m.optInt("completion_percent");parent.addView(txt(percent+"% complete · "+m.optInt("completed")+" / "+m.optInt("total")+" items",16,true));
        ProgressBar bar=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);bar.setMax(100);bar.setProgress(percent);bar.setProgressTintList(android.content.res.ColorStateList.valueOf(INK));bar.setContentDescription("Completion "+percent+" percent");parent.addView(bar,new LinearLayout.LayoutParams(-1,dp(14)));
        parent.addView(txt("Read "+m.optInt("read_percent")+"% (self-reported) · Submitted "+m.optInt("submitted")+" / "+m.optInt("required"),14,false));
    }
    private void enrollScreen(){
        label("Enroll subjects",24,true);label("Only subjects opened for self-enrollment appear here.",15,false);
        if(available.length()==0)label("No open subjects on this page. Ask your administrator about restricted subjects.",16,false);
        for(int i=0;i<available.length();i++){JSONObject s=available.optJSONObject(i);LinearLayout c=card();c.addView(txt(s.optString("title"),21,true));c.addView(txt(s.optString("description"),15,false));c.addView(button("Enroll",true,v->new AlertDialog.Builder(this).setTitle("Enroll in "+s.optString("title")+"?").setNegativeButton("Cancel",null).setPositiveButton("Enroll",(d,w)->perform(()->api.request("POST","/v1/subjects/"+s.optString("id")+"/enrol",new JSONObject()),r->{selected=s.optString("id");screen="subjects";discoverOffset=0;load();})).show()));body.addView(c);gap();}
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
            JSONObject student=learner.optJSONObject("student");label(student.optString("name"),22,true);label(student.optString("email")+" · "+student.optString("status"),14,false);progress(body,learner.optJSONObject("summary"));
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
        for(int i=0;i<rows.length();i++){JSONObject row=rows.optJSONObject(i),student=row.optJSONObject("student"),m=row.optJSONObject("summary");LinearLayout c=card();c.addView(txt(student.optString("name")+" · "+student.optString("status"),20,true));progress(c,m);c.addView(txt("Compliance "+m.optInt("compliance_percent")+"% · Awaiting assessment "+m.optInt("awaiting_assessment"),15,false));c.addView(button("Review work & results",true,v->{learnerId=student.optString("id");load();}));body.addView(c);gap();}
        if(rosterOffset>0)body.addView(button("Previous students",false,v->{rosterOffset=Math.max(0,rosterOffset-100);load();}));if(!report.isNull("next_offset"))body.addView(button("Next students",false,v->{rosterOffset=report.optInt("next_offset");load();}));
    }
    private void gradeOutput(JSONObject item){
        LinearLayout form=column();EditText score=field(form,"Score (0–100)",item.isNull("score")?"":String.valueOf(item.optDouble("score")),false);score.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);EditText feedback=field(form,"Feedback (up to 1000 characters)",item.optString("feedback"),false);feedback.setSingleLine(false);feedback.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(1000)});
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Assess "+item.optString("title")).setView(form).setNegativeButton("Cancel",null).setPositiveButton("Save assessment",null).create();
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{double n=Double.parseDouble(score.getText().toString());if(!Double.isFinite(n)||n<0||n>100)throw new IllegalArgumentException("Enter a score from 0 to 100.");JSONObject data=new JSONObject().put("score",n).put("feedback",feedback.getText().toString()).put("expected_graded_at",item.opt("graded_at"));perform(()->api.request("POST","/v1/submissions/"+item.optString("submission_id")+"/grade",data),r->{dialog.dismiss();load();});}catch(Exception e){score.setError("Enter a score from 0 to 100.");}}));dialog.show();
    }
    private void showText(String title,String text){ScrollView scroll=new ScrollView(this);TextView view=txt(text,16,false);view.setPadding(dp(20),dp(12),dp(20),dp(20));view.setTextIsSelectable(true);scroll.addView(view);new AlertDialog.Builder(this).setTitle(title).setView(scroll).setPositiveButton("Close",null).show();}
    private void itemForm(String kind){
        LinearLayout form=column();EditText title=field(form,"Title","",false),bodyText=field(form,kind.equals("quiz")?"Question":"Instructions / accessible text","",false);bodyText.setSingleLine(false);
        EditText first=kind.equals("quiz")?field(form,"Choice 1","",false):null,second=kind.equals("quiz")?field(form,"Choice 2","",false):null;
        Spinner correct=null;if(kind.equals("quiz")){correct=new Spinner(this);correct.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"Correct answer: choice 1","Correct answer: choice 2"}));form.addView(correct);}final Spinner answer=correct;
        CheckBox published=new CheckBox(this);published.setText("Publish now");published.setChecked(false);form.addView(published);
        ScrollView scroll=new ScrollView(this);scroll.addView(form);
        new AlertDialog.Builder(this).setTitle("New "+kind).setView(scroll).setNegativeButton("Cancel",null).setPositiveButton("Create",(d,w)->{
            try{JSONObject data=new JSONObject().put("kind",kind).put("title",title.getText().toString()).put("body",bodyText.getText().toString()).put("published",published.isChecked());if(kind.equals("quiz"))data.put("options",new JSONArray().put(first.getText().toString()).put(second.getText().toString())).put("correct_index",answer.getSelectedItemPosition());final String courseId=selected;perform(()->api.request("POST","/v1/subjects/"+courseId+"/items",data),r->load());}catch(Exception e){error(e);}
        }).show();
    }
    private void editItem(JSONObject item){
        LinearLayout form=column();EditText title=field(form,"Title",item.optString("title"),false),text=field(form,"Instructions",item.optString("body"),false);text.setSingleLine(false);CheckBox publish=new CheckBox(this);publish.setText("Published");publish.setChecked(item.optBoolean("published"));form.addView(publish);
        new AlertDialog.Builder(this).setTitle("Edit your item").setView(form).setNegativeButton("Cancel",null).setNeutralButton("Archive",(d,w)->new AlertDialog.Builder(this).setTitle("Archive this item?").setMessage("Students will no longer see it. Existing quiz records are kept.").setNegativeButton("Keep",null).setPositiveButton("Archive",(x,y)->{try{JSONObject data=new JSONObject().put("archived",true);perform(()->api.request("POST","/v1/items/"+item.optString("id"),data),r->load());}catch(Exception e){error(e);}}).show()).setPositiveButton("Save",(d,w)->{try{JSONObject data=new JSONObject().put("title",title.getText().toString()).put("body",text.getText().toString()).put("published",publish.isChecked());perform(()->api.request("POST","/v1/items/"+item.optString("id"),data),r->load());}catch(Exception e){error(e);}}).show();
    }
    private void accountsScreen(){
        label("Accounts",24,true);body.addView(button("Register account",true,v->registerAccount()));
        for(int n=0;n<accounts.length();n++){
            JSONObject a=accounts.optJSONObject(n);LinearLayout card=card();card.addView(txt(a.optString("name"),20,true));card.addView(txt(a.optString("email")+" · "+a.optString("role")+" · "+a.optString("status"),14,false));
            card.addView(button("Manage access",false,v->new AlertDialog.Builder(this).setTitle(a.optString("email")).setItems(new String[]{a.optString("status").equals("active")?"Suspend account":"Reactivate account","Change role","Reset temporary password","Delete account"},(d,w)->{
                if(w==0)confirmStatus(a,a.optString("status").equals("active")?"suspended":"active");else if(w==1)changeRole(a);else if(w==2)resetPassword(a);else confirmStatus(a,"deleted");
            }).show()));body.addView(card);gap();
        }
        if(accountOffset>0)body.addView(button("Previous accounts",false,v->{accountOffset=Math.max(0,accountOffset-100);load();}));if(accounts.length()==100)body.addView(button("Next accounts",false,v->{accountOffset+=100;load();}));
    }
    private void registerAccount(){
        LinearLayout form=column();EditText name=field(form,"Name","",false),email=field(form,"Email","",false),password=field(form,"Temporary passphrase (15+ characters)","",true);Spinner role=new Spinner(this);role.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"student","instructor","admin"}));form.addView(role);
        form.addView(txt("Give the temporary passphrase to the intended user through your organization’s approved channel. They must change it on first sign-in.",14,false));
        new AlertDialog.Builder(this).setTitle("Register account").setView(form).setNegativeButton("Cancel",null).setPositiveButton("Create",(d,w)->{try{JSONObject data=new JSONObject().put("name",name.getText().toString()).put("email",email.getText().toString()).put("password",password.getText().toString()).put("role",role.getSelectedItem().toString());perform(()->api.request("POST","/v1/admin/accounts",data),r->load());}catch(Exception e){error(e);}}).show();
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
    private LinearLayout card(){LinearLayout l=column();l.setPadding(dp(18),dp(16),dp(18),dp(16));l.setBackground(shape(Color.WHITE));return l;}
    private TextView txt(String text,int sp,boolean bold){TextView t=new TextView(this);t.setText(text);t.setTextSize(sp);t.setTextColor(bold?INK:MUTED);t.setLineSpacing(dp(3),1);if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;}
    private TextView label(String text,int sp,boolean bold){TextView t=txt(text,sp,bold);body.addView(t);return t;}
    private EditText field(LinearLayout parent,String hint,String value,boolean secret){EditText e=new EditText(this);e.setHint(hint);e.setContentDescription(hint);e.setText(value);e.setTextSize(16);e.setTextColor(INK);e.setHintTextColor(MUTED);e.setSingleLine(true);e.setMinHeight(dp(54));e.setPadding(dp(14),dp(10),dp(14),dp(10));if(secret)e.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);parent.addView(e);return e;}
    private Button button(String text,boolean primary,View.OnClickListener click){Button b=new Button(this);b.setText(text);b.setAllCaps(false);b.setTextSize(15);b.setMinHeight(dp(52));b.setTextColor(primary?Color.WHITE:INK);b.setBackground(shape(primary?INK:Color.TRANSPARENT));b.setOnClickListener(v->{if(!busy)click.onClick(v);});return b;}
    private GradientDrawable shape(int color){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(16));return d;}
    private void gap(){Space s=new Space(this);body.addView(s,new LinearLayout.LayoutParams(1,dp(16)));}
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
}
