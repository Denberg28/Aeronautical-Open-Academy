package org.aeronautical.openacademy;

import android.graphics.Typeface;
import android.graphics.Paint;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.LeadingMarginSpan;
import android.text.style.StyleSpan;
import android.text.style.LineHeightSpan;
import android.view.Gravity;
import android.view.View;
import android.widget.TextView;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** UI — preserve content/link spans; indent wrapped list text under its first word. */
final class ReadingText {
    private static final Pattern MARKER=Pattern.compile("^(?:Q?\\d+[.)]|[A-H][.)]|[-•])\\s+");
    private static final Pattern HEADING=Pattern.compile("(?i)^(learning outcomes|outcomes|study route|assessments?|instructor setup|instructor preparation|practice|learn|activity|quiz|privacy and storage)$");
    private static final Pattern PREFIX=Pattern.compile("(?i)^(outcome\\s+O\\d+|worked(?: classroom)? example|synthetic dataset|practice):");
    private ReadingText(){}
    static void apply(TextView view){
        SpannableStringBuilder text=new SpannableStringBuilder(view.getText());
        // Reformatting must not compound spacing or remove author/link spans.
        for(Object span:text.getSpans(0,text.length(),Object.class))if(span instanceof ParagraphGap||span instanceof Heading||span instanceof ListMargin)text.removeSpan(span);
        String raw=text.toString();int start=0,gap=Math.round(view.getResources().getDimension(R.dimen.academy_paragraph_gap)/Math.max(1f,view.getLineSpacingMultiplier()));
        while(start<raw.length()){
            int end=raw.indexOf('\n',start);if(end<0)end=raw.length();String line=raw.substring(start,end);Matcher marker=MARKER.matcher(line);
            if(marker.find()){int indent=Math.round(view.getPaint().measureText(marker.group()));text.setSpan(new ListMargin(indent),start,end<raw.length()?end+1:end,Spanned.SPAN_PARAGRAPH);}
            if(HEADING.matcher(line.trim()).matches())text.setSpan(new Heading(),start,end,Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            Matcher prefix=PREFIX.matcher(line);if(prefix.find())text.setSpan(new Heading(),start,start+prefix.end(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            // A hard line break separates paragraphs; existing blank lines already provide space.
            if(!line.trim().isEmpty()&&end+1<raw.length()&&raw.charAt(end+1)!='\n')text.setSpan(new ParagraphGap(gap),start,end+1,Spanned.SPAN_PARAGRAPH);
            start=end+1;
        }
        view.setText(text);view.setGravity(Gravity.START);view.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
    }
    private static final class Heading extends StyleSpan {Heading(){super(Typeface.BOLD);}}
    private static final class ListMargin extends LeadingMarginSpan.Standard {ListMargin(int indent){super(0,indent);}}
    private static final class ParagraphGap implements LineHeightSpan {
        final int pixels;ParagraphGap(int pixels){this.pixels=pixels;}
        public void chooseHeight(CharSequence text,int start,int end,int spanstartv,int v,Paint.FontMetricsInt metrics){
            if(text instanceof Spanned&&end==((Spanned)text).getSpanEnd(this)){metrics.descent+=pixels;metrics.bottom+=pixels;}
        }
    }
}
