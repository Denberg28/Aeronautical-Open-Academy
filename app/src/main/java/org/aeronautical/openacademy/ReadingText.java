package org.aeronautical.openacademy;

import android.graphics.Typeface;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.LeadingMarginSpan;
import android.text.style.StyleSpan;
import android.view.Gravity;
import android.view.View;
import android.widget.TextView;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** UI — preserve content/link spans; indent wrapped list text under its first word. */
final class ReadingText {
    private static final Pattern MARKER=Pattern.compile("^(?:Q?\\d+[.)]|[A-H][.)]|[-•])\\s+");
    private static final Pattern HEADING=Pattern.compile("(?i)^(learning outcomes|outcomes|study route|assessments?|instructor setup|instructor preparation|practice|learn|activity|quiz|privacy and storage)$");
    private ReadingText(){}
    static void apply(TextView view){
        SpannableStringBuilder text=new SpannableStringBuilder(view.getText());String raw=text.toString();int start=0;
        while(start<raw.length()){
            int end=raw.indexOf('\n',start);if(end<0)end=raw.length();String line=raw.substring(start,end);Matcher marker=MARKER.matcher(line);
            if(marker.find()){int indent=Math.round(view.getPaint().measureText(marker.group()));text.setSpan(new LeadingMarginSpan.Standard(0,indent),start,end<raw.length()?end+1:end,Spanned.SPAN_PARAGRAPH);}
            if(HEADING.matcher(line.trim()).matches())text.setSpan(new StyleSpan(Typeface.BOLD),start,end,Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            start=end+1;
        }
        view.setText(text);view.setGravity(Gravity.START);view.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);view.setLineSpacing(2*view.getResources().getDisplayMetrics().density,1.2f);
    }
}
