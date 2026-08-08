import os
import sqlite3
import datetime
import json

db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app_business.db")

def init_db():
    print(f"Initializing Application Business Database at: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. 处置工单表 (biz_disposal_tickets)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS biz_disposal_tickets (
        ticket_id TEXT PRIMARY KEY,
        alert_id TEXT,
        target_city TEXT NOT NULL,
        target_district TEXT NOT NULL,
        target_street TEXT,
        vector_category TEXT NOT NULL,
        species_name TEXT NOT NULL,
        severity_level TEXT NOT NULL,
        recommended_protocol TEXT NOT NULL,
        assigned_team TEXT NOT NULL,
        contact_phone TEXT,
        disposal_status TEXT NOT NULL DEFAULT 'PENDING',
        before_density REAL,
        after_bi_index REAL,
        disposal_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        resolved_at TEXT
    );
    """)

    # 2. 预警事件与推送日志表 (biz_early_warning_events)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS biz_early_warning_events (
        event_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        level TEXT NOT NULL,
        category TEXT NOT NULL,
        city TEXT NOT NULL,
        district TEXT NOT NULL,
        street TEXT,
        latitude REAL,
        longitude REAL,
        trigger_reason TEXT NOT NULL,
        current_density REAL NOT NULL,
        threshold REAL NOT NULL,
        affected_population INTEGER,
        recommended_action TEXT,
        push_channels TEXT,
        push_status TEXT DEFAULT 'SENT',
        created_at TEXT NOT NULL
    );
    """)

    # 3. 移动端采集上报与审核流转表 (biz_mobile_submissions)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS biz_mobile_submissions (
        submission_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        city TEXT NOT NULL,
        district TEXT NOT NULL,
        street TEXT,
        latitude REAL,
        longitude REAL,
        image_url_base64 TEXT,
        recognized_species TEXT,
        ai_confidence REAL,
        category TEXT NOT NULL,
        species_name TEXT NOT NULL,
        capture_count INTEGER NOT NULL,
        weather_temp REAL,
        weather_humidity REAL,
        habitat_type TEXT,
        method_name TEXT,
        audit_status TEXT NOT NULL DEFAULT 'SUBMITTED',
        auditor_name TEXT,
        audit_comment TEXT,
        submitted_at TEXT NOT NULL,
        audited_at TEXT
    );
    """)

    # 4. 国家标准与防治技术指南知识库表 (biz_kb_standards)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS biz_kb_standards (
        doc_id TEXT PRIMARY KEY,
        standard_no TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        chapter TEXT NOT NULL,
        content TEXT NOT NULL,
        keywords TEXT NOT NULL,
        reference_url TEXT
    );
    """)

    # 5. 自动生成专题报告归档表 (biz_generated_reports)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS biz_generated_reports (
        report_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        city TEXT,
        district TEXT,
        report_type TEXT NOT NULL,
        summary TEXT NOT NULL,
        content_markdown TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL
    );
    """)

    # 6. 用户定制元技能元数据表 (biz_custom_skills)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS biz_custom_skills (
        skill_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        sql_query TEXT NOT NULL,
        chart_type TEXT NOT NULL,
        recommended_prompts TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    # ---------------- 写入初始种子数据 ----------------
    # 1. 知识库标准种子数据
    kb_records = [
        (
            "KB-001", "GB/T 23797-2020", "《病媒生物密度监测方法 蚊类》", "蚊类", "诱蚊灯法与成蚊监测",
            "【诱蚊灯法操作规程】\n1. 仪器选用：使用符合国家标准的诱蚊灯（波长 365nm 紫外光管或 CO2 诱芯）。\n2. 布放原则：每个监测点布灯 2~4 台，距地面高度 1.5 米，避开强光源与强风口。\n3. 时间窗口：通常在日落前 1 小时开灯，次日日出后 1 小时收灯。\n4. 密度计算公式：蚊虫密度 (只/灯·夜) = 捕获成蚊总数 / (诱蚊灯台数 × 监测夜数)。",
            "诱蚊灯,GB/T 23797,成蚊密度,计算公式,布放高度", "http://openstd.samr.gov.cn/gb/gbt23797"
        ),
        (
            "KB-002", "GB/T 23797-2020", "《病媒生物密度监测方法 蚊类》", "蚊类", "幼虫监测与布雷图指数 (BI)",
            "【布雷图指数 (Breteau Index, BI)】\n1. 定义：每 100 户居民住宅室内外查到伊蚊幼虫孳生阳性积水容器的总数。\n2. 公式：BI = (阳性容器数 / 调查户数) × 100。\n3. 登革热风险阈值：\n   - BI < 5：安全控制范围，传播风险极低；\n   - 5 ≤ BI < 10：有传播风险，需启动常规环境卫生清理；\n   - 10 ≤ BI < 20：有暴发风险，需启动区域性药物灭蚊；\n   - BI ≥ 20：高暴发风险（红色警戒），必须立即启动全域突发公共卫生应急响应与超低容量喷雾消杀。",
            "布雷图指数,BI,伊蚊幼虫,登革热阈值,阳性容器", "http://openstd.samr.gov.cn/gb/gbt23797"
        ),
        (
            "KB-003", "WS/T 467-2014", "《登革热媒介伊蚊应急控制指南》", "蚊类", "空间喷雾与化学消杀技术规范",
            "【空间喷雾应急处置标准】\n1. 超低容量空间喷雾 (ULV)：选用 2.5% 高效氯氟氰菊酯水乳剂或 5% 顺式氯氰菊酯，雾滴中径 (VMD) 应控制在 10~30 μm。\n2. 作业时间：白纹伊蚊刺叮高峰为早晨 06:00-08:00 及傍晚 16:30-18:30，应在作业窗口期逆风或侧风向施药。\n3. 幼虫治理：水源生境投掷苏云金芽孢杆菌以色列亚种 (Bti) 或吡丙醚颗粒剂，抑制幼虫羽化。",
            "超低容量,ULV,高效氯氟氰菊酯,Bti,施药时间,白纹伊蚊", "http://wsjkw.gov.cn/wst467"
        ),
        (
            "KB-004", "GB/T 23798-2020", "《病媒生物密度监测方法 蝇类》", "蝇类", "笼诱法与蝇类抗药性治理",
            "【蝇类监测与消杀规程】\n1. 监测方法：采用方型诱蝇笼（食诱剂多采用红糖食醋豆腐发酵液），日落后收笼鉴定计数。\n2. 蝇类密度单位：只/笼·天。\n3. 抗药性轮换策略：对拟除虫菊酯类产生高抗性的家蝇种群，应轮换使用有机磷类（倍硫磷、敌百虫）或新烟碱类（噻虫嗪残杀诱饵），严禁单一药剂连续施用超 2 个月。",
            "家蝇,诱蝇笼,密度,抗药性轮换,倍硫磷,噻虫嗪", "http://openstd.samr.gov.cn/gb/gbt23798"
        ),
        (
            "KB-005", "GB/T 23796-2020", "《病媒生物密度监测方法 鼠类》", "鼠类", "夹夜法与出血热防控规范",
            "【夹夜法与鼠密度控制】\n1. 布夹原则：室内按 15 平方米布夹 1 夹，室外每 5 米沿墙根、绿化带布夹 1 夹，以生花生米或油条为诱饵。\n2. 鼠密度计算：鼠密度 (%) = (捕获鼠数 / 有效夹数) × 100%。\n3. 肾综合征出血热 (HFRS) 防控：当褐家鼠/黑线姬鼠阳性携带汉坦病毒且鼠密度 >3% 时，启动重点村镇全覆盖灭鼠投放溴敌隆毒饵站，严禁使用违禁急性剧毒鼠药。",
            "夹夜法,鼠密度,褐家鼠,黑线姬鼠,汉坦病毒,出血热,溴敌隆", "http://openstd.samr.gov.cn/gb/gbt23796"
        ),
        (
            "KB-006", "GB/T 23799-2020", "《病媒生物密度监测方法 蜚蠊》", "蜚蠊", "粘捕法与灭蟑胶饵技术",
            "【蜚蠊监测与灭蟑胶饵】\n1. 监测方法：采用粘蟑纸（盒）法，每间房布放 2~4 张，重点布放在厨房灶台下、水池旁、暖气后。\n2. 德国小蠊治理：推荐使用含有氟蚁腙 (Hydramethylnon) 或吡虫啉的灭蟑胶饵，采取“点多量少、间距20cm”原则施药，利用蜚蠊食尸取食习性产生二次连锁中毒效应。",
            "德国小蠊,粘捕法,灭蟑胶饵,氟蚁腙,二次中毒", "http://openstd.samr.gov.cn/gb/gbt23799"
        )
    ]

    for k in kb_records:
        cursor.execute("""
        INSERT OR REPLACE INTO biz_kb_standards (doc_id, standard_no, title, category, chapter, content, keywords, reference_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, k)

    # 2. 初始处置工单种子数据
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
    INSERT OR REPLACE INTO biz_disposal_tickets (
        ticket_id, alert_id, target_city, target_district, target_street, vector_category, species_name,
        severity_level, recommended_protocol, assigned_team, contact_phone, disposal_status,
        before_density, after_bi_index, disposal_notes, created_at, updated_at, resolved_at
    ) VALUES (
        'DISPATCH-20260808-01', 'ALERT-202608-101', '郑州市', '金水区', '未来路街道办事处', '蚊', '白纹伊蚊',
        'red', 
        json('[{"step":1,"title":"物理环境清理","content":"翻盆倒罐清除小区与绿化带散在积水容器，投放Bti灭幼粒剂。"},{"step":2,"title":"化学超低容量喷雾","content":"使用 2.5% 高效氯氟氰菊酯水乳剂在早晨 06:00-08:00 进行 ULV 喷雾。"},{"step":3,"title":"效果后评估与核销","content":"消杀后 48 小时复测布雷图指数，若 BI < 5 即自动核销闭环。"}]'),
        '金水区疾病预防控制中心第一消杀突击队', '0371-68991234', 'IN_PROGRESS',
        86.0, 4.2, '已完成第一轮 120 处绿化带积水清理，今日傍晚开展第二轮超低容量作业。',
        ?, ?, NULL
    )
    """, (now_str, now_str))

    # 3. 初始预警事件
    cursor.execute("""
    INSERT OR REPLACE INTO biz_early_warning_events (
        event_id, title, level, category, city, district, street, latitude, longitude,
        trigger_reason, current_density, threshold, affected_population, recommended_action,
        push_channels, push_status, created_at
    ) VALUES (
        'ALERT-202608-101', '郑州市金水区 白纹伊蚊密度超标一级严重预警', 'red', '蚊', '郑州市', '金水区', '未来路街道',
        34.8003, 113.6627, '诱蚊灯捕获量达 86 只/台次（预警基线 30 只），连续 3 日均温 >28℃，具备登革热暴发滋生条件。',
        86.0, 30.0, 32000, '立即启动突发虫媒应急消杀，实施 2.5% 高效氯氟氰菊酯空间超低容量喷雾与积水清除。',
        '系统通知,短信网关,移动端APP推送', 'SENT', ?
    )
    """, (now_str,))

    conn.commit()
    conn.close()
    print("Application Business Database successfully initialized with tables and seed data!")

if __name__ == "__main__":
    init_db()
