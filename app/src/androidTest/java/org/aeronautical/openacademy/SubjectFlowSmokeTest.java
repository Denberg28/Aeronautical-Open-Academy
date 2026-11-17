package org.aeronautical.openacademy;

import android.content.Context;
import android.content.Intent;
import android.graphics.Rect;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.*;
import org.junit.*;
import org.junit.runner.RunWith;
import java.io.File;
import static org.junit.Assert.*;

/** Device regression for the reported full-screen header and public PDF detour. */
@RunWith(AndroidJUnit4.class)
public class SubjectFlowSmokeTest {
    private UiDevice device;
    private Context context;
    private static final String SHOTS="/sdcard/Download/academy-smoke";
    @Before public void setup()throws Exception {
        context=InstrumentationRegistry.getInstrumentation().getTargetContext();device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        new AccountVault(context).clear();new LearningApi(context).resetTest();device.executeShellCommand("settings put system font_scale 1.0");device.executeShellCommand("mkdir -p "+SHOTS);
    }
    @After public void cleanup()throws Exception {device.executeShellCommand("settings put system font_scale 1.0");device.pressBack();}
    private void launch(){context.startActivity(new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK));}
    private UiObject2 waitFor(BySelector selector){UiObject2 view=device.wait(Until.findObject(selector),15000);assertNotNull("Missing UI: "+selector,view);return view;}
    private UiObject2 findButton(String text)throws Exception {
        UiSelector target=new UiSelector().className("android.widget.Button").text(text);
        UiObject visible=device.findObject(target);if(!visible.exists())new UiScrollable(new UiSelector().className("android.widget.ScrollView")).scrollIntoView(target);
        return waitFor(By.clazz("android.widget.Button").text(text));
    }
    private void button(String text)throws Exception {findButton(text).click();device.waitForIdle();}
    private void compactHeader(){
        UiObject2 brand=waitFor(By.text("Open Academy"));Rect bounds=brand.getVisibleBounds();
        float density=context.getResources().getDisplayMetrics().density;
        assertTrue("Header displaced the subject screen: "+bounds,bounds.bottom<device.getDisplayHeight()/4);
        assertTrue("Brand collapsed horizontally: "+bounds,bounds.width()>40*density);
        assertNotNull(device.findObject(By.text("Subjects")));
    }
    @Test public void headerStaysCompactAtDoubleFontSize()throws Exception {
        device.executeShellCommand("settings put system font_scale 2.0");launch();waitFor(By.text("1 subject available"));compactHeader();
        assertTrue(device.takeScreenshot(new File(SHOTS,"header-large-font.png")));
    }
    @Test public void readAndQuizWorkFromPublicSubjectThroughSignIn()throws Exception {
        launch();waitFor(By.text("Open subject"));compactHeader();assertTrue(device.takeScreenshot(new File(SHOTS,"subjects.png")));
        button("Open subject");button("Read");waitFor(By.textContains("Learning outcomes"));button("Close");
        assertNull(device.findObject(By.text("Save PDF")));assertNull(device.findObject(By.text("Read PDF")));
        assertTrue(device.takeScreenshot(new File(SHOTS,"subject-actions.png")));
        button("Take quiz");waitFor(By.desc("Username")).setText("student");waitFor(By.desc("Password")).setText("student");button("Sign in");
        waitFor(By.clazz("android.widget.RadioButton")).click();button("Submit");waitFor(By.text("Submit answers?"));button("Submit");
        waitFor(By.text("Result"));waitFor(By.textContains(" / 1 correct"));assertTrue(device.takeScreenshot(new File(SHOTS,"quiz-result.png")));button("Close");
        findButton("Review");button("Take activity");waitFor(By.clazz("android.widget.RadioButton"));button("Cancel");button("Take examination");waitFor(By.clazz("android.widget.RadioButton"));button("Cancel");assertNull(device.findObject(By.text("Save PDF")));
    }
}
