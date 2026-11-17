package org.aeronautical.openacademy;

import org.aeronautical.openacademy.testing.TestWorkspace;
import org.json.*;
import org.junit.*;
import org.junit.rules.TemporaryFolder;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.UUID;
import static org.junit.Assert.*;

public class ChoiceFormsTest {
    @Rule public TemporaryFolder folder=new TemporaryFolder();
    private TestWorkspace app;private File root;private String teacher,student,subject;
    private static JSONObject data(Object... values)throws Exception{JSONObject result=new JSONObject();for(int n=0;n<values.length;n+=2)result.put((String)values[n],values[n+1]);return result;}
    private JSONObject call(String who,String method,String path,JSONObject body)throws Exception{return app.request(method,path,body,who,null);}
    private interface Work{void run()throws Exception;}
    private void denied(int status,Work work)throws Exception{try{work.run();fail("Expected "+status);}catch(TestWorkspace.Failure e){assertEquals(e.getMessage(),status,e.status);}}
    @Before public void setup()throws Exception{
        root=folder.newFolder();app=new TestWorkspace(root);teacher=call("","POST","/v1/auth/login",data("email","instructor","password","instructor")).getString("token");student=call("","POST","/v1/auth/login",data("email","student","password","student")).getString("token");subject=call(student,"GET","/v1/subjects",null).getJSONArray("subjects").getJSONObject(0).getString("id");
    }
    private JSONObject course(String token)throws Exception{return call(token,"GET","/v1/subjects/"+subject,null);}
    @Test public void everyTemplateAssessmentIsInteractiveAndAutomaticallyScored()throws Exception{
        JSONArray items=course(teacher).getJSONArray("items");int forms=0,questions=0,exams=0;
        for(int n=0;n<items.length();n++){
            JSONObject item=items.getJSONObject(n);if(item.getString("kind").equals("material")){call(student,"POST","/v1/items/"+item.getString("id")+"/complete",data("completed",true));continue;}
            JSONArray answers=new JSONArray();for(int j=0;j<item.getJSONArray("questions").length();j++)answers.put(item.getJSONArray("questions").getJSONObject(j).getInt("correct_index"));
            String path="/v1/items/"+item.getString("id")+"/answers",key=UUID.randomUUID().toString();JSONObject request=data("answers",answers,"expected_revision",item.getInt("revision"),"score",0);
            assertEquals(100,app.request("POST",path,request,student,key).getJSONObject("result").getInt("score"));assertEquals(100,app.request("POST",path,request,student,key).getJSONObject("result").getInt("score"));
            denied(409,()->app.request("POST",path,request,student,UUID.randomUUID().toString()));forms++;questions+=answers.length();if(item.optString("assessment_type").equals("examination"))exams++;
        }
        assertEquals(16,forms);assertEquals(40,questions);assertEquals(4,exams);JSONObject result=course(student);assertFalse(result.toString().contains("correct_index"));JSONObject summary=result.getJSONObject("summary");assertEquals(100,summary.getInt("completion_percent"));assertEquals(16,summary.getInt("graded"));assertEquals(0,summary.getInt("awaiting_assessment"));
        app=new TestWorkspace(root);assertEquals(16,course(student).getJSONObject("summary").getInt("graded"));
    }
    @Test public void partialInvalidStaleAndCrossRoleSubmissionsDoNotRecordWork()throws Exception{
        JSONObject item=course(teacher).getJSONArray("items").getJSONObject(5);String path="/v1/items/"+item.getString("id")+"/answers";String key=UUID.randomUUID().toString();
        denied(400,()->app.request("POST",path,data("answers",new JSONArray().put(0),"expected_revision",1),student,key));
        denied(400,()->app.request("POST",path,data("answers",new JSONArray().put(0).put(0).put(0).put(9),"expected_revision",1),student,key));
        denied(400,()->app.request("POST",path,data("answers",new JSONArray().put(0.5).put(0).put(0).put(0),"expected_revision",1),student,key));
        denied(409,()->app.request("POST",path,data("answers",new JSONArray().put(0).put(0).put(0).put(0),"expected_revision",2),student,key));
        denied(403,()->app.request("POST",path,data("answers",new JSONArray().put(0).put(0).put(0).put(0),"expected_revision",1),teacher,key));
        assertEquals(0,course(student).getJSONObject("summary").getInt("submitted"));
        JSONArray answers=new JSONArray();for(int n=0;n<item.getJSONArray("questions").length();n++)answers.put(item.getJSONArray("questions").getJSONObject(n).getInt("correct_index"));answers.put(0,(answers.getInt(0)+1)%4);
        JSONObject result=app.request("POST",path,data("answers",answers,"expected_revision",1),student,key).getJSONObject("result");assertEquals(3,result.getInt("correct"));assertEquals(75,result.getInt("score"));
        JSONObject saved=call(student,"GET","/v1/items/"+item.getString("id"),null).getJSONObject("item");assertFalse(saved.toString().contains("correct_index"));String record=saved.getJSONObject("form_result").getString("id");
        denied(409,()->call(teacher,"POST","/v1/submissions/"+record+"/grade",data("score",99,"expected_graded_at",JSONObject.NULL)));
    }
    @Test public void validationRejectsAmbiguousChoicesAndMissingKeys()throws Exception{
        JSONArray questions=new JSONArray().put(data("prompt","Question","options",new JSONArray().put("A").put("a"),"correct_index",0));assertThrows(IllegalArgumentException.class,()->ChoiceAssessment.validate(questions));
        questions.getJSONObject(0).put("options",new JSONArray().put("A").put("B")).put("correct_index",-1);assertThrows(IllegalArgumentException.class,()->ChoiceAssessment.validate(questions));
    }
    @Test public void v3TemplateMigrationKeepsIdsHistoryAndEditedWork()throws Exception{
        File stateFile=new File(root,"workspace.json");JSONObject state=new JSONObject(new String(Files.readAllBytes(stateFile.toPath()),StandardCharsets.UTF_8));JSONObject template;
        try(InputStream in=getClass().getResourceAsStream("/subject-template.json")){template=new JSONObject(new String(in.readAllBytes(),StandardCharsets.UTF_8));}
        JSONArray source=new JSONArray().put(template.getJSONObject("overview"));for(int n=0;n<4;n++){JSONArray entries=template.getJSONArray("periods").getJSONObject(n).getJSONArray("entries");for(int j=0;j<entries.length();j++)source.put(entries.getJSONObject(j));}
        String retained="";for(int n=0;n<state.getJSONArray("items").length();n++){JSONObject item=state.getJSONArray("items").getJSONObject(n),original=source.getJSONObject(n);if(original.has("legacy_body"))item.put("body",original.getString("legacy_body"));item.remove("questions");if(original.has("legacy_options"))item.put("options",original.getJSONArray("legacy_options")).put("correct_index",original.getInt("legacy_correct_index"));if(n==5){item.put("body","My edited classroom instructions").put("edit_version",2);retained=item.getString("id");}}
        state.put("version",3).put("template_version",1);Files.write(stateFile.toPath(),state.toString().getBytes(StandardCharsets.UTF_8));app=new TestWorkspace(root);JSONObject updated=course(teacher);assertEquals(subject,updated.getJSONObject("subject").getString("id"));assertEquals(26,updated.getJSONArray("items").length());assertEquals("My edited classroom instructions",call(teacher,"GET","/v1/items/"+retained,null).getJSONObject("item").getString("body"));assertTrue(new File(root,"workspace-before-forms.json").isFile());
        app=new TestWorkspace(root);assertEquals(26,course(teacher).getJSONArray("items").length());
    }
}
