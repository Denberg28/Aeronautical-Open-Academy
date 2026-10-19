import org.aeronautical.openacademy.core.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/** Standalone checks run on JDK 17 without an Android SDK. */
public final class CoreChecks {
    private static int checks;
    interface Checked { void run() throws Exception; }
    static void expect(boolean ok,String label){checks++;if(!ok)throw new AssertionError(label);}
    static void rejects(Checked action,String label)throws Exception{boolean rejected=false;try{action.run();}catch(IllegalArgumentException|java.io.IOException e){rejected=true;}expect(rejected,label);}
    public static void main(String[] args)throws Exception{
        Set<String> ids=Set.of("a","c");
        String protectedId="12345678-abcd-abcd-abcd-123456789abc";
        expect(QrRouter.protectedSubject("aoa://subject/"+protectedId).equals(protectedId),"protected subject routes to authorization workspace");
        expect(QrRouter.protectedSubject(protectedId).equals(protectedId),"protected manual subject identifier");
        for(String raw:new String[]{"https://evil.example/"+protectedId,"aoa://subject/"+protectedId+"?enroll=true","aoa://subject/"+protectedId+"#fragment","aoa://evil@subject/"+protectedId})expect(QrRouter.protectedSubject(raw).isEmpty(),"malformed protected route rejected");
        expect(QrRouter.subject(" A ",ids).equals("a"),"manual code normalized");
        expect(QrRouter.subject("aoa://subject/c",ids).equals("c"),"stable QR routes locally");
        for(String s:new String[]{"", "https://evil.example/a", "aoa://subject/a?url=https://evil.example", "aoa://subject/a#fragment", "aoa://subject/../../a", "aoa://user@subject/a", "aoa://subject:8/a", "aoa://other/a", "aoa://subject/%61", "aoa://subject/ae-999", "file:///a", "a\nother", "a".repeat(513)})rejects(()->QrRouter.subject(s,ids),"reject QR "+s);
        for(String s:new String[]{"https://drive.google.com/file/d/abc/view","https://docs.google.com/document/d/abc/export?format=pdf","https://drive.usercontent.google.com/download?id=abc","https://doc-01.googleusercontent.com/a"})expect(UrlPolicy.allowed(s),"allow content provider");
        for(String s:new String[]{"http://drive.google.com/a","https://drive.google.com.evil.example/a","https://evilgoogleusercontent.com/a","https://drive.google.com@evil.example/a","file:///data/a","https://127.0.0.1/a","https://drive.google.com:8443/a","https://accounts.google.com/a","javascript:alert(1)"})expect(!UrlPolicy.allowed(s),"deny unapproved destination");
        for(String link:new String[]{"https://docs.google.com/document/d/demo/edit?usp=sharing","https://docs.google.com/presentation/d/demo/edit#slide=id.1","https://docs.google.com/spreadsheets/d/demo/edit","https://drive.google.com/file/d/demo/view","https://youtu.be/demo?t=20","http://www.example.org/lesson","https://www.example.org/guide.pdf","https://www.example.org/grades.xlsx","https://www.example.org/wiki/Topic_(detail)","https://www.example.org:443/a","http://www.example.org:80/a"}){KnowledgeLinks.require(link);checks++;}
        for(String link:new String[]{"javascript:alert(1)","file:///a","content://private/a","intent://host","https://user:pass@example.org/a","https://127.0.0.1/a","http://10.0.0.1/a","http://2130706433/a","http://0x7f000001/a","https://[::1]/a","http://localhost/a","https://school.local/a","https://a.internal/a","https://www.example.org:8443/a","https://www.example.org/a\\evil","https://www.example.org/a\nb"})rejects(()->KnowledgeLinks.require(link),"reject unsafe external link");
        var linked=KnowledgeLinks.inText("Slides (https://docs.google.com/presentation/d/demo/edit). Video https://youtu.be/demo?t=4 and https://www.example.org/wiki/Topic_(detail).");
        expect(linked.size()==3,"inline web links extracted without punctuation");expect(linked.get(0).label.equals("Google Slides"),"presentation link label");expect(linked.get(1).label.equals("YouTube"),"video link label");expect(linked.get(2).url.endsWith("Topic_(detail)"),"balanced URL parentheses retained");
        expect(KnowledgeLinks.inText("unsafe https://127.0.0.1/private and javascript:alert(1)").isEmpty(),"unsafe text stays noninteractive");
        var prior=java.util.List.of("b","a","deleted","b");var current=java.util.List.of("a","b","new");
        expect(SubjectOrder.merge(prior,current).equals(java.util.List.of("b","a","new")),"personal subject order removes stale and duplicate IDs, appends newly available subjects");
        expect(SubjectOrder.merge(java.util.List.of(),current).equals(current),"first account keeps received order");
        expect(SubjectOrder.merge(prior,java.util.List.of()).isEmpty(),"revoked subjects do not survive personal order");
        expect(SubjectOrder.move(current,"b",-1).equals(java.util.List.of("b","a","new")),"accessible move matches drag sequence");
        expect(SubjectOrder.move(current,"a",-1).equals(current),"first subject cannot move out of bounds");
        expect(SubjectOrder.move(current,"missing",1).equals(current)&&current.equals(java.util.List.of("a","b","new")),"missing ID and source list are preserved");
        Path temp=Files.createTempDirectory("academy-core-");
        try{
            Path pdf=temp.resolve("complete.pdf");Files.writeString(pdf,"%PDF-1.4\nexample\n%%EOF",StandardCharsets.US_ASCII);
            String sha=TransferPolicy.sha256(pdf);expect(sha.length()==64,"sha256 returned");TransferPolicy.validatePdf(pdf,sha);checks++;
            rejects(()->TransferPolicy.validatePdf(pdf,"0".repeat(64)),"checksum mismatch rejected");
            Path html=temp.resolve("drive-login.pdf");Files.writeString(html,"<!doctype html><title>Sign in</title>");rejects(()->TransferPolicy.validatePdf(html,""),"login page cannot become offline PDF");
            Path empty=temp.resolve("partial.pdf");Files.writeString(empty,"%PD");rejects(()->TransferPolicy.validatePdf(empty,""),"partial signature rejected");
            Path large=temp.resolve("large.pdf");try(java.io.RandomAccessFile f=new java.io.RandomAccessFile(large.toFile(),"rw")){f.setLength(TransferPolicy.MAX_PDF_BYTES+1);}rejects(()->TransferPolicy.validatePdf(large,""),"download limit enforced");
        }finally{try(var entries=Files.list(temp)){for(Path p:entries.toList())Files.delete(p);}Files.delete(temp);}
        System.out.println("PASS: "+checks+" routing, destination, and transfer integrity checks");
    }
}
