package org.aeronautical.openacademy.testing;

import org.json.JSONArray;
import org.json.JSONObject;
import org.aeronautical.openacademy.core.KnowledgeLinks;
import org.aeronautical.openacademy.core.TransferPolicy;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/** Device-local sandbox for synthetic data. Never authenticates to an organization server. */
public final class TestWorkspace {
    public static final String BASE="local-test";
    public static final String PASSWORD="AcademyTest2026!";
    public static final String[] EMAILS={"admin@academy.test","instructor@academy.test","student@academy.test"};
    private static final Object LOCK=new Object();
    private final File directory,stateFile;
    private JSONObject state;
    public static final class Failure extends IOException {
        public final int status;
        Failure(int status,String message){super(message);this.status=status;}
    }
    public TestWorkspace(File directory){this.directory=directory;stateFile=new File(directory,"workspace.json");}
    private static JSONObject obj(Object... pairs)throws Exception{JSONObject o=new JSONObject();for(int i=0;i<pairs.length;i+=2)o.put((String)pairs[i],pairs[i+1]);return o;}
    private static String id(){return UUID.randomUUID().toString();}
    private static void require(boolean test,int code,String message)throws Failure{if(!test)throw new Failure(code,message);}
    private static String text(JSONObject d,String key,int max,boolean empty)throws Exception{String s=d.optString(key,"").trim();require((empty||!s.isEmpty())&&s.length()<=max,400,"Check "+key+" (maximum "+max+" characters).");return s;}
    private static String number(String s)throws Exception{s=s.trim().toUpperCase(Locale.ROOT);require(s.matches("[A-Z0-9][A-Z0-9-]{2,31}"),400,"Student ID needs 3–32 letters, digits or hyphens.");return s;}
    private static String hash(String value,String salt)throws Exception{
        PBEKeySpec spec=new PBEKeySpec(value.toCharArray(),salt.getBytes(StandardCharsets.UTF_8),60000,256);
        try{return Base64.getEncoder().encodeToString(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded());}finally{spec.clearPassword();}
    }
    private static boolean passwordMatches(JSONObject a,String password)throws Exception{return MessageDigest.isEqual(hash(password,a.getString("salt")).getBytes(StandardCharsets.UTF_8),a.getString("password_hash").getBytes(StandardCharsets.UTF_8));}
    private void setPassword(JSONObject a,String password)throws Exception{
        require(password.length()>=15&&password.length()<=256,400,"Use a passphrase of 15–256 characters.");byte[] salt=new byte[16];new SecureRandom().nextBytes(salt);a.put("salt",Base64.getEncoder().encodeToString(salt));a.put("password_hash",hash(password,a.getString("salt")));
    }
    private JSONArray rows(String key)throws Exception{return state.getJSONArray(key);}
    private JSONObject find(String table,String key,String value)throws Exception{JSONArray a=rows(table);for(int i=0;i<a.length();i++){JSONObject r=a.getJSONObject(i);if(value.equals(r.optString(key)))return r;}return null;}
    private JSONObject byId(String table,String value)throws Exception{JSONObject r=find(table,"id",value);require(r!=null,404,"Entry unavailable. Refresh and try again.");return r;}
    private interface Match{boolean test(JSONObject r)throws Exception;}
    private void remove(String table,Match test)throws Exception{JSONArray a=rows(table);for(int i=a.length()-1;i>=0;i--)if(test.test(a.getJSONObject(i)))a.remove(i);}
    private static JSONObject copy(JSONObject value)throws Exception{return new JSONObject(value.toString());}
    private static JSONObject publicAccount(JSONObject a)throws Exception{JSONObject r=copy(a);r.remove("salt");r.remove("password_hash");return r;}
    private void load()throws Exception{
        if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Cannot create test workspace. Check storage.");
        if(!stateFile.exists()){seed();save();return;}
        try{require(stateFile.length()<=16*1024*1024,500,"Test data is too large. Reset test data to start again.");state=new JSONObject(new String(Files.readAllBytes(stateFile.toPath()),StandardCharsets.UTF_8));require(state.optInt("version")==1,500,"Unsupported test data version.");}
        catch(Exception e){throw new IOException("Cannot read test data. Use Reset local test data to restore the default accounts.",e);}
    }
    private void save()throws Exception{
        byte[] bytes=state.toString().getBytes(StandardCharsets.UTF_8);require(bytes.length<=16*1024*1024,413,"Test workspace is full. Reset test data or remove unused items.");
        File temp=new File(directory,"workspace.tmp");try(FileOutputStream out=new FileOutputStream(temp)){out.write(bytes);out.getFD().sync();}
        Files.move(temp.toPath(),stateFile.toPath(),StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);
    }
    private JSONObject createAccount(JSONObject d,boolean temporary)throws Exception{
        String role=d.optString("role"),email=text(d,"email",254,false).toLowerCase(Locale.ROOT),name=text(d,"name",100,false);
        require(Arrays.asList("admin","instructor","student").contains(role),400,"Choose admin, instructor or student.");require(email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"),400,"Enter an email address.");
        require(find("accounts","email",email)==null,409,"This email already has a test account.");String num=role.equals("student")?number(d.optString("student_number")):null;
        require(num==null||find("accounts","student_number",num)==null,409,"Student ID is already assigned.");
        JSONObject a=obj("id",id(),"email",email,"name",name,"role",role,"status","active","must_change_password",temporary,"student_number",num==null?JSONObject.NULL:num);setPassword(a,d.optString("password"));rows("accounts").put(a);return a;
    }
    private void seed()throws Exception{
        state=obj("version",1);for(String name:new String[]{"accounts","sessions","subjects","items","enrolments","blocks","records","announcements"})state.put(name,new JSONArray());
        JSONObject teacher=null,student=null;
        for(int i=0;i<3;i++){JSONObject a=createAccount(obj("name",new String[]{"Test Administrator","Test Instructor","Test Student"}[i],"email",EMAILS[i],"password",PASSWORD,"role",new String[]{"admin","instructor","student"}[i],"student_number","TEST-001"),false);if(i==1)teacher=a;if(i==2)student=a;}
        JSONObject subject=newSubject(teacher,obj("title","Practice subject · Aircraft maintenance","description","Synthetic practice content. Create materials as the instructor, then sign in as the student to read and submit work."));subject.put("all_students",true);
        newItem(teacher,subject,obj("kind","material","material_mode","text","title","Welcome to your practice subject","body","Read this test material, then tap Mark as read.\nSign out and switch accounts to review the same work as instructor or administrator.","published",true));
        newItem(teacher,subject,obj("kind","activity","title","Practice written activity","body","Describe how you would check the current maintenance document revision before starting a task. Synthetic exercise only.","published",true));
        newItem(teacher,subject,obj("kind","quiz","title","Practice documentation quiz","body","Which document should you use before beginning a maintenance task?","options",new JSONArray().put("Current approved documentation").put("An obsolete personal copy"),"correct_index",0,"published",true));
        enroll(student,subject,"admin");rows("announcements").put(obj("id",id(),"title","Local test workspace","body","Default accounts share this device's test data. No organization server is required. Use synthetic content only.","archived",false));
    }
    public void reset()throws Exception{synchronized(LOCK){if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Cannot create test workspace.");seed();save();File[] files=directory.listFiles((d,n)->n.endsWith(".pdf"));if(files!=null)for(File f:files)Files.deleteIfExists(f.toPath());}}
    private JSONObject actor(String token)throws Exception{
        JSONObject s=find("sessions","token",token);require(s!=null&&s.optLong("expires")>System.currentTimeMillis(),401,"Your test session ended. Sign in again.");JSONObject a=byId("accounts",s.getString("account_id"));require(a.optString("status").equals("active"),401,"This test account is inactive.");return a;
    }
    private static boolean admin(JSONObject a){return a.optString("role").equals("admin");}
    private static boolean student(JSONObject a){return a.optString("role").equals("student");}
    private static boolean manages(JSONObject a,JSONObject row){return admin(a)||(!student(a)&&a.optString("id").equals(row.optString("owner_id")));}
    private static void needAdmin(JSONObject a)throws Exception{require(admin(a),403,"Administrator access required.");}
    private boolean enrolled(JSONObject a,JSONObject s)throws Exception{return enrollment(a.getString("id"),s.getString("id"))!=null;}
    private JSONObject enrollment(String account,String subject)throws Exception{JSONArray a=rows("enrolments");for(int i=0;i<a.length();i++){JSONObject r=a.getJSONObject(i);if(r.getString("student_id").equals(account)&&r.getString("subject_id").equals(subject))return r;}return null;}
    private boolean blocked(JSONObject a,JSONObject s)throws Exception{JSONArray b=rows("blocks");for(int i=0;i<b.length();i++){JSONObject r=b.getJSONObject(i);if(r.getString("student_id").equals(a.getString("id"))&&r.getString("subject_id").equals(s.getString("id")))return true;}return false;}
    private static boolean eligible(JSONObject a,JSONObject s)throws Exception{if(s.optBoolean("all_students"))return true;JSONArray ids=s.getJSONArray("student_numbers");for(int i=0;i<ids.length();i++)if(!a.isNull("student_number")&&ids.getString(i).equals(a.optString("student_number")))return true;return false;}
    private void enroll(JSONObject a,JSONObject s,String source)throws Exception{if(!enrolled(a,s))rows("enrolments").put(obj("student_id",a.getString("id"),"subject_id",s.getString("id"),"source",source));}
    private JSONObject subjectFor(JSONObject a,String id,boolean write)throws Exception{JSONObject s=byId("subjects",id);require(manages(a,s)||!write&&student(a)&&enrolled(a,s),404,"Subject unavailable for this account.");return s;}
    private JSONObject itemFor(JSONObject a,String id,boolean write)throws Exception{JSONObject i=byId("items",id);subjectFor(a,i.getString("subject_id"),false);require(!i.optBoolean("archived")&&(!student(a)||i.optBoolean("published")),404,"Item unavailable.");if(write)require(manages(a,i),403,"Only the creator or administrator can edit this material.");return i;}
    private JSONObject newSubject(JSONObject a,JSONObject d)throws Exception{
        require(!student(a),403,"Instructor access required.");String owner=d.optString("owner_id",a.getString("id"));if(!owner.equals(a.getString("id"))){needAdmin(a);JSONObject o=byId("accounts",owner);require(o.optString("role").equals("instructor")&&o.optString("status").equals("active"),400,"Choose an active instructor.");}
        JSONObject s=obj("id",id(),"title",text(d,"title",160,false),"description",text(d,"description",1000,true),"owner_id",owner,"all_students",false,"student_numbers",new JSONArray(),"eligibility_revision",1);rows("subjects").put(s);return s;
    }
    private JSONObject newItem(JSONObject a,JSONObject s,JSONObject d)throws Exception{
        require(manages(a,s),403,"Instructor access required.");String kind=d.optString("kind");boolean exam=kind.equals("examination");if(exam)kind="activity";require(Arrays.asList("material","activity","quiz").contains(kind),400,"Choose a learning item type.");
        JSONObject i=obj("id",id(),"subject_id",s.getString("id"),"owner_id",a.getString("id"),"kind",kind,"title",text(d,"title",160,false),"body",text(d,"body",12000,false),"published",d.optBoolean("published"),"archived",false,"material_mode",d.optString("material_mode","file"),"assessment_type",exam?"examination":"standard","revision",1,"edit_version",1,"has_file",false);
        if(kind.equals("quiz")){JSONArray options=d.optJSONArray("options");int answer=d.optInt("correct_index",-1);require(options!=null&&options.length()>=2&&options.length()<=8&&answer>=0&&answer<options.length(),400,"Provide quiz choices and a correct answer.");for(int n=0;n<options.length();n++)require(!options.getString(n).trim().isEmpty()&&options.getString(n).length()<=500,400,"Check quiz choices.");i.put("options",options).put("correct_index",answer);}rows("items").put(i);return i;
    }
    private JSONObject record(JSONObject a,JSONObject i)throws Exception{JSONArray r=rows("records");for(int n=0;n<r.length();n++){JSONObject x=r.getJSONObject(n);if(x.getString("student_id").equals(a.getString("id"))&&x.getString("item_id").equals(i.getString("id"))&&x.getInt("revision")==i.getInt("revision"))return x;}return null;}
    private JSONObject present(JSONObject a,JSONObject i)throws Exception{JSONObject r=copy(i);r.remove("file_name");if(!manages(a,i))r.remove("correct_index");JSONObject done=record(a,i);r.put("completed",done!=null&&done.optBoolean("completed"));if(done!=null){JSONObject safe=copy(done);safe.remove("choice");safe.remove("request_key");r.put(i.getString("kind").equals("quiz")?"attempt":"submission",safe);}return r;}
    private JSONObject learner(JSONObject a,JSONObject s)throws Exception{
        JSONArray details=new JSONArray();int read=0,materials=0,submitted=0,required=0,graded=0;
        JSONArray items=rows("items");for(int n=0;n<items.length();n++){JSONObject i=items.getJSONObject(n);if(!i.getString("subject_id").equals(s.getString("id"))||i.optBoolean("archived")||!i.optBoolean("published"))continue;
            JSONObject r=record(a,i);boolean material=i.getString("kind").equals("material"),quiz=i.getString("kind").equals("quiz"),done=r!=null&&r.optBoolean("completed"),scored=done&&!r.isNull("score");if(material){materials++;if(done)read++;}else{required++;if(done)submitted++;if(scored)graded++;}
            JSONObject detail=obj("id",i.getString("id"),"title",i.getString("title"),"kind",i.getString("kind"),"revision",i.getInt("revision"),"assessment_type",i.getString("assessment_type"),"completed",done,"status",material?(done?"Read (self-reported)":"Unread"):!done?"Not submitted":scored?"Graded":"Awaiting assessment","score",scored?r.get("score"):JSONObject.NULL,"max_score",quiz?1:100,"feedback",r==null?"":r.optString("feedback"),"output",r==null?"":r.optString("output"),"submission_id",r==null?JSONObject.NULL:r.getString("id"),"graded_at",r==null?JSONObject.NULL:r.opt("graded_at"));if(quiz&&done)detail.put("answer",i.getJSONArray("options").getString(r.getInt("choice")));details.put(detail);
        }
        return obj("student",publicAccount(a),"items",details,"summary",obj("read",read,"materials",materials,"read_percent",percent(read,materials),"submitted",submitted,"required",required,"compliance_percent",percent(submitted,required),"graded",graded,"awaiting_assessment",submitted-graded,"completed",read+submitted,"total",materials+required,"completion_percent",percent(read+submitted,materials+required)));
    }
    private static int percent(int n,int d){return d==0?0:(int)Math.round(n*100.0/d);}
    private JSONObject roster(JSONObject s,int offset)throws Exception{JSONArray all=new JSONArray(),a=rows("accounts");for(int i=0;i<a.length();i++){JSONObject x=a.getJSONObject(i);if(student(x)&&!x.getString("status").equals("deleted")&&enrolled(x,s))all.put(learner(x,s));}JSONArray page=new JSONArray();for(int i=offset;i<Math.min(all.length(),offset+100);i++)page.put(all.get(i));return obj("learners",page,"total",all.length(),"next_offset",offset+page.length()<all.length()?offset+page.length():JSONObject.NULL);}
    public JSONObject request(String method,String path,JSONObject body,String token,String key)throws Exception{
        synchronized(LOCK){load();JSONObject result=route(method,path,body==null?new JSONObject():body,token,key);if(!method.equals("GET"))save();return copy(result);}
    }
    private JSONObject route(String method,String raw,JSONObject d,String token,String key)throws Exception{
        String path=raw.split("\\?",2)[0];int offset=0;if(raw.contains("?offset="))try{offset=Math.max(0,Math.min(100000,Integer.parseInt(raw.split("\\?offset=",2)[1])));}catch(NumberFormatException e){throw new Failure(400,"Invalid page.");}
        if(path.equals("/v1/auth/login")&&method.equals("POST")){
            JSONObject a=find("accounts","email",d.optString("email").trim().toLowerCase(Locale.ROOT));require(a!=null&&a.optString("status").equals("active")&&passwordMatches(a,d.optString("password")),401,"Check your local test email and password.");String t="demo-"+id();remove("sessions",s->s.optLong("expires")<=System.currentTimeMillis());rows("sessions").put(obj("token",t,"account_id",a.getString("id"),"expires",System.currentTimeMillis()+8*60*60*1000));return obj("token",t,"account",publicAccount(a));
        }
        JSONObject a=actor(token);
        if(path.equals("/v1/auth/logout")&&method.equals("POST")){remove("sessions",s->s.getString("token").equals(token));return obj("signed_out",true);}
        if(path.equals("/v1/auth/password")&&method.equals("POST")){require(passwordMatches(a,d.optString("current_password")),400,"Check your current password.");setPassword(a,d.optString("new_password"));a.put("must_change_password",false);revoke(a);return obj("sign_in_again",true);}
        if(path.equals("/v1/me")&&method.equals("GET"))return obj("account",publicAccount(a),"capabilities",obj("material_upload",true));
        require(!a.optBoolean("must_change_password"),403,"Change the temporary password first.");
        String[] p=path.split("/");
        if(path.startsWith("/v1/admin/")){
            needAdmin(a);
            if(path.equals("/v1/admin/accounts")){
                if(method.equals("POST"))return obj("account",publicAccount(createAccount(d,true)));
                if(method.equals("GET")){JSONArray page=new JSONArray(),all=rows("accounts");int seen=0;for(int i=0;i<all.length();i++){JSONObject x=all.getJSONObject(i);if(x.getString("status").equals("deleted"))continue;if(seen++>=offset&&page.length()<100)page.put(publicAccount(x));}return obj("accounts",page);}
            }
            if(p.length>=5&&p[3].equals("accounts")&&method.equals("POST")){
                JSONObject target=byId("accounts",p[4]);
                if(p.length==6&&p[5].equals("password")){setPassword(target,d.optString("password"));target.put("must_change_password",true);revoke(target);return obj("reset",true);}
                if(p.length==5){String role=d.optString("role",target.getString("role")),status=d.optString("status",target.getString("status"));require(Arrays.asList("admin","instructor","student").contains(role)&&Arrays.asList("active","suspended","deleted").contains(status),400,"Check account role and status.");
                    int admins=0;for(int i=0;i<rows("accounts").length();i++){JSONObject x=rows("accounts").getJSONObject(i);if(admin(x)&&x.getString("status").equals("active"))admins++;}require(!(admin(target)&&target.getString("status").equals("active")&&(!role.equals("admin")||!status.equals("active"))&&admins<=1),409,"Keep at least one active administrator.");
                    String old=target.optString("student_number",""),num=role.equals("student")?(d.has("student_number")?number(d.optString("student_number")):old):"";JSONObject duplicate=num.isEmpty()?null:find("accounts","student_number",num);require(duplicate==null||duplicate==target,409,"Student ID is already assigned.");
                    if(!num.equals(old)){forgetNumber(old,target.getString("id"));}target.put("role",role).put("status",status).put("student_number",num.isEmpty()?JSONObject.NULL:num);revoke(target);
                    if(status.equals("deleted")){require(d.optString("confirm_email").equals(target.getString("email")),400,"Type the account email to confirm deletion.");String targetId=target.getString("id");target.put("email",targetId+"@deleted.invalid").put("name","Deleted account").put("student_number",JSONObject.NULL);target.remove("salt");target.remove("password_hash");forgetNumber(num,targetId);remove("enrolments",r->r.getString("student_id").equals(targetId));remove("blocks",r->r.getString("student_id").equals(targetId));remove("records",r->r.getString("student_id").equals(targetId));}return obj("saved",true);
                }
            }
            if(path.equals("/v1/admin/enrolments")&&method.equals("POST")){JSONObject s=subjectFor(a,d.optString("subject_id"),true),x=byId("accounts",d.optString("student_id"));require(student(x)&&x.optString("status").equals("active"),400,"Choose an active student.");String sid=s.getString("id"),uid=x.getString("id");remove("blocks",r->r.getString("subject_id").equals(sid)&&r.getString("student_id").equals(uid));remove("enrolments",r->r.getString("subject_id").equals(sid)&&r.getString("student_id").equals(uid));if(d.optBoolean("enrolled"))enroll(x,s,"admin");else rows("blocks").put(obj("subject_id",sid,"student_id",uid));return obj("saved",true);}
        }
        if(path.equals("/v1/announcements")){
            if(method.equals("GET")){JSONArray list=new JSONArray();for(int i=0;i<rows("announcements").length();i++){JSONObject r=rows("announcements").getJSONObject(i);if(!r.optBoolean("archived"))list.put(copy(r));}return obj("announcements",list);}
            if(method.equals("POST")){needAdmin(a);JSONObject r=obj("id",id(),"title",text(d,"title",160,false),"body",text(d,"body",12000,false),"archived",false);rows("announcements").put(r);return obj("id",r.getString("id"));}
        }
        if(p.length==4&&p[2].equals("announcements")&&method.equals("DELETE")){needAdmin(a);byId("announcements",p[3]).put("archived",true);return obj("archived",true);}
        if(path.equals("/v1/subjects/discover")&&method.equals("GET")){require(student(a),403,"Student access required.");JSONArray list=new JSONArray();int seen=0;for(int n=0;n<rows("subjects").length();n++){JSONObject s=rows("subjects").getJSONObject(n);if(!enrolled(a,s)&&!blocked(a,s)&&eligible(a,s)&&seen++>=offset&&list.length()<100)list.put(copy(s));}return obj("subjects",list);}
        if(path.equals("/v1/subjects")){
            if(method.equals("POST"))return obj("id",newSubject(a,d).getString("id"));
            if(method.equals("GET")){JSONArray list=new JSONArray();for(int n=0;n<rows("subjects").length();n++){JSONObject s=rows("subjects").getJSONObject(n);if(manages(a,s)||student(a)&&enrolled(a,s)){JSONObject r=copy(s);if(student(a))r.put("summary",learner(a,s).getJSONObject("summary"));list.put(r);}}return obj("subjects",list);}
        }
        if(p.length>=4&&p[2].equals("subjects")){
            if(p.length==5&&p[4].equals("enrol")&&method.equals("POST")){require(student(a),403,"Student access required.");JSONObject s=byId("subjects",p[3]);require(!blocked(a,s)&&(enrolled(a,s)||eligible(a,s)),404,"Enrollment unavailable. Ask the instructor to check eligibility.");enroll(a,s,d.optString("source").equals("qr")?"qr":"self");return obj("enrolled",true);}
            JSONObject s=subjectFor(a,p[3],false);
            if(p.length==4){
                if(method.equals("GET")){JSONArray list=new JSONArray();for(int n=0;n<rows("items").length();n++){JSONObject i=rows("items").getJSONObject(n);if(i.getString("subject_id").equals(p[3])&&!i.optBoolean("archived")&&(!student(a)||i.optBoolean("published")))list.put(present(a,i));}JSONObject r=obj("subject",copy(s),"items",list);if(student(a))r.put("summary",learner(a,s).getJSONObject("summary"));return r;}
                if(method.equals("POST")){require(manages(a,s),403,"Instructor access required.");require(d.optString("expected_title").equals(s.getString("title"))&&d.optString("expected_description").equals(s.getString("description")),409,"Subject changed. Refresh before saving.");s.put("title",text(d,"title",160,false)).put("description",text(d,"description",1000,true));return obj("saved",true);}
            }
            if(p.length==5&&p[4].equals("open-link")&&method.equals("POST")){require(d.optString("expected_description").equals(s.getString("description")),409,"Subject changed. Refresh first.");return link(s.getString("description"),d.optString("url"));}
            require(manages(a,s),403,"Instructor access required.");
            if(p.length==5&&p[4].equals("items")&&method.equals("POST"))return obj("id",newItem(a,s,d).getString("id"));
            if(p.length==5&&p[4].equals("eligibility")){
                if(method.equals("POST")){require(d.optInt("expected_revision")==s.getInt("eligibility_revision"),409,"Eligibility changed. Refresh first.");JSONArray ids=d.optJSONArray("student_numbers");require(ids!=null&&ids.length()<=1000&&d.opt("all_students") instanceof Boolean,400,"Choose All students or up to 1,000 student IDs.");JSONArray clean=new JSONArray();Set<String> unique=new HashSet<>();for(int i=0;i<ids.length();i++){String num=number(ids.getString(i));if(unique.add(num))clean.put(num);}s.put("all_students",d.optBoolean("all_students")).put("student_numbers",clean).put("eligibility_revision",s.getInt("eligibility_revision")+1);remove("enrolments",e->e.getString("subject_id").equals(s.getString("id"))&&!e.getString("source").equals("admin")&&!eligible(byId("accounts",e.getString("student_id")),s));}
                if(method.equals("GET")||method.equals("POST"))return obj("all_students",s.getBoolean("all_students"),"student_numbers",s.getJSONArray("student_numbers"),"revision",s.getInt("eligibility_revision"));
            }
            if(p.length>=5&&p[4].equals("learners")&&method.equals("GET")){if(p.length==5)return roster(s,offset);if(p.length==6){JSONObject x=byId("accounts",p[5]);require(student(x)&&enrolled(x,s)&&!x.optString("status").equals("deleted"),404,"Enrolled student unavailable.");return learner(x,s);}}
        }
        if(p.length>=4&&p[2].equals("items")){
            JSONObject i=itemFor(a,p[3],false);
            if(p.length==4&&method.equals("GET"))return obj("item",present(a,i));
            if(p.length==4&&method.equals("POST")){require(manages(a,i),403,"Only the creator or administrator can edit this material.");require(d.optInt("expected_edit_version")==i.getInt("edit_version"),409,"Item changed. Refresh first.");for(String field:new String[]{"owner_id","subject_id","kind","correct_index","assessment_type"})require(!d.has(field),400,"Create a new item to change its type or answer.");String title=d.has("title")?text(d,"title",160,false):i.getString("title"),body=d.has("body")?text(d,"body",12000,false):i.getString("body");if(!title.equals(i.getString("title"))||!body.equals(i.getString("body")))i.put("revision",i.getInt("revision")+1);i.put("title",title).put("body",body).put("published",d.optBoolean("published",i.getBoolean("published"))).put("archived",d.optBoolean("archived",false)).put("edit_version",i.getInt("edit_version")+1);return obj("saved",true);}
            if(p.length==5&&p[4].equals("open-link")&&method.equals("POST")){require(d.optInt("expected_revision")==i.getInt("revision"),409,"Item changed. Refresh first.");return link(i.getString("body"),d.optString("url"));}
            if(p.length==5&&method.equals("POST")){
                require(student(a),403,"Student access required.");String kind=i.getString("kind"),action=p[4];JSONObject old=record(a,i);
                if(action.equals("complete")){require(kind.equals("material"),403,"Submit assessed work instead of marking it read.");if(old==null){old=newRecord(a,i);rows("records").put(old);}old.put("completed",d.optBoolean("completed"));return obj("saved",true);}
                if(action.equals("quiz")||action.equals("submission")){
                    require(kind.equals(action.equals("quiz")?"quiz":"activity"),400,"Wrong submission type.");require(key!=null&&key.matches("[a-f0-9-]{36}"),400,"Provide a unique submission key.");int choice=d.optInt("choice",-1);String output=action.equals("submission")?text(d,"output",12000,false):"";if(kind.equals("quiz"))require(choice>=0&&choice<i.getJSONArray("options").length(),400,"Choose an answer.");
                    if(old!=null){require(key.equals(old.optString("request_key"))&&(kind.equals("quiz")?old.optInt("choice")==choice:old.optString("output").equals(output)),409,"Work has already been submitted for this version.");return obj("submitted",true);}
                    JSONObject r=newRecord(a,i).put("completed",true).put("request_key",key).put("submitted_at",System.currentTimeMillis());if(kind.equals("quiz"))r.put("choice",choice).put("score",choice==i.getInt("correct_index")?1:0);else r.put("output",output);rows("records").put(r);return obj("submitted",true);
                }
            }
        }
        if(p.length==5&&p[2].equals("submissions")&&p[4].equals("grade")&&method.equals("POST")){
            JSONObject r=byId("records",p[3]),i=itemFor(a,r.getString("item_id"),false);subjectFor(a,i.getString("subject_id"),true);JSONObject x=byId("accounts",r.getString("student_id"));require(student(x)&&x.optString("status").equals("active")&&enrolled(x,byId("subjects",i.getString("subject_id"))),404,"Student is no longer active and enrolled.");require(i.getString("kind").equals("activity")&&r.getInt("revision")==i.getInt("revision"),409,"Work belongs to a different item version.");require(Objects.equals(d.opt("expected_graded_at"),r.opt("graded_at")),409,"Assessment changed. Refresh first.");double score=d.optDouble("score",Double.NaN);require(Double.isFinite(score)&&score>=0&&score<=100,400,"Score must be 0–100.");r.put("score",score).put("feedback",text(d,"feedback",1000,true)).put("graded_at",Math.max(System.currentTimeMillis(),r.optLong("graded_at")+1));return obj("graded",true);
        }
        throw new Failure(404,"This action is unavailable in the local test workspace.");
    }
    private JSONObject newRecord(JSONObject a,JSONObject i)throws Exception{return obj("id",id(),"student_id",a.getString("id"),"item_id",i.getString("id"),"revision",i.getInt("revision"),"completed",false,"score",JSONObject.NULL,"feedback","","graded_at",JSONObject.NULL);}
    private void revoke(JSONObject a)throws Exception{remove("sessions",s->s.getString("account_id").equals(a.getString("id")));}
    private void forgetNumber(String old,String uid)throws Exception{for(int n=0;n<rows("subjects").length();n++){JSONObject s=rows("subjects").getJSONObject(n);JSONArray ids=s.getJSONArray("student_numbers");boolean changed=false;for(int i=ids.length()-1;i>=0;i--)if(!old.isEmpty()&&ids.getString(i).equals(old)){ids.remove(i);changed=true;}if(changed)s.put("eligibility_revision",s.getInt("eligibility_revision")+1);}remove("enrolments",r->r.getString("student_id").equals(uid)&&!r.getString("source").equals("admin"));}
    private static JSONObject link(String text,String url)throws Exception{KnowledgeLinks.require(url);boolean found=false;for(KnowledgeLinks.Link l:KnowledgeLinks.inText(text))if(l.url.equals(url))found=true;require(found,404,"Link changed. Refresh first.");return obj("url",url);}
    public void upload(String token,String itemId,int version,File staged)throws Exception{
        synchronized(LOCK){load();JSONObject a=actor(token);require(!a.optBoolean("must_change_password"),403,"Change the temporary password first.");JSONObject i=itemFor(a,itemId,true);require(i.getString("kind").equals("material")&&i.getString("material_mode").equals("file"),400,"Choose a PDF material item.");require(i.getInt("edit_version")==version,409,"Item changed. Refresh before uploading.");TransferPolicy.validatePdf(staged.toPath(),"");File target=new File(directory,id()+".pdf");Files.copy(staged.toPath(),target.toPath());String previous=i.optString("file_name");try{i.put("file_name",target.getName()).put("has_file",true).put("revision",i.getInt("revision")+1).put("edit_version",i.getInt("edit_version")+1);save();}catch(Exception e){Files.deleteIfExists(target.toPath());throw e;}if(!previous.isEmpty())Files.deleteIfExists(new File(directory,previous).toPath());}
    }
    public void material(String token,String itemId,boolean download,File destination)throws Exception{
        synchronized(LOCK){load();JSONObject a=actor(token);require(!a.optBoolean("must_change_password"),403,"Change the temporary password first.");JSONObject i=itemFor(a,itemId,download);require(i.optBoolean("has_file"),404,"Upload a PDF first.");File source=new File(directory,i.getString("file_name"));TransferPolicy.validatePdf(source.toPath(),"");Files.copy(source.toPath(),destination.toPath(),StandardCopyOption.REPLACE_EXISTING);}
    }
    /** A real minimal XLSX, with inline strings so content cannot become spreadsheet formulas. */
    public byte[] exportReport(String token,String subject,int offset)throws Exception{
        synchronized(LOCK){load();JSONObject a=actor(token);require(!a.optBoolean("must_change_password"),403,"Change the temporary password first.");JSONObject s=subjectFor(a,subject,true),report=roster(s,Math.max(0,offset));List<List<String>> table=new ArrayList<>();table.add(Arrays.asList("LOCAL TEST DATA",s.getString("title"),"Current published revisions; no pass/fail inferred"));table.add(Arrays.asList("Name","Email","Student ID","Completion %","Read % (self-reported)","Submitted","Required","Awaiting assessment","Item","Status","Score","Maximum","Feedback"));JSONArray learners=report.getJSONArray("learners");for(int n=0;n<learners.length();n++){JSONObject l=learners.getJSONObject(n),u=l.getJSONObject("student"),m=l.getJSONObject("summary");JSONArray items=l.getJSONArray("items");for(int j=0;j<Math.max(1,items.length());j++){JSONObject i=items.optJSONObject(j);List<String> row=new ArrayList<>(Arrays.asList(u.getString("name"),u.getString("email"),u.isNull("student_number")?"":u.getString("student_number"),""+m.getInt("completion_percent"),""+m.getInt("read_percent"),""+m.getInt("submitted"),""+m.getInt("required"),""+m.getInt("awaiting_assessment")));row.addAll(i==null?Arrays.asList("","","","",""):Arrays.asList(i.getString("title"),i.getString("status"),i.isNull("score")?"":i.optString("score"),i.optString("max_score"),i.optString("feedback")));table.add(row);}}
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(ZipOutputStream zip=new ZipOutputStream(bytes)){
                entry(zip,"[Content_Types].xml","<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>");
                entry(zip,"_rels/.rels","<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
                entry(zip,"xl/workbook.xml","<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Local test results\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
                entry(zip,"xl/_rels/workbook.xml.rels","<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>");
                StringBuilder sheet=new StringBuilder("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");for(List<String> row:table){sheet.append("<row>");for(String value:row)sheet.append("<c t=\"inlineStr\"><is><t xml:space=\"preserve\">").append(xml(value)).append("</t></is></c>");sheet.append("</row>");}entry(zip,"xl/worksheets/sheet1.xml",sheet.append("</sheetData></worksheet>").toString());
            }return bytes.toByteArray();
        }
    }
    private static String xml(String value){return value.replaceAll("[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f]","").replace("&","&amp;").replace("<","&lt;").replace(">","&gt;");}
    private static void entry(ZipOutputStream zip,String path,String text)throws IOException{zip.putNextEntry(new ZipEntry(path));zip.write(("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"+text).getBytes(StandardCharsets.UTF_8));zip.closeEntry();}
}
