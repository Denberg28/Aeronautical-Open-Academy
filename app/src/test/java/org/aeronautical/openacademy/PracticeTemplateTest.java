package org.aeronautical.openacademy;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

public class PracticeTemplateTest {
    @Test public void publicEntriesOfferReadingOrExactAssessmentActionWithoutQuestions()throws Exception {
        PracticeTemplate template;
        try(InputStream in=getClass().getResourceAsStream("/subject-template.json")){template=new PracticeTemplate(new String(in.readAllBytes(),StandardCharsets.UTF_8));}
        assertEquals(25,template.entries.size());Set<String> keys=new HashSet<>();int reads=0,quizzes=0,activities=0,exams=0;
        for(PracticeTemplate.Entry entry:template.entries){
            assertTrue(keys.add(entry.key));String action=PracticeTemplate.action(entry.kind,"");
            if(action.equals("Read")){reads++;assertFalse(entry.reading.isEmpty());}
            else{assertEquals("",entry.reading);if(action.equals("Take quiz"))quizzes++;else if(action.equals("Take activity"))activities++;else if(action.equals("Take examination"))exams++;else fail(action);}
        }
        assertEquals(9,reads);assertEquals(8,quizzes);assertEquals(4,activities);assertEquals(4,exams);
        assertEquals("Take examination",PracticeTemplate.action("activity","examination"));
    }
}
