"""Shared deterministic fitting, chronological validation and bounded data access.

Metrics describe held-out rows from the selected dataset, never clinical validation.
"""
import calendar
import numpy as np
import pandas as pd
from analytics_engine.repositories.datasets import connect_readonly


def frame(db, table, args, date_column=None):
    # Table names are constants supplied by domain code, never request values.
    with connect_readonly(db) as c:
        df = pd.read_sql_query('SELECT * FROM '+table, c)
    for key in ('city', 'district'):
        if args.get(key) and key in df: df = df[df[key] == args[key]]
    end = args.get('to') or args.get('asOf')
    if date_column and date_column in df:
        if args.get('from'): df = df[df[date_column].str[:10] >= args['from']]
        if end: df = df[df[date_column].str[:10] <= end]
    return df.reset_index(drop=True)


def records(df, limit=200):
    return df.head(limit).replace({np.nan: None}).to_dict('records')


def result(method, **data):
    return {'status': 'SUCCESS', 'method': method, 'qualityFlags': ['dataset-specific-validation-not-external-validation'], **data}


def metrics(actual, predicted):
    a, p = np.asarray(actual, dtype=float), np.asarray(predicted, dtype=float)
    nz = np.abs(a) > 1e-9
    return {'mae': float(np.mean(abs(a-p))), 'rmse': float(np.sqrt(np.mean((a-p)**2))),
            'mapePercent': float(np.mean(abs((a[nz]-p[nz])/a[nz]))*100) if nz.any() else None,
            'testRows': len(a)}


def forecast(periods, values, horizon=3, model='lstm', exogenous=None):
    """Chronological holdout; scaling and all parameters fit on training only.

    LSTM forecasts are recursive; future covariates use last known values, explicitly
    recorded. No future observed values are consumed in the validation recursion.
    """
    y = np.asarray(values, dtype=float)
    if len(y) < 18 or not np.isfinite(y).all(): raise ValueError('FORECAST_REQUIRES_18_FINITE_PERIODS')
    if not 1 <= horizon <= 12: raise ValueError('FORECAST_HORIZON_INVALID')
    periods = list(map(str, periods)); holdout = min(6, max(3, len(y)//5))
    x = np.asarray(exogenous, dtype=float) if exogenous is not None else np.zeros((len(y), 0))
    if len(x) != len(y) or not np.isfinite(x).all(): raise ValueError('INVALID_EXOGENOUS_HISTORY')
    def fit_predict(target, covariates, steps):
        if model == 'arima':
            from statsmodels.tsa.arima.model import ARIMA
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter('ignore')
                fitted = ARIMA(target, order=(1,1,1)).fit()
                return np.maximum(0, np.asarray(fitted.forecast(steps))), None
        if model == 'gbdt':
            from sklearn.ensemble import GradientBoostingRegressor
            series=list(target); X=[]; Y=[]
            def features(i, last, previous, cov): return [last,previous,np.sin(2*np.pi*i/12),np.cos(2*np.pi*i/12),*cov]
            for i in range(2,len(series)): X.append(features(i,series[i-1],series[i-2],covariates[i-1])); Y.append(series[i])
            fitted=GradientBoostingRegressor(n_estimators=60,max_depth=2,random_state=42).fit(X,Y)
            for _ in range(steps):series.append(max(0,float(fitted.predict([features(len(series),series[-1],series[-2],covariates[-1])])[0])))
            return np.array(series[-steps:]), fitted.feature_importances_.tolist()
        if model != 'lstm': raise ValueError('UNKNOWN_FORECAST_MODEL')
        import torch
        torch.set_num_threads(1); torch.manual_seed(42)
        seq=6; raw=np.column_stack([target,covariates]); mean=raw.mean(axis=0); scale=raw.std(axis=0); scale[scale<1e-8]=1
        normalized=(raw-mean)/scale
        X=torch.tensor(np.array([normalized[i-seq:i] for i in range(seq,len(raw))]),dtype=torch.float32)
        Y=torch.tensor(normalized[seq:,0,None],dtype=torch.float32)
        class LSTM(torch.nn.Module):
            def __init__(self):
                super().__init__(); self.recurrent=torch.nn.LSTM(raw.shape[1],12,batch_first=True); self.head=torch.nn.Linear(12,1)
            def forward(self,z): return self.head(self.recurrent(z)[0][:,-1,:])
        net=LSTM(); optimizer=torch.optim.Adam(net.parameters(),lr=.025)
        for _ in range(100):
            optimizer.zero_grad(); loss=torch.nn.functional.mse_loss(net(X),Y); loss.backward(); torch.nn.utils.clip_grad_norm_(net.parameters(),1); optimizer.step()
        history=list(normalized); predictions=[]; net.eval()
        with torch.no_grad():
            for _ in range(steps):
                value=float(net(torch.tensor(np.array(history[-seq:])[None,:,:],dtype=torch.float32))[0,0])
                prediction=max(0,value*scale[0]+mean[0]); predictions.append(prediction)
                history.append(np.r_[(prediction-mean[0])/scale[0],normalized[-1,1:]])
        return np.array(predictions), None
    validation,_ = fit_predict(y[:-holdout],x[:-holdout],holdout)
    predicted, importance = fit_predict(y,x,horizon)
    end=pd.Timestamp(periods[-1]); monthly=len(periods[-1])==7
    future=[(end+pd.DateOffset(months=i)).strftime('%Y-%m') if monthly else (end+pd.Timedelta(days=i)).strftime('%Y-%m-%d') for i in range(1,horizon+1)]
    return {'model':model.upper(),'history':[{'period':p,'value':float(v)} for p,v in zip(periods,y)],
            'forecasts':[{'period':p,'value':float(v)} for p,v in zip(future,predicted)],
            'validation':{'strategy':'chronological-recursive-holdout','trainEnd':periods[-holdout-1],**metrics(y[-holdout:],validation),
                          'rows':[{'period':p,'actual':float(a),'predicted':float(v)} for p,a,v in zip(periods[-holdout:],y[-holdout:],validation)]},
            'training':{'start':periods[0],'end':periods[-1],'rows':len(y),'seed':42,'epochs':100 if model=='lstm' else None},
            'featureImportance':importance,'futureCovariates':'last-observed-value persistence; no future observations'}


def classifier(df, features, target, kind='gbdt'):
    from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
    from sklearn.tree import DecisionTreeClassifier, export_text
    from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix
    X=pd.get_dummies(df[features],dtype=float).fillna(0); y=df[target]; split=int(len(df)*.75)
    if split<12 or y.iloc[:split].nunique()<2: raise ValueError('CLASSIFIER_REQUIRES_TWO_CLASSES_AND_16_ROWS')
    constructor={'gbdt':lambda:GradientBoostingClassifier(n_estimators=60,max_depth=2,random_state=42),
                 'rf':lambda:RandomForestClassifier(n_estimators=60,max_depth=4,random_state=42),
                 'tree':lambda:DecisionTreeClassifier(max_depth=4,min_samples_leaf=5,random_state=42)}[kind]
    model=constructor().fit(X.iloc[:split],y.iloc[:split]); p=model.predict(X.iloc[split:])
    validation={'strategy':'ordered-75/25-holdout','trainRows':split,'testRows':len(y)-split,
                'accuracy':float(accuracy_score(y.iloc[split:],p)), 'balancedAccuracy':float(balanced_accuracy_score(y.iloc[split:],p)),
                'labels':list(map(str,model.classes_)), 'confusionMatrix':confusion_matrix(y.iloc[split:],p,labels=model.classes_).tolist()}
    tree=export_text(model,feature_names=list(X.columns)) if kind=='tree' else None
    model=constructor().fit(X,y)
    return model, X, {'validation':validation,'features':list(X.columns),'featureImportance':model.feature_importances_.tolist(),'decisionTree':tree}
