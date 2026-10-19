package org.aeronautical.openacademy;

import android.content.Context;
import android.os.Parcelable;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.DefaultItemAnimator;
import androidx.recyclerview.widget.ItemTouchHelper;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.*;
import org.aeronautical.openacademy.core.SubjectOrder;

/** Handle-only, measured-row dragging; the active row follows the finger and swaps live. */
final class SubjectBoard extends RecyclerView {
    interface RowFactory {Row make(JSONObject subject);}
    interface Saved {void accept(List<String> ids);}
    static final class Row {final View view,handle;Row(View view,View handle){this.view=view;this.handle=handle;}}
    private final List<JSONObject> subjects=new ArrayList<>();
    private final Saved saved;
    private final ItemTouchHelper helper;
    private final BoardAdapter boardAdapter;
    private boolean dirty,dragging,dragEnabled=true;
    SubjectBoard(Context context,JSONArray source,View header,View footer,RowFactory factory,Saved saved){
        super(context);this.saved=saved;
        for(int i=0;i<source.length();i++)if(source.optJSONObject(i)!=null)subjects.add(source.optJSONObject(i));
        setLayoutManager(new LinearLayoutManager(context));setClipToPadding(false);setOverScrollMode(OVER_SCROLL_NEVER);setContentDescription("Subjects. Hold a subject handle to change its order.");
        DefaultItemAnimator animator=new DefaultItemAnimator();animator.setSupportsChangeAnimations(false);animator.setMoveDuration(160);animator.setAddDuration(120);animator.setRemoveDuration(120);setItemAnimator(animator);
        boardAdapter=new BoardAdapter(header,footer,factory);setAdapter(boardAdapter);
        helper=new ItemTouchHelper(new ItemTouchHelper.SimpleCallback(ItemTouchHelper.UP|ItemTouchHelper.DOWN,0){
            @Override public boolean isLongPressDragEnabled(){return false;}
            @Override public boolean isItemViewSwipeEnabled(){return false;}
            @Override public int getMovementFlags(@NonNull RecyclerView list,@NonNull ViewHolder holder){return holder.getItemViewType()==1?makeMovementFlags(ItemTouchHelper.UP|ItemTouchHelper.DOWN,0):0;}
            @Override public float getMoveThreshold(@NonNull ViewHolder holder){return .22f;}
            @Override public int getBoundingBoxMargin(){return Math.round(8*getResources().getDisplayMetrics().density);}
            @Override public boolean onMove(@NonNull RecyclerView list,@NonNull ViewHolder from,@NonNull ViewHolder to){
                if(to.getItemViewType()!=1)return false;int a=from.getBindingAdapterPosition()-1,b=to.getBindingAdapterPosition()-1;
                if(a<0||b<0||a>=subjects.size()||b>=subjects.size())return false;
                subjects.add(b,subjects.remove(a));dirty=true;boardAdapter.notifyItemMoved(a+1,b+1);return true;
            }
            @Override public void onSwiped(@NonNull ViewHolder holder,int direction){}
            @Override public void onSelectedChanged(ViewHolder holder,int state){
                super.onSelectedChanged(holder,state);dragging=state==ItemTouchHelper.ACTION_STATE_DRAG;
                if(dragging&&holder!=null){holder.itemView.animate().cancel();holder.itemView.animate().scaleX(1.015f).scaleY(1.015f).setDuration(100).start();holder.itemView.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS);}
            }
            @Override public void clearView(@NonNull RecyclerView list,@NonNull ViewHolder holder){super.clearView(list,holder);dragging=false;holder.itemView.animate().scaleX(1).scaleY(1).setDuration(120).start();flush();}
        });helper.attachToRecyclerView(this);
    }
    void setDragEnabled(boolean enabled){dragEnabled=enabled;}
    boolean isDragging(){return dragging;}
    List<String> ids(){List<String> ids=new ArrayList<>();for(JSONObject s:subjects)ids.add(s.optString("id"));return ids;}
    void flush(){if(dirty){dirty=false;saved.accept(ids());}}
    void dispose(){flush();helper.attachToRecyclerView(null);}
    Parcelable layoutState(){return getLayoutManager()==null?null:getLayoutManager().onSaveInstanceState();}
    void restoreLayout(Parcelable state){if(state!=null&&getLayoutManager()!=null)getLayoutManager().onRestoreInstanceState(state);}
    void move(String id,int delta){
        if(dragging)return;List<String> before=ids(),after=SubjectOrder.move(before,id,delta);if(before.equals(after))return;
        int from=before.indexOf(id),to=after.indexOf(id);subjects.add(to,subjects.remove(from));boardAdapter.notifyItemMoved(from+1,to+1);dirty=true;flush();announceForAccessibility("Subject moved "+(delta<0?"up":"down"));
    }
    private final class Holder extends ViewHolder {Holder(View view){super(view);}}
    private final class BoardAdapter extends Adapter<Holder> {
        private final View header,footer;private final RowFactory factory;private final Map<String,Long> stable=new HashMap<>();
        BoardAdapter(View header,View footer,RowFactory factory){this.header=header;this.footer=footer;this.factory=factory;for(int i=0;i<subjects.size();i++)stable.put(subjects.get(i).optString("id"),(long)i+1);setHasStableIds(true);setStateRestorationPolicy(StateRestorationPolicy.PREVENT_WHEN_EMPTY);}
        @Override public int getItemCount(){return subjects.size()+2;}
        @Override public int getItemViewType(int position){return position==0?0:position==getItemCount()-1?2:1;}
        @Override public long getItemId(int position){return position==0?Long.MIN_VALUE:position==getItemCount()-1?Long.MAX_VALUE:stable.get(subjects.get(position-1).optString("id"));}
        @NonNull @Override public Holder onCreateViewHolder(@NonNull ViewGroup parent,int type){
            if(type!=1)return new Holder(type==0?header:footer);
            FrameLayout wrapper=new FrameLayout(getContext());wrapper.setLayoutParams(new RecyclerView.LayoutParams(-1,-2));int pad=Math.round(20*getResources().getDisplayMetrics().density);wrapper.setPadding(pad,0,pad,Math.round(12*getResources().getDisplayMetrics().density));return new Holder(wrapper);
        }
        @Override public void onBindViewHolder(@NonNull Holder holder,int position){
            if(getItemViewType(position)!=1)return;JSONObject subject=subjects.get(position-1);FrameLayout wrapper=(FrameLayout)holder.itemView;wrapper.removeAllViews();Row row=factory.make(subject);wrapper.addView(row.view,new FrameLayout.LayoutParams(-1,-2));
            row.handle.setOnLongClickListener(v->{if(!dragEnabled||holder.getBindingAdapterPosition()==NO_POSITION)return false;helper.startDrag(holder);return true;});
        }
    }
}
