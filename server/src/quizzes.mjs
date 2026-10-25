import { requireThat, text } from './security.mjs';
export const MAX_QUIZ_QUESTIONS=50;
export function validateQuestions(value){
 requireThat(Array.isArray(value)&&value.length>=1&&value.length<=MAX_QUIZ_QUESTIONS,400,'Choose 1–50 quiz questions.');
 const questions=value.map((q,index)=>{
  requireThat(q&&typeof q==='object'&&!Array.isArray(q),400,`Complete question ${index+1}.`);
  const prompt=text(q.prompt,'question',1000);
  requireThat(Array.isArray(q.options)&&q.options.length>=2&&q.options.length<=6,400,`Question ${index+1} needs 2–6 choices.`);
  const options=q.options.map(o=>text(o,'choice',300));
  requireThat(Number.isInteger(q.correct_index)&&q.correct_index>=0&&q.correct_index<options.length,400,`Select the correct answer for question ${index+1}.`);
  return {prompt,options,correct_index:q.correct_index};
 });
 requireThat(Buffer.byteLength(JSON.stringify(questions),'utf8')<=48000,400,'Keep the quiz within 48 KB of question text and choices.');
 return questions;
}
export function quizQuestions(item){return item.questions_json?JSON.parse(item.questions_json):[{prompt:item.body,options:JSON.parse(item.options_json),correct_index:item.correct_index}];}
export function publicQuestions(item,manager){return quizQuestions(item).map(q=>({prompt:q.prompt,options:q.options,...(manager?{correct_index:q.correct_index}:{})}));}
export function gradeAnswers(item,data){
 const questions=quizQuestions(item);
 requireThat(data.expected_revision===undefined&&questions.length===1||data.expected_revision===item.revision,409,'This quiz changed. Refresh before submitting.');
 const answers=data.answers??(questions.length===1?[data.choice]:null);
 requireThat(Array.isArray(answers)&&answers.length===questions.length,400,'Answer every question. Multi-question quizzes require an updated Academy client.');
 requireThat(answers.every((a,i)=>Number.isInteger(a)&&a>=0&&a<questions[i].options.length),400,'Choose one answer for every question.');
 return {answers,score:answers.reduce((n,a,i)=>n+(a===questions[i].correct_index?1:0),0),max_score:questions.length};
}
