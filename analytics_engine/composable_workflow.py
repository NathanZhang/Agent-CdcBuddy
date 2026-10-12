"""Legacy graph cannot execute arbitrary IDs or bypass main Agent/Skills authorization."""
def run_dynamic_composable_workflow(db_path,workflow_name=None,steps=None,initial_context=None):
 return {'status':'FAILED','success':False,'payload':None,'method':'legacy-composable-unavailable','step_results':{},'qualityFlags':['main-agent-workflow-required'],'error':{'code':'CAPABILITY_UNAVAILABLE','message':'旧组合图缺少统一 Skill 校验和持久审批；请使用主线 Agent 的已验证技能或持久工作流','retryable':False}}
