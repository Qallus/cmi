/** Pure, dependency-free takeoff math and CSV utilities. No network or database writes. */
export const round = (n, digits = 2) => Math.round((n + Number.EPSILON) * 10 ** digits) / 10 ** digits;
export const money = n => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
export const amount = n => new Intl.NumberFormat('en-US', {maximumFractionDigits:2}).format(n);
export const uid = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function polygonArea(points) {
  if (points.length < 3) return 0;
  return Math.abs(points.reduce((s,p,i) => {const q=points[(i+1)%points.length];return s+p.x*q.y-q.x*p.y;},0))/2;
}
export function pathLength(points, closed = false) {
  let n=0; for(let i=1;i<points.length;i++) n+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
  return n+(closed && points.length>2 ? Math.hypot(points[0].x-points.at(-1).x,points[0].y-points.at(-1).y):0);
}
export function selfIntersects(points) {
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  for(let i=0;i<points.length;i++) for(let j=i+1;j<points.length;j++) {
    if(j===i+1 || (i===0 && j===points.length-1)) continue;
    const a=points[i],b=points[(i+1)%points.length],c=points[j],d=points[(j+1)%points.length];
    if(cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0) return true;
  }
  return false;
}
export function geometryQuantity(g, item, sheet) {
  if(g.kind==='count') return g.points.length;
  if(!sheet?.scale || sheet.scale<=0) return 0;
  const area=polygonArea(g.points)*sheet.scale*sheet.scale;
  if(g.kind==='area') return area;
  if(g.kind==='volume') return area*(item.depth || 0)/27; // feet cubed → cubic yards
  return pathLength(g.points)*sheet.scale;
}
export function itemQuantity(item, job) {
  const geometries=job.geometry.filter(g=>g.itemId===item.id);
  const measured=geometries.reduce((sum,g)=>sum+geometryQuantity(g,item,job.sheets.find(s=>s.id===g.sheetId))*(g.deduct?-1:1),0);
  return Math.max(0,(item.baseQty || 0)+measured);
}
export function itemCost(item, job) {
  const qty=itemQuantity(item,job), materialQty=qty*(1+item.waste/100);
  const material=round(materialQty*item.material), labor=round(qty*item.labor), equipment=round(qty*(item.equipment||0)), sub=round(qty*(item.sub||0));
  return {qty,materialQty,material,labor,equipment,sub,total:round(material+labor+equipment+sub)};
}
export function estimateTotals(job) {
  const lines=job.items.map(item=>({item,...itemCost(item,job)}));
  const material=round(lines.reduce((s,l)=>s+l.material,0));
  const labor=round(lines.reduce((s,l)=>s+l.labor,0));
  const equipment=round(lines.reduce((s,l)=>s+l.equipment,0));
  const sub=round(lines.reduce((s,l)=>s+l.sub,0));
  const direct=round(material+labor+equipment+sub);
  const tax=round(lines.reduce((s,l)=>s+(l.item.taxable ? l.material:0),0)*job.tax/100);
  const contingency=round(direct*job.contingency/100), basis=round(direct+tax+contingency);
  const rate=Math.max(0,Math.min(job.pricingMode==='margin'?99:1000,job.rate))/100;
  const price=round(job.pricingMode==='margin' ? basis/(1-rate) : basis*(1+rate));
  const profit=round(price-basis), margin=price>0?profit/price*100:0;
  return {lines,material,labor,equipment,sub,direct,tax,contingency,basis,price,profit,margin};
}
export function parseCSV(text) {
  if(text.length>10*1024*1024) throw new Error('Use a CSV smaller than 10 MB.');
  text=text.replace(/^\uFEFF/,'');
  const rows=[];let row=[],field='',quoted=false,afterQuote=false;
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(quoted) {
      if(ch==='"' && text[i+1]==='"'){field+='"';i++;}
      else if(ch==='"'){quoted=false;afterQuote=true;}
      else field+=ch;
    } else if(ch==='"') {if(field.trim() || afterQuote) throw new Error('Malformed CSV quotation.');quoted=true;}
    else if(ch===','){row.push(field);field='';afterQuote=false;}
    else if(ch==='\n' || ch==='\r') {if(ch==='\r' && text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';afterQuote=false;}
    else {if(afterQuote && ch.trim()) throw new Error('Unexpected characters after a quoted CSV value.');field+=ch;}
  }
  if(quoted)throw new Error('The CSV contains an unclosed quoted field.');
  row.push(field);if(row.some(v=>v.trim()))rows.push(row);
  if(rows.length<2)throw new Error('Include a header and at least one data row.');
  const headers=rows.shift().map(h=>h.trim());
  if(headers.some(h=>!h) || new Set(headers).size!==headers.length)throw new Error('CSV headers must be present and unique.');
  if(rows.length>10000)throw new Error('Prototype import limit: 10,000 rows.');
  rows.forEach((r,i)=>{if(r.length!==headers.length)throw new Error(`Row ${i+2}: expected ${headers.length} columns; found ${r.length}.`);});
  return {headers,rows};
}
export function numberCell(value, optional=false) {
  const s=String(value??'').trim().replace(/^\$/,'');
  if(optional && s==='')return 0;
  if(!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(s))throw new Error(`Not a non-negative number: ${value || '(empty)'}`);
  const n=Number(s.replaceAll(',','')); if(!Number.isFinite(n)||n>1e12)throw new Error('Number is outside the allowed range.');return n;
}
const UNIT_MAP={SF:'SF',SQFT:'SF','SQ FT':'SF','FT2':'SF','FT²':'SF',LF:'LF',FT:'LF','LIN FT':'LF',EA:'EA',EACH:'EA',COUNT:'EA',CY:'CY','CU YD':'CY','YD3':'CY','YD³':'CY'};
export function normalizeUnit(unit){return UNIT_MAP[String(unit??'').trim().toUpperCase()] || null;}
export function mapCSV(parsed,map) {
  const issues=[],results=[];
  for(let i=0;i<parsed.rows.length;i++){
    const row=parsed.rows[i], get=k=>map[k]===undefined||map[k]===''?'':row[Number(map[k])];
    try{
      const name=get('name').trim(); if(!name)throw new Error('Takeoff name is required.');
      const qty=numberCell(get('qty')),unit=normalizeUnit(get('unit'));if(!unit)throw new Error(`Unsupported unit “${get('unit')}”. Map to SF, LF, EA or CY; no implicit conversion.`);
      if(unit==='EA' && !Number.isInteger(qty))throw new Error('Each/count quantities must be whole numbers.');
      const material=numberCell(get('material'),true),labor=numberCell(get('labor'),true);
      results.push({row:i+2,name,qty,unit,material,labor,code:get('code')||'UNMAPPED',area:get('area')||'Not provided',raw:Object.fromEntries(parsed.headers.map((h,k)=>[h,row[k]]))});
    }catch(e){issues.push({row:i+2,message:e.message});}
  }
  return {results,issues};
}
export function csvCell(value){const s=String(value??'');const safe=/^[\s]*[=+@\-\t\r]/.test(s)?`'${s}`:s;return `"${safe.replaceAll('"','""')}"`;}
export const encodeCSV=rows=>'\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
/** SHA-256 fallback for offline/insecure-origin previews. Used only for duplicate
 * source detection, not authentication, passwords, signatures, or access control. */
export function sha256Bytes(bytes) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const padded=new Uint8Array(Math.ceil((bytes.length+9)/64)*64);padded.set(bytes);padded[bytes.length]=128;
  const view=new DataView(padded.buffer);view.setBigUint64(padded.length-8,BigInt(bytes.length)*8n,false);
  const R=(x,n)=>(x>>>n)|(x<<(32-n)), W=new Uint32Array(64);
  for(let start=0;start<padded.length;start+=64) {
    for(let i=0;i<16;i++)W[i]=view.getUint32(start+4*i,false);
    for(let i=16;i<64;i++){const x=W[i-15],y=W[i-2],s0=R(x,7)^R(x,18)^(x>>>3),s1=R(y,17)^R(y,19)^(y>>>10);W[i]=(W[i-16]+s0+W[i-7]+s1)>>>0;}
    let [a,b,c,d,e,f,g,h]=H;
    for(let i=0;i<64;i++){const t1=(h+(R(e,6)^R(e,11)^R(e,25))+((e&f)^(~e&g))+K[i]+W[i])>>>0,t2=((R(a,2)^R(a,13)^R(a,22))+((a&b)^(a&c)^(b&c)))>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    [a,b,c,d,e,f,g,h].forEach((v,i)=>H[i]=(H[i]+v)>>>0);
  }
  return H.map(n=>n.toString(16).padStart(8,'0')).join('');
}
export async function fingerprint(text) {
  const bytes=new TextEncoder().encode(text);
  if(!globalThis.crypto?.subtle)return sha256Bytes(bytes);
  const buf=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(buf)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function downloadFile(name,content,type='text/plain') {
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
