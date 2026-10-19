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
        expect(QrRouter.subject(" A ",ids).equals("a"),"manual code normalized");
        expect(QrRouter.subject("aoa://subject/c",ids).equals("c"),"stable QR routes locally");
        for(String s:new String[]{"", "https://evil.example/a", "aoa://subject/a?url=https://evil.example", "aoa://subject/a#fragment", "aoa://subject/../../a", "aoa://user@subject/a", "aoa://subject:8/a", "aoa://other/a", "aoa://subject/%61", "aoa://subject/ae-999", "file:///a", "a\nother", "a".repeat(513)})rejects(()->QrRouter.subject(s,ids),"reject QR "+s);
        for(String s:new String[]{"https://drive.google.com/file/d/abc/view","https://docs.google.com/document/d/abc/export?format=pdf","https://drive.usercontent.google.com/download?id=abc","https://doc-01.googleusercontent.com/a"})expect(UrlPolicy.allowed(s),"allow content provider");
        for(String s:new String[]{"http://drive.google.com/a","https://drive.google.com.evil.example/a","https://evilgoogleusercontent.com/a","https://drive.google.com@evil.example/a","file:///data/a","https://127.0.0.1/a","https://drive.google.com:8443/a","https://accounts.google.com/a","javascript:alert(1)"})expect(!UrlPolicy.allowed(s),"deny unapproved destination");
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
