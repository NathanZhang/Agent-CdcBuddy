"""CI engineering fixtures. ALL domains, including vector, are explicitly Mock."""
import argparse,json,sqlite3,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];p=argparse.ArgumentParser();p.add_argument('--output-dir',type=Path,required=True);args=p.parse_args();args.output_dir.mkdir(parents=True,exist_ok=False);db=args.output_dir/'vector.db';c=sqlite3.connect(db);c.executescript((root/'tests/fixtures/vector-schema.sql').read_text())
locations=[('l','郑州市','金水区','Mock监测点',34,113),('xz','郑州市','新郑市','Mock新郑点',34.4,113.7),('xy','郑州市','荥阳市','Mock荥阳点',34.8,113.4),('pd','平顶山市','新华区','Mock平顶山点',33.7,113.3)]
for location in locations:c.execute("INSERT INTO dim_location(location_id,province,city,district,street,latitude,longitude) VALUES(?,'河南省',?,?,?,?,?)",location)
c.executemany('INSERT INTO dim_species VALUES(?,?,?,?)',[('s','蚊','白纹伊蚊','mock-aedes'),('fly','蝇','家蝇','mock-musca'),('cockroach','蟑螂','德国小蠊','mock-blattella')]);c.execute("INSERT INTO dim_method VALUES('m','诱蚊灯法')");c.executemany('INSERT INTO dim_pathogen VALUES(?,?)',[('p','测试病原'),('dengue','登革病毒')]);c.execute("INSERT INTO dim_pesticide VALUES('a','测试药','mock')")
for year in range(2019,2026):
 for month in range(1,13):
  d=f'{year}-{month:02d}-15';c.execute('INSERT INTO dim_date VALUES(?,?,?,?,?)',(d,year,month,15,'Mock'))
  c.execute('INSERT INTO fact_monitoring(monitoring_id,date_id,location_id,species_id,method_id,capture_count,sampling_unit,weather_temp,weather_humidity,source_file) VALUES(?,?,?,?,?,?,?,?,?,?)',(d,d,'l','s','m',month+year-2019,1,20,60,'synthetic-ci-fixture'))
# Small, explicit Mock records cover supported recommendation scenes and geography binding.
for location in ['xz','xy','pd']:
 c.execute('INSERT INTO fact_monitoring(monitoring_id,date_id,location_id,species_id,method_id,capture_count,sampling_unit,source_file) VALUES(?,?,?,?,?,?,?,?)',('extra-'+location,'2022-06-15',location,'s','m',4,1,'synthetic-ci-fixture'))
c.execute("INSERT INTO fact_pathogen_detection(detection_id,location_id,date_id,species_id,pathogen_id,tested_count,positive_groups,total_groups,pcr_result,source_file) VALUES('dengue-2024','l','2024-06-15','s','dengue',10,2,10,'阳性','synthetic-ci-fixture')")
for species in ['fly','cockroach']:
 c.execute('INSERT INTO fact_insecticide_resistance(resistance_id,species_id,pesticide_id,location_id,date_id,corrected_mortality,resistance_level,source_file) VALUES(?,?,?,?,?,?,?,?)',('resistance-'+species,species,'a','l','2025-01-15',100,'敏感','synthetic-ci-fixture'))
c.execute("INSERT INTO fact_pathogen_detection(detection_id,location_id,date_id,species_id,pathogen_id,tested_count,positive_groups,total_groups,pcr_result) VALUES('d','l','2025-01-15','s','p',10,0,10,'阴性')");c.execute("INSERT INTO fact_insecticide_resistance(resistance_id,species_id,pesticide_id,location_id,date_id,corrected_mortality,resistance_level) VALUES('r','s','a','l','2025-01-15',100,'敏感')");c.commit();c.close()
manifest=[]
for domain in ['vector','foodborne','env','chronic']:
 output=db if domain=='vector' else args.output_dir/(domain+'.db')
 if domain!='vector':subprocess.run([sys.executable,str(root/f'scripts/init_{domain}_mock.py'),'--output',str(output),'--seed','7'],check=True,stdout=subprocess.DEVNULL)
 manifest.append({'id':domain+'-monitoring','domain':domain,'origin':'mock','version':'synthetic-ci-v1','schemaVersion':'1','asOf':'2026-10-12','path':str(output.resolve())})
(args.output_dir/'manifest.json').write_text(json.dumps(manifest));print('CI fixtures generated: all origins mock')

# Version-specific source spellings and CRS belong to this synthetic fixture, not production snapshots.
catalog=json.loads((root/'config/regions.json').read_text());bindings={}
for entry in manifest:
 domain=entry['domain'];connection=sqlite3.connect(entry['path']);pairs=set()
 for table, in connection.execute("SELECT name FROM sqlite_master WHERE type='table' AND (name GLOB 'dim_*' OR name GLOB 'fact_*')"):
  cols=[row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')]
  if 'city' in cols:
   pairs.update(connection.execute(f'SELECT DISTINCT city,{"district" if "district" in cols else "NULL"} FROM "{table}"'))
 connection.close();regions=[{'code':'410000'}]
 for region in catalog['regions']:
  if region['level']=='province':continue
  if region['level']=='city':
   names=[city for city,district in pairs if city in region['aliases']]
   if names:regions.append({'code':region['code'],'city':sorted(set(names))[0]})
  else:
   parent=next((r for r in catalog['regions'] if r['code']==region['parentCode']),None)
   matches=[(city,district) for city,district in pairs if parent and city in parent['aliases'] and district in region['aliases']]
   if matches:city,district=sorted(matches)[0];regions.append({'code':region['code'],'city':city,'district':district})
 bindings[domain]={'datasetVersion':entry['version'],'mappingVersion':'synthetic-ci-source-names-v1','sourceCRS':'EPSG:4326','coordinateEvidence':'Declared synthetic CI coordinates, not observed records','regions':regions}
(args.output_dir/'region-bindings.json').write_text(json.dumps(bindings,ensure_ascii=False))
