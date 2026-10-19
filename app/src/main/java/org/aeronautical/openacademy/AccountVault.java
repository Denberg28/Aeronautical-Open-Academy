package org.aeronautical.openacademy;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Only an opaque session token is retained, encrypted with a non-exportable device key. */
final class AccountVault {
    private final SharedPreferences prefs;
    private static final String ALIAS="academy-session-v1";
    AccountVault(Context c){prefs=c.getSharedPreferences("account",Context.MODE_PRIVATE);}
    private SecretKey key()throws Exception{
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(!store.containsAlias(ALIAS)){
            KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());generator.generateKey();
        }
        return ((KeyStore.SecretKeyEntry)store.getEntry(ALIAS,null)).getSecretKey();
    }
    String base(){return prefs.getString("base","");}
    void setBase(String base){if(!base.equals(base()))clear();prefs.edit().putString("base",base).apply();}
    void save(String token)throws Exception{
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
        if(!prefs.edit().putString("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).putString("token",Base64.encodeToString(cipher.doFinal(token.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP)).commit())throw new java.io.IOException("Session could not be saved. Check device storage.");
    }
    String token(){
        if(!prefs.contains("token"))return "";
        try{Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(prefs.getString("iv",""),Base64.NO_WRAP)));return new String(c.doFinal(Base64.decode(prefs.getString("token",""),Base64.NO_WRAP)),StandardCharsets.UTF_8);}
        catch(Exception e){clear();return "";}
    }
    String draft(String id){
        try{String value=prefs.getString("draft:"+id,"");if(value.isEmpty())return "";String[] parts=value.split(":",2);Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));return new String(c.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8);}catch(Exception e){return "";}
    }
    boolean saveDraft(String id,String value){
        if(id.isEmpty()||token().isEmpty())return false;
        try{Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());return prefs.edit().putString("draft:"+id,Base64.encodeToString(c.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(c.doFinal(value.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP)).commit();}catch(Exception e){return false;}
    }
    void removeDraft(String id){prefs.edit().remove("draft:"+id).commit();}
    void clear(){SharedPreferences.Editor edit=prefs.edit();for(String name:prefs.getAll().keySet())if(name.startsWith("draft:"))edit.remove(name);edit.remove("token").remove("iv").commit();}
}
