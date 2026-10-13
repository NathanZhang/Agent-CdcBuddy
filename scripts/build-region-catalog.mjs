import fs from 'node:fs';
import crypto from 'node:crypto';
const assets={province:'henan province border.geojson',city:'henan city border.geojson',county:'henan county border.geojson'};
const regions=[],resources=[];
const bbox=geometry=>{const points=[];const walk=v=>{if(Array.isArray(v)&&typeof v[0]==='number')points.push(v);else if(Array.isArray(v))v.forEach(walk);};walk(geometry.coordinates);if(!points.length)throw Error('Missing geometry');return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];};
for(const [level,filename] of Object.entries(assets)){
 const raw=fs.readFileSync(`public/geo/${filename}`),collection=JSON.parse(raw);
 const assetId=`henan-${level}`;resources.push({assetId,filename,sha256:crypto.createHash('sha256').update(raw).digest('hex'),featureCount:collection.features.length});
 for(const f of collection.features){const gb=String(f.properties.gb);if(!/^156[0-9]{6}$/.test(gb))throw Error('Invalid source gb');const code=gb.slice(3);
 // Jiyuan occurs in both source files; the explicit city-level directory entry owns it.
 if(level==='county'&&code==='419001')continue;
 const name=f.properties.name,aliases=[name];if(level==='city'&&name.endsWith('市'))aliases.push(name.slice(0,-1));if(level==='province')aliases.push('河南','全省','全域','全省全景','河南省全域');if(level==='county'&&/[市县区]$/.test(name))aliases.push(name.slice(0,-1));
 regions.push({code,name,level,parentCode:level==='province'?null:level==='city'?'410000':code.slice(0,4)+'00',aliases,assetId,sourceId:gb,bbox:bbox(f.geometry)});
 }
}
fs.writeFileSync('config/regions.json',JSON.stringify({schemaVersion:1,version:'local-boundaries-2026-10-13-v1',source:'existing-repository-boundaries; not current nationwide coverage',resources,regions},null,2)+'\n');
