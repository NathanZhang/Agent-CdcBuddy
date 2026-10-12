"""CI engineering fixtures. ALL domains, including vector, are explicitly Mock."""
import argparse,json,sqlite3,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];p=argparse.ArgumentParser();p.add_argument('--output-dir',type=Path,required=True);args=p.parse_args();args.output_dir.mkdir(parents=True,exist_ok=False);db=args.output_dir/'vector.db';c=sqlite3.connect(db);c.executescript((root/'tests/fixtures/vector-schema.sql').read_text())
c.execute("INSERT INTO dim_location(location_id,city,district,street,latitude,longitude) VALUES('l','郑州市','金水区','Mock监测点',34,113)");c.execute("INSERT INTO dim_species VALUES('s','蚊','白纹伊蚊','mock-aedes')");c.execute("INSERT INTO dim_method VALUES('m','诱蚊灯法')");c.execute("INSERT INTO dim_pathogen VALUES('p','测试病原')");c.execute("INSERT INTO dim_pesticide VALUES('a','测试药','mock')")
for year in range(2019,2026):
 for month in range(1,13):
  d=f'{year}-{month:02d}-15';c.execute('INSERT INTO dim_date VALUES(?,?,?,?,?)',(d,year,month,15,'Mock'))
  c.execute('INSERT INTO fact_monitoring(monitoring_id,date_id,location_id,species_id,method_id,capture_count,sampling_unit,weather_temp,weather_humidity,source_file) VALUES(?,?,?,?,?,?,?,?,?,?)',(d,d,'l','s','m',month+year-2019,1,20,60,'synthetic-ci-fixture'))
c.execute("INSERT INTO fact_pathogen_detection(detection_id,location_id,date_id,species_id,pathogen_id,tested_count,positive_groups,total_groups,pcr_result) VALUES('d','l','2025-01-15','s','p',10,0,10,'阴性')");c.execute("INSERT INTO fact_insecticide_resistance(resistance_id,species_id,pesticide_id,location_id,date_id,corrected_mortality,resistance_level) VALUES('r','s','a','l','2025-01-15',100,'敏感')");c.commit();c.close()
manifest=[]
for domain in ['vector','foodborne','env','chronic']:
 output=db if domain=='vector' else args.output_dir/(domain+'.db')
 if domain!='vector':subprocess.run([sys.executable,str(root/f'scripts/init_{domain}_mock.py'),'--output',str(output),'--seed','7'],check=True,stdout=subprocess.DEVNULL)
 manifest.append({'id':domain+'-monitoring','domain':domain,'origin':'mock','version':'synthetic-ci-v1','schemaVersion':'1','asOf':'2026-10-12','path':str(output.resolve())})
(args.output_dir/'manifest.json').write_text(json.dumps(manifest));print('CI fixtures generated: all origins mock')
