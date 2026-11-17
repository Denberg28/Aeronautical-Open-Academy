package org.aeronautical.openacademy;

import android.content.Context;
import android.graphics.Color;
import android.text.InputFilter;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/** Assessment editor — ordinary native fields, with one selected answer per question. */
final class ChoiceFormEditor extends LinearLayout {
    private final List<QuestionRow> rows=new ArrayList<>();
    private final boolean editable;
    private final Button add;
    ChoiceFormEditor(Context context,JSONArray initial,boolean editable)throws Exception{
        super(context);this.editable=editable;setOrientation(VERTICAL);
        add=action("+ Question",v->{if(rows.size()<ChoiceAssessment.MAX_QUESTIONS)try{append(null);}catch(Exception e){throw new IllegalStateException(e);}});
        if(initial!=null)for(int n=0;n<initial.length();n++)append(initial.getJSONObject(n));
        if(rows.isEmpty())append(null);if(editable)addView(add);update();
    }
    JSONArray snapshot()throws Exception{JSONArray result=new JSONArray();for(QuestionRow row:rows)result.put(row.value());return result;}
    JSONArray questions()throws Exception{return ChoiceAssessment.validate(snapshot());}
    private void append(JSONObject value)throws Exception{
        QuestionRow row=new QuestionRow(value);rows.add(row);addView(row,indexOfChild(add)<0?getChildCount():indexOfChild(add));update();
    }
    private void update(){for(int n=0;n<rows.size();n++){QuestionRow row=rows.get(n);row.heading.setText("Question "+(n+1));row.remove.setEnabled(rows.size()>1);}add.setEnabled(rows.size()<ChoiceAssessment.MAX_QUESTIONS);}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private TextView label(String value){TextView view=new TextView(getContext());view.setText(value);view.setTextSize(15);view.setTextColor(0xff102640);view.setPadding(0,dp(12),0,dp(8));return view;}
    private EditText field(String hint,String value,int maximum){EditText view=new EditText(getContext());view.setHint(hint);view.setContentDescription(hint);view.setText(value);view.setTextSize(16);view.setTextColor(0xff102640);view.setMinHeight(dp(48));view.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_SENTENCES|InputType.TYPE_TEXT_FLAG_MULTI_LINE);view.setMaxLines(4);view.setFilters(new InputFilter[]{new InputFilter.LengthFilter(maximum)});view.setEnabled(editable);view.setPadding(dp(8),dp(8),dp(8),dp(8));return view;}
    private Button action(String text,OnClickListener click){Button button=new Button(getContext());button.setAllCaps(false);button.setText(text);button.setTextSize(14);button.setMinHeight(dp(48));button.setTextColor(0xff102640);button.setOnClickListener(click);return button;}

    private final class QuestionRow extends LinearLayout {
        final TextView heading;final EditText prompt;final LinearLayout options;
        final List<EditText> values=new ArrayList<>();final List<RadioButton> correct=new ArrayList<>();
        final Button remove,addOption,removeOption;
        QuestionRow(JSONObject data)throws Exception{
            super(ChoiceFormEditor.this.getContext());setOrientation(VERTICAL);setPadding(0,dp(12),0,dp(16));
            heading=label("");addView(heading);prompt=field("Question",data==null?"":data.optString("prompt"),2000);addView(prompt,new LayoutParams(-1,-2));
            if(editable)addView(label("Select the correct choice"));options=new LinearLayout(getContext());options.setOrientation(VERTICAL);addView(options);
            JSONArray choices=data==null?new JSONArray().put("").put("").put("").put(""):data.getJSONArray("options");
            for(int n=0;n<choices.length();n++)appendOption(choices.getString(n),data!=null&&data.optInt("correct_index",-1)==n);
            LinearLayout controls=new LinearLayout(getContext());controls.setGravity(Gravity.START);
            addOption=action("+ Choice",v->{if(values.size()<ChoiceAssessment.MAX_OPTIONS)appendOption("",false);updateOptions();});
            removeOption=action("− Choice",v->{if(values.size()>2){int last=values.size()-1;values.remove(last);correct.remove(last);options.removeViewAt(last);}updateOptions();});
            remove=action("Remove question",v->{rows.remove(this);ChoiceFormEditor.this.removeView(this);update();});
            if(editable){controls.addView(addOption,new LayoutParams(0,-2,1));controls.addView(removeOption,new LayoutParams(0,-2,1));addView(controls);addView(remove);}updateOptions();
        }
        void appendOption(String text,boolean checked){
            LinearLayout line=new LinearLayout(getContext());line.setGravity(Gravity.CENTER_VERTICAL);RadioButton radio=new RadioButton(getContext());radio.setId(View.generateViewId());radio.setContentDescription("Correct answer, choice "+(values.size()+1));radio.setEnabled(editable);radio.setChecked(checked);line.addView(radio,new LayoutParams(dp(48),dp(48)));
            EditText value=field("Choice "+(values.size()+1),text,300);line.addView(value,new LayoutParams(0,-2,1));values.add(value);correct.add(radio);options.addView(line);
            radio.setOnClickListener(v->{for(RadioButton candidate:correct)candidate.setChecked(candidate==radio);});
        }
        void updateOptions(){if(addOption!=null)addOption.setEnabled(values.size()<ChoiceAssessment.MAX_OPTIONS);if(removeOption!=null)removeOption.setEnabled(values.size()>2);}
        JSONObject value()throws Exception{JSONArray choices=new JSONArray();int answer=-1;for(int n=0;n<values.size();n++){choices.put(values.get(n).getText().toString());if(correct.get(n).isChecked())answer=n;}return new JSONObject().put("prompt",prompt.getText().toString()).put("options",choices).put("correct_index",answer);}
    }
}
