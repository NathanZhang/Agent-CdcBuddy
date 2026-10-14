/** Keep the complete result in AG-UI and the audit log. The LLM receives a
 * labelled preview, never a silently truncated table presented as complete. */
export function modelResultPreview(value:unknown):unknown {
 if(Array.isArray(value))return value.length>10
  ?{previewOnly:true,returnedCount:value.length,preview:value.slice(0,10).map(modelResultPreview)}
  :value.map(modelResultPreview);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,modelResultPreview(item)]));
 return value;
}
