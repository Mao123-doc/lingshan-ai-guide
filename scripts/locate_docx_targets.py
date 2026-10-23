# -*- coding: utf-8 -*-
import docx, os, sys
sys.stdout.reconfigure(encoding='utf-8')

src = os.path.join('竞赛汇报与文档材料包', 'upload', 'final.docx')
doc = docx.Document(src)

patterns = [
    '切实保障特殊群体的出行安全与尊严',
    '图 2  n=50 探索性预调研',
    '3.1  总体技术路线',
    '3.2  系统四层架构与部署',
    '图 3  灵小禅系统四层总体技术架构',
    'FORBIDDEN_LLM_FIELDS',
    '图 4  场景状态提取与可信门禁',
    '图 5  问答页证据追溯抽屉原型',
    '3.3.4  演出时间窗倒排对齐',
    '3.3.5  Beam Search 多景点组合优化',
    '图 6  多约束路线求解与硬约束校验原理',
    '图 7  独立路线验证器',
    '图 8  极限约束下的诚实拒绝',
    '图 9  问答页',
    '图 10  语音交互',
    '图 11  知识库管理后台',
    '图 12  运营数据看板原型界面',
    '5.1  验证目标与原则',
    '七组检索配置受控消融结果',
    '图 13  七组检索配置',
    '图 14  边缘案例一',
    '图 15  边缘案例二',
    '6.2.1  经典案例',
    '图 16  原型路线输出',
    '图 17  原型需求理解',
    '图 18  信息不足时的澄清追问',
    '表 20  单景区落地成本情景测算',
    '附录 E  团队与分工'
]

for pat in patterns:
    found = False
    for idx, p in enumerate(doc.paragraphs):
        if pat in p.text:
            print(f'Found "{pat}" at P{idx:03d}: {repr(p.text[:60])}')
            found = True
            break
    if not found:
        print(f'NOT FOUND: "{pat}"')
