package org.aeronautical.openacademy.core;

import java.util.*;

/** A personal subject order: stale IDs disappear and newly available subjects append. */
public final class SubjectOrder {
    private SubjectOrder() {}
    public static List<String> merge(List<String> saved,List<String> current){
        LinkedHashSet<String> remaining=new LinkedHashSet<>(current),result=new LinkedHashSet<>();
        for(String id:saved)if(remaining.remove(id))result.add(id);
        result.addAll(remaining);return new ArrayList<>(result);
    }
    public static List<String> move(List<String> ids,String id,int offset){
        List<String> result=new ArrayList<>(ids);int from=result.indexOf(id),to=from+offset;
        if(from>=0&&to>=0&&to<result.size()){result.remove(from);result.add(to,id);}return result;
    }
}
