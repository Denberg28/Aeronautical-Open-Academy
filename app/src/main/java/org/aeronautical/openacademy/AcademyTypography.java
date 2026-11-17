package org.aeronautical.openacademy;

import android.content.Context;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.widget.TextView;
import androidx.appcompat.app.AlertDialog;

/** UI — shared typography for app text, inputs, choices and native dialogs. Sizes use sp. */
final class AcademyTypography {
    static final float BODY_LINE_HEIGHT=1.4f, HEADING_LINE_HEIGHT=1.2f;
    private AcademyTypography(){}
    static void style(TextView view,int sp,boolean heading){
        view.setTextSize(sp);view.setIncludeFontPadding(false);view.setGravity(Gravity.START|Gravity.CENTER_VERTICAL);view.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
        view.setLineSpacing(0,heading?HEADING_LINE_HEIGHT:BODY_LINE_HEIGHT);
        view.setTypeface(Typeface.create(heading?"sans-serif-medium":"sans-serif",Typeface.NORMAL));
    }
    static int inset(Context context){return context.getResources().getDimensionPixelSize(R.dimen.academy_screen_inset);}
    // Native dialog text follows the same rules without replacing existing show/submit listeners.
    static AlertDialog.Builder dialog(Context context){
        return new AlertDialog.Builder(context){
            @Override public AlertDialog create(){
                AlertDialog dialog=super.create();View decor=dialog.getWindow().getDecorView();
                decor.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener(){
                    public void onViewAttachedToWindow(View view){view.removeOnAttachStateChangeListener(this);view.post(()->formatDialog(dialog));}
                    public void onViewDetachedFromWindow(View view){}
                });return dialog;
            }
        };
    }
    private static void formatDialog(AlertDialog dialog){
        TextView message=dialog.findViewById(android.R.id.message),title=dialog.findViewById(androidx.appcompat.R.id.alertTitle);
        if(message!=null){style(message,16,false);ReadingText.apply(message);}
        if(title!=null){style(title,20,true);title.setMaxLines(4);}
        for(int which:new int[]{AlertDialog.BUTTON_POSITIVE,AlertDialog.BUTTON_NEGATIVE,AlertDialog.BUTTON_NEUTRAL}){
            android.widget.Button button=dialog.getButton(which);if(button!=null){button.setAllCaps(false);button.setTextSize(15);button.setLineSpacing(0,HEADING_LINE_HEIGHT);}
        }
    }
}
