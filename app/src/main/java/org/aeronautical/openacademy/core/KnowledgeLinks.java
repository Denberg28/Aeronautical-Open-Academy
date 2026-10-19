package org.aeronautical.openacademy.core;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Inline web references only; never used for app HTTP/auth traffic or private downloads. */
public final class KnowledgeLinks {
    private static final Pattern WEB=Pattern.compile("https?://[^\\s<>\"`]+",Pattern.CASE_INSENSITIVE);
    private KnowledgeLinks(){}
    public static final class Link {
        public final int start,end;public final String url,label;
        Link(int start,int end,String url,String label){this.start=start;this.end=end;this.url=url;this.label=label;}
    }
    public static URI require(String raw){
        try{
            String value=raw.trim();if(value.isEmpty()||value.length()>2048||value.matches("(?s).*[\\s\\\\\\x00-\\x1f\\x7f].*"))throw new IllegalArgumentException();
            URI uri=new URI(value);String scheme=uri.getScheme()==null?"":uri.getScheme().toLowerCase(Locale.ROOT),host=uri.getHost()==null?"":uri.getHost().toLowerCase(Locale.ROOT);
            int port=uri.getPort();boolean defaultPort=port==-1||scheme.equals("https")&&port==443||scheme.equals("http")&&port==80;
            if((!scheme.equals("http")&&!scheme.equals("https"))||uri.getUserInfo()!=null||!defaultPort||host.length()>253||!host.contains(".")||host.endsWith(".")||host.contains(":")||host.matches(".*[.]([0-9]+|localhost|local|internal|lan|home|test|invalid|example|onion)$"))throw new IllegalArgumentException();
            for(String part:host.split("\\."))if(!part.matches("[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"))throw new IllegalArgumentException();
            return uri;
        }catch(Exception e){throw new IllegalArgumentException("Use a public HTTP or HTTPS link without credentials, local addresses or custom ports.");}
    }
    private static String trimPunctuation(String value){
        String text=value;while(text.matches("(?s).*[.,;!]$"))text=text.substring(0,text.length()-1);
        for(char[] pair:new char[][]{{'(',')'},{'[',']'},{'{','}'}}){
            while(!text.isEmpty()&&text.charAt(text.length()-1)==pair[1]){int opens=0,closes=0;for(char c:text.toCharArray()){if(c==pair[0])opens++;if(c==pair[1])closes++;}if(closes<=opens)break;text=text.substring(0,text.length()-1);}
        }
        while(text.matches("(?s).*[.,;!]$"))text=text.substring(0,text.length()-1);return text;
    }
    public static List<Link> inText(String text){
        List<Link> links=new ArrayList<>();Matcher matcher=WEB.matcher(text);
        while(matcher.find()){
            String raw=trimPunctuation(matcher.group());try{URI uri=require(raw);links.add(new Link(matcher.start(),matcher.start()+raw.length(),raw,(uri.getScheme().equalsIgnoreCase("http")?"HTTP · ":"")+label(uri)));}catch(IllegalArgumentException ignored){}
        }return links;
    }
    public static String label(URI uri){
        String host=uri.getHost().toLowerCase(Locale.ROOT),path=uri.getPath()==null?"":uri.getPath().toLowerCase(Locale.ROOT);
        if(host.equals("docs.google.com")){if(path.startsWith("/document/"))return "Google Docs";if(path.startsWith("/presentation/"))return "Google Slides";if(path.startsWith("/spreadsheets/"))return "Google Sheets";}
        if(host.equals("drive.google.com"))return "Google Drive";
        if(host.equals("youtu.be")||host.equals("youtube.com")||host.endsWith(".youtube.com"))return "YouTube";
        if(path.endsWith(".pdf"))return "PDF · "+host;
        if(path.endsWith(".xlsx")||path.endsWith(".xls")||path.endsWith(".csv"))return "Spreadsheet · "+host;
        if(path.endsWith(".pptx")||path.endsWith(".ppt"))return "Presentation · "+host;
        if(path.endsWith(".docx")||path.endsWith(".doc"))return "Document · "+host;
        return host;
    }
}
