#!/usr/bin/env python3
"""Regenerate the original demonstration handouts and bundled catalog.
Authoring dependency: reportlab==4.4.3. Not required to build the app.
"""
from pathlib import Path
import hashlib
import json
import shutil
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/pdf'
ASSETS=ROOT/'app/src/main/assets'
SUBJECTS=[
 ('a','A','Subject A','Explore a lesson, try an activity, and check your understanding.',[
  ('Learn','Read the lesson material and identify its main idea. Use the text companion whenever you prefer a readable text version.'),
  ('Activity','Write a short explanation of one idea in your own words. In the learning workspace, mark the activity complete after doing the work.'),
  ('Quiz','Submit your answer when ready. A quiz is marked submitted by the server; marking an activity complete does not create a quiz grade.')]),
 ('b','B','Subject B','Practice applying a concept to a simple situation.',[
  ('Learn','Compare two possible approaches to a problem. Identify the evidence you need before choosing.'),
  ('Activity','Describe your preferred approach and one observation that would make you reconsider it.'),
  ('Quiz','Review the question and options. Submit once, then read the recorded result. Practice samples are separate from official learning records.')]),
 ('c','C','Subject C','Reflect on your work and plan the next learning step.',[
  ('Learn','Review the lesson objective and connect it with something you have already learned.'),
  ('Activity','Record one thing you understood and one question to ask your instructor. Mark completion only after doing the activity.'),
  ('Quiz','Submit your own answer. Completion, submission, and achievement are separate states; a completed quiz is not necessarily a passing grade.')])
]

def make():
 OUT.mkdir(parents=True,exist_ok=True);(ASSETS/'materials').mkdir(parents=True,exist_ok=True)
 styles=getSampleStyleSheet()
 styles.add(ParagraphStyle(name='AcademyTitle',fontName='Helvetica-Bold',fontSize=28,leading=32,textColor=HexColor('#173c33'),spaceAfter=16))
 styles.add(ParagraphStyle(name='AcademyBody',fontName='Helvetica',fontSize=11,leading=17,spaceAfter=14,textColor=HexColor('#344d43')))
 styles.add(ParagraphStyle(name='AcademyLabel',fontName='Helvetica-Bold',fontSize=11,leading=16,textColor=HexColor('#215b4c'),spaceBefore=12,spaceAfter=6))
 subjects=[]
 for sid,code,title,description,sections in SUBJECTS:
  path=OUT/f'{sid}-learning-guide.pdf'
  doc=SimpleDocTemplate(str(path),pagesize=(595.28,841.89),rightMargin=52,leftMargin=52,topMargin=48,bottomMargin=60,title=code+' | '+title,author='Aeronautical Open Academy')
  story=[Paragraph('AERONAUTICAL OPEN ACADEMY',styles['AcademyLabel']),Spacer(1,16),Paragraph(code,styles['AcademyLabel']),Paragraph(title,styles['AcademyTitle']),Paragraph('DEMONSTRATION MATERIAL - NOT AN APPROVED SYLLABUS',styles['AcademyLabel']),Paragraph(description,styles['AcademyBody'])]
  transcript=code+' - '+title+'\n\nDEMONSTRATION MATERIAL - NOT AN APPROVED SYLLABUS\n\n'+description+'\n\n'
  for heading,body in sections:
   story.extend([Paragraph(heading,styles['AcademyLabel']),Paragraph(body,styles['AcademyBody'])]);transcript+=heading+'\n'+body+'\n\n'
  def footer(canvas,document):
   canvas.setStrokeColor(HexColor('#dfe5df'));canvas.line(52,53,543,53);canvas.setFont('Helvetica',9);canvas.setFillColor(HexColor('#52665e'));canvas.drawString(52,37,'Original sample content | CC BY 4.0 | Revision 1');canvas.drawRightString(543,37,str(document.page))
  doc.build(story,onFirstPage=footer,onLaterPages=footer)
  destination=ASSETS/'materials'/path.name;shutil.copyfile(path,destination)
  source='asset://materials/'+path.name
  resource={'id':sid+'-guide','title':'Learning guide & practice situation','module':'Getting started','description':'A short demonstration guide with one professional practice situation. Text and PDF versions contain the same notes.','source':source,'downloadUrl':source,'downloadable':True,'mimeType':'application/pdf','revision':1,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'license':'Original Academy sample content - CC BY 4.0','text':transcript.strip()}
  subjects.append({'id':sid,'code':code,'title':title,'description':description,'resources':[resource]})
 catalog={'schemaVersion':1,'version':1,'title':'Aeronautical Open Academy - Sample Library','subjects':subjects}
 (ASSETS/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n',encoding='utf-8')
 print('Created 3 sample PDFs and catalog with matching SHA-256 checksums.')

if __name__=='__main__':make()
