import javax.tools.*;
import com.sun.source.util.JavacTask;
import java.util.*;
/** Syntax-only check; explicitly does not type-check Android APIs or dependencies. */
public class ParseJava {
 public static void main(String[] args)throws Exception{
  JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();
  DiagnosticCollector<JavaFileObject> diagnostics=new DiagnosticCollector<>();
  try(StandardJavaFileManager files=compiler.getStandardFileManager(diagnostics,null,null)){
   JavacTask task=(JavacTask)compiler.getTask(null,files,diagnostics,List.of("-proc:none"),null,files.getJavaFileObjects(args));
   task.parse();
   boolean errors=false;
   for(Diagnostic<?> d:diagnostics.getDiagnostics())if(d.getKind()==Diagnostic.Kind.ERROR){System.err.println(d);errors=true;}
   if(errors)System.exit(1);
   System.out.println("PASS: Java syntax parsed for "+args.length+" files (not Android compilation)");
  }
 }
}
