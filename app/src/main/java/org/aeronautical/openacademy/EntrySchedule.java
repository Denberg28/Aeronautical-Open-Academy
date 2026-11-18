package org.aeronautical.openacademy;

import android.app.Activity;
import android.app.DatePickerDialog;
import android.app.TimePickerDialog;
import android.view.View;
import android.widget.*;
import androidx.appcompat.app.AlertDialog;
import org.json.JSONObject;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Publishing/due dates use Philippine time in the UI and UTC milliseconds in the API. */
public final class EntrySchedule {
    private static final ZoneId ZONE=ZoneId.of("Asia/Manila");
    private static final DateTimeFormatter FORMAT=DateTimeFormatter.ofPattern("dd MMM uuuu, hh:mm a 'PHT'",Locale.ENGLISH);
    public interface Save {void submit(JSONObject data,Runnable done) throws Exception;}
    private static ZonedDateTime date(JSONObject item,String key,ZonedDateTime fallback){return item.isNull(key)?fallback:Instant.ofEpochMilli(item.optLong(key)).atZone(ZONE);}
    public static String caption(JSONObject item){
        String text=item.optString("publication_state").equals("scheduled")?"Publishes "+FORMAT.format(date(item,"publish_at",ZonedDateTime.now(ZONE))):"";
        if(!item.isNull("due_at")){
            String state=item.optString("due_state"),label=state.equals("overdue")?" · Overdue":state.equals("late")?" · Completed late":state.equals("completed")?" · Completed on time":"";
            text+=(text.isEmpty()?"":"\n")+"Due "+FORMAT.format(date(item,"due_at",ZonedDateTime.now(ZONE)))+label;
        }
        return text;
    }
    // UI — Native date/time pickers; change ZONE only alongside server/client date tests.
    private static Button picker(Activity activity,LinearLayout form,String title,ZonedDateTime[] value){
        Button button=new Button(activity);Runnable label=()->button.setText(title+" · "+FORMAT.format(value[0]));label.run();form.addView(button);
        button.setOnClickListener(v->new DatePickerDialog(activity,(view,year,month,day)->{
            value[0]=value[0].withDayOfMonth(1).withYear(year).withMonth(month+1).withDayOfMonth(day);
            label.run();new TimePickerDialog(activity,(time,hour,minute)->{value[0]=value[0].withHour(hour).withMinute(minute).withSecond(0).withNano(0);label.run();},value[0].getHour(),value[0].getMinute(),false).show();
        },value[0].getYear(),value[0].getMonthValue()-1,value[0].getDayOfMonth()).show());return button;
    }
    public static void show(Activity activity,JSONObject item,Save save,Runnable dismissed){
        LinearLayout form=new LinearLayout(activity);form.setOrientation(LinearLayout.VERTICAL);int pad=(int)(20*activity.getResources().getDisplayMetrics().density);form.setPadding(pad,pad,pad,pad);
        TextView hint=new TextView(activity);hint.setText("Asia/Manila (PHT). Late work is accepted and marked late, without an automatic grade penalty.");form.addView(hint);
        Spinner mode=new Spinner(activity);mode.setAdapter(new ArrayAdapter<>(activity,android.R.layout.simple_spinner_dropdown_item,new String[]{"Draft","Publish now","Scheduled"}));form.addView(mode);
        String state=item.optString("publication_state",item.optBoolean("published")?"published":"draft");mode.setSelection(state.equals("scheduled")?2:state.equals("published")?1:0);
        ZonedDateTime start=ZonedDateTime.now(ZONE).plusDays(1).withSecond(0).withNano(0);
        ZonedDateTime[] release={date(item,"publish_at",start)},due={date(item,"due_at",start.plusDays(7))};
        Button publish=picker(activity,form,"Publish",release);
        CheckBox hasDue=new CheckBox(activity);hasDue.setText("Set completion due date");hasDue.setChecked(!item.isNull("due_at"));form.addView(hasDue);
        Button deadline=picker(activity,form,"Due",due);deadline.setVisibility(hasDue.isChecked()?View.VISIBLE:View.GONE);hasDue.setOnCheckedChangeListener((button,checked)->deadline.setVisibility(checked?View.VISIBLE:View.GONE));
        mode.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onItemSelected(AdapterView<?> p,View v,int position,long id){publish.setVisibility(position==2?View.VISIBLE:View.GONE);}public void onNothingSelected(AdapterView<?> p){}});
        TextView error=new TextView(activity);error.setTextColor(0xffb42318);form.addView(error);ScrollView scroll=new ScrollView(activity);scroll.addView(form);
        AlertDialog dialog=AcademyTypography.dialog(activity).setTitle("Publishing and due date").setView(scroll).setNegativeButton("Cancel",null).setPositiveButton("Save schedule",null).create();
        dialog.setOnDismissListener(d->dismissed.run());dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{
            Long publishAt=mode.getSelectedItemPosition()==2?release[0].toInstant().toEpochMilli():null,dueAt=hasDue.isChecked()?due[0].toInstant().toEpochMilli():null;
            if(publishAt!=null&&dueAt!=null&&dueAt<=publishAt)throw new IllegalArgumentException("The due date must be after the publish time.");
            save.submit(new JSONObject().put("expected_edit_version",item.optInt("edit_version")).put("published",mode.getSelectedItemPosition()!=0).put("publish_at",publishAt==null?JSONObject.NULL:publishAt).put("due_at",dueAt==null?JSONObject.NULL:dueAt),dialog::dismiss);
        }catch(Exception failure){error.setText(failure.getMessage());}}));dialog.show();
    }
    private EntrySchedule(){}
}
