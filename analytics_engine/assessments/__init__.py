"""Domain methods share fitting and scoping. Missing model inputs stay explicit."""
import sqlite3
import pandas as pd
from analytics_engine.input_errors import input_failure

def execute(domain, db, args):
    from . import vector, foodborne, environment, chronic, signals
    try:
        if args.get('analysis') in ('signals','advice'):
            return signals.assess(domain,db,args)
        return {'vector':vector,'foodborne':foodborne,'env':environment,'chronic':chronic}[domain].assess(db,args)
    except (ValueError,sqlite3.OperationalError,pd.errors.DatabaseError) as error:
        failure=input_failure(error)
        if failure:return {**failure,'method':domain+'-assessment-inputs-v1'}
        raise
