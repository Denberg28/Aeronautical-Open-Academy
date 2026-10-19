package org.aeronautical.openacademy;

import org.json.JSONObject;
import org.json.JSONException;
import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;

public class CatalogValidationTest {
    private JSONObject sample() throws Exception {
        try(var in=getClass().getClassLoader().getResourceAsStream("catalog.json")) {
            assertNotNull(in);return new JSONObject(new String(in.readAllBytes(),StandardCharsets.UTF_8));
        }
    }
    @Test public void bundledCatalogContainsStableSubjectAndOfflineText() throws Exception {
        Catalog c=Catalog.parse(sample().toString(),true);
        assertEquals(3,c.subjects.size());assertNotNull(c.subject("a"));
        assertFalse(c.subject("a").resources.get(0).plainText.isEmpty());
    }
    @Test public void remoteCatalogCannotReadBundledPaths() throws Exception {
        assertThrows(JSONException.class,()->Catalog.parse(sample().toString(),false));
    }
    @Test public void duplicateIdsAreRejected() throws Exception {
        JSONObject j=sample();j.getJSONArray("subjects").getJSONObject(1).put("id","a");
        assertThrows(JSONException.class,()->Catalog.parse(j.toString(),true));
    }
    @Test public void unsupportedSchemaIsRejected() throws Exception {
        JSONObject j=sample().put("schemaVersion",2);
        assertThrows(JSONException.class,()->Catalog.parse(j.toString(),true));
    }
    @Test public void deceptiveDownloadLinkIsRejected() throws Exception {
        JSONObject j=sample();j.getJSONArray("subjects").getJSONObject(0).getJSONArray("resources").getJSONObject(0).put("downloadUrl","https://drive.google.com.evil.example/download");
        assertThrows(JSONException.class,()->Catalog.parse(j.toString(),true));
    }
    @Test public void nonPdfOfflineFormatIsRejected() throws Exception {
        JSONObject j=sample();j.getJSONArray("subjects").getJSONObject(0).getJSONArray("resources").getJSONObject(0).put("mimeType","text/html");
        assertThrows(JSONException.class,()->Catalog.parse(j.toString(),true));
    }
    @Test public void invalidRevisionAndChecksumAreRejected() throws Exception {
        JSONObject revisionCatalog=sample();revisionCatalog.getJSONArray("subjects").getJSONObject(0).getJSONArray("resources").getJSONObject(0).put("revision",0);
        assertThrows(JSONException.class,()->Catalog.parse(revisionCatalog.toString(),true));
        JSONObject checksumCatalog=sample();checksumCatalog.getJSONArray("subjects").getJSONObject(0).getJSONArray("resources").getJSONObject(0).put("sha256","wrong");
        assertThrows(JSONException.class,()->Catalog.parse(checksumCatalog.toString(),true));
    }
    @Test public void instructorCatalogCanUseValidatedGooglePdfSource() throws Exception {
        JSONObject j=sample();
        for(int i=0;i<j.getJSONArray("subjects").length();i++) {
            JSONObject r=j.getJSONArray("subjects").getJSONObject(i).getJSONArray("resources").getJSONObject(0);
            r.put("source","https://drive.google.com/file/d/approved/view");r.put("downloadUrl","https://drive.usercontent.google.com/download?id=approved");
        }
        assertFalse(Catalog.parse(j.toString(),false).demo);
    }
}
