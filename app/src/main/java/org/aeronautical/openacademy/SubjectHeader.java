package org.aeronautical.openacademy;

import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.text.TextUtils;
import android.widget.*;
import androidx.core.view.ViewCompat;

/** UI — a mounted subject title/progress area, outside the content's scrolling viewport. */
final class SubjectHeader extends LinearLayout {
    private final TextView title,percent;
    private final ProgressBar progress;
    private final Button back,info;
    SubjectHeader(Context context){
        super(context);setId(R.id.subject_header);setOrientation(VERTICAL);setBackgroundColor(Color.WHITE);
        int inset=AcademyTypography.inset(context);setPadding(inset,dp(8),inset,dp(12));
        LinearLayout line=new LinearLayout(context);line.setGravity(android.view.Gravity.CENTER_VERTICAL);
        back=action("‹","Back to subjects");line.addView(back,new LayoutParams(dp(48),dp(48)));
        title=new TextView(context);title.setId(R.id.subject_title);AcademyTypography.style(title,20,true);title.setTextColor(0xff102640);title.setEllipsize(TextUtils.TruncateAt.END);
        title.setMaxLines(getResources().getConfiguration().orientation==Configuration.ORIENTATION_LANDSCAPE?1:3);ViewCompat.setAccessibilityHeading(title,true);line.addView(title,new LayoutParams(0,-2,1));
        info=action("ⓘ","Subject details");line.addView(info,new LayoutParams(dp(48),dp(48)));addView(line,new LayoutParams(-1,-2));
        percent=new TextView(context);percent.setId(R.id.subject_percent);AcademyTypography.style(percent,13,false);percent.setTextColor(0xff536174);percent.setPadding(0,dp(8),0,dp(6));addView(percent,new LayoutParams(-1,-2));
        progress=new ProgressBar(context,null,android.R.attr.progressBarStyleHorizontal);progress.setId(R.id.subject_progress);progress.setMax(100);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(0xffb17b0f));progress.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(0xffe4e9f0));addView(progress,new LayoutParams(-1,dp(6)));setVisibility(GONE);
    }
    void bind(String text,Integer completion,String progressDescription,Runnable onBack,Runnable details){
        title.setText(text);title.setOnClickListener(v->details.run());back.setOnClickListener(v->onBack.run());info.setOnClickListener(v->details.run());
        percent.setVisibility(completion==null?GONE:VISIBLE);progress.setVisibility(completion==null?GONE:VISIBLE);
        if(completion!=null){int value=Math.max(0,Math.min(100,completion));percent.setText(value+"% complete");progress.setProgress(value);progress.setContentDescription(value+"% complete; "+progressDescription);}
        setVisibility(VISIBLE);
    }
    void setActionsEnabled(boolean enabled){back.setEnabled(enabled);info.setEnabled(enabled);title.setEnabled(enabled);}
    private Button action(String label,String description){Button button=new Button(getContext());button.setText(label);button.setTextSize(15);button.setAllCaps(false);button.setMinWidth(0);button.setMinimumWidth(0);button.setPadding(0,0,0,0);android.util.TypedValue ripple=new android.util.TypedValue();getContext().getTheme().resolveAttribute(android.R.attr.selectableItemBackground,ripple,true);if(ripple.resourceId!=0)button.setBackgroundResource(ripple.resourceId);button.setTextColor(0xff102640);button.setContentDescription(description);return button;}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
}
