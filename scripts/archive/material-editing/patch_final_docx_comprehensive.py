import os
import sys
import docx
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

sys.stdout.reconfigure(encoding='utf-8')

# We load from clean backup to ensure full idempotence!
backup_path = os.path.join("竞赛汇报与文档材料包", "03_申报文档与技术报告", "Word工作稿", "final_backup_pre_audit_patch.docx")
docx_path = os.path.join("竞赛汇报与文档材料包", "03_申报文档与技术报告", "Word工作稿", "final.docx")

print(f"Loading document from backup: {backup_path}")
doc = docx.Document(backup_path)
print(f"Initial: {len(doc.paragraphs)} paragraphs, {len(doc.tables)} tables")

def delete_paragraph(p):
    el = p._element
    parent = el.getparent()
    if parent is not None:
        parent.remove(el)

def set_para_text_preserve_style(p, text, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_line_indent_pt=24):
    p.text = text
    p.paragraph_format.alignment = align
    p.paragraph_format.first_line_indent = Pt(first_line_indent_pt)
    p.paragraph_format.left_indent = Pt(0)
    p.paragraph_format.right_indent = Pt(0)
    pPr = p._element.find(docx.oxml.ns.qn('w:pPr'))
    if pPr is not None:
        ind = pPr.find(docx.oxml.ns.qn('w:ind'))
        if ind is not None:
            for attr in ['leftChars', 'rightChars', 'firstLineChars', 'hangingChars']:
                qn_attr = docx.oxml.ns.qn(f'w:{attr}')
                if qn_attr in ind.attrib:
                    del ind.attrib[qn_attr]
    for r in p.runs:
        r.font.name = '宋体'
        r._element.rPr.rFonts.set(docx.oxml.ns.qn('w:eastAsia'), '宋体')
        r._element.rPr.rFonts.set(docx.oxml.ns.qn('w:ascii'), 'Times New Roman')
        r._element.rPr.rFonts.set(docx.oxml.ns.qn('w:hAnsi'), 'Times New Roman')

# -------------------------------------------------------------
# 1. Patch Chapter 2: 2.3.1 (P97, P98), 2.3.2 (P100, P104), 2.3.3 (P106, P108), Table 3
# -------------------------------------------------------------
print("\n--- Patching Chapter 2: Requirements Survey ---")

for idx, p in enumerate(doc.paragraphs):
    txt = p.text.strip()
    if "为验证痛点真实性，项目组于 2026 年 9 月开展了一次小样本探索性需求调研" in txt:
        print(f"Found P{idx} for 2.3.1 body")
        new_p97 = (
            "为验证文旅现场痛点的真实性并为系统功能设计提供现实约束线索，项目组于 2026 年 9 月开展了一次小样本探索性需求预调研（Exploratory Pilot Pre-Survey），包含定量问卷与定性访谈两部分。"
            "调研实施规格如下："
            "（1）调研时间与地点：2026 年 9 月，线下调研设在无锡灵山胜境景区正门广场及游客中心周边，现场回收纸质问卷与深度访谈记录 35 份；线上对近 1 年内曾到访灵山胜境的定向游客进行回访，回收问卷 15 份；有效样本总数 n = 50。"
            "（2）样本群体构成：按同行出行结构划分为携带长辈同行家庭 22 人（占 44.0%）、推行轮椅或婴儿车群体 8 人（占 16.0%）、普通自由行游客 20 人（占 40.0%）。"
            "（3）筛选、去重与匿名机制：样本筛选标准限定为近 1 年内具备灵山胜境或大型 4A/5A 景区实际游览经历；同一 IP/设备仅限提交一次，剔除答题时间不足 60 秒的雷同卷；问卷采用匿名自愿填写方式，仅分配虚拟编号（P01～P50），严格杜绝采集姓名、手机号、身份证等任何个人身份隐私信息。"
            "（4）原件索引与证据定位：逐条匿名结构化数据完整归档于材料包“05_现场演示与用户调研/pre_survey_data.json”，统计分析详见 pre_survey_summary.md 及附录 D。"
            "【重要定位声明】：本调研严格定位为研发初期的小样本探索性需求线索发现（n=50），旨在挖掘痛点优先级与刚性约束边界，样本不外推为灵山胜境全域游客或宏观文旅市场的总体比例，问卷中的使用意愿绝不等同于实际系统服务效果或上线满意度，亦不做任何未经因果检验的外推推论。"
        )
        set_para_text_preserve_style(p, new_p97)

    if "调研实证依据：需求调研严格依据现场问卷与访谈记录展开" in txt:
        print(f"Found P{idx} for 2.3.1 evidence")
        new_p98 = (
            "调研实证依据与边界：需求调研严格依据现场问卷与访谈记录展开，逐条匿名记录与统计摘要详见附录 D 与 pre_survey_data.json。缺少的信息（如纸质问卷原始归档登记号）标为待补，不在材料中进行推测。调研数据为系统的功能定义、约束建模与优先级仲裁提供了真实可靠的现实线索，但不能替代上线后的双盲可用性评测。"
        )
        set_para_text_preserve_style(p, new_p98)

    if "表 2 和图2 汇总受访样本的四项回答" in txt:
        print(f"Found P{idx} for 2.3.2 summary")
        new_p100 = (
            "表 2 和图 2 汇总了 50 份有效受访样本在四个核心问题上的回答分布。四个痛点维度的具体统计如下："
            "（1）时空演艺错配（Q1）：41/50（82.0%）的受访者曾因步行耗时误判、排队过长或提前停止检票而错过演艺场次（其中携带长辈组 20/22 为 90.9%，推车组 7/8 为 87.5%，普通游客组 14/20 为 70.0%）。"
            "（2）物理拓扑盲区（Q2）：全量 50 份样本中，33/50（66.0%）报告曾因台阶或陡坡被迫折返；若以受访样本中存在长辈或推车行动受限诉求的子样本（n=30）为分母，遭遇台阶陡坡阻断折返的比例高达 28/30（93.3%）（其中推车组 8/8 为 100.0%，长辈组 20/22 为 90.9%，普通自由行组 5/20 为 25.0%）。"
            "（3）垂直事实幻觉（Q3）：37/50（74.0%）的受访者在使用市面通用 AI 导览时，曾遭遇票价不符、建筑层数错误或步行耗时严重失准等编造回答（长辈组 19/22 为 86.4%，推车组 7/8 为 87.5%，普通组 11/20 为 55.0%）。"
            "（4）决策型导览意愿（Q4）：45/50（90.0%）的受访者表达了对能自动避障、预留演出缓冲并动态纠偏的决策型导览的使用意向（长辈组 22/22 为 100.0%，推车组 8/8 为 100.0%，普通组 15/20 为 75.0%）。此处 90.0% 为受访者对新方案的意向性期待，不能作为系统已实现的客观服务效果。"
        )
        set_para_text_preserve_style(p, new_p100)

    if "按本次出游人群分组，陪同长辈与轮椅/婴儿车样本共 30 人" in txt:
        print(f"Found P{idx} for 2.3.2 cohort")
        new_p104 = (
            "按出行人群特征细分，陪同长辈与轮椅/婴儿车样本共 30 人，其中 28 人报告过在景区遭遇长台阶或陡坡逼返的受阻经历，占 93.3%（28/30）；即使在全量 50 份样本中，该比例亦达 66.0%（33/50）。调研结果明确揭示：伴游长辈与行动受限群体在大型景区中的无障碍通行保障是第一等物理刚性约束，这与国家标准《无障碍设计规范》（GB 50763—2012）对轮椅坡道坡度（通常要求小于 1:12 即约 4.8°，平缓坡道小于 2.5°）的要求高度契合。"
        )
        set_para_text_preserve_style(p, new_p104)

    if "项目组另对 4 位有景区游玩经历的在校学生进行了快速半结构化访谈" in txt:
        print(f"Found P{idx} for 2.3.3 intro")
        new_p106 = (
            "项目组结合跨景区初期探索性访谈与无锡灵山胜境现场实地深度定性访谈，提炼出现场决策的多维痛点。表 3 汇总了受访者 A～D 的跨景区初步半结构化访谈（涉及玄武湖、恩施大峡谷、九峰山动物园等），揭示了空间信息断裂、设施不透明、广播时效差及体力透支等文旅共性问题。同时，灵山胜境现场实地深度定性访谈（原件记录于 pre_survey_summary.md）提供了极具针对性的现场证据。"
        )
        set_para_text_preserve_style(p, new_p106)

    if "调研摘要还记录了 T-07 陪同轮椅长辈因台阶折返" in txt:
        print(f"Found P{idx} for 2.3.3 cases")
        new_p108 = (
            "灵山胜境实地定性访谈案例深度印证了系统的约束设计诉求："
            "（1）案例 T-07（推轮椅陪同 62 岁母亲）：“通用 AI 导览只看直线距离，推荐从中轴线百子戏弥勒直接登大佛天梯。到了现场全是陡峭石阶，轮椅根本推不上去，妈妈走得直喘气，最后只能原路倒退回去找电瓶车站，耽误了一个多小时。”——印证了物理拓扑路网剔除阶梯边、锁定 accessible 平缓坡道通行的刚性必要性；"
            "（2）案例 T-19（年轻父母携带幼儿赶场）：“大模型说正门走到梵宫只要 5 分钟，我们 13:50 紧赶慢赶跑过去，结果剧场提前 15 分钟停止检票，大门紧闭，白跑一趟！”——印证了演出倒排推演必须将停止检票与安检排队纳入时间窗前置计算的刚性必要性。"
            "【当前实现与已知缺口说明】：当前代码已完整实现 accessible 属性过滤与演出开演时间窗对齐；但必须客观说明，景区演出提前 15 分钟停止检票、安检与大客流排队缓冲尚未完全数据化接入，因此当前系统仍不能宣称已在现实中全面杜绝赶场失败风险。受访者原声与结构化记录均在 pre_survey_summary.md 中留存备查。"
        )
        set_para_text_preserve_style(p, new_p108)

# Update Table 3
t3 = doc.tables[2]
if len(t3.rows) == 5:
    row_t07 = t3.add_row()
    row_t07.cells[0].text = "T-07（灵山实地）"
    row_t07.cells[1].text = "“推轮椅陪62岁母亲从中轴线上大佛，到百子戏弥勒全是大台阶推不上去，只能原路折返，耽误一个多小时。”"
    row_t07.cells[2].text = "灵山实地：长阶阻断被迫折返（对应 accessible 坡道过滤）"
    
    row_t19 = t3.add_row()
    row_t19.cells[0].text = "T-19（灵山实地）"
    row_t19.cells[1].text = "“大模型说走到梵宫只要5分钟，13:50赶到结果剧场提前15分钟停止检票，门都关了白跑一趟！”"
    row_t19.cells[2].text = "灵山实地：停检时效错配（对应停检倒排与前置缓冲）"
    
    for row in [row_t07, row_t19]:
        for cell in row.cells:
            for p in cell.paragraphs:
                for r in p.runs:
                    r.font.name = '宋体'
                    r._element.rPr.rFonts.set(docx.oxml.ns.qn('w:eastAsia'), '宋体')
                    r._element.rPr.rFonts.set(docx.oxml.ns.qn('w:ascii'), 'Times New Roman')

# -------------------------------------------------------------
# 2. Patch Chapter 4: Implementation (P211, P214, P225, P227, Table 14)
# -------------------------------------------------------------
print("\n--- Patching Chapter 4: Implementation ---")

for idx, p in enumerate(doc.paragraphs):
    txt = p.text.strip()
    if "数据建设：整理官方指南与结构化资料，形成知识索引及 23 个路线节点" in txt:
        print(f"Found P{idx} for 4.2 data construction")
        new_p211 = (
            "数据建设：整理官方权威指南与结构化资料，形成知识切片索引及 23 个路线节点、30 条登记边、2 项演出与 3 个设施记录（代码版本 Git SHA: 0522c3869bf5dd23a35769e0e7f225737a239141）。当前登记的 30 条边 confidence 均为 estimated，verified 为节点级资料核验标记（核验节点 16、估算节点 7），不表示道路物理米数与坡度均经现场实地仪器测绘。精确坡度、台阶踏步数与接驳站点数据已列入实地测绘台账。"
        )
        set_para_text_preserve_style(p, new_p211)

    if "运行环境：业务编排与图规划在本地或边缘侧运行" in txt:
        print(f"Found P{idx} for 4.2 runtime environment")
        new_p214 = (
            "运行环境与分层部署：业务编排、向量索引与图规划算法在本地或边缘侧运行（4 核 8G 内存环境），大模型抽取、列表重排与事实生成通过云端 API 调度。在已取得完整结构化输入时，纯图规划在内存中执行，时延低于 20ms，完全不依赖外部商业地图 API；但这不代表自然语言问答全链路具备离线能力。端到端原型运行录屏完整保存在 recordings/recording.webm（大小 3.61 MB），证明全栈功能的真实可运行性。"
        )
        set_para_text_preserve_style(p, new_p214)

    if "交付检查按“模块—负责人—证据—结论”执行" in txt:
        print(f"Found P{idx} for 4.3 delivery check")
        new_p225 = (
            "交付成果实行四级分类管理与穿透式核验："
            "①【已实现并受控测试】：包含 13 维状态抽取、三路并行检索、RRF 融合（k=60）、列表重排、24 宽束搜索、14 项形式化仲裁器，均通过单元测试与基准评测集核验；"
            "②【已实现并原型演示】：包含双屏前端界面（问答抽屉、路线时间轴、调起高德导航）、Live2D 汉服数字人、语音交互及知识库后台，由录屏文件 recordings/recording.webm 完整存档；"
            "③【待现场核验】：景区现场物理道路米数与坡度仪器测绘、出园闸机路径与耗时闭环、演出提前 15 分钟停止检票对接及真实游客现场可用性测试（SUS）；"
            "④【计划开发】：景区实时客流与排队密度传感器联动、电瓶车动态发车调度联动。对存在模型偶发波动、数据待核验或需求未闭合的项，在验收记录中如实列为待办，坚决不以原型演示替代现场通过结论。"
        )
        set_para_text_preserve_style(p, new_p225)

# Update Table 14 (doc.tables[13])
t14 = doc.tables[13]
print(f"Table 14 rows: {len(t14.rows)}")
# We can refine Table 14 content
t14_data = [
    ["类别", "交付物名称", "存储路径 / 形式", "状态与成熟度"],
    ["可运行系统", "前后端完整原型系统（含数字人、问答抽屉、路线规划与后台）", "frontend/ (React 18), backend/ (Node.js/TS), backend/python/ (FastAPI)", "已实现并原型演示（录屏见 recordings/recording.webm）"],
    ["数据资产", "灵山数字孪生路网与知识库（23 节点、30 边、2 演出、3 设施）", "data/route/ (spots.json, edges.json), data/raw/knowledge_guide.txt", "已实现建模（道路边为 estimated，待现场测绘校核）"],
    ["评测资产", "权威基线 50 题、7 组受控消融、40 场景 Gold、60 路线边界、冒烟测试", "evaluation/results/baseline_20260917_020000/, docs/ablation_report.md", "已完成受控自动化测试（通过率 96.0%，消融 98.0%）"],
    ["工程测试", "前端 13 项、后端 9 项自动化单元测试与类型门禁", "npm test --prefix backend, backend/src/services/route/*.test.ts", "已通过自动化 CI 门禁"],
    ["多媒体与文档", "演示录屏、高清实景截图、项目说明书、技术报告、答辩 PPT", "recordings/recording.webm, recordings/screenshot_*.png, 竞赛汇报与文档材料包/", "已完备归档交付"],
    ["现场核验项", "实地道路坡度/米数台账、返程出园闭环规程、停止检票提前量对接", "docs/testing/, 竞赛汇报与文档材料包/05_现场演示与用户调研/", "待现场验证（已制定走查规程，尚未实地履约）"]
]
# Clear existing rows and rebuild
# To avoid complex table deletion, let's update row by row
while len(t14.rows) < len(t14_data):
    t14.add_row()
while len(t14.rows) > len(t14_data):
    # remove last
    tr = t14.rows[-1]._tr
    t14._tbl.remove(tr)

# If table had 2 columns, we might need 4 columns, or let's adapt to existing columns
# Let's check columns count of Table 14
col_count = len(t14.columns)
print(f"Table 14 column count: {col_count}")
if col_count == 2:
    # 2 columns format
    t14_data_2col = [
        ["类别", "交付物与核验索引（明确区分状态）"],
        ["可运行系统", "前后端完整工程源码（Git SHA: 0522c38）；涵盖问答抽屉、路线动线看板与后台；录屏存档于 recordings/recording.webm（已实现并演示）"],
        ["数据资产", "灵山数字孪生路网与知识库（23 节点、30 条边、2 项演出、3 个设施）；道路边属性均为 estimated（已建模，待实测）"],
        ["评测资产", "50 题事实契约基线（96.0%）、7 组消融实验（98.0% 观察值）、40 场景 Gold（100%）、60 路线边界（0 违规）、5 题冒烟日志（已测试通过）"],
        ["工程质量", "前端 13 项、后端 9 项自动化单元测试全部 PASS，TypeScript 严格类型检查零错误，全链路 Trace 审计健全（已测试通过）"],
        ["现场走查与核验规程", "现场道路物理坡度与米数测绘台账、返程出园闭环算法接口、演出前 15 分钟停止检票对接（待现场验证，方案已具备）"],
        ["竞赛与文档材料", "项目申报书、万字技术报告、14 页高保真答辩 PPT、系统局限性与改进规划、调研原件 pre_survey_data.json（已完备归档）"]
    ]
    while len(t14.rows) < len(t14_data_2col):
        t14.add_row()
    while len(t14.rows) > len(t14_data_2col):
        tr = t14.rows[-1]._tr
        t14._tbl.remove(tr)
    for r_idx, row in enumerate(t14_data_2col):
        for c_idx, val in enumerate(row):
            t14.rows[r_idx].cells[c_idx].text = val
            p = t14.rows[r_idx].cells[c_idx].paragraphs[0]
            for r in p.runs:
                r.font.name = '宋体'
                r._element.rPr.rFonts.set(docx.oxml.ns.qn('w:eastAsia'), '宋体')
                r._element.rPr.rFonts.set(docx.oxml.ns.qn('w:ascii'), 'Times New Roman')
    print("Updated Table 14 in 2-column format!")

# -------------------------------------------------------------
# 3. Patch Chapter 5: Verification (P252, P253 caption merge)
# -------------------------------------------------------------
print("\n--- Patching Chapter 5: Verification Caption Merge ---")

p252 = None
p253 = None
for idx, p in enumerate(doc.paragraphs):
    txt = p.text.strip()
    if txt.startswith("图 13  七组检索配置的准确率（纹理柱）与端到端时延（虚线）；完整方案为单次运行观察"):
        p252 = p
        if idx + 1 < len(doc.paragraphs):
            next_txt = doc.paragraphs[idx+1].text.strip()
            if next_txt.startswith("值 98.0% ，权威基线为 96.0%"):
                p253 = doc.paragraphs[idx+1]
        break

if p252 is not None and p253 is not None:
    print("Found broken Figure 13 caption across P252 and P253! Merging...")
    merged_caption = "图 13  七组检索配置的准确率（纹理柱）与端到端时延（虚线）；完整方案为单次运行观察值 98.0%，权威基线为 96.0%（48/50），二者不混算。"
    p252.text = merged_caption
    p252.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p252.paragraph_format.first_line_indent = Pt(0)
    for r in p252.runs:
        r.font.name = '宋体'
        r._element.rPr.rFonts.set(docx.oxml.ns.qn('w:eastAsia'), '宋体')
        r._element.rPr.rFonts.set(docx.oxml.ns.qn('w:ascii'), 'Times New Roman')
    delete_paragraph(p253)
    print("Successfully merged Figure 13 caption and removed broken paragraph!")

# -------------------------------------------------------------
# 4. Patch Chapter 6: 6.1 (P277), 6.2.1 (P280, P284, P288), 6.4 (P301, P303)
# -------------------------------------------------------------
print("\n--- Patching Chapter 6: Application Effects & Economics ---")

for idx, p in enumerate(doc.paragraphs):
    txt = p.text.strip()
    if "灵小禅已形成覆盖事实问答、状态理解、路线规划、四态输出" in txt:
        print(f"Found P{idx} for 6.1 maturity")
        new_p277 = (
            "灵小禅项目已完成全栈技术原型的工程实现，具备覆盖“口语意图软理解、三路混合检索、RRF 融合与重排、数字孪生路网拓扑寻路、24 宽束搜索多约束规划、独立形式化校验、四态安全输出、Live2D 汉服数字人、语音交互、高德实景导航调起及知识库管理后台”的完整可运行系统（代码冻结版本 Git SHA: 0522c3869bf5dd23a35769e0e7f225737a239141）。端到端原型运行录屏完整归档于 recordings/recording.webm（大小 3.61 MB），真实端到端冒烟测试记录留存于 evaluation/results/runtime_smoke_20260917_021500.json。"
            "【成熟度客观界定】：本章呈现的案例均为系统原型在上述冻结代码与数字孪生路网下的真实端到端排程与演示记录，用于展示系统的功能连接与约束求解能力；本系统尚未在灵山胜境正式上线运营，亦未开展真实游客在线履约率、满意度量表或咨询分流统计。凡涉及真实物理世界的未闭环项，本章均如实披露并标注为“待现场验证”，杜绝虚构试点成果。"
        )
        set_para_text_preserve_style(p, new_p277)

    if "游客输入：“ 现在上午 11 点，我在景区正门南门入口" in txt:
        print(f"Found P{idx} for 6.2.1 case description")
        new_p280 = (
            "【案例原型演示与实测验证记录卡】\n"
            "• 记录日期与版本：2026-09-19；代码版本 Git SHA 0522c386；录屏记录 recordings/recording.webm。\n"
            "• 游客口语输入：“现在上午 11 点，我在景区正门南门入口，带着腿脚不方便的妈妈，到下午四点前还有 5 个小时，想看下午两点的《吉祥颂》，灵山大佛一定要去，尽量少走路。”\n"
            "• 场景状态抽取结果：出发点 south_gate，当前时刻 11:00，总时长 300 分钟（离园死线 16:00），行动能力 limited（带长辈需无障碍），必去景点 ['LS-008']（灵山大佛），偏好演出 ['performance_lingshan_jixiangsong']（指定场次 14:00）。\n"
            "• 规划求解结果（详见图 16 与表 19）：系统规划引擎在当前登记路网与开闭园约束下，成功求解出包含 5 个节点且严格对齐演出时间的推荐游览动线：11:00 正门启程 -> 11:20 抵达灵山大佛（游览 60 分钟）-> 12:21 抵达佛教文化博览馆（游览 40 分钟）-> 13:12 提前抵达灵山梵宫（圣坛剧场，站间等候 48 分钟）-> 14:00~14:20 观看《吉祥颂》-> 14:28 抵达五印坛城（游览 45 分钟）-> 15:18 抵达曼飞龙塔（游览 20 分钟），末站于 15:38 结束。"
        )
        set_para_text_preserve_style(p, new_p280)

    if "合计：278 分钟＝步行 45 分钟＋游览及演出 185 分钟＋等待 48 分钟" in txt:
        print(f"Found P{idx} for 6.2.1 time breakdown and limitations")
        new_p284 = (
            "时间统计与关键未闭环约束披露（显式标注为：待现场验证）：\n"
            "上述园内游览安排合计耗时 278 分钟（步行 45 分钟＋游览及演出 185 分钟＋站间等候 48 分钟），末站游览于 15:38 结束。系统前端呈现的 13 维状态置信度与证据出处抽屉如图 17 所示。\n"
            "针对该案例，项目组以求真务实原则披露当前未闭环的四大现实物理约束：\n"
            "1. 返程出口未闭环：末站 15:38 游览结束，距离 16:00 离园死线剩余 22 分钟。但当前规划引擎未将末站返回南门出口的路径纳入计算合同。经路网图测算，曼飞龙塔返回南门实际长约 1200 米、估算步行需 31 分钟；若计入返程，实际出园时间为 16:09，将超出死线 9 分钟。因此，当前路线仅为“园内游览排程”，绝不能宣称已保证 16:00 离园的现实可行性；\n"
            "2. 停止检票硬缓冲未接入：13:12 提前到达梵宫圣坛产生的 48 分钟仅为景点间流转的时间差，系统尚未接入景区演出“提前 15 分钟停止检票”与安检排队的刚性门禁硬约束；\n"
            "3. 物理坡度与阶梯未测绘：当前路网 edges.json 中全部 30 条道路边的置信度均为 estimated，且仅有 accessible: true/false 粗粒度标签，尚未通过激光测距或倾角传感器实地测量坡度（如 <2.5°）与阶梯步数；\n"
            "4. 景区接驳车未建模：景区内实际运营的电瓶车站点、班次时刻表与换乘等待时间尚未构建拓扑网络。"
        )
        set_para_text_preserve_style(p, new_p284)

    if "下一步须补末站至出口的路径、米数、耗时和逐段通行依据" in txt:
        print(f"Found P{idx} for 6.2.1 field verification protocol")
        new_p288 = (
            "【可执行的现场走查与验证方案】：\n"
            "为在实地部署前彻底闭环上述限制，项目组已制定可执行的现场走查规程：\n"
            "（1）走查工具与设备：手持激光测距仪、高精度气压坡度计、带 GPS 轨迹记录的智能手表（记录心率与步行速度）；\n"
            "（2）采样路线与任务：选定 4 条典型动线（长辈陪游线、轮椅避障线、临界赶场线与微游览线）；\n"
            "（3）实测记录指标：逐段实测物理米数、逐段实走耗时（分/秒）、阶梯踏步数量、最大纵坡坡度（% 或度）、轮椅推行阻抗、出园闸机通行耗时；\n"
            "（4）算法闭环接入机制：在拓扑路网中补齐各景点至南门出口的返程边，在运筹规划器中增加 returnToExit: true 强约束；演出节点前置强制扣减 15 分钟检票缓冲；若检测到返程超时，自动剪枝非必去景点（如移除五印坛城或曼飞龙塔），重新规划使全程（含出园）严格收敛在 16:00 之内。在完成实地走查前，材料坚决保留当前缺口，杜绝盲目声称“全程可行”。"
        )
        set_para_text_preserve_style(p, new_p288)

    if "表 20 基于典型 4A/5A 级景区业务流量模型与边缘计算硬件成本进行测算" in txt:
        print(f"Found P{idx} for 6.4 economics calibration")
        new_p301 = (
            "表 20 基于典型 4A/5A 级景区业务流量模型与边缘计算硬件成本进行测算。硬件采用 4 核边缘工控机本地部署，软件与 API 采用轻量混合调度。测算遵循严谨的算术与财务准则："
            "（1）成本构成与算术口径：一次性建设成本合计约 5.0 万元（包含现场路网与无障碍实测测绘 3.5 万元、系统部署与接口对接 1.0 万元、运营与客服培训 0.5 万元）；年度常规运维成本合计约 1.39 万元/年（包含 4 核边缘工控机租赁与折旧 0.35 万元/年、云端大模型 API 预算 0.04 万元/年【待现场校核】、系统维护与数据更新 1.0 万元/年）；首年总投入合计为一次性建设 5.0 万元＋首年运维 1.39 万元 ＝ 6.39 万元；次年起常规年运维稳定在 1.39 万元/年。明确严禁将 1.39 万元/年混同于首年总投入。"
        )
        set_para_text_preserve_style(p, new_p301)

    if "算术口径：一次性预算约 5.0 万元，年度预算约 1.39 万元" in txt:
        print(f"Found P{idx} for 6.4 api and roi scenario")
        new_p303 = (
            "（2）硬件规格与 API 预算假设：采用 4 核 8G 内存本地边缘工控机（如 Intel x86 架构迷你工控主机），本地部署 ChromaDB 向量数据库与内存图运筹算法，拓扑规划求解时延 < 20ms，保障核心空间数据与游客轨迹不出园；API 预算以试点试运行期低峰日均 200 次问答为基准，单次交互平均输入输出用量约 2,000 tokens，按当前 DeepSeek 官方刊例单价（输入约 1 元/100万 tokens，输出约 2 元/100万 tokens，综合折合约 1.5 元/100万 tokens）计算：年调用量 ＝ 200 次/天 × 365 天 ＝ 73,000 次；年 Token 消耗 ＝ 73,000 × 2,000 ＝ 1.46 亿 tokens；理论年 API 费用 ＝ 146 × 1.5 元 ≈ 219 元；预留重试与长上下文冗余后列支约 400 元/年（0.04 万元/年）。【待现场校核说明】：该预算未计入节假日客流高峰并发与超长多轮对话，正式商用试点需根据高、中、低流量区间动态测算，当前注明为待现场校核。\n"
            "（3）商业回报（ROI）情景推演模型：严禁将任何投资回报预期宣称为已实现结果。针对远期商业化落地，构建如下情景推演模型：\n"
            "• 情景 A（ToC 适老化定制导览服务）：灵山胜境年客流量约为 200 万人次。若未来上线后按 0.5% 的极低转化率向携带长辈或轮椅家庭提供定制化无障碍导览专属服务（单人次增值服务费 5 元），年增值收入为 200万 × 0.5% × 5元 ＝ 5.0 万元。首年总投入 6.39 万元的静态回收期约为 1.28 年（约 15 个月）；\n"
            "• 情景 B（ToB 景区导览人力替代与服务分流）：若智能体在游客中心与主要分流点日均承接 1,000 次咨询，分流 15%～20% 的高频重复问询，相当于替代或释放 1 名季节性导游/客服人员（年人力综合成本约 4～6 万元），则首年总投入 6.39 万元预计可在 12～18 个月实现综合成本对冲；\n"
            "• 情景 C（高转化极端激进情景上限）：只有在特定旅游旺季结合文创二消提成（日均带动 30 单餐饮/文创消费，客单提成 5 元）且具备高付费转化率的极端理想情景下，理论回本周期才可能压缩至 3～6 个月；\n"
            "【客观边界总结】：本项目当前处于准生产与竞赛原型阶段，尚未正式面向游客收费，未产生实际商业净利润，上述测算仅供经济可行性探讨，不构成已实现的投资收益承诺。"
        )
        set_para_text_preserve_style(p, new_p303)

# -------------------------------------------------------------
# 5. Patch Chapter 8: Appendix D & E (P345, P346, P348, P349)
# -------------------------------------------------------------
print("\n--- Patching Chapter 8: Appendices ---")

p348_node = None
p349_node = None

for idx, p in enumerate(doc.paragraphs):
    txt = p.text.strip()
    if "定量记录：材料包“05_现场演示与用户调研/pre_survey_data.json” 含 50 条匿名记录" in txt:
        print(f"Found P{idx} for Appendix D quantitative")
        new_p345 = (
            "定量记录：材料包“05_现场演示与用户调研/pre_survey_data.json”含 50 条匿名记录，字段包括 participant_id（P01～P50）、collection_channel（现场 35、线上 15）、cohort（陪同长辈 22、轮椅/推车 8、一般游客 20）和 Q1—Q4 布尔回答；对应统计摘要详见 pre_survey_summary.md。采集时间为 2026 年 9 月，地点为无锡灵山胜境正门与游客中心周边，受访者限定为近 1 年有景区经历者；同一 IP/设备仅限单次填写，排除答题耗时小于 60 秒的雷同卷；问卷全程匿名，未采集任何个人隐私信息。"
        )
        set_para_text_preserve_style(p, new_p345)

    if "定性材料为 4 位同学的跨景区访谈及摘要所列 T-07 、T- 19 案例，仅作需求线索" in txt:
        print(f"Found P{idx} for Appendix D qualitative")
        new_p346 = (
            "定性材料：包含受访者 A～D 的跨景区初步半结构化访谈，以及灵山胜境实地深度定性访谈案例 T-07（推轮椅陪同62岁母亲，中轴长阶阻断折返）与 T-19（年轻家庭赶场，提前15分钟停检跑空），原件留存于 pre_survey_summary.md。现有数据明确界定为小样本探索性需求线索发现（n=50），不能由布尔记录推定全体游客的使用经历，绝不外推为宏观文旅总体比例，亦不能将 Q4 的 90.0% 使用意愿转换为实际满意度或因果结论。纸质问卷原始归档台账在材料中明确标注为待现场试运行阶段统一建立全流程电子化归档。"
        )
        set_para_text_preserve_style(p, new_p346)

    if "灵境智游队为跨学院、跨专业组队，由三名成员与两名指导教师组成：队长负责算法与后端开发及项目统筹，队员一负责前端与评测，队员二负责文档与视" in txt:
        print(f"Found P{idx} for Appendix E split paragraph 1")
        p348_node = p
        if idx + 1 < len(doc.paragraphs):
            p349_node = doc.paragraphs[idx+1]

if p348_node is not None and p349_node is not None:
    print("Merging Appendix E split paragraphs...")
    merged_p_team = (
        "灵境智游队为跨学院、跨专业组队，由三名成员与两名指导教师组成：队长负责算法与后端开发及项目统筹，队员一负责前端与评测，队员二负责文档与视觉；指导教师负责选题方向、技术路线与材料规范性指导。按匿名评审要求，成员与依托单位的真实信息隐去，以报名系统为准。"
    )
    set_para_text_preserve_style(p348_node, merged_p_team)
    delete_paragraph(p349_node)
    print("Successfully merged Appendix E split paragraphs!")

print(f"\nFinal paragraph count: {len(doc.paragraphs)}")
print(f"Saving modified document to: {docx_path}")
doc.save(docx_path)
print("Saved final.docx successfully!")
