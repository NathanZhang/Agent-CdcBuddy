export type ImplementationStatus='planned'|'partial'|'implemented';
export type ValidationStatus='unvalidated'|'contract'|'observed-backtest';
export const implementationLabels:Record<ImplementationStatus,string>={planned:'尚未实现',partial:'部分实现',implemented:'当前功能已实现'};
export const validationLabels:Record<ValidationStatus,string>={unvalidated:'尚未验证',contract:'工程契约已验证，专业效果未验收','observed-backtest':'已做实测历史回测，专业指标未验收'};
