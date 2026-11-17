package org.aeronautical.openacademy;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/** Assessment — bounded authoring validation and trusted local scoring; no Android UI. */
public final class ChoiceAssessment {
    public static final int MAX_QUESTIONS=20, MAX_OPTIONS=8;
    private ChoiceAssessment(){}
    private static void check(boolean valid,String message){if(!valid)throw new IllegalArgumentException(message);}

    public static JSONArray validate(JSONArray source)throws Exception{
        check(source!=null&&source.length()>=1&&source.length()<=MAX_QUESTIONS,"Use 1–20 questions.");
        JSONArray clean=new JSONArray();
        for(int n=0;n<source.length();n++){
            JSONObject question=source.getJSONObject(n);Object promptValue=question.opt("prompt");
            check(promptValue instanceof String,"Question prompts must be text.");String prompt=((String)promptValue).trim();
            JSONArray options=question.optJSONArray("options");Object answer=question.opt("correct_index");
            check(!prompt.isEmpty()&&prompt.length()<=2000,"Question "+(n+1)+" needs 1–2000 characters.");
            check(options!=null&&options.length()>=2&&options.length()<=MAX_OPTIONS,"Use 2–8 choices per question.");
            check(answer instanceof Integer&&(Integer)answer>=0&&(Integer)answer<options.length(),"Select the correct answer for question "+(n+1)+".");
            JSONArray values=new JSONArray();Set<String> unique=new HashSet<>();
            for(int j=0;j<options.length();j++){
                Object value=options.get(j);check(value instanceof String,"Choices must be text.");String text=((String)value).trim();
                check(!text.isEmpty()&&text.length()<=300&&unique.add(text.toLowerCase(Locale.ROOT)),"Use distinct choices of 1–300 characters.");values.put(text);
            }
            clean.put(new JSONObject().put("prompt",prompt).put("options",values).put("correct_index",answer));
        }
        check(clean.toString().length()<=48000,"The form is too large; split it into smaller assessments.");return clean;
    }

    public static JSONArray present(JSONArray source,boolean includeAnswers)throws Exception{
        JSONArray clean=validate(source);if(!includeAnswers)for(int n=0;n<clean.length();n++)clean.getJSONObject(n).remove("correct_index");return clean;
    }

    public static JSONObject score(JSONArray questions,JSONArray answers)throws Exception{
        JSONArray clean=validate(questions);check(answers!=null&&answers.length()==clean.length(),"Answer every question.");
        JSONArray selected=new JSONArray();int correct=0;
        for(int n=0;n<clean.length();n++){
            Object raw=answers.get(n);check(raw instanceof Integer,"Select one choice for question "+(n+1)+".");int choice=(Integer)raw;JSONObject question=clean.getJSONObject(n);
            check(choice>=0&&choice<question.getJSONArray("options").length(),"Select one choice for question "+(n+1)+".");selected.put(choice);if(choice==question.getInt("correct_index"))correct++;
        }
        return new JSONObject().put("answers",selected).put("correct",correct).put("total",clean.length()).put("score",Math.round(correct*10000.0/clean.length())/100.0);
    }
}
