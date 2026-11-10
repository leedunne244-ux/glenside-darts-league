const ExcelJS = require('exceljs');
const { Buffer } = require('node:buffer');

const clean = v => v == null ? '' : typeof v === 'object' ? (v.result ?? v.text ?? '') : v;
const value = (sheet, row, col) => clean(sheet.getRow(row).getCell(col).value);
const numeric = x => x !== '' && x != null && Number.isFinite(Number(x)) ? Number(x) : null;
const json = (statusCode, payload) => ({statusCode, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}, body:JSON.stringify(payload)});

async function downloadWorkbook(link) {
  const url = new URL(link);
  if (!['https:'].includes(url.protocol) || !['1drv.ms','onedrive.live.com'].includes(url.hostname.toLowerCase())) {
    throw new Error('Only HTTPS personal OneDrive links are supported');
  }
  const candidates = [];
  const direct = new URL(url);
  direct.searchParams.set('download','1');
  candidates.push(direct.toString());
  candidates.push(url.toString());
  let last = 'OneDrive did not return an XLSX file';
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate,{redirect:'follow',signal:AbortSignal.timeout(15000),headers:{'Accept':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream;q=0.9,*/*;q=0.1'}});
      if (!response.ok) {last=`OneDrive HTTP ${response.status}`;continue;}
      const len = Number(response.headers.get('content-length')||0);
      if (len>8000000) throw new Error('Workbook exceeds 8 MB');
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length>8000000) throw new Error('Workbook exceeds 8 MB');
      if (buffer[0]===0x50 && buffer[1]===0x4b) return buffer;
      last='OneDrive returned a webpage, not XLSX data';
    } catch(e) {last=e.message;}
  }
  throw new Error(last);
}

exports.handler = async () => {
  const link = process.env.ONEDRIVE_DOWNLOAD_URL;
  if (!link) return json(503,{error:'NOT_CONFIGURED',detail:'Add ONEDRIVE_DOWNLOAD_URL in Netlify environment variables and redeploy.'});
  try {
    const buffer=await downloadWorkbook(link);
    const workbook=new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const playersSheet=workbook.getWorksheet('PLAYERS');
    const fixtures=workbook.getWorksheet('FIXTURES & RESULTS');
    if (!playersSheet||!fixtures) throw new Error('Missing PLAYERS or FIXTURES & RESULTS worksheet');
    const players=[];
    for(let r=5;r<=20;r++) {
      const name=String(value(playersSheet,r,2)||'').trim();
      if(name) players.push({name,points:0,won:0,lost:0,legDiff:0,legsWon:0,legsLost:0,played:0});
    }
    const byName=new Map(players.map(p=>[p.name.toLocaleLowerCase(),p]));
    const headToHead=new Map();
    let completed=0;
    for(let r=6;r<=Math.max(125,fixtures.rowCount);r++) {
      const aName=String(value(fixtures,r,4)||'').trim();
      const bName=String(value(fixtures,r,5)||'').trim();
      const a=byName.get(aName.toLocaleLowerCase());
      const b=byName.get(bName.toLocaleLowerCase());
      if(!a||!b||a===b) continue;
      const walkover=String(value(fixtures,r,8)||'').trim().toLowerCase();
      const x=numeric(value(fixtures,r,6)),y=numeric(value(fixtures,r,7));
      if(walkover==='walkover a'||walkover==='walkover b') {
        const winner=walkover==='walkover a'?a:b,loser=winner===a?b:a;
        winner.points+=2;winner.won++;winner.played++;loser.lost++;loser.played++;completed++;
        headToHead.set(`${winner.name}|${loser.name}`,true);
      } else if(x!==null&&y!==null&&((x===2&&(y===0||y===1))||(y===2&&(x===0||x===1)))) {
        a.legsWon+=x;a.legsLost+=y;b.legsWon+=y;b.legsLost+=x;
        a.legDiff+=x-y;b.legDiff+=y-x;a.played++;b.played++;
        const winner=x===2?a:b,loser=x===2?b:a;
        winner.won++;winner.points+=3;loser.lost++;
        if(Math.min(x,y)===1) loser.points++;
        completed++;headToHead.set(`${winner.name}|${loser.name}`,true);
      }
    }
    players.sort((a,b)=>b.points-a.points||b.won-a.won||b.legDiff-a.legDiff||b.legsWon-a.legsWon||(headToHead.has(`${a.name}|${b.name}`)?-1:headToHead.has(`${b.name}|${a.name}`)?1:0));
    return json(200,{table:players.map((p,i)=>({position:i+1,...p})),completed,scheduled:players.length*(players.length-1)/2,updatedAt:new Date().toISOString()});
  } catch(e) {
    console.error('Standings connection error:',e.message);
    return json(502,{error:'WORKBOOK_UNAVAILABLE',detail:e.message});
  }
};
