import {assertPrincipal} from '@/infrastructure/auth/authorization';
import {withBusinessDb} from '@/infrastructure/db/business-store';
import {assertJobEvidence} from '@/application/jobs/workflow-provenance';
import {getDeploymentTier} from '@/application/config/deployment-tier';
export function deliverInApp(){return withBusinessDb(db=>db.transaction(()=>{
 const events=db.prepare("SELECT * FROM biz_outbox WHERE channel='in_app' AND status='PENDING' LIMIT 100").all() as any[];let delivered=0;
 for(const e of events){
  try{const job=db.prepare('SELECT * FROM biz_jobs WHERE job_id=? AND domain=?').get(e.job_id,e.domain) as any;if(!job)throw Error('Notification requires actual job evidence');
   if(job.status!=='APPROVED')throw Error('Notification requires approved evidence');const principal=JSON.parse(job.principal_json);const ctx={runId:'outbox',domain:e.domain,deploymentTier:getDeploymentTier(),principal};assertPrincipal(ctx);assertJobEvidence(job,ctx,true);
  }catch{db.prepare("UPDATE biz_outbox SET status='BLOCKED_MOCK' WHERE event_id=?").run(e.event_id);continue;}
  db.prepare('INSERT OR IGNORE INTO biz_inbox VALUES(?,?,?,?,?)').run(e.event_id,e.user_id,e.domain,e.payload_json,Date.now());
  db.prepare("UPDATE biz_outbox SET status='DELIVERED',delivered_at=? WHERE event_id=?").run(Date.now(),e.event_id);delivered++;
 }
 return delivered;
}).immediate());}
