/**
 * CdcBuddy Vector Guard - 嵌入式业务系统浮窗接入 SDK
 * 适用于任何 HTML / Vue / React / Angular 业务系统
 * 
 * 使用方式:
 * <script src="http://localhost:3000/cdc-buddy-embed.js" data-server="http://localhost:3000" data-token="YOUR_USER_TOKEN"></script>
 */
(function() {
  const currentScript = document.currentScript;
  const serverUrl = (currentScript && currentScript.getAttribute('data-server')) || window.location.origin;
  const userToken = (currentScript && currentScript.getAttribute('data-token')) || 'ANONYMOUS';

  // 创建嵌入式浮窗容器
  const container = document.createElement('div');
  container.id = 'cdc-buddy-embed-root';
  container.style.position = 'fixed';
  container.style.bottom = '24px';
  container.style.right = '24px';
  container.style.zIndex = '999999';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // 悬浮按钮
  const btn = document.createElement('button');
  btn.innerHTML = '🛡️ <span style="margin-left:4px;">CdcBuddy 疾控助手</span>';
  btn.style.padding = '12px 18px';
  btn.style.borderRadius = '30px';
  btn.style.background = 'linear-gradient(135deg, #0284c7, #06b6d4)';
  btn.style.color = '#ffffff';
  btn.style.border = '2px solid #38bdf8';
  btn.style.fontWeight = 'bold';
  btn.style.fontSize = '14px';
  btn.style.cursor = 'pointer';
  btn.style.boxShadow = '0 10px 25px -5px rgba(2, 132, 199, 0.5)';
  btn.style.transition = 'all 0.3s ease';

  // 弹窗 iframe
  const iframeWrapper = document.createElement('div');
  iframeWrapper.style.display = 'none';
  iframeWrapper.style.width = '420px';
  iframeWrapper.style.height = '580px';
  iframeWrapper.style.marginBottom = '12px';
  iframeWrapper.style.borderRadius = '16px';
  iframeWrapper.style.overflow = 'hidden';
  iframeWrapper.style.boxShadow = '0 20px 40px -10px rgba(0,0,0,0.6)';
  iframeWrapper.style.border = '1px solid rgba(56, 189, 248, 0.3)';

  const iframe = document.createElement('iframe');
  iframe.src = `${serverUrl}?mode=embedded&token=${encodeURIComponent(userToken)}`;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframeWrapper.appendChild(iframe);

  let isOpen = false;
  btn.onclick = function() {
    isOpen = !isOpen;
    iframeWrapper.style.display = isOpen ? 'block' : 'none';
  };

  container.appendChild(iframeWrapper);
  container.appendChild(btn);
  document.body.appendChild(container);
  console.log('[CdcBuddy] 疾控病媒智能体嵌入式浮窗已成功注入宿主系统');
})();
