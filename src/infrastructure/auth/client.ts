let token:string|null=null;
export function setCsrfToken(value:string|null){token=value;}
export async function authHeaders():Promise<Record<string,string>>{if(!token){try{const response=await fetch('/api/auth/me',{cache:'no-store'});if(response.ok)token=(await response.json()).csrfToken??null;}catch{/* API retains the authentication error. */}}return token?{'X-CSRF-Token':token}:{};}
