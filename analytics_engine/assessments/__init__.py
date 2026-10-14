"""Domain methods share fitting and scoping. Missing model inputs stay explicit."""
import sqlite3
import pandas as pd

def execute(domain, db, args):
    from . import vector, foodborne, environment, chronic, signals
    try:
        if args.get('analysis') in ('signals','advice'):
            return signals.assess(domain,db,args)
        return {'vector':vector,'foodborne':foodborne,'env':environment,'chronic':chronic}[domain].assess(db,args)
    except (ValueError,sqlite3.OperationalError,pd.errors.DatabaseError) as error:
        message=str(error)
        if 'REQUIRES_' in message or message.endswith('_REQUIRED') or 'no such table:' in message:
            return {'status':'INSUFFICIENT_DATA','method':domain+'-assessment-inputs-v1','reason':message,'qualityFlags':['model-inputs-missing-no-fabricated-estimate']}
        raise
