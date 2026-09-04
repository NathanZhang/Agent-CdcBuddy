#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Agent-CdcBuddy 技术架构图生成器 (SVG + 高清 PNG)
参考用户上传的规范分层架构图风格，生成符合项目实际技术栈的高保真架构图。
"""

import os
import shutil
from PIL import Image, ImageDraw, ImageFont

# 目标路径
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_IMG_DIR = os.path.join(BASE_DIR, "docs", "images")
os.makedirs(DOCS_IMG_DIR, exist_ok=True)

SVG_PATH = os.path.join(DOCS_IMG_DIR, "architecture.svg")
PNG_PATH = os.path.join(DOCS_IMG_DIR, "architecture.png")

ARTIFACT_DIR = "/Users/nathanzhang/.gemini/antigravity/brain/2d004ad2-1f58-4273-afe8-2ba83e35264a"

# ==========================================
# 1. 生成纯矢量 SVG 文件
# ==========================================
def generate_svg():
    svg_content = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1340 1140" width="1340" height="1140">
  <defs>
    <!-- 滤镜与渐变定义 -->
    <filter id="softShadow" x="-5%" y="-5%" width="110%" height="115%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0a2a44" flood-opacity="0.08"/>
    </filter>
    <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="118%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#194868" flood-opacity="0.18"/>
    </filter>
    <filter id="tagShadow" x="-5%" y="-5%" width="110%" height="118%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#b82622" flood-opacity="0.25"/>
    </filter>

    <!-- 红色渐变标签 -->
    <linearGradient id="redTagGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fa6d6a"/>
      <stop offset="100%" stop-color="#e74c48"/>
    </linearGradient>

    <!-- 蓝色卡片渐变 (默认) -->
    <linearGradient id="blueCardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#c9e8fc"/>
      <stop offset="100%" stop-color="#96d2fa"/>
    </linearGradient>

    <!-- 蓝色卡片渐变 (强调/核心) -->
    <linearGradient id="blueCardGradAccent" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#b0dcfa"/>
      <stop offset="100%" stop-color="#7ebbf5"/>
    </linearGradient>

    <!-- 紫蓝色贯穿柱渐变 -->
    <linearGradient id="purplePillarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#9ab0ee"/>
      <stop offset="100%" stop-color="#738dd8"/>
    </linearGradient>

    <!-- 样式表 -->
    <style>
      .title-text { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'STHeiti', 'Microsoft YaHei', sans-serif; font-weight: 800; fill: #0f3453; }
      .sub-title { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'STHeiti', sans-serif; font-size: 13px; fill: #486d88; font-weight: 500; }
      .tag-text { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'STHeiti', sans-serif; font-size: 15px; font-weight: 700; fill: #ffffff; letter-spacing: 1.5px; text-anchor: middle; dominant-baseline: middle; }
      .card-main { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'STHeiti', sans-serif; font-size: 12.5px; font-weight: 700; fill: #0d283d; text-anchor: middle; dominant-baseline: middle; }
      .card-sub { font-family: Arial, sans-serif; font-size: 9.5px; font-weight: 500; fill: #1c5279; text-anchor: middle; dominant-baseline: middle; }
      .group-label { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'STHeiti', sans-serif; font-size: 11.5px; font-weight: 700; fill: #1d5175; text-anchor: middle; dominant-baseline: middle; }
      .pillar-text { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'STHeiti', sans-serif; font-size: 14.5px; font-weight: 700; fill: #ffffff; letter-spacing: 4px; text-anchor: middle; dominant-baseline: middle; }
      .footer-text { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'STHeiti', sans-serif; font-size: 11.5px; fill: #52738d; }
    </style>
  </defs>

  <!-- 全局大背景 -->
  <rect x="15" y="15" width="1310" height="1110" rx="14" fill="#ffffff" stroke="#3780ad" stroke-width="2" filter="url(#softShadow)"/>

  <!-- 顶部主标题区域 -->
  <g transform="translate(670, 52)">
    <text class="title-text" x="0" y="0" font-size="23" text-anchor="middle" letter-spacing="1">
      <tspan fill="#e74c48">Agent-CdcBuddy</tspan> 疾控病媒生物监测预警智能体平台技术架构图
    </text>
    <text class="sub-title" x="0" y="24" text-anchor="middle">
      基于 LangGraph 多智能体协同 · Python 科学计算与深度学习算法引擎 · 双数据库与信创国产化架构
    </text>
    <line x1="-610" y1="38" x2="610" y2="38" stroke="#dbe7f0" stroke-width="1.5"/>
  </g>

  <!-- ==================== 1. 应用层 (y: 105, h: 70) ==================== -->
  <g transform="translate(45, 105)">
    <!-- 左侧红标 -->
    <rect x="0" y="0" width="128" height="66" rx="8" fill="url(#redTagGrad)" stroke="#c93531" stroke-width="1.5" filter="url(#tagShadow)"/>
    <text class="tag-text" x="64" y="34">应用层</text>

    <!-- 右侧容器 -->
    <rect x="142" y="0" width="1108" height="66" rx="8" fill="#ebf6fb" stroke="#4899c2" stroke-width="1.5"/>

    <!-- 应用层 7 个卡片 -->
    <!-- 宽度 (1108 - 16 - 6*10) / 7 = 1032 / 7 ≈ 147 -->
    <g transform="translate(150, 8)">
      <!-- 1 -->
      <g transform="translate(0, 0)">
        <rect width="147" height="50" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="73.5" y="19">病媒密度监测分析</text>
        <text class="card-sub" x="73.5" y="35">Surveillance Dynamics</text>
      </g>
      <!-- 2 -->
      <g transform="translate(157, 0)">
        <rect width="147" height="50" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="73.5" y="19">杀虫剂抗药性评估</text>
        <text class="card-sub" x="73.5" y="35">Resistance Bioassay</text>
      </g>
      <!-- 3 -->
      <g transform="translate(314, 0)">
        <rect width="147" height="50" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="73.5" y="19">虫媒传播风险预警</text>
        <text class="card-sub" x="73.5" y="35">Transmission Risk</text>
      </g>
      <!-- 4 -->
      <g transform="translate(471, 0)">
        <rect width="147" height="50" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="73.5" y="19">消杀处置闭环管理</text>
        <text class="card-sub" x="73.5" y="35">Intervention &amp; Retest</text>
      </g>
      <!-- 5 -->
      <g transform="translate(628, 0)">
        <rect width="147" height="50" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="73.5" y="19">7×24 后台常驻巡检</text>
        <text class="card-sub" x="73.5" y="35">Daemon Surveillance</text>
      </g>
      <!-- 6 -->
      <g transform="translate(785, 0)">
        <rect width="147" height="50" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="73.5" y="19">Text2SQL 疾控问答</text>
        <text class="card-sub" x="73.5" y="35">CDC ChatBI / QA</text>
      </g>
      <!-- 7 -->
      <g transform="translate(942, 0)">
        <rect width="150" height="50" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="75" y="19">应急研判专报生成</text>
        <text class="card-sub" x="75" y="35">Auto Report Export</text>
      </g>
    </g>
  </g>

  <!-- ==================== 2. 展现层 (y: 183, h: 84) ==================== -->
  <g transform="translate(45, 183)">
    <rect x="0" y="0" width="128" height="80" rx="8" fill="url(#redTagGrad)" stroke="#c93531" stroke-width="1.5" filter="url(#tagShadow)"/>
    <text class="tag-text" x="64" y="41">展现层</text>

    <!-- 右侧容器 -->
    <rect x="142" y="0" width="1108" height="80" rx="8" fill="#ebf6fb" stroke="#4899c2" stroke-width="1.5"/>

    <!-- WEB 子分组 -->
    <g transform="translate(152, 7)">
      <rect width="736" height="66" rx="6" fill="#ffffff" fill-opacity="0.75" stroke="#71b4d6" stroke-width="1.2"/>
      <text x="10" y="14" font-family="-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif" font-size="11" font-weight="700" fill="#25648a">🖥️ WEB 端 / 疾控智能研判大屏 (Next.js 15 &amp; React 19)</text>
      <!-- 5 个卡片 -->
      <g transform="translate(8, 20)">
        <g transform="translate(0, 0)">
          <rect width="138" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="69" y="15" font-size="12">国家天地图 GIS 空间层</text>
          <text class="card-sub" x="69" y="28">Tianditu GIS</text>
        </g>
        <g transform="translate(144, 0)">
          <rect width="138" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="69" y="15" font-size="12">SaTScan 时空圆柱投影</text>
          <text class="card-sub" x="69" y="28">3D Cylinder Map</text>
        </g>
        <g transform="translate(288, 0)">
          <rect width="138" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="69" y="15" font-size="12">ECharts 动态时序图表</text>
          <text class="card-sub" x="69" y="28">Time-series Charts</text>
        </g>
        <g transform="translate(432, 0)">
          <rect width="138" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="69" y="15" font-size="12">AG-UI 生成式组件库</text>
          <text class="card-sub" x="69" y="28">Generative UI</text>
        </g>
        <g transform="translate(576, 0)">
          <rect width="138" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="69" y="15" font-size="12">Copilot 交互侧边栏</text>
          <text class="card-sub" x="69" y="28">CopilotKit Widget</text>
        </g>
      </g>
    </g>

    <!-- 移动端 / 嵌入式 子分组 -->
    <g transform="translate(896, 7)">
      <rect width="344" height="66" rx="6" fill="#ffffff" fill-opacity="0.75" stroke="#71b4d6" stroke-width="1.2"/>
      <text x="10" y="14" font-family="-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif" font-size="11" font-weight="700" fill="#25648a">📱 移动端采集 &amp; 嵌入式微前端</text>
      <g transform="translate(8, 20)">
        <g transform="translate(0, 0)">
          <rect width="104" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="52" y="15" font-size="11.5">现场采样上报</text>
          <text class="card-sub" x="52" y="28">Mobile Survey</text>
        </g>
        <g transform="translate(110, 0)">
          <rect width="104" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="52" y="15" font-size="11.5">AI 物种拍照识别</text>
          <text class="card-sub" x="52" y="28">Species Vision</text>
        </g>
        <g transform="translate(220, 0)">
          <rect width="104" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="52" y="15" font-size="11.5">嵌入式浮窗 SDK</text>
          <text class="card-sub" x="52" y="28">Embedded Plugin</text>
        </g>
      </g>
    </g>
  </g>

  <!-- ==================== 3 & 4. 网关层 + 应用编排 + 右侧贯穿 (y: 274) ==================== -->
  <!-- 3. 网关层 (y: 274, h: 62) -->
  <g transform="translate(45, 274)">
    <rect x="0" y="0" width="128" height="60" rx="8" fill="url(#redTagGrad)" stroke="#c93531" stroke-width="1.5" filter="url(#tagShadow)"/>
    <text class="tag-text" x="64" y="31">网关层</text>

    <!-- 中间网关内容 (宽度留出右侧贯穿区 1108 - 116 = 992) -->
    <rect x="142" y="0" width="982" height="60" rx="8" fill="#ebf6fb" stroke="#4899c2" stroke-width="1.5"/>

    <g transform="translate(150, 7)">
      <!-- 6个卡片, 宽度 ≈ (982 - 16 - 5*8) / 6 = 926 / 6 ≈ 154 -->
      <g transform="translate(0, 0)">
        <rect width="154" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="77" y="17">API 网关 (Next.js)</text>
        <text class="card-sub" x="77" y="32">Route Handlers</text>
      </g>
      <g transform="translate(162, 0)">
        <rect width="154" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="77" y="17">CopilotKit 协议网关</text>
        <text class="card-sub" x="77" y="32">Runtime Bridge</text>
      </g>
      <g transform="translate(324, 0)">
        <rect width="154" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="77" y="17">RESTful OpenAPI (v1)</text>
        <text class="card-sub" x="77" y="32">Standard Endpoints</text>
      </g>
      <g transform="translate(486, 0)">
        <rect width="154" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="77" y="17">SSE 实时事件推流</text>
        <text class="card-sub" x="77" y="32">Server-Sent Events</text>
      </g>
      <g transform="translate(648, 0)">
        <rect width="154" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="77" y="17">JWT 统一身份认证</text>
        <text class="card-sub" x="77" y="32">Auth &amp; Identity</text>
      </g>
      <g transform="translate(810, 0)">
        <rect width="156" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="78" y="17">动态限流与熔断</text>
        <text class="card-sub" x="78" y="32">Rate Limiter</text>
      </g>
    </g>
  </g>

  <!-- 4. 应用编排层 (y: 342, h: 124) -->
  <g transform="translate(45, 342)">
    <rect x="0" y="0" width="128" height="124" rx="8" fill="url(#redTagGrad)" stroke="#c93531" stroke-width="1.5" filter="url(#tagShadow)"/>
    <text class="tag-text" x="64" y="55">应用编排</text>
    <text x="64" y="74" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" fill="#ffeaea" text-anchor="middle">(Agent中枢)</text>

    <!-- 中间容器 (982宽) -->
    <rect x="142" y="0" width="982" height="124" rx="8" fill="#ebf6fb" stroke="#4899c2" stroke-width="1.5"/>

    <!-- 第一排：四智能体核心 -->
    <g transform="translate(150, 8)">
      <!-- 4 个智能体卡片 宽度 (982 - 16 - 3*10) / 4 = 936 / 4 = 234 -->
      <g transform="translate(0, 0)">
        <rect width="234" height="50" rx="6" fill="url(#blueCardGradAccent)" stroke="#1d6b99" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="117" y="19" font-size="13">🦟 监测分析智能体</text>
        <text class="card-sub" x="117" y="35">Surveillance Agent (种群/时序/守护)</text>
      </g>
      <g transform="translate(244, 0)">
        <rect width="234" height="50" rx="6" fill="url(#blueCardGradAccent)" stroke="#1d6b99" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="117" y="19" font-size="13">🧪 抗药性分析智能体</text>
        <text class="card-sub" x="117" y="35">Resistance Agent (LC50/基因演化)</text>
      </g>
      <g transform="translate(488, 0)">
        <rect width="234" height="50" rx="6" fill="url(#blueCardGradAccent)" stroke="#1d6b99" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="117" y="19" font-size="13">⚠️ 风险评估智能体</text>
        <text class="card-sub" x="117" y="35">Risk Agent (动力学/PCR/时空扫描)</text>
      </g>
      <g transform="translate(732, 0)">
        <rect width="234" height="50" rx="6" fill="url(#blueCardGradAccent)" stroke="#1d6b99" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="117" y="19" font-size="13">🛠️ 处置推荐智能体</text>
        <text class="card-sub" x="117" y="35">Intervention Agent (消杀处方/工单)</text>
      </g>
    </g>

    <!-- 第二排：编排支撑能力 (7个卡片) -->
    <!-- (982 - 16 - 6*8) / 7 = 918 / 7 ≈ 131 -->
    <g transform="translate(150, 66)">
      <g transform="translate(0, 0)">
        <rect width="131" height="48" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.4" filter="url(#cardShadow)"/>
        <text class="card-main" x="65.5" y="18" font-size="11.5">LangGraph 状态图</text>
        <text class="card-sub" x="65.5" y="33">StateGraph Engine</text>
      </g>
      <g transform="translate(139, 0)">
        <rect width="131" height="48" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.4" filter="url(#cardShadow)"/>
        <text class="card-main" x="65.5" y="18" font-size="11.5">5步科学计算管线</text>
        <text class="card-sub" x="65.5" y="33">SaTScan+LSTM</text>
      </g>
      <g transform="translate(278, 0)">
        <rect width="131" height="48" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.4" filter="url(#cardShadow)"/>
        <text class="card-main" x="65.5" y="18" font-size="11.5">Prompt 策略注入</text>
        <text class="card-sub" x="65.5" y="33">Dynamic Policy</text>
      </g>
      <g transform="translate(417, 0)">
        <rect width="131" height="48" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.4" filter="url(#cardShadow)"/>
        <text class="card-main" x="65.5" y="18" font-size="11.5">Text2SQL 语义解析</text>
        <text class="card-sub" x="65.5" y="33">NL to SQL Parser</text>
      </g>
      <g transform="translate(556, 0)">
        <rect width="131" height="48" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.4" filter="url(#cardShadow)"/>
        <text class="card-main" x="65.5" y="18" font-size="11.5">国标知识库 RAG</text>
        <text class="card-sub" x="65.5" y="33">GB/T &amp; WS/T KB</text>
      </g>
      <g transform="translate(695, 0)">
        <rect width="131" height="48" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.4" filter="url(#cardShadow)"/>
        <text class="card-main" x="65.5" y="18" font-size="11.5">元技能构建器</text>
        <text class="card-sub" x="65.5" y="33">Meta-Skill Builder</text>
      </g>
      <g transform="translate(834, 0)">
        <rect width="132" height="48" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.4" filter="url(#cardShadow)"/>
        <text class="card-main" x="66" y="18" font-size="11.5">48h 复测核销闭环</text>
        <text class="card-sub" x="66" y="33">Ticket Workflow</text>
      </g>
    </g>
  </g>

  <!-- 右侧纵向贯穿支柱：日志系统 & 权限系统 (从 y: 274 到 y: 466, 总高 192) -->
  <g transform="translate(1180, 274)">
    <!-- 日志审计系统 -->
    <g transform="translate(0, 0)">
      <rect width="52" height="192" rx="8" fill="url(#purplePillarGrad)" stroke="#455db0" stroke-width="1.5" filter="url(#cardShadow)"/>
      <text class="pillar-text" x="26" y="85">日志审计系统</text>
      <text class="card-sub" x="26" y="174" fill="#f0f4ff">TraceId</text>
    </g>
    <!-- RBAC 权限系统 -->
    <g transform="translate(62, 0)">
      <rect width="52" height="192" rx="8" fill="url(#purplePillarGrad)" stroke="#455db0" stroke-width="1.5" filter="url(#cardShadow)"/>
      <text class="pillar-text" x="26" y="85">权限控制系统</text>
      <text class="card-sub" x="26" y="174" fill="#f0f4ff">RBAC</text>
    </g>
  </g>

  <!-- ==================== 5. 推理和服务部署 (y: 476, h: 62) ==================== -->
  <g transform="translate(45, 476)">
    <rect x="0" y="0" width="128" height="60" rx="8" fill="url(#redTagGrad)" stroke="#c93531" stroke-width="1.5" filter="url(#tagShadow)"/>
    <text class="tag-text" x="64" y="24" font-size="14">推理和服务</text>
    <text class="tag-text" x="64" y="42" font-size="14">部 署</text>

    <rect x="142" y="0" width="1108" height="60" rx="8" fill="#ebf6fb" stroke="#4899c2" stroke-width="1.5"/>

    <!-- 5 个横向通栏卡片: (1108 - 16 - 4*10) / 5 = 1052 / 5 ≈ 210 -->
    <g transform="translate(150, 7)">
      <g transform="translate(0, 0)">
        <rect width="210" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="105" y="17">Python 科学算法执行引擎</text>
        <text class="card-sub" x="105" y="32">analytics_engine IPC Bridge</text>
      </g>
      <g transform="translate(220, 0)">
        <rect width="210" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="105" y="17">PyTorch 深度学习运行时</text>
        <text class="card-sub" x="105" y="32">TorchScript (CPU / CUDA)</text>
      </g>
      <g transform="translate(440, 0)">
        <rect width="210" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="105" y="17">大模型统一调度网关</text>
        <text class="card-sub" x="105" y="32">Dynamic LLM Router / Gateway</text>
      </g>
      <g transform="translate(660, 0)">
        <rect width="210" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="105" y="17">vLLM / Ollama 私有化高并发推理</text>
        <text class="card-sub" x="105" y="32">Local LLM Acceleration</text>
      </g>
      <g transform="translate(880, 0)">
        <rect width="212" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="106" y="17">7×24 Daemon 守护后台运行器</text>
        <text class="card-sub" x="106" y="32">Surveillance Daemon Task</text>
      </g>
    </g>
  </g>

  <!-- ==================== 6. 模型层 (y: 546, h: 168) ==================== -->
  <g transform="translate(45, 546)">
    <rect x="0" y="0" width="128" height="162" rx="8" fill="url(#redTagGrad)" stroke="#c93531" stroke-width="1.5" filter="url(#tagShadow)"/>
    <text class="tag-text" x="64" y="81">模型层</text>

    <rect x="142" y="0" width="1108" height="162" rx="8" fill="#ebf6fb" stroke="#4899c2" stroke-width="1.5"/>

    <!-- 分栏 1: 中小模型与科学算法 -->
    <g transform="translate(152, 9)">
      <text class="group-label" x="42" y="22">中小模型<tspan x="42" y="38">科学算法</tspan></text>
      <line x1="88" y1="4" x2="88" y2="46" stroke="#87bdda" stroke-width="1.5"/>
      <!-- 9 个算法药丸卡片 (1108 - 100 - 8*6) / 9 ≈ 107 -->
      <g transform="translate(98, 3)">
        <g transform="translate(0, 0)">
          <rect width="106" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="53" y="15" font-size="11">SaTScan 时空扫描</text>
          <text class="card-sub" x="53" y="28">Poisson/Bernoulli</text>
        </g>
        <g transform="translate(112, 0)">
          <rect width="106" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="53" y="15" font-size="11">双向 Bi-LSTM</text>
          <text class="card-sub" x="53" y="28">PyTorch 时序网络</text>
        </g>
        <g transform="translate(224, 0)">
          <rect width="106" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="53" y="15" font-size="11">ARIMAX 季节消长</text>
          <text class="card-sub" x="53" y="28">气象外生回归</text>
        </g>
        <g transform="translate(336, 0)">
          <rect width="106" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="53" y="15" font-size="11">GBDT 密度预测</text>
          <text class="card-sub" x="53" y="28">气象特征重要度</text>
        </g>
        <g transform="translate(448, 0)">
          <rect width="106" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="53" y="15" font-size="11">普通克里金插值</text>
          <text class="card-sub" x="53" y="28">Ordinary Kriging</text>
        </g>
        <g transform="translate(560, 0)">
          <rect width="106" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="53" y="15" font-size="11">K-Means 优势种</text>
          <text class="card-sub" x="53" y="28">香农多样性指数</text>
        </g>
        <g transform="translate(672, 0)">
          <rect width="106" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="53" y="15" font-size="11">Probit 毒力回归</text>
          <text class="card-sub" x="53" y="28">LC50 / KT50 参数</text>
        </g>
        <g transform="translate(784, 0)">
          <rect width="106" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="53" y="15" font-size="11">Apriori 病原关联</text>
          <text class="card-sub" x="53" y="28">Frequent Itemsets</text>
        </g>
        <g transform="translate(896, 0)">
          <rect width="106" height="40" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="53" y="15" font-size="11">马尔可夫基因演化</text>
          <text class="card-sub" x="53" y="28">Bayes Mutation</text>
        </g>
      </g>
    </g>

    <!-- 分栏 2: 向量与微调 -->
    <g transform="translate(152, 60)">
      <text class="group-label" x="42" y="20">向量与微调</text>
      <line x1="88" y1="4" x2="88" y2="40" stroke="#87bdda" stroke-width="1.5"/>
      <g transform="translate(98, 2)">
        <g transform="translate(0, 0)">
          <rect width="250" height="38" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="125" y="14" font-size="11.5">bge-large-zh-v1.5 (高维语义向量)</text>
          <text class="card-sub" x="125" y="27">Dense Vector Embedding</text>
        </g>
        <g transform="translate(262, 0)">
          <rect width="250" height="38" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="125" y="14" font-size="11.5">bge-reranker-v2-m3 (交叉重排模型)</text>
          <text class="card-sub" x="125" y="27">Cross-Encoder Re-ranker</text>
        </g>
        <g transform="translate(524, 0)">
          <rect width="478" height="38" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="239" y="14" font-size="11.5">CDC 疾控病媒垂类指令微调 (LLaMA-Factory / LoRA SFT)</text>
          <text class="card-sub" x="239" y="27">Domain Parameter-Efficient Fine-Tuning</text>
        </g>
      </g>
    </g>

    <!-- 分栏 3: 大语言模型 (LLMs) -->
    <g transform="translate(152, 110)">
      <text class="group-label" x="42" y="20">大语言模型</text>
      <line x1="88" y1="4" x2="88" y2="40" stroke="#87bdda" stroke-width="1.5"/>
      <g transform="translate(98, 2)">
        <!-- 6 个 LLM 卡片 -->
        <g transform="translate(0, 0)">
          <rect width="162" height="38" rx="5" fill="url(#blueCardGradAccent)" stroke="#1d6b99" stroke-width="1.4" filter="url(#cardShadow)"/>
          <text class="card-main" x="81" y="14" font-size="12">Qwen 2.5 / 3.6 (通义)</text>
          <text class="card-sub" x="81" y="27">Primary Agent Core</text>
        </g>
        <g transform="translate(169, 0)">
          <rect width="162" height="38" rx="5" fill="url(#blueCardGradAccent)" stroke="#1d6b99" stroke-width="1.4" filter="url(#cardShadow)"/>
          <text class="card-main" x="81" y="14" font-size="12">DeepSeek-V3 / R1</text>
          <text class="card-sub" x="81" y="27">Reasoning Engine</text>
        </g>
        <g transform="translate(338, 0)">
          <rect width="162" height="38" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="81" y="14" font-size="12">书生·浦语 (InternLM2)</text>
          <text class="card-sub" x="81" y="27">InternLM Foundation</text>
        </g>
        <g transform="translate(507, 0)">
          <rect width="162" height="38" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="81" y="14" font-size="12">百度文心一言 (ERNIE)</text>
          <text class="card-sub" x="81" y="27">Baidu BigModel</text>
        </g>
        <g transform="translate(676, 0)">
          <rect width="162" height="38" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="81" y="14" font-size="12">百川智能 (Baichuan)</text>
          <text class="card-sub" x="81" y="27">Healthcare LLM</text>
        </g>
        <g transform="translate(845, 0)">
          <rect width="157" height="38" rx="5" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.3" filter="url(#cardShadow)"/>
          <text class="card-main" x="78.5" y="14" font-size="12">智谱 GLM-4</text>
          <text class="card-sub" x="78.5" y="27">Zhipu BigModel</text>
        </g>
      </g>
    </g>
  </g>

  <!-- ==================== 7. 数据存储层 (y: 720, h: 66) ==================== -->
  <g transform="translate(45, 720)">
    <rect x="0" y="0" width="128" height="62" rx="8" fill="url(#redTagGrad)" stroke="#c93531" stroke-width="1.5" filter="url(#tagShadow)"/>
    <text class="tag-text" x="64" y="32">数据存储层</text>

    <rect x="142" y="0" width="1108" height="62" rx="8" fill="#ebf6fb" stroke="#4899c2" stroke-width="1.5"/>

    <!-- 7 个存储组件: (1108 - 16 - 6*10) / 7 = 1032 / 7 ≈ 147 -->
    <g transform="translate(150, 7)">
      <g transform="translate(0, 0)">
        <rect width="147" height="48" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="73.5" y="17">时空监测事实库</text>
        <text class="card-sub" x="73.5" y="32">vector_monitoring.db (5.6W+)</text>
      </g>
      <g transform="translate(157, 0)">
        <rect width="147" height="48" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="73.5" y="17">业务持久化闭环库</text>
        <text class="card-sub" x="73.5" y="32">app_business.db (工单/预警)</text>
      </g>
      <g transform="translate(314, 0)">
        <rect width="147" height="48" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="73.5" y="17">PostgreSQL 14+</text>
        <text class="card-sub" x="73.5" y="32">生产级企业关系库</text>
      </g>
      <g transform="translate(471, 0)">
        <rect width="147" height="48" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="73.5" y="17">人大金仓 KingbaseES</text>
        <text class="card-sub" x="73.5" y="32">信创国产化数据库</text>
      </g>
      <g transform="translate(628, 0)">
        <rect width="147" height="48" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="73.5" y="17">国家病媒标准库</text>
        <text class="card-sub" x="73.5" y="32">GB/T &amp; WS/T 规范</text>
      </g>
      <g transform="translate(785, 0)">
        <rect width="147" height="48" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="73.5" y="17">省市县 GeoJSON</text>
        <text class="card-sub" x="73.5" y="32">空间三级地理矢量</text>
      </g>
      <g transform="translate(942, 0)">
        <rect width="150" height="48" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="75" y="17">Redis / Checkpoint</text>
        <text class="card-sub" x="75" y="32">状态快照与巡检缓存</text>
      </g>
    </g>
  </g>

  <!-- ==================== 8. 基础设施层 (虚线外框) (y: 794, h: 62) ==================== -->
  <g transform="translate(45, 794)">
    <rect x="0" y="0" width="128" height="60" rx="8" fill="url(#redTagGrad)" stroke="#c93531" stroke-width="1.5" filter="url(#tagShadow)"/>
    <text class="tag-text" x="64" y="31">基础设施层</text>

    <!-- 虚线背景框 -->
    <rect x="142" y="0" width="1108" height="60" rx="8" fill="#e2f0f7" stroke="#378ebd" stroke-width="2" stroke-dasharray="6,4"/>

    <!-- 6 个基础设施卡片: (1108 - 16 - 5*10) / 6 = 1042 / 6 ≈ 173 -->
    <g transform="translate(150, 7)">
      <g transform="translate(0, 0)">
        <rect width="173" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="86.5" y="17">高性能通用 CPU</text>
        <text class="card-sub" x="86.5" y="32">Intel Xeon / AMD EPYC</text>
      </g>
      <g transform="translate(183, 0)">
        <rect width="173" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="86.5" y="17">AI 专用加速 GPU / NPU</text>
        <text class="card-sub" x="86.5" y="32">NVIDIA CUDA / 华为昇腾</text>
      </g>
      <g transform="translate(366, 0)">
        <rect width="173" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="86.5" y="17">Kubernetes (K8s)</text>
        <text class="card-sub" x="86.5" y="32">容器编排与弹性伸缩</text>
      </g>
      <g transform="translate(549, 0)">
        <rect width="173" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="86.5" y="17">Docker 容器化交付</text>
        <text class="card-sub" x="86.5" y="32">微服务容器镜像</text>
      </g>
      <g transform="translate(732, 0)">
        <rect width="173" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="86.5" y="17">政务私有云 / 局域信创</text>
        <text class="card-sub" x="86.5" y="32">银河麒麟 / 统信 UOS</text>
      </g>
      <g transform="translate(915, 0)">
        <rect width="177" height="46" rx="6" fill="url(#blueCardGrad)" stroke="#2774a3" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text class="card-main" x="88.5" y="17">国家天地图公共平台</text>
        <text class="card-sub" x="88.5" y="32">Tianditu Map Service</text>
      </g>
    </g>
  </g>

  <!-- ==================== 底部标注 ==================== -->
  <g transform="translate(45, 874)">
    <line x1="0" y1="0" x2="1250" y2="0" stroke="#cadde9" stroke-width="1" stroke-dasharray="4,4"/>
    <rect x="0" y="10" width="60" height="20" rx="3" fill="#e2edf4" stroke="#87bdda" stroke-width="1"/>
    <text x="30" y="24" font-family="-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif" font-size="11" font-weight="700" fill="#184a6b" text-anchor="middle">架构说明</text>
    <text class="footer-text" x="70" y="24">
      本架构图全面呈现疾控病媒生物监测国标规范、LangGraph四智能体状态图协同体系、Python科学算法引擎与信创国产化软硬件支撑全景。
    </text>
    <text class="footer-text" x="1250" y="24" text-anchor="end" font-weight="600">
      平台版本: Agent-CdcBuddy v2.5 | 部署模式: 私有化/混合云
    </text>
  </g>

</svg>
"""
    with open(SVG_PATH, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"SVG saved to {SVG_PATH}")

    # 同时复制到 artifact 目录
    artifact_svg = os.path.join(ARTIFACT_DIR, "architecture.svg")
    shutil.copyfile(SVG_PATH, artifact_svg)
    print(f"Artifact SVG copied to {artifact_svg}")


# ==========================================
# 2. 使用 PIL 渲染超高分辨率 PNG 架构图
# ==========================================
def generate_png():
    # 建立 2x 超采样画布: 2680 x 1840，最终生成锐利细腻的图像
    scale = 2
    w, h = 1340 * scale, 920 * scale

    # 字体加载
    font_path_medium = "/System/Library/Fonts/STHeiti Medium.ttc"
    font_path_light = "/System/Library/Fonts/STHeiti Light.ttc"
    font_path_arial = "/System/Library/Fonts/Supplemental/Arial.ttf"

    font_title = ImageFont.truetype(font_path_medium, 24 * scale)
    font_subtitle = ImageFont.truetype(font_path_light, 13 * scale)
    font_tag = ImageFont.truetype(font_path_medium, 16 * scale)
    font_card_main = ImageFont.truetype(font_path_medium, 12 * scale)
    font_card_sub = ImageFont.truetype(font_path_arial, 10 * scale)
    font_pillar = ImageFont.truetype(font_path_medium, 15 * scale)
    font_group = ImageFont.truetype(font_path_medium, 11 * scale)
    font_footer = ImageFont.truetype(font_path_light, 11 * scale)

    img = Image.new("RGB", (w, h), (244, 248, 251))
    draw = ImageDraw.Draw(img)

    # 绘制外边框
    margin = 15 * scale
    draw.rounded_rectangle(
        [margin, margin, w - margin, h - margin],
        radius=14 * scale,
        fill=(255, 255, 255),
        outline=(55, 128, 173),
        width=int(2 * scale)
    )

    # 绘制标题
    draw.text((w // 2, 48 * scale), "Agent-CdcBuddy 疾控病媒生物监测预警智能体平台技术架构图", font=font_title, fill=(19, 57, 88), anchor="mm")
    draw.text((w // 2, 74 * scale), "基于 LangGraph 多智能体协同 · Python 科学计算与深度学习算法引擎 · 双数据库与信创国产化架构", font=font_subtitle, fill=(72, 109, 136), anchor="mm")
    draw.line([(45 * scale, 90 * scale), (w - 45 * scale, 90 * scale)], fill=(219, 231, 240), width=int(1.5 * scale))

    # 辅助绘图函数
    def draw_card(box, main_text, sub_text, is_accent=False):
        x1, y1, x2, y2 = box
        # 渐变背景近似: accent 为较深蓝，普通为天蓝
        fill_color = (168, 216, 249) if is_accent else (192, 230, 251)
        border_color = (29, 107, 153) if is_accent else (39, 116, 163)
        draw.rounded_rectangle([x1, y1, x2, y2], radius=6 * scale, fill=fill_color, outline=border_color, width=int(1.5 * scale))
        cx = (x1 + x2) // 2
        cy1 = y1 + (y2 - y1) * 0.38
        cy2 = y1 + (y2 - y1) * 0.72
        draw.text((cx, cy1), main_text, font=font_card_main, fill=(13, 40, 61), anchor="mm")
        draw.text((cx, cy2), sub_text, font=font_card_sub, fill=(28, 82, 121), anchor="mm")

    def draw_red_tag(box, text, sub=""):
        x1, y1, x2, y2 = box
        draw.rounded_rectangle([x1, y1, x2, y2], radius=8 * scale, fill=(234, 79, 75), outline=(201, 53, 49), width=int(1.5 * scale))
        cx = (x1 + x2) // 2
        cy = (y1 + y2) // 2
        if sub:
            draw.text((cx, cy - 8 * scale), text, font=font_tag, fill=(255, 255, 255), anchor="mm")
            draw.text((cx, cy + 12 * scale), sub, font=font_group, fill=(255, 235, 235), anchor="mm")
        else:
            draw.text((cx, cy), text, font=font_tag, fill=(255, 255, 255), anchor="mm")

    # 1. 应用层 (y: 105)
    y105 = 105 * scale
    draw_red_tag([45 * scale, y105, 173 * scale, y105 + 62 * scale], "应用层")
    draw.rounded_rectangle([187 * scale, y105, (187 + 1108) * scale, y105 + 62 * scale], radius=8 * scale, fill=(235, 246, 251), outline=(72, 153, 194), width=int(1.5 * scale))
    app_cards = [
        ("病媒密度监测分析", "Surveillance Dynamics"),
        ("杀虫剂抗药性评估", "Resistance Bioassay"),
        ("虫媒传播风险预警", "Transmission Risk"),
        ("消杀处置闭环管理", "Intervention & Retest"),
        ("7×24 后台常驻巡检", "Daemon Surveillance"),
        ("Text2SQL 疾控问答", "CDC ChatBI / QA"),
        ("应急研判专报生成", "Auto Report Export"),
    ]
    card_w = (1108 * scale - 16 * scale - 6 * 10 * scale) // 7
    for i, (m, s) in enumerate(app_cards):
        cx1 = (187 + 8) * scale + i * (card_w + 10 * scale)
        draw_card([cx1, y105 + 7 * scale, cx1 + card_w, y105 + 55 * scale], m, s)

    # 2. 展现层 (y: 177)
    y177 = 177 * scale
    draw_red_tag([45 * scale, y177, 173 * scale, y177 + 76 * scale], "展现层")
    draw.rounded_rectangle([187 * scale, y177, (187 + 1108) * scale, y177 + 76 * scale], radius=8 * scale, fill=(235, 246, 251), outline=(72, 153, 194), width=int(1.5 * scale))
    
    # Web 子区
    draw.rounded_rectangle([197 * scale, y177 + 6 * scale, (197 + 740) * scale, y177 + 70 * scale], radius=6 * scale, fill=(255, 255, 255), outline=(113, 180, 214), width=int(1.2 * scale))
    draw.text((207 * scale, y177 + 14 * scale), "WEB 端 / 疾控智能研判大屏 (Next.js 15 & React 19)", font=font_group, fill=(37, 100, 138))
    web_cards = [
        ("国家天地图 GIS 空间层", "Tianditu GIS"),
        ("SaTScan 时空圆柱投影", "3D Cylinder Map"),
        ("ECharts 动态时序图表", "Time-series Charts"),
        ("AG-UI 生成式组件库", "Generative UI"),
        ("Copilot 交互侧边栏", "CopilotKit Widget"),
    ]
    ww = (740 * scale - 16 * scale - 4 * 8 * scale) // 5
    for i, (m, s) in enumerate(web_cards):
        cx1 = 205 * scale + i * (ww + 8 * scale)
        draw_card([cx1, y177 + 24 * scale, cx1 + ww, y177 + 64 * scale], m, s)

    # App 子区
    draw.rounded_rectangle([947 * scale, y177 + 6 * scale, (947 + 338) * scale, y177 + 70 * scale], radius=6 * scale, fill=(255, 255, 255), outline=(113, 180, 214), width=int(1.2 * scale))
    draw.text((957 * scale, y177 + 14 * scale), "移动端采集 & 嵌入式微前端", font=font_group, fill=(37, 100, 138))
    app_mob_cards = [
        ("现场采样上报", "Mobile Survey"),
        ("AI 物种拍照识别", "Species Vision"),
        ("嵌入式浮窗 SDK", "Embedded Plugin"),
    ]
    aw = (338 * scale - 16 * scale - 2 * 8 * scale) // 3
    for i, (m, s) in enumerate(app_mob_cards):
        cx1 = 955 * scale + i * (aw + 8 * scale)
        draw_card([cx1, y177 + 24 * scale, cx1 + aw, y177 + 64 * scale], m, s)

    # 3. 网关层 (y: 263, h: 58)
    y263 = 263 * scale
    draw_red_tag([45 * scale, y263, 173 * scale, y263 + 58 * scale], "网关层")
    draw.rounded_rectangle([187 * scale, y263, (187 + 982) * scale, y263 + 58 * scale], radius=8 * scale, fill=(235, 246, 251), outline=(72, 153, 194), width=int(1.5 * scale))
    gw_cards = [
        ("API 网关 (Next.js)", "Route Handlers"),
        ("CopilotKit 协议网关", "Runtime Bridge"),
        ("RESTful OpenAPI (v1)", "Standard Endpoints"),
        ("SSE 实时事件推流", "Server-Sent Events"),
        ("JWT 统一身份认证", "Auth & Identity"),
        ("动态限流与熔断", "Rate Limiter"),
    ]
    gw_w = (982 * scale - 16 * scale - 5 * 8 * scale) // 6
    for i, (m, s) in enumerate(gw_cards):
        cx1 = (187 + 8) * scale + i * (gw_w + 8 * scale)
        draw_card([cx1, y263 + 6 * scale, cx1 + gw_w, y263 + 52 * scale], m, s)

    # 4. 应用编排层 (y: 331, h: 120)
    y331 = 331 * scale
    draw_red_tag([45 * scale, y331, 173 * scale, y331 + 120 * scale], "应用编排", "(Agent中枢)")
    draw.rounded_rectangle([187 * scale, y331, (187 + 982) * scale, y331 + 120 * scale], radius=8 * scale, fill=(235, 246, 251), outline=(72, 153, 194), width=int(1.5 * scale))
    
    # 第一排: 4智能体核心 (强调色)
    ag_cards = [
        ("监测分析智能体", "Surveillance Agent"),
        ("抗药性分析智能体", "Resistance Agent"),
        ("风险评估智能体", "Risk Assessment Agent"),
        ("处置推荐智能体", "Intervention Agent"),
    ]
    ag_w = (982 * scale - 16 * scale - 3 * 10 * scale) // 4
    for i, (m, s) in enumerate(ag_cards):
        cx1 = (187 + 8) * scale + i * (ag_w + 10 * scale)
        draw_card([cx1, y331 + 8 * scale, cx1 + ag_w, y331 + 56 * scale], m, s, is_accent=True)

    # 第二排: 编排能力
    orch_cards = [
        ("LangGraph 状态图", "StateGraph Engine"),
        ("5步科学计算管线", "SaTScan+LSTM Pipeline"),
        ("Prompt 策略注入", "Dynamic Policy Injection"),
        ("Text2SQL 语义解析", "NL to SQL Parser"),
        ("国标知识库 RAG", "GB/T & WS/T RAG"),
        ("元技能构建器", "Meta-Skill Builder"),
        ("48h 复测核销闭环", "Disposal Workflow"),
    ]
    ow = (982 * scale - 16 * scale - 6 * 8 * scale) // 7
    for i, (m, s) in enumerate(orch_cards):
        cx1 = (187 + 8) * scale + i * (ow + 8 * scale)
        draw_card([cx1, y331 + 64 * scale, cx1 + ow, y331 + 112 * scale], m, s)

    # 右侧贯穿立柱: 日志系统 & 权限系统 (y: 263 到 y: 451, 高度 188)
    def draw_pillar(x, text, en_sub):
        draw.rounded_rectangle([x, y263, x + 52 * scale, y263 + 188 * scale], radius=8 * scale, fill=(122, 145, 219), outline=(69, 93, 176), width=int(1.5 * scale))
        chars = list(text)
        start_y = y263 + 24 * scale
        gap = 22 * scale
        for ci, ch in enumerate(chars):
            draw.text((x + 26 * scale, start_y + ci * gap), ch, font=font_pillar, fill=(255, 255, 255), anchor="mm")
        draw.text((x + 26 * scale, y263 + 172 * scale), en_sub, font=font_card_sub, fill=(235, 240, 255), anchor="mm")

    draw_pillar((187 + 994) * scale, "日志审计系统", "Audit Log")
    draw_pillar((187 + 994 + 60) * scale, "权限控制系统", "RBAC Auth")

    # 5. 推理和服务部署 (y: 461, h: 58)
    y461 = 461 * scale
    draw_red_tag([45 * scale, y461, 173 * scale, y461 + 58 * scale], "推理和服务", "部 署")
    draw.rounded_rectangle([187 * scale, y461, (187 + 1108) * scale, y461 + 58 * scale], radius=8 * scale, fill=(235, 246, 251), outline=(72, 153, 194), width=int(1.5 * scale))
    inf_cards = [
        ("Python 科学算法执行引擎", "analytics_engine IPC Bridge"),
        ("PyTorch 深度学习运行时", "TorchScript (CPU / CUDA)"),
        ("大模型统一调度网关", "Dynamic LLM Router / Gateway"),
        ("vLLM / Ollama 高并发推理", "Local LLM Acceleration"),
        ("7×24 Daemon 守护后台运行器", "Surveillance Daemon Runner"),
    ]
    inf_w = (1108 * scale - 16 * scale - 4 * 10 * scale) // 5
    for i, (m, s) in enumerate(inf_cards):
        cx1 = (187 + 8) * scale + i * (inf_w + 10 * scale)
        draw_card([cx1, y461 + 6 * scale, cx1 + inf_w, y461 + 52 * scale], m, s)

    # 6. 模型层 (y: 529, h: 162)
    y529 = 529 * scale
    draw_red_tag([45 * scale, y529, 173 * scale, y529 + 162 * scale], "模型层")
    draw.rounded_rectangle([187 * scale, y529, (187 + 1108) * scale, y529 + 162 * scale], radius=8 * scale, fill=(235, 246, 251), outline=(72, 153, 194), width=int(1.5 * scale))

    # 中小模型
    draw.text((232 * scale, y529 + 18 * scale), "中小模型", font=font_group, fill=(23, 77, 113), anchor="mm")
    draw.text((232 * scale, y529 + 34 * scale), "科学算法", font=font_group, fill=(23, 77, 113), anchor="mm")
    draw.line([(274 * scale, y529 + 6 * scale), (274 * scale, y529 + 48 * scale)], fill=(135, 189, 218), width=int(1.5 * scale))
    sci_cards = [
        ("SaTScan 时空扫描", "Poisson / Bernoulli"),
        ("双向 Bi-LSTM", "PyTorch Time-Series"),
        ("ARIMAX 季节消长", "Climate ARIMAX"),
        ("GBDT 密度预测", "Weather GBDT"),
        ("普通克里金插值", "Ordinary Kriging"),
        ("K-Means 优势种", "Shannon-Wiener"),
        ("Probit 毒力回归", "LC50 / KT50"),
        ("Apriori 病原关联", "Frequent Itemsets"),
        ("马尔可夫基因演化", "Markov & Bayes"),
    ]
    sw = (1108 * scale - 98 * scale - 8 * 6 * scale) // 9
    for i, (m, s) in enumerate(sci_cards):
        cx1 = 282 * scale + i * (sw + 6 * scale)
        draw_card([cx1, y529 + 6 * scale, cx1 + sw, y529 + 48 * scale], m, s)

    # 向量与微调
    draw.text((232 * scale, y529 + 76 * scale), "向量与微调", font=font_group, fill=(23, 77, 113), anchor="mm")
    draw.line([(274 * scale, y529 + 58 * scale), (274 * scale, y529 + 96 * scale)], fill=(135, 189, 218), width=int(1.5 * scale))
    draw_card([282 * scale, y529 + 58 * scale, (282 + 250) * scale, y529 + 96 * scale], "bge-large-zh-v1.5 向量表征", "Dense Vector Embedding")
    draw_card([(282 + 258) * scale, y529 + 58 * scale, (282 + 508) * scale, y529 + 96 * scale], "bge-reranker-v2-m3 重排模型", "Cross-Encoder Re-ranker")
    draw_card([(282 + 516) * scale, y529 + 58 * scale, (187 + 1100) * scale, y529 + 96 * scale], "CDC 疾控病媒垂类指令微调", "LLaMA-Factory Domain LoRA SFT")

    # 大语言模型
    draw.text((232 * scale, y529 + 130 * scale), "大语言模型", font=font_group, fill=(23, 77, 113), anchor="mm")
    draw.line([(274 * scale, y529 + 110 * scale), (274 * scale, y529 + 150 * scale)], fill=(135, 189, 218), width=int(1.5 * scale))
    llm_cards = [
        ("Qwen 2.5 / 3.6 (通义)", "Primary Agent Core", True),
        ("DeepSeek-V3 / R1", "Reasoning Engine", True),
        ("书生·浦语 (InternLM2)", "InternLM Foundation", False),
        ("百度文心一言 (ERNIE)", "Baidu BigModel", False),
        ("百川智能 (Baichuan)", "Healthcare LLM", False),
        ("智谱 GLM-4", "Zhipu BigModel", False),
    ]
    lw = (1108 * scale - 98 * scale - 5 * 8 * scale) // 6
    for i, (m, s, is_acc) in enumerate(llm_cards):
        cx1 = 282 * scale + i * (lw + 8 * scale)
        draw_card([cx1, y529 + 110 * scale, cx1 + lw, y529 + 150 * scale], m, s, is_accent=is_acc)

    # 7. 数据存储层 (y: 701, h: 60)
    y701 = 701 * scale
    draw_red_tag([45 * scale, y701, 173 * scale, y701 + 60 * scale], "数据存储层")
    draw.rounded_rectangle([187 * scale, y701, (187 + 1108) * scale, y701 + 60 * scale], radius=8 * scale, fill=(235, 246, 251), outline=(72, 153, 194), width=int(1.5 * scale))
    db_cards = [
        ("时空监测事实库", "vector_monitoring.db (5.6W+)"),
        ("业务持久化闭环库", "app_business.db (Tickets/Logs)"),
        ("PostgreSQL 14+", "Production Database"),
        ("人大金仓 KingbaseES", "Kingbase National DB"),
        ("国家病媒标准库", "GB/T & WS/T Standards"),
        ("省市县 GeoJSON", "Vector GIS Boundaries"),
        ("Redis / Checkpoint", "State Snapshots & Cache"),
    ]
    for i, (m, s) in enumerate(db_cards):
        cx1 = (187 + 8) * scale + i * (card_w + 10 * scale)
        draw_card([cx1, y701 + 6 * scale, cx1 + card_w, y701 + 54 * scale], m, s)

    # 8. 基础设施层 (y: 771, h: 58)
    y771 = 771 * scale
    draw_red_tag([45 * scale, y771, 173 * scale, y771 + 58 * scale], "基础设施层")
    draw.rounded_rectangle([187 * scale, y771, (187 + 1108) * scale, y771 + 58 * scale], radius=8 * scale, fill=(226, 240, 247), outline=(55, 142, 189), width=int(2 * scale))
    infra_cards = [
        ("高性能通用 CPU", "Intel Xeon / AMD EPYC"),
        ("AI 专用加速 GPU/NPU", "NVIDIA CUDA / Ascend NPU"),
        ("Kubernetes (K8s)", "K8s Container Cluster"),
        ("Docker 容器化交付", "Microservices Container"),
        ("政务私有云 / 局域信创", "Kylin OS / UnionTech UOS"),
        ("国家天地图公共平台", "Tianditu Map Service"),
    ]
    inf_w2 = (1108 * scale - 16 * scale - 5 * 10 * scale) // 6
    for i, (m, s) in enumerate(infra_cards):
        cx1 = (187 + 8) * scale + i * (inf_w2 + 10 * scale)
        draw_card([cx1, y771 + 6 * scale, cx1 + inf_w2, y771 + 52 * scale], m, s)

    # 底部说明 (y: 846)
    y846 = 846 * scale
    draw.line([(45 * scale, y846), (w - 45 * scale, y846)], fill=(202, 221, 233), width=int(1.2 * scale))
    draw.rounded_rectangle([45 * scale, y846 + 10 * scale, 105 * scale, y846 + 28 * scale], radius=3 * scale, fill=(226, 237, 244), outline=(135, 189, 218), width=int(1 * scale))
    draw.text((75 * scale, y846 + 19 * scale), "架构说明", font=font_group, fill=(24, 74, 107), anchor="mm")
    draw.text((115 * scale, y846 + 19 * scale), "本架构图严格遵循国家疾控病媒生物监测规范、四智能体协同逻辑与信创自主可控标准，打通监测、分析、预警与消杀闭环。", font=font_footer, fill=(82, 115, 141), anchor="lm")
    draw.text((w - 45 * scale, y846 + 19 * scale), "平台版本: Agent-CdcBuddy v2.5 | 部署模式: 私有化 / 混合信创云", font=font_footer, fill=(82, 115, 141), anchor="rm")

    # 保存 PNG
    img.save(PNG_PATH, "PNG", quality=95)
    print(f"PNG saved to {PNG_PATH} (size: {w}x{h})")

    # 复制到 artifact 目录
    artifact_png = os.path.join(ARTIFACT_DIR, "architecture.png")
    shutil.copyfile(PNG_PATH, artifact_png)
    print(f"Artifact PNG copied to {artifact_png}")

if __name__ == "__main__":
    generate_svg()
    generate_png()
