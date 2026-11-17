package org.aeronautical.openacademy;

import android.content.Context;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ClickableSpan;
import android.view.View;
import android.widget.TextView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Rendered regression: paragraph spacing must differ from soft wrapping and preserve links/text. */
@RunWith(AndroidJUnit4.class)
public class TypographyLayoutTest {
    @Test public void paragraphSpacingPreservesWordsLinksAndRepeatedFormatting(){
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        String raw="A paragraph with enough words to wrap across several lines in a narrow reader. It keeps its original wording.\nThe next paragraph contains an Academy link.";
        int[] heights=new int[4];boolean[] retained=new boolean[2];float density=context.getResources().getDisplayMetrics().density;
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
            TextView view=new TextView(context);view.setLayoutParams(new android.view.ViewGroup.LayoutParams(Math.round(200*density),android.view.ViewGroup.LayoutParams.WRAP_CONTENT));AcademyTypography.style(view,16,false);SpannableStringBuilder text=new SpannableStringBuilder(raw);
            ClickableSpan link=new ClickableSpan(){public void onClick(View ignored){}};int index=raw.indexOf("Academy");text.setSpan(link,index,index+7,Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);view.setText(text);
            for(int attempt=0;attempt<2;attempt++){
                ReadingText.apply(view);view.measure(View.MeasureSpec.makeMeasureSpec(Math.round(200*density),View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(0,View.MeasureSpec.UNSPECIFIED));view.layout(0,0,view.getMeasuredWidth(),view.getMeasuredHeight());
                int last=view.getLayout().getLineForOffset(raw.indexOf('\n'));heights[attempt*2]=view.getLayout().getLineTop(1)-view.getLayout().getLineTop(0);heights[attempt*2+1]=view.getLayout().getLineTop(last+1)-view.getLayout().getLineTop(last);
            }
            retained[0]=raw.contentEquals(view.getText());retained[1]=((Spanned)view.getText()).getSpanStart(link)==index;
        });
        assertTrue("Original words changed",retained[0]);assertTrue("Clickable link was lost",retained[1]);
        assertTrue("Paragraphs are as cramped as wrapped lines",heights[1]>=heights[0]+8*density);
        assertEquals("Reformatting compounded paragraph space",heights[1],heights[3]);
    }
}
