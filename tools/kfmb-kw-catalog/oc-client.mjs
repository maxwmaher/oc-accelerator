/** Fixed sandbox client. Reads may retry throttling; writes never retry. */
import {SETTINGS,guard} from './catalog.mjs';
export class OCClient {
  constructor(secret, fetchImpl=fetch) { this.secret=secret; this.fetch=fetchImpl; this.token=null; this.expires=0; }
  async authenticate() {
    guard(typeof this.secret==='string' && this.secret.length>0,'No backend secret supplied. Use Run-KwCatalog.ps1.');
    const response=await this.fetch(`${SETTINGS.api}/oauth/token`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(45000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:SETTINGS.clientId,client_secret:this.secret,scope:'FullAccess'})});
    guard(response.ok,`Backend authentication failed: HTTP ${response.status}. Secret/token values are not logged.`);
    const data=await response.json();
    guard(typeof data.access_token==='string','Authentication response contained no access token.');
    this.token=data.access_token; this.expires=Date.now()+((data.expires_in||600)-30)*1000;
  }
  async request(method,path,body,allow404=false) {
    guard(path.startsWith('/') && !path.startsWith('//') && !path.includes('://') && !path.includes('..'), 'Unsafe API path.');
    guard(['GET','POST'].includes(method),'This importer permits only GET and POST.');
    if (!this.token || Date.now()>=this.expires) await this.authenticate();
    let response;
    // Only safe GET reads are automatically retried. Never retry an uncertain write.
    for (let attempt=0;attempt<3;attempt++) {
      try { response=await this.fetch(`${SETTINGS.api}/v1${path}`,{method,redirect:'error',signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${this.token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}); }
      catch { throw new Error(`${method} ${path}: network timeout/failure. No automatic write retry; a later run will inspect existing state.`); }
      if (method==='GET' && [429,502,503,504].includes(response.status) && attempt<2) {await new Promise(r=>setTimeout(r,(attempt+1)*1500));continue;}
      break;
    }
    if (allow404 && response.status===404) return null;
    const text=await response.text(); let data=null;
    if (text) {try {data=JSON.parse(text);} catch {guard(false,`${method} ${path}: non-JSON API response (HTTP ${response.status}).`);}}
    if (!response.ok) {
      const errors=Array.isArray(data?.Errors)?data.Errors.map(x=>`${x.ErrorCode}: ${x.Message}`).join('; '):'Request failed';
      let message=`${method} ${path}: HTTP ${response.status}. ${errors}`;
      for (const value of [this.secret,this.token]) if(value) message=message.split(value).join('[redacted]');
      throw new Error(message);
    }
    return data;
  }
  async list(path) {
    const items=[];
    for (let page=1;page<=100;page++) {
      const data=await this.request('GET',`${path}${path.includes('?')?'&':'?'}pageSize=100&page=${page}`);
      guard(Array.isArray(data?.Items) && Number.isInteger(data?.Meta?.TotalPages),`Unexpected pagination shape: ${path}`);
      items.push(...data.Items);
      if(page>=data.Meta.TotalPages) return items;
    }
    throw new Error(`Pagination exceeded limit: ${path}`);
  }
}
