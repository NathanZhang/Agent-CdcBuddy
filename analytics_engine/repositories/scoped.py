"""Server-owned per-connection TEMP views; fact files remain read-only."""
import sqlite3
from pathlib import Path
from contextvars import ContextVar
ACTIVE_SCOPE=ContextVar('approved_scope',default=None)
DATE_COLUMNS={'fact_monitoring':'date_id','fact_pathogen_detection':'date_id','fact_insecticide_resistance':'date_id','fact_foodborne_case':'visit_date','fact_pathogen_molecular':'isolation_date','fact_food_sampling':'sample_date','fact_outbreak_event':'start_time','fact_water_monitoring':'monitoring_date','fact_sewage_monitoring':'monitoring_date','fact_air_climate_monitoring':'date','fact_river_basin_monitoring':'monitoring_date','fact_public_venue_inspection':'inspection_date','fact_env_alerts':'created_at','fact_death_registry':'death_date','fact_chronic_cases':'diagnosed_date','fact_injury_surveillance':'injury_time','fact_chronic_alerts':'created_at'}
DATE_COLUMNS.update({'fact_vector_exposure':'monitoring_date','fact_food_exposure':'exposure_date','fact_food_forecast_inputs':'monitoring_date','fact_env_raw_samples':'monitoring_date','fact_venue_scores':'inspection_date','fact_env_activity':'monitoring_date','fact_sewage_network':'monitoring_date','fact_env_mobile_tasks':'monitoring_date','fact_env_intervention_inputs':'monitoring_date','fact_chronic_followup':'monitoring_date','fact_injury_risk_inputs':'monitoring_date','fact_river_adjacency':'monitoring_date'})
def connect_scoped_readonly(path,scope,connection_factory=sqlite3.Connection):
 if not isinstance(scope,dict) or not scope.get('scopeFingerprint') or scope.get('domain') not in ('vector','foodborne','env','chronic') or not isinstance(scope.get('regionPaths'),list):raise ValueError('APPROVED_SCOPE_INVALID')
 connection=sqlite3.connect(f'{Path(path).resolve().as_uri()}?mode=ro',uri=True,factory=connection_factory)
 try:
  tables=[r[0] for r in connection.execute("SELECT name FROM sqlite_master WHERE type='table' AND (name GLOB 'fact_*' OR name GLOB 'dim_*')")]
  schemas={t:[r[1] for r in connection.execute(f'PRAGMA main.table_info("{t}")')] for t in tables}
  quote=lambda v:connection.execute('SELECT quote(?)',(str(v),)).fetchone()[0]
  dimensions={'category':('dim_species','species_id','category'),'speciesName':('dim_species','species_id','species_name'),'methodName':('dim_method','method_id','method_name'),'pathogenName':('dim_pathogen','pathogen_id','pathogen_name'),'pesticideName':('dim_pesticide','pesticide_id','pesticide_name')}
  if scope['domain']=='foodborne':
   for field in ('pathogenName','pathogen'):dimensions[field]=('dim_pathogen_type','pathogen_id','pathogen_name')
   dimensions['pathogenType']=('dim_pathogen_type','pathogen_id','category')
  direct={'pathogenType':'category','pathogen':'pathogen_name','category':'category','speciesName':'species_name','methodName':'method_name','pathogenName':'pathogen_name','pesticideName':'pesticide_name','diseaseName':'disease_name','basinName':'basin_name','pathogenId':'pathogen_id','clusterId':'cluster_id'}
  def condition(column,f):
   values=[quote(v) for v in f['values']]
   if column.strip(chr(34))=='pathogen_name':
    values=[quote(str(v).split(' (',1)[0].strip()) for v in f['values']]
    column=f"TRIM(SUBSTR({column},1,INSTR({column}||' (',' (')-1))"
   if f['operator']=='eq':return f'{column}={values[0]}'
   if f['operator']=='range':return f'{column} BETWEEN {values[0]} AND {values[1]}'
   if f['operator'] not in ('in','not_in'):raise ValueError('APPROVED_SCOPE_INVALID')
   return f"{column} {'NOT IN' if f['operator']=='not_in' else 'IN'} ({','.join(values)})"
  invalid_tables=set()
  for table,columns in schemas.items():
   constraints=[];city='city' if 'city' in columns else 'city_name' if 'city_name' in columns else None;district='district' if 'district' in columns else 'district_name' if 'district_name' in columns else None
   def geo(p,city_column=city,district_column=district):return ' AND '.join([f'"{city_column}"={quote(p["city"])}' if p.get('city') and city_column else '',f'"{district_column}"={quote(p["district"])}' if p.get('district') and district_column else '']).strip(' AND') or '1=1'
   includes=scope['regionPaths'];excludes=scope.get('excludePaths',[])
   if scope['domain']=='vector' and table.startswith('fact_') and 'location_id' in columns:
    constraints.append('location_id IN (SELECT location_id FROM main.dim_location WHERE ('+' OR '.join('('+geo(p,'city','district')+')' for p in includes)+'))')
    for p in excludes:constraints.append('location_id NOT IN (SELECT location_id FROM main.dim_location WHERE '+geo(p,'city','district')+')')
   elif city or district:
    constraints.append('('+' OR '.join('('+geo(p)+')' for p in includes)+')')
    constraints.extend('NOT ('+geo(p)+')' for p in excludes)
   elif table.startswith('fact_') and any(p.get('city') or p.get('district') for p in includes):invalid_tables.add(table)
   date=DATE_COLUMNS.get(table)
   if date in columns:
    if scope.get('from'):constraints.append(f'substr("{date}",1,10)>={quote(scope["from"])}')
    if scope.get('to'):constraints.append(f'substr("{date}",1,10)<={quote(scope["to"])}')
   for field,f in scope.get('filters',{}).items():
    if field in scope.get('parameterFilters',[]):continue
    targets=scope.get('filterTables',{}).get(field)
    if targets is not None and table not in targets:continue
    column=direct.get(field);dimension=dimensions.get(field)
    foreign='detected_pathogen_id' if table=='fact_food_sampling' and scope['domain']=='foodborne' else dimension[1] if dimension else None
    if column in columns:constraints.append(condition('"'+column+'"',f))
    elif dimension and foreign in columns:constraints.append(f'"{foreign}" IN (SELECT "{dimension[1]}" FROM main."{dimension[0]}" WHERE '+condition('"'+dimension[2]+'"',f)+')')
    elif table=='fact_food_exposure' and scope['domain']=='foodborne' and field in ('pathogen','pathogenName','pathogenType'):
     constraints.append('cluster_id IN (SELECT cluster_id FROM main.fact_foodborne_case WHERE pathogen_id IN (SELECT pathogen_id FROM main.dim_pathogen_type WHERE '+condition(dimension[2],f)+'))')
    elif scope['domain']=='vector' and field=='category' and 'species_name' in columns:
     constraints.append('species_name IN (SELECT species_name FROM main.dim_species WHERE '+condition('category',f)+')')
    elif table.startswith('fact_'):invalid_tables.add(table)
   allowed=scope.get('allowedColumns',{}).get(table,columns)
   if not allowed:continue
   if any(c not in columns for c in allowed):raise ValueError('INVALID_ALLOWED_COLUMN')
   projection=','.join('"'+c+'"' for c in allowed);connection.execute(f'CREATE TEMP VIEW "{table}" AS SELECT {projection} FROM main."{table}"'+(' WHERE '+' AND '.join(constraints) if constraints else ''))
  def authorize(action,table,column,database,source):
   if action==sqlite3.SQLITE_READ and table in invalid_tables:return sqlite3.SQLITE_DENY
   if action==sqlite3.SQLITE_READ and database=='main' and (table.startswith('fact_') or table.startswith('dim_')) and source not in schemas:return sqlite3.SQLITE_DENY
   if action in (sqlite3.SQLITE_INSERT,sqlite3.SQLITE_UPDATE,sqlite3.SQLITE_DELETE,sqlite3.SQLITE_ATTACH,sqlite3.SQLITE_DETACH):return sqlite3.SQLITE_DENY
   return sqlite3.SQLITE_OK
  connection.set_authorizer(authorize);return connection
 except BaseException:connection.close();raise
