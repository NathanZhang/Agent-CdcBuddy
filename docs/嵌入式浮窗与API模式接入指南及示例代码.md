# CdcBuddy 嵌入式浮窗与 API 模式接入指南及示例代码

CdcBuddy 智能体支持以**轻量化浮窗 (AI Copilot Widget)** 或 **API 接口** 形式无缝嵌入至现有的疾控业务信息系统（如传染病报告系统、突发公共卫生应急指挥平台、实验室 LIMS 系统等）。

---

## 一、 接入方式一：单行 Script 免编译快速引入 (推荐)

在现有业务系统的任意 HTML 页面（`index.html` 或 JSP / PHP / ASP 模板）底部的 `</body>` 标签前添加如下单行脚本：

```html
<!-- 引入 CdcBuddy 智能体嵌入式浮窗 -->
<script 
  src="http://localhost:3000/cdc-buddy-embed.js" 
  data-server="http://localhost:3000" 
  data-token="USER_JWT_TOKEN_HERE"
  async>
</script>
```

### 参数说明：
* `data-server`: CdcBuddy 智能体后台服务地址（如 `https://cdc-buddy.example.gov.cn`）。
* `data-token`: 当前宿主业务系统的登录用户凭证或 JWT Token。智能体会自动解析用户的角色（省级管理员 / 市级专家 / 区县监测员）与管辖行政区划。

---

## 二、 接入方式二：React / Next.js 组件化原生引入

如果在现代前端框架（React / Next.js）中集成，可直接导入 `<EmbeddedWidget />` 组件：

```tsx
import React from 'react';
import { EmbeddedWidget } from '@/components/layout/EmbeddedWidget';

export default function BusinessApp() {
  return (
    <div className="relative min-h-screen bg-white">
      {/* 宿主业务系统已有页面内容 */}
      <h1 className="text-xl font-bold p-6">疾控业务信息管理系统</h1>
      
      {/* 挂载 CdcBuddy 右下角智能助手浮窗 */}
      <EmbeddedWidget 
        theme="dark"
        onSendMessage={(userMessage) => {
          console.log('用户向智能体下发了指令:', userMessage);
        }}
      />
    </div>
  );
}
```

---

## 三、 接入方式三：Vue 3 原生组件引入

在 Vue 3 工程中，可通过 Iframe 容器组件优雅包装：

```vue
<template>
  <div class="cdc-assistant-wrapper">
    <!-- 悬浮触发圆形按钮 -->
    <button class="float-btn" @click="isOpen = !isOpen">
      🛡️ CdcBuddy
    </button>

    <!-- 浮窗 Iframe 对话容器 -->
    <div v-if="isOpen" class="assistant-popup">
      <iframe 
        :src="`${cdcServerUrl}?mode=embedded&token=${userToken}`" 
        class="assistant-iframe"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const isOpen = ref(false);
const cdcServerUrl = 'http://localhost:3000';
const userToken = 'eyJhbGciOiJIUzI1NiIsIn...'; // 宿主系统的登录Token
</script>

<style scoped>
.cdc-assistant-wrapper {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
}
.float-btn {
  padding: 12px 20px;
  border-radius: 30px;
  background: linear-gradient(135deg, #0284c7, #06b6d4);
  color: white;
  font-weight: bold;
  border: 2px solid #38bdf8;
  cursor: pointer;
  box-shadow: 0 10px 25px rgba(2, 132, 199, 0.4);
}
.assistant-popup {
  width: 420px;
  height: 580px;
  margin-bottom: 12px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0,0,0,0.4);
}
.assistant-iframe {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
```

---

## 四、 跨域与安全性保障 (CORS & CSP)

1. **跨域配置**：CdcBuddy 接口服务在生产环境中已配置 `Access-Control-Allow-Origin: *` 与 `X-Frame-Options: SAMEORIGIN / ALLOW-FROM`；
2. **Token 安全**：通过 Header `Authorization: Bearer <Token>` 进行接口鉴权，确保不同市县监测员只能调取其辖区内的病媒监测数据。
