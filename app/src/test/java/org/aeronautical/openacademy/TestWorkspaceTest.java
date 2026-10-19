package org.aeronautical.openacademy;

import org.aeronautical.openacademy.testing.TestWorkspace;
import org.json.*;
import org.junit.*;
import org.junit.rules.TemporaryFolder;
import java.io.*;
import java.nio.file.Files;
import java.util.UUID;
import java.util.zip.ZipInputStream;
import static org.junit.Assert.*;

public class TestWorkspaceTest {
    @Rule public TemporaryFolder folder=new TemporaryFolder();
    private File root;private TestWorkspace app;private String admin,teacher,student,subject,studentId;
    private static JSONObject data(Object... pairs)throws Exception{JSONObject o=new JSONObject();for(int i=0;i<pairs.length;i+=2)o.put((String)pairs[i],pairs[i+1]);return o;}
    private JSONObject call(String who,String method,String path,JSONObject body)throws Exception{return app.request(method,path,body,who,null);}
    private String login(int role)throws Exception{return login(TestWorkspace.USERS[role],TestWorkspace.USERS[role]);}
    private String login(String email,String password)throws Exception{return call("","POST","/v1/auth/login",data("email",email,"password",password)).getString("token");}
    private interface Work{void run()throws Exception;}
    private void denied(int status,Work work)throws Exception{try{work.run();fail("Expected status "+status);}catch(TestWorkspace.Failure e){assertEquals(e.getMessage(),status,e.status);}}
    private JSONObject course(String token)throws Exception{return call(token,"GET","/v1/subjects/"+subject,null);}
    private JSONObject item(String kind)throws Exception{JSONArray all=course(teacher).getJSONArray("items");for(int i=0;i<all.length();i++)if(all.getJSONObject(i).getString("kind").equals(kind))return all.getJSONObject(i);throw new AssertionError(kind);}
    private JSONObject submit(String item,JSONObject body,String key)throws Exception{return app.request("POST","/v1/items/"+item+"/submission",body,student,key);}
    @Before public void setup()throws Exception{
        root=folder.newFolder();app=new TestWorkspace(root);admin=login(0);teacher=login(1);student=login(2);subject=call(student,"GET","/v1/subjects",null).getJSONArray("subjects").getJSONObject(0).getString("id");studentId=call(student,"GET","/v1/me",null).getJSONObject("account").getString("id");
    }
    @Test public void defaultsAndHashesAndPersistence()throws Exception{
        assertEquals(3,call(admin,"GET","/v1/admin/accounts",null).getJSONArray("accounts").length());
        assertEquals("TEST-001",call(student,"GET","/v1/me",null).getJSONObject("account").getString("student_number"));
        assertFalse(call(admin,"GET","/v1/admin/accounts",null).toString().contains("password_hash"));
        assertFalse(new String(Files.readAllBytes(new File(root,"workspace.json").toPath()),java.nio.charset.StandardCharsets.UTF_8).contains("password_hash\":\"admin"));
        denied(401,()->login(TestWorkspace.EMAILS[0],"bad password"));app=new TestWorkspace(root);assertEquals(subject,call(student,"GET","/v1/subjects",null).getJSONArray("subjects").getJSONObject(0).getString("id"));
    }
    @Test public void roleBoundariesAndDraftVisibility()throws Exception{
        denied(403,()->call(student,"GET","/v1/admin/accounts",null));denied(403,()->call(teacher,"POST","/v1/admin/accounts",data()));denied(403,()->call(student,"POST","/v1/subjects",data()));
        String id=call(teacher,"POST","/v1/subjects/"+subject+"/items",data("kind","material","material_mode","text","title","Draft","body","Private draft","published",false)).getString("id");
        denied(404,()->call(student,"GET","/v1/items/"+id,null));denied(403,()->call(student,"POST","/v1/items/"+item("material").getString("id"),data("expected_edit_version",1,"title","Tampered")));
        assertFalse(course(student).toString().contains("correct_index"));
    }
    @Test public void createAccountsTemporaryPasswordAndDuplicateIdentity()throws Exception{
        JSONObject d=data("name","New Student","role","student","student_number","TEST-002","email","new@academy.test","password",TestWorkspace.PASSWORD);
        String uid=call(admin,"POST","/v1/admin/accounts",d).getJSONObject("account").getString("id");denied(409,()->call(admin,"POST","/v1/admin/accounts",d));
        String token=login("new@academy.test",TestWorkspace.PASSWORD);assertTrue(call(token,"GET","/v1/me",null).getJSONObject("account").getBoolean("must_change_password"));denied(403,()->call(token,"GET","/v1/subjects",null));
        call(token,"POST","/v1/auth/password",data("current_password",TestWorkspace.PASSWORD,"new_password","My new test passphrase!"));denied(401,()->call(token,"GET","/v1/me",null));String fresh=login("new@academy.test","My new test passphrase!");assertEquals(uid,call(fresh,"GET","/v1/me",null).getJSONObject("account").getString("id"));
        call(admin,"POST","/v1/admin/accounts",data("name","New Instructor","role","instructor","email","newteacher@academy.test","password",TestWorkspace.PASSWORD));
    }
    @Test public void materialReadSurvivesRoleSwitchAndUndo()throws Exception{
        String material=item("material").getString("id");call(student,"POST","/v1/items/"+material+"/complete",data("completed",true));call(student,"POST","/v1/auth/logout",data());student=login(2);assertEquals(1,course(student).getJSONObject("summary").getInt("read"));assertEquals(1,call(teacher,"GET","/v1/subjects/"+subject+"/learners/"+studentId,null).getJSONObject("summary").getInt("read"));call(student,"POST","/v1/items/"+material+"/complete",data("completed",false));assertEquals(0,course(student).getJSONObject("summary").getInt("read"));
    }
    @Test public void quizIsScoredOnceAndCannotBeMarkedRead()throws Exception{
        String quiz=item("quiz").getString("id"),key=UUID.randomUUID().toString();denied(403,()->call(student,"POST","/v1/items/"+quiz+"/complete",data("completed",true)));
        JSONObject answer=data("choice",0);app.request("POST","/v1/items/"+quiz+"/quiz",answer,student,key);app.request("POST","/v1/items/"+quiz+"/quiz",answer,student,key);denied(409,()->app.request("POST","/v1/items/"+quiz+"/quiz",data("choice",1),student,key));
        JSONArray list=course(student).getJSONArray("items");for(int i=0;i<list.length();i++)if(list.getJSONObject(i).getString("id").equals(quiz))assertEquals(1,list.getJSONObject(i).getJSONObject("attempt").getInt("score"));
    }
    @Test public void writtenSubmissionGradingAndRevisionRecovery()throws Exception{
        JSONObject activity=item("activity");String id=activity.getString("id"),key=UUID.randomUUID().toString();submit(id,data("output","Check the current approved revision."),key);submit(id,data("output","Check the current approved revision."),key);denied(409,()->submit(id,data("output","Different output"),key));
        JSONObject detail=call(teacher,"GET","/v1/subjects/"+subject+"/learners/"+studentId,null).getJSONArray("items").getJSONObject(1);String grade="/v1/submissions/"+detail.getString("submission_id")+"/grade";
        denied(404,()->call(student,"POST",grade,data("score",99)));call(teacher,"POST",grade,data("score",92,"feedback","Good revision check.","expected_graded_at",JSONObject.NULL));denied(409,()->call(teacher,"POST",grade,data("score",90,"expected_graded_at",JSONObject.NULL)));
        JSONObject view=call(student,"GET","/v1/items/"+id,null).getJSONObject("item").getJSONObject("submission");assertEquals(92,view.getInt("score"));assertEquals("Good revision check.",view.getString("feedback"));
        call(teacher,"POST","/v1/items/"+id,data("expected_edit_version",1,"title","Revised activity","body","New prompt"));assertFalse(call(student,"GET","/v1/items/"+id,null).getJSONObject("item").has("submission"));submit(id,data("output","New revision answer"),UUID.randomUUID().toString());
    }
    @Test public void enrollmentEligibilityQrAndAdministrativeBlock()throws Exception{
        String second=call(teacher,"POST","/v1/subjects",data("title","Second subject","description","")).getString("id"),base="/v1/subjects/"+second;
        denied(404,()->call(student,"POST",base+"/enrol",data("source","qr")));call(teacher,"POST",base+"/eligibility",data("all_students",false,"student_numbers",new JSONArray().put("TEST-001"),"expected_revision",1));call(student,"POST",base+"/enrol",data("source","qr"));call(student,"GET",base,null);
        call(teacher,"POST",base+"/eligibility",data("all_students",false,"student_numbers",new JSONArray(),"expected_revision",2));denied(404,()->call(student,"GET",base,null));
        call(teacher,"POST",base+"/eligibility",data("all_students",true,"student_numbers",new JSONArray(),"expected_revision",3));assertEquals(1,call(student,"GET","/v1/subjects/discover?offset=0",null).getJSONArray("subjects").length());call(student,"POST",base+"/enrol",data());
        call(admin,"POST","/v1/admin/enrolments",data("student_id",studentId,"subject_id",second,"enrolled",false));denied(404,()->call(student,"POST",base+"/enrol",data()));call(admin,"POST","/v1/admin/enrolments",data("student_id",studentId,"subject_id",second,"enrolled",true));call(student,"GET",base,null);
    }
    @Test public void accountSuspensionResetRoleAndLastAdmin()throws Exception{
        String account="/v1/admin/accounts/"+studentId;call(admin,"POST",account,data("status","suspended"));denied(401,()->call(student,"GET","/v1/me",null));denied(401,()->login(2));call(admin,"POST",account,data("status","active"));student=login(2);call(admin,"POST",account+"/password",data("password","Reset test passphrase!"));denied(401,()->call(student,"GET","/v1/me",null));assertTrue(call(login(TestWorkspace.EMAILS[2],"Reset test passphrase!"),"GET","/v1/me",null).getJSONObject("account").getBoolean("must_change_password"));
        String aid=call(admin,"GET","/v1/me",null).getJSONObject("account").getString("id");denied(409,()->call(admin,"POST","/v1/admin/accounts/"+aid,data("status","suspended")));
    }
    @Test public void pdfUploadReadExportAndOwnership()throws Exception{
        String id=call(teacher,"POST","/v1/subjects/"+subject+"/items",data("kind","material","title","PDF exercise","body","Read PDF","published",true)).getString("id");File pdf=new File(root,"stage");Files.write(pdf.toPath(),"%PDF-1.4\nsynthetic pdf test\n%%EOF".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        denied(403,()->app.upload(student,id,1,pdf));app.upload(teacher,id,1,pdf);denied(409,()->app.upload(teacher,id,1,pdf));File dest=new File(root,"view");app.material(student,id,false,dest);assertArrayEquals(Files.readAllBytes(pdf.toPath()),Files.readAllBytes(dest.toPath()));denied(403,()->app.material(student,id,true,dest));app.material(teacher,id,true,dest);
        app=new TestWorkspace(root);app.material(student,id,false,dest);assertTrue(call(student,"GET","/v1/items/"+id,null).getJSONObject("item").getBoolean("has_file"));
    }
    @Test public void invalidUploadDoesNotPublishAndTextLinksNeedAuthorization()throws Exception{
        String id=item("material").getString("id");File bad=new File(root,"bad");Files.write(bad.toPath(),"not a pdf".getBytes());try{app.upload(teacher,id,1,bad);fail();}catch(IOException expected){}assertFalse(call(teacher,"GET","/v1/items/"+id,null).getJSONObject("item").getBoolean("has_file"));
        call(teacher,"POST","/v1/items/"+id,data("expected_edit_version",1,"body","Reference https://example.com/guide"));assertEquals("https://example.com/guide",call(student,"POST","/v1/items/"+id+"/open-link",data("url","https://example.com/guide","expected_revision",2)).getString("url"));denied(404,()->call(student,"POST","/v1/items/"+id+"/open-link",data("url","https://example.com/other","expected_revision",2)));denied(409,()->call(student,"POST","/v1/items/"+id+"/open-link",data("url","https://example.com/guide","expected_revision",1)));
    }
    @Test public void reportIsWorkbookAndStudentsCannotExport()throws Exception{
        denied(404,()->app.exportReport(student,subject,0));byte[] bytes=app.exportReport(teacher,subject,0);assertEquals('P',bytes[0]);int entries=0;try(ZipInputStream zip=new ZipInputStream(new ByteArrayInputStream(bytes))){while(zip.getNextEntry()!=null){entries++;}}assertEquals(5,entries);
    }
    @Test public void resetRestoresDefaultsAndRevokesAllOldSessions()throws Exception{
        app.reset();denied(401,()->call(admin,"GET","/v1/me",null));admin=login(0);teacher=login(1);student=login(2);assertEquals(3,call(admin,"GET","/v1/admin/accounts",null).getJSONArray("accounts").length());assertEquals(0,call(student,"GET","/v1/subjects",null).getJSONArray("subjects").getJSONObject(0).getJSONObject("summary").getInt("completed"));
    }
    @Test public void staleWritesDoNotMutateAndArchiveHidesItem()throws Exception{
        JSONObject material=item("material");String id=material.getString("id");denied(409,()->call(teacher,"POST","/v1/items/"+id,data("expected_edit_version",8,"title","Stale edit")));assertEquals(material.getString("title"),call(teacher,"GET","/v1/items/"+id,null).getJSONObject("item").getString("title"));call(teacher,"POST","/v1/items/"+id,data("expected_edit_version",1,"archived",true));denied(404,()->call(student,"GET","/v1/items/"+id,null));assertEquals(2,course(student).getJSONObject("summary").getInt("total"));
    }
    @Test public void corruptStateFailsWithoutSilentlyDeletingWork()throws Exception{
        File state=new File(root,"workspace.json");Files.write(state.toPath(),"corrupt".getBytes());try{call(admin,"GET","/v1/me",null);fail();}catch(IOException expected){assertTrue(expected.getMessage().contains("Reset"));}assertEquals("corrupt",new String(Files.readAllBytes(state.toPath())));app.reset();login(0);
    }
    @Test public void deletionRequiresEmailAndRemovesLearnerRecords()throws Exception{
        String activity=item("activity").getString("id");submit(activity,data("output","Synthetic work"),UUID.randomUUID().toString());String path="/v1/admin/accounts/"+studentId;denied(400,()->call(admin,"POST",path,data("status","deleted","confirm_email","wrong")));call(student,"GET","/v1/me",null);call(admin,"POST",path,data("status","deleted","confirm_email",TestWorkspace.EMAILS[2]));denied(401,()->call(student,"GET","/v1/me",null));assertEquals(0,call(teacher,"GET","/v1/subjects/"+subject+"/learners?offset=0",null).getInt("total"));assertFalse(new String(Files.readAllBytes(new File(root,"workspace.json").toPath())).contains("Synthetic work"));
    }

    @Test public void orderPersistsWithoutChangingWorkAndNewEntriesAppend()throws Exception{
        JSONObject material=item("material");call(student,"POST","/v1/items/"+material.getString("id")+"/complete",data("completed",true));JSONObject before=course(teacher);JSONArray items=before.getJSONArray("items"),ids=new JSONArray();for(int i=items.length()-1;i>=0;i--)ids.put(items.getJSONObject(i).getString("id"));String path="/v1/subjects/"+subject+"/order";JSONObject order=data("item_ids",ids,"expected_revision",before.getJSONObject("subject").getInt("order_revision"));denied(403,()->call(student,"POST",path,order));call(teacher,"POST",path,order);denied(409,()->call(teacher,"POST",path,order));app=new TestWorkspace(root);assertEquals(ids.getString(0),course(student).getJSONArray("items").getJSONObject(0).getString("id"));assertEquals(1,course(student).getJSONObject("summary").getInt("read"));
        String added=call(teacher,"POST","/v1/subjects/"+subject+"/items",data("kind","material","material_mode","text","title","Last entry","body","Added after reorder","published",true)).getString("id");assertEquals(added,course(student).getJSONArray("items").getJSONObject(3).getString("id"));
        int revision=course(teacher).getJSONObject("subject").getInt("order_revision");denied(400,()->call(teacher,"POST",path,data("item_ids",new JSONArray().put(added).put(added).put(added).put(added),"expected_revision",revision)));assertEquals(added,course(student).getJSONArray("items").getJSONObject(3).getString("id"));
    }
    @Test public void legacyLocalMigrationPreservesEntriesAndCustomPasswords()throws Exception{
        call(student,"POST","/v1/auth/password",data("current_password","student","new_password",TestWorkspace.PASSWORD));call(teacher,"POST","/v1/auth/password",data("current_password","instructor","new_password","My custom teacher password!"));
        File file=new File(root,"workspace.json");JSONObject state=new JSONObject(new String(Files.readAllBytes(file.toPath()),java.nio.charset.StandardCharsets.UTF_8));state.put("version",1);JSONArray items=state.getJSONArray("items");for(int n=0;n<items.length();n++)items.getJSONObject(n).remove("sort_order");state.getJSONArray("subjects").getJSONObject(0).remove("order_revision");Files.write(file.toPath(),state.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        app=new TestWorkspace(root);student=login(2);teacher=login(TestWorkspace.EMAILS[1],"My custom teacher password!");assertEquals(subject,course(student).getJSONObject("subject").getString("id"));assertEquals(3,course(student).getJSONArray("items").length());denied(401,()->login(1));
    }
}
