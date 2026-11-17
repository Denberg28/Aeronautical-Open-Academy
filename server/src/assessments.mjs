import { requireThat } from './security.mjs';

// Assessment — keep these authoring limits aligned with Android ChoiceAssessment.
export function questions(value){
 requireThat(Array.isArray(value)&&value.length>=1&&value.length<=20,400,'Use 1–20 questions.');
 const clean=value.map((q,n)=>{
  requireThat(q&&typeof q==='object'&&!Array.isArray(q),400,'Check question '+(n+1)+'.');
  const prompt=typeof q.prompt==='string'?q.prompt.trim():'';
  requireThat(prompt.length>=1&&prompt.length<=2000,400,'Question '+(n+1)+' needs 1–2000 characters.');
  requireThat(Array.isArray(q.options)&&q.options.length>=2&&q.options.length<=8,400,'Use 2–8 choices per question.');
  const unique=new Set(),options=q.options.map(raw=>{requireThat(typeof raw==='string',400,'Choices must be text.');const text=raw.trim(),key=text.toLowerCase();requireThat(text.length>=1&&text.length<=300&&!unique.has(key),400,'Use distinct choices of 1–300 characters.');unique.add(key);return text;});
  requireThat(Number.isInteger(q.correct_index)&&q.correct_index>=0&&q.correct_index<options.length,400,'Select the correct answer for question '+(n+1)+'.');
  return {prompt,options,correct_index:q.correct_index};
 });
 requireThat(JSON.stringify(clean).length<=48000,400,'The form is too large; split it into smaller assessments.');return clean;
}
export function publicQuestions(value,includeAnswers=false){return questions(value).map(q=>includeAnswers?q:{prompt:q.prompt,options:q.options});}
export function scoreAnswers(value,answers){
 const clean=questions(value);requireThat(Array.isArray(answers)&&answers.length===clean.length,400,'Answer every question.');let correct=0;
 answers=answers.map((choice,n)=>{requireThat(Number.isInteger(choice)&&choice>=0&&choice<clean[n].options.length,400,'Select one choice for question '+(n+1)+'.');if(choice===clean[n].correct_index)correct++;return choice;});
 return {answers,correct,total:clean.length,score:Math.round(correct*10000/clean.length)/100};
}
