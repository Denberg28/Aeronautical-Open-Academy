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
    private JSONObject account,course;
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
    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);api=new LearningApi(this);
        String requested=getIntent().getStringExtra("subject_id");if(requested!=null&&requested.matches("[a-f0-9-]{36}"))selected=requested;
        if(saved!=null){selected=saved.getString("selected","");screen=saved.getString("screen","subjects");pendingUpload=saved.getString("upload","");exportPath=saved.getString("export","");pickerActive=saved.getBoolean("picker",false);accountOffset=saved.getInt("offset",0);}
        getOnBackPressedDispatcher().addCallback(this,new androidx.activity.OnBackPressedCallback(true){public void handleOnBackPressed(){if(!selected.isEmpty()||!screen.equals("subjects")){selected="";screen="subjects";load();}else finish();}});
        render();if(!pickerActive)load();
    }
    @Override protected void onSaveInstanceState(Bundle out){out.putString("selected",selected);out.putString("screen",screen);out.putString("upload",pendingUpload);out.putString("export",exportPath);out.putBoolean("picker",pickerActive);out.putInt("offset",accountOffset);super.onSaveInstanceState(out);}
    @Override protected void onDestroy(){io.shutdown();super.onDestroy();}
    private boolean admin(){return account!=null&&account.optString("role").equals("admin");}
    private boolean creator(){return account!=null&&!account.optString("role").equals("student");}
    private void perform(Action action,Done done){
        if(busy)return;busy=true;if(status!=null)status.setText("Working…");
        io.execute(()->{
            try{JSONObject result=action.run();runOnUiThread(()->{if(isDestroyed())return;busy=false;try{done.accept(result);}catch(Exception e){error(e);}if(status!=null&&!busy)status.setText("");});}
            catch(Exception e){runOnUiThread(()->{if(isDestroyed())return;busy=false;if(e instanceof LearningApi.Failure&&((LearningApi.Failure)e).status==401){api.vault.clear();account=null;course=null;subjects=new JSONArray();selected="";render();}error(e);});}
        });
    }
    private void error(Exception e){if(status!=null)status.setText("Request not completed");new AlertDialog.Builder(this).setTitle("Please check").setMessage(e.getMessage()==null?"Connection unavailable. Try again.":e.getMessage()).setPositiveButton("OK",null).show();}
    private void load(){
        if(pickerActive)return;
        final String id=selected,view=screen;final int offset=accountOffset;
        perform(()->{
            if(api.vault.token().isEmpty())return new JSONObject().put("signed_out",true);
            JSONObject me=api.request("GET","/v1/me",null),a=me.getJSONObject("account");
            if(a.optBoolean("must_change_password"))return me;
            me.put("subjects",api.request("GET","/v1/subjects",null).getJSONArray("subjects"));
            me.put("announcements",api.request("GET","/v1/announcements",null).getJSONArray("announcements"));
            if(!id.isEmpty())try{me.put("course",api.request("GET","/v1/subjects/"+id,null));}catch(LearningApi.Failure e){if(e.status==404)me.put("course_unavailable",true);else throw e;}
            if(a.getString("role").equals("admin")&&view.equals("accounts"))me.put("accounts",api.request("GET","/v1/admin/accounts?offset="+offset,null).getJSONArray("accounts"));
            return me;
        },r->{
            account=r.optJSONObject("account");course=r.optJSONObject("course");subjects=r.optJSONArray("subjects")==null?new JSONArray():r.getJSONArray("subjects");announcements=r.optJSONArray("announcements")==null?new JSONArray():r.getJSONArray("announcements");accounts=r.optJSONArray("accounts")==null?new JSONArray():r.getJSONArray("accounts");if(r.optBoolean("course_unavailable"))selected="";render();if(r.optBoolean("course_unavailable"))new AlertDialog.Builder(this).setTitle("Subject unavailable").setMessage("This subject is unavailable or you need enrollment. Ask your administrator to check access.").setPositiveButton("OK",null).show();
        });
    }
    private void render(){
        LinearLayout root=column();root.setBackgroundColor(PAPER);setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root,(v,insets)->{androidx.core.graphics.Insets b=insets.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.displayCutout());v.setPadding(b.left,b.top,b.right,b.bottom);return insets;});ViewCompat.requestApplyInsets(root);
        ScrollView scroll=new ScrollView(this);body=column();body.setPadding(dp(22),dp(12),dp(22),dp(28));scroll.addView(body);root.addView(scroll,new LinearLayout.LayoutParams(-1,-1));
        body.addView(button("‹  Public samples",false,v->finish()));label("Open Academy",30,true);status=label(busy?"Working…":"",13,false);
        if(pickerActive){label("Choose your file to continue.",16,false);return;}
        if(account==null){signIn();return;}
        label(account.optString("name")+" · "+account.optString("role"),15,false);
        if(account.optBoolean("must_change_password")){passwordForm(true);return;}
        LinearLayout menu=row();menu.addView(button("My subjects",false,v->{selected="";screen="subjects";load();}));menu.addView(button("News",false,v->{selected="";screen="news";render();}));if(admin())menu.addView(button("Accounts",false,v->{selected="";screen="accounts";load();}));body.addView(menu);
        if(screen.equals("accounts")&&admin())accountsScreen();else if(screen.equals("news"))newsScreen();else if(course!=null&&!selected.isEmpty())courseScreen();else subjectList();
        gap();body.addView(button("Refresh",false,v->load()));body.addView(button("Change password",false,v->passwordForm(false)));
        body.addView(button("Sign out",false,v->perform(()->{try{return api.request("POST","/v1/auth/logout",new JSONObject());}finally{api.vault.clear();api.clearProtectedCache();}},r->{account=null;selected="";course=null;render();})));
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
        if(subjects.length()==0)label("No subjects yet. Your administrator can enroll you, or an instructor can create a subject.",16,false);
        for(int n=0;n<subjects.length();n++){
            JSONObject s=subjects.optJSONObject(n);LinearLayout card=card();card.addView(txt(s.optString("title"),22,true));card.addView(txt(s.optString("description"),15,false));
            card.addView(button("Open subject",true,v->{selected=s.optString("id");screen="subjects";load();}));body.addView(card);gap();
        }
        if(announcements.length()>0){label("Latest announcement",18,true);JSONObject a=announcements.optJSONObject(0);label(a.optString("title"),17,true);label(a.optString("body"),15,false);}
    }
    private void subjectForm(){
        LinearLayout form=column();EditText title=field(form,"Subject title","",false),description=field(form,"Description","",false);description.setSingleLine(false);
        new AlertDialog.Builder(this).setTitle("Create subject").setView(form).setNegativeButton("Cancel",null).setPositiveButton("Create",(d,w)->{
            try{JSONObject data=new JSONObject().put("title",title.getText().toString()).put("description",description.getText().toString());perform(()->api.request("POST","/v1/subjects",data),r->{selected=r.getString("id");load();});}catch(Exception e){error(e);}
        }).show();
    }
    private void courseScreen(){
        JSONObject subject=course.optJSONObject("subject");label(subject.optString("title"),26,true);label(subject.optString("description"),15,false);
        label("Subject QR: aoa://subject/"+subject.optString("id"),12,false);
        body.addView(button("Show subject QR",false,v->{try{
            android.graphics.Bitmap bitmap=new com.journeyapps.barcodescanner.BarcodeEncoder().encodeBitmap("aoa://subject/"+subject.optString("id"),com.google.zxing.BarcodeFormat.QR_CODE,720,720);
            ImageView qr=new ImageView(this);qr.setImageBitmap(bitmap);qr.setAdjustViewBounds(true);qr.setContentDescription("Subject QR code for "+subject.optString("title"));qr.setPadding(dp(24),dp(24),dp(24),dp(24));
            new AlertDialog.Builder(this).setTitle(subject.optString("title")).setMessage("Scanning identifies this subject. Enrollment and sign-in are still required.").setView(qr).setPositiveButton("Close",null).show();
        }catch(Exception e){error(e);}}));
        if(creator()){
            body.addView(button("Add material / activity / quiz",true,v->new AlertDialog.Builder(this).setTitle("Add to subject").setItems(new String[]{"PDF material","Activity","Quiz"},(d,w)->itemForm(new String[]{"material","activity","quiz"}[w])).show()));
            if(admin())body.addView(button("Enroll or remove student",false,v->enrollmentForm()));
        }
        JSONArray items=course.optJSONArray("items");int done=0;for(int n=0;n<items.length();n++)if(items.optJSONObject(n).optBoolean("completed"))done++;
        if(!creator())label(done+" of "+items.length()+" items completed · quiz scores are recorded separately",14,false);
        if(items.length()==0)label("No published learning items yet.",16,false);
        for(int n=0;n<items.length();n++){
            JSONObject item=items.optJSONObject(n);LinearLayout card=card();String kind=item.optString("kind"),id=item.optString("id");final boolean manage=admin()||account.optString("id").equals(item.optString("owner_id"));
            card.addView(txt(kind.toUpperCase(java.util.Locale.ROOT)+(item.optBoolean("published")?"":" · Draft"),12,false));card.addView(txt(item.optString("title"),21,true));card.addView(txt(item.optString("body"),16,false));
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
            }else if(!creator())card.addView(button(item.optBoolean("completed")?"Completed · undo":"Mark activity complete",false,v->{try{JSONObject data=new JSONObject().put("completed",!item.optBoolean("completed"));perform(()->api.request("POST","/v1/items/"+id+"/complete",data),r->load());}catch(Exception e){error(e);}}));
            if(manage)card.addView(button("Edit / publish / archive",false,v->editItem(item)));
            body.addView(card);gap();
        }
    }
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
