package org.aeronautical.openacademy;

import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Bounded-memory, one-page-at-a-time offline reader. Rendering never blocks the UI. */
public final class PdfActivity extends AppCompatActivity {
    private final ExecutorService renderer=Executors.newSingleThreadExecutor();
    private PdfRenderer document;
    private ParcelFileDescriptor descriptor;
    private ImageView image;
    private TextView status;
    private Button previous,next;
    private int page,count;
    private volatile boolean closed;
    private boolean rendering;
    private String key;
    private String protectedPath;
    private boolean allowExport=true;
    private String protectedItem;
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        key=getIntent().getStringExtra("key");page=saved==null?0:saved.getInt("page",0);
        protectedPath=getIntent().getStringExtra("secure_path");allowExport=protectedPath==null||getIntent().getBooleanExtra("allow_export",false);
        if(protectedPath!=null)getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);
        protectedItem=getIntent().getStringExtra("item_id");
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(0xfff6f7f4);setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root,(v,i)->{androidx.core.graphics.Insets b=i.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.displayCutout());v.setPadding(b.left,b.top,b.right,b.bottom);return i;});
        ViewCompat.requestApplyInsets(root);
        TextView title=new TextView(this);title.setText(getIntent().getStringExtra("title"));title.setTextSize(20);title.setTextColor(0xff173c33);title.setPadding(24,18,24,18);root.addView(title);
        TextView hint=new TextView(this);hint.setText("Saved PDF · use page controls below. Rotate your phone for a wider view.");hint.setTextSize(14);hint.setPadding(24,0,24,12);root.addView(hint);
        Button external=new Button(this);external.setText("Open in another PDF reader");root.addView(external);
        external.setVisibility(allowExport?View.VISIBLE:View.GONE);
        external.setOnClickListener(v->{
            try {
                File file=resolveFile();
                android.net.Uri uri=androidx.core.content.FileProvider.getUriForFile(this,BuildConfig.APPLICATION_ID+".files",file);
                android.content.Intent view=new android.content.Intent(android.content.Intent.ACTION_VIEW).setDataAndType(uri,"application/pdf").addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(android.content.Intent.createChooser(view,"Choose a PDF reader"));
            } catch(Exception e) { new androidx.appcompat.app.AlertDialog.Builder(this).setTitle("PDF reader unavailable").setMessage("Install or enable a PDF reader to use its accessibility and zoom tools. You can continue reading inside the Academy.").setPositiveButton("OK",null).show(); }
        });
        ScrollView scroll=new ScrollView(this);image=new ImageView(this);image.setAdjustViewBounds(true);image.setBackgroundColor(Color.WHITE);scroll.addView(image,new ScrollView.LayoutParams(-1,-2));root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        status=new TextView(this);status.setText("Opening saved PDF…");status.setGravity(Gravity.CENTER);status.setPadding(18,14,18,14);root.addView(status);
        LinearLayout controls=new LinearLayout(this);controls.setGravity(Gravity.CENTER);previous=new Button(this);previous.setText("Previous");next=new Button(this);next.setText("Next");Button back=new Button(this);back.setText("Close");
        controls.addView(previous,new LinearLayout.LayoutParams(0,-2,1));controls.addView(next,new LinearLayout.LayoutParams(0,-2,1));controls.addView(back,new LinearLayout.LayoutParams(0,-2,1));root.addView(controls);
        previous.setEnabled(false);next.setEnabled(false);previous.setOnClickListener(v->{if(!rendering&&page>0){page--;renderPage();scroll.scrollTo(0,0);}});next.setOnClickListener(v->{if(!rendering&&page<count-1){page++;renderPage();scroll.scrollTo(0,0);}});back.setOnClickListener(v->finish());
        renderer.execute(()->{
            try {
                File file=resolveFile();
                if(protectedPath!=null)new LearningApi(this).request("GET","/v1/items/"+protectedItem,null);
                descriptor=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);document=new PdfRenderer(descriptor);count=document.getPageCount();page=Math.max(0,Math.min(page,count-1));
                runOnUiThread(()->{if(!closed)renderPage();});
            } catch(Exception e){showError();}
        });
    }
    private void renderPage() {
        if(closed||rendering)return;rendering=true;previous.setEnabled(false);next.setEnabled(false);
        final int requested=page;status.setText("Rendering page "+(page+1)+"…");
        renderer.execute(()->{
            try{if(protectedPath!=null)new LearningApi(this).request("GET","/v1/items/"+protectedItem,null);}catch(Exception e){showError();return;}
            try(PdfRenderer.Page p=document.openPage(requested)) {
                int width=Math.min(1600,Math.max(600,getResources().getDisplayMetrics().widthPixels));
                int height=(int)Math.min(2400,Math.max(1,width*(double)p.getHeight()/Math.max(1,p.getWidth())));
                Bitmap bitmap=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);bitmap.eraseColor(Color.WHITE);p.render(bitmap,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                runOnUiThread(()->{
                    if(closed){bitmap.recycle();return;}
                    image.setImageBitmap(bitmap);image.setContentDescription("PDF page "+(requested+1)+" of "+count+". PDF page images do not expose document text to screen readers.");
                    status.setText("Page "+(requested+1)+" of "+count);rendering=false;previous.setEnabled(page>0);next.setEnabled(page<count-1);
                });
            }catch(Exception e){showError();}
        });
    }
    private void showError(){runOnUiThread(()->{if(!closed){rendering=false;status.setText("Cannot open this PDF. Return to the subject and download it again, or ask your instructor for an accessible copy.");}});}
    private File resolveFile()throws java.io.IOException{
        if(protectedPath==null)return ((AcademyApp)getApplication()).repository().file(key);
        File file=new File(protectedPath);String allowed=new File(getCacheDir(),"protected-pdf").getCanonicalPath()+File.separator;
        if(!file.getCanonicalPath().startsWith(allowed))throw new java.io.IOException("Material unavailable.");return file;
    }
    @Override protected void onSaveInstanceState(Bundle out){out.putInt("page",page);super.onSaveInstanceState(out);}
    @Override protected void onDestroy(){closed=true;final boolean remove=protectedPath!=null&&!isChangingConfigurations();renderer.execute(()->{if(document!=null)document.close();if(descriptor!=null)try{descriptor.close();}catch(java.io.IOException ignored){}if(remove)try{resolveFile().delete();}catch(java.io.IOException ignored){}});renderer.shutdown();super.onDestroy();}
}
