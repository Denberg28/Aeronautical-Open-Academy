"use strict";
// Scheduling — Philippine input/display, UTC milliseconds over the shared API.
// Due dates report compliance; they never block late work or change scores.
window.academySchedule = (() => {
  const format = new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"});
  const inputDate = ms => new Date(ms+8*3600000).toISOString().slice(0,16);
  function timestamp(value) {
    const ms=Date.parse(value+":00+08:00");
    if(!Number.isFinite(ms)||inputDate(ms)!==value)throw new Error("Choose a valid date and time.");
    return ms;
  }
  function caption(item) {
    const parts=[];
    if(item.publication_state==="scheduled")parts.push("Publishes "+format.format(item.publish_at)+" PHT");
    if(item.due_at)parts.push("Due "+format.format(item.due_at)+" PHT"+({overdue:" · Overdue",late:" · Completed late",completed:" · Completed on time"}[item.due_state]||""));
    return parts.join(" | ");
  }
  function show(item,save,onClose) {
    const dialog=document.createElement("dialog");dialog.className="schedule-dialog";
    dialog.innerHTML='<h2>Publishing and due date</h2><p>Asia/Manila (PHT). Late work is accepted and marked late; no automatic grade penalty.</p><form><label>Publication<select name="mode"><option value="draft">Draft</option><option value="published">Publish now</option><option value="scheduled">Scheduled</option></select></label><label data-release>Publish date and time<input name="publish" type="datetime-local" step="60"></label><label class="choice"><input type="checkbox" name="hasDue">Set completion due date</label><label data-deadline>Due date and time<input name="due" type="datetime-local" step="60"></label><p class="error" role="alert"></p><div class="form-actions"><button type="button" data-cancel>Cancel</button><button type="submit" class="primary">Save schedule</button></div></form>';
    const form=dialog.querySelector("form");form.elements.mode.value=item.publication_state||(!item.published?"draft":"published");
    form.elements.publish.value=inputDate(item.publish_at||Date.now()+86400000);
    form.elements.due.value=inputDate(item.due_at||(item.publish_at||Date.now())+7*86400000);
    form.elements.hasDue.checked=!!item.due_at;
    const visibility=()=>{dialog.querySelector("[data-release]").hidden=form.elements.mode.value!=="scheduled";dialog.querySelector("[data-deadline]").hidden=!form.elements.hasDue.checked;};
    form.onchange=visibility;visibility();
    const close=()=>{dialog.close();dialog.remove();onClose();};
    dialog.querySelector("[data-cancel]").onclick=close;
    dialog.oncancel=event=>{event.preventDefault();if(!form.querySelector('[type="submit"]').disabled)close();};
    form.onsubmit=async event=>{
      event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;
      try {
        const publish_at=form.elements.mode.value==="scheduled"?timestamp(form.elements.publish.value):null;
        const due_at=form.elements.hasDue.checked?timestamp(form.elements.due.value):null;
        if(publish_at!=null&&due_at!=null&&due_at<=publish_at)throw new Error("The due date must be after the publish time.");
        await save({published:form.elements.mode.value!=="draft",publish_at,due_at,expected_edit_version:item.edit_version});close();
      }catch(error){
        if(error.status===401){close();document.dispatchEvent(new CustomEvent("academy-schedule-error",{detail:{message:error.message,status:error.status}}));}
        else dialog.querySelector('[role="alert"]').textContent=error.message;
      }
      finally{button.disabled=false;}
    };
    document.body.append(dialog);dialog.showModal();
  }
  return {caption,show};
})();
