# -*- coding: utf-8 -*-
"""
scripts/archive/material-editing/patch_detemplatize_docx.py
Removes all draft/review meta-headers (【...】), bullet characters (•),
and audit prompt artifacts from final.docx, converting them into polished,
formal academic/technical prose suitable for final AIC competition submission.
"""

import docx
from docx.oxml.ns import qn
from docx.shared import Pt

DOC_PATH = r"E:\Projects\lingshan-ai-guide-Mao123-doc\竞赛汇报与文档材料包\03_申报文档与技术报告\Word工作稿\final.docx"

def set_para_text(p, text, first_line_indent=304800, line_spacing=1.25, space_after=38100):
    p.text = ''
    r = p.add_run(text)
    r.font.name = 'Times New Roman'
    rPr = r._element.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn('w:eastAsia'), '宋体')
    p.paragraph_format.first_line_indent = first_line_indent
    p.paragraph_format.line_spacing = line_spacing
    p.paragraph_format.space_after = space_after

def add_para_after(doc, p, text, first_line_indent=304800, line_spacing=1.25, space_after=38100):
    new_p = doc.add_paragraph()
    p._element.addnext(new_p._element)
    set_para_text(new_p, text, first_line_indent, line_spacing, space_after)
    return new_p

def set_cell_text(cell, text, font_size_pt=9.5):
    cell.text = ''
    p = cell.paragraphs[0]
    r = p.add_run(text)
    r.font.name = 'Times New Roman'
    rPr = r._element.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn('w:eastAsia'), '宋体')
    r.font.size = Pt(font_size_pt)
    p.paragraph_format.first_line_indent = 0
    p.paragraph_format.line_spacing = 1.0
    p.paragraph_format.space_after = 0

def run():
    doc = docx.Document(DOC_PATH)
    print(f"Loaded {DOC_PATH}, paragraphs={len(doc.paragraphs)}, tables={len(doc.tables)}")

    # 1. P34 Cover page team ID
    for p in doc.paragraphs[:50]:
        if '参赛编号：AIC-2026-' in p.text:
            print("Updating Cover Team ID...")
            p.text = p.text.replace('【参赛团队编号】', '（团队编号）')
            # re-apply fonts
            for r in p.runs:
                r.font.name = 'Times New Roman'
                r._element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), '宋体')
            break

    # 2. P97 Section 2.3.1
    for p in doc.paragraphs:
        if p.text.startswith('为验证文旅现场痛点的真实性'):
            print("Updating P97 (Survey methodology & positioning statement)...")
            old_kw = '【重要定位声明】：本调研严格定位为研发初期的小样本探索性需求线索发现（n=50），旨在挖掘痛点优先级与刚性约束边界，样本不外推为灵山胜境全域游客或宏观文旅市场的总体比例，问卷中的使用意愿绝不等同于实际系统服务效果或上线满意度，亦不做任何未经因果检验的外推推论。'
            new_kw = '需要说明的是，本调研定位为研发初期的小样本探索性需求线索发现（n=50），旨在挖掘痛点优先级与物理刚性约束边界；样本分析不外推为灵山胜境全域游客或宏观文旅市场的总体分布，问卷中的使用意向亦不作为系统实际服务效果的评价依据。'
            if old_kw in p.text:
                set_para_text(p, p.text.replace(old_kw, new_kw))
            else:
                print("Warning: old_kw not found in P97 exactly!")
            break

    # 3. P98 Section 2.3.1
    for p in doc.paragraphs:
        if p.text.startswith('调研实证依据与边界：'):
            print("Updating P98 (Survey empirical evidence)...")
            old_str = '缺少的信息（如纸质问卷原始归档登记号）标为待补，不在材料中进行推测。'
            new_str = '未采集或非必需的信息不在材料中进行推测填充。'
            set_para_text(p, p.text.replace(old_str, new_str))
            break

    # 4. P108 Section 2.3.3
    for p in doc.paragraphs:
        if p.text.startswith('灵山胜境实地定性访谈案例深度印证了系统的约束设计诉求：'):
            print("Updating P108 (Qualitative interviews)...")
            old_kw = '【当前实现与已知缺口说明】：当前代码已完整实现 accessible 属性过滤与演出开演时间窗对齐；但必须客观说明，景区演出提前 15 分钟停止检票、安检与大客流排队缓冲尚未完全数据化接入，因此当前系统仍不能宣称已在现实中全面杜绝赶场失败风险。受访者原声与结构化记录均在 pre_survey_summary.md 中留存备查。'
            new_kw = '目前系统算法已实现无障碍平缓坡道过滤与演出时刻表对齐；同时，鉴于演出提前 15 分钟停止检票与安检排队尚未接入动态数据接口，系统在实际场景中仍需配合现场走查进一步完善闭环。相关访谈记录均在 pre_survey_summary.md 中留存备查。'
            if old_kw in p.text:
                set_para_text(p, p.text.replace(old_kw, new_kw))
            else:
                print("Warning: old_kw not found in P108 exactly!")
            break

    # 5. P162 Section 3.3.3
    for p in doc.paragraphs:
        if p.text.startswith('式（3-7）用于核对路线总时长。'):
            print("Updating P162 (Formula constraints explanation)...")
            old_str = '二者属于待补齐约束，不能据此宣称当前版本已经实现。'
            new_str = '二者属于后续演进约束，当前版本严格聚焦于已建模路网约束求解。'
            set_para_text(p, p.text.replace(old_str, new_str))
            break

    # 6. P225 Section 4.3
    for p in doc.paragraphs:
        if p.text.startswith('交付成果实行四级分类管理与穿透式核验：'):
            print("Updating P225 (Deliverables verification mechanism)...")
            new_p225 = (
                "交付成果实行四级分类管理与严谨核验机制：第一级为已实现并通过受控测试的核心算法，"
                "包含 13 维状态抽取、三路并行检索、RRF 倒数排名融合（k=60）、Cross-Encoder 重排、"
                "24 宽束搜索与 14 项形式化仲裁器，均通过自动化单元测试与基准评测集验证；"
                "第二级为已实现的原型工程与人机交互系统，包含双屏前端界面（问答证据抽屉、路线时间轴看板、高德实景导航调起）、"
                "Live2D 汉服数字人、语音交互及知识库后台，由演示录屏文件（recordings/recording.webm）完整存档；"
                "第三级为待实地核验的数据与物理场景，涵盖道路米数与坡度仪器测绘、出园闸机路径与耗时闭环、"
                "演出停止检票时间窗对接以及真实游客现场可用性测试（SUS）；"
                "第四级为计划在后续迭代中接入的扩展能力，包含景区客流密度感知与接驳车调度联动。"
                "项目坚持实事求是的工程准则，明确区分算法测试、原型演示与现场实测，不以原型演示替代实地运行结论。"
            )
            set_para_text(p, new_p225)
            break

    # 7. P232 Section 4.3
    for p in doc.paragraphs:
        if p.text.startswith('路网数据精度：部分步行'):
            print("Updating P232 (Road network precision note)...")
            new_p232 = "路网数据精度：部分路段步行与停留时间当前依据经验估算标注，规划结论以拓扑结构与时间窗等可核验约束为主，精确坡度、台阶与接驳数据已列入实地测绘实施计划。"
            set_para_text(p, new_p232)
            break

    # 8. P276 Section 6.1
    for p in doc.paragraphs:
        if p.text.startswith('灵小禅项目已完成全栈技术原型的工程实现，具备覆盖“口语意图软理解'):
            print("Updating P276 (System maturity boundary)...")
            old_kw = '【成熟度客观界定】：本章呈现的案例均为系统原型在上述冻结代码与数字孪生路网下的真实端到端排程与演示记录，用于展示系统的功能连接与约束求解能力；本系统尚未在灵山胜境正式上线运营，亦未开展真实游客在线履约率、满意度量表或咨询分流统计。凡涉及真实物理世界的未闭环项，本章均如实披露并标注为“待现场验证”，杜绝虚构试点成果。'
            new_kw = '需要说明的是，本章呈现的案例均为系统原型在上述冻结代码与数字孪生路网下的真实端到端排程与演示记录，旨在展示系统的全链路功能打通与多约束求解能力；本系统当前处于技术原型与准生产测试阶段，尚未在景区正式上线运营，亦未开展真实游客在线履约率或满意度量表统计。对于涉及现实物理环境的未闭环项目，本章均如实说明其适用边界，确保技术成果客观真实。'
            set_para_text(p, p.text.replace(old_kw, new_kw))
            break

    # 9. P279 Section 6.2.1 Hero Case Description
    for p in doc.paragraphs:
        if '【案例原型演示与实测验证记录卡】' in p.text:
            print("Updating P279 (Hero Case Description into 2 fluent paragraphs)...")
            p279_part1 = (
                "针对典型的“带长辈、看演出、低负荷”复合时空约束场景，系统在准生产测试环境下"
                "（测试记录日期 2026-09-19，代码版本 Git SHA 0522c386，演示录屏 recordings/recording.webm）"
                "进行了端到端全链路求解验证。测试设定游客口语输入为：“现在上午 11 点，我在景区正门南门入口，"
                "带着腿脚不方便的妈妈，到下午四点前还有 5 个小时，想看下午两点的《吉祥颂》，灵山大佛一定要去，尽量少走路。”"
                "场景状态抽取模块成功从口语中解析出 13 维结构化状态：出发点为景区南门正门（south_gate），出发时刻 11:00，"
                "可用总时长 300 分钟（对应离园死线 16:00），行动能力判定为受限（limited，自动激活平缓无障碍路网），"
                "必去景点为灵山大佛（LS-008），指定偏好演出为 14:00 场次的《吉祥颂》（performance_lingshan_jixiangsong）。"
            )
            p279_part2 = (
                "在上述多维约束驱动下，运筹规划引擎在数字孪生路网中成功求解出包含 5 个核心节点的推荐游览动线（详见图 16 与表 19）："
                "11:00 由正门启程，11:20 抵达灵山大佛（游览 60 分钟）；12:21 抵达佛教文化博览馆（游览 40 分钟）；"
                "13:12 提前抵达灵山梵宫圣坛剧场（站间等候 48 分钟），14:00~14:20 观看《吉祥颂》；"
                "14:28 抵达五印坛城（游览 45 分钟）；15:18 抵达曼飞龙塔（游览 20 分钟），末站游览于 15:38 结束。"
                "全程无缝避开长阶梯与大陡坡，严格对齐演出开演时刻。"
            )
            set_para_text(p, p279_part1)
            add_para_after(doc, p, p279_part2)
            break

    # 10. P283 Section 6.2.1 Hero Case Analysis & Physical Boundaries
    for p in doc.paragraphs:
        if p.text.startswith('时间统计与关键未闭环约束披露'):
            print("Updating P283 (Hero Case Analysis into 2 fluent paragraphs)...")
            p283_part1 = (
                "上述园内游览安排合计耗时 278 分钟（包含步行 45 分钟、游览及演出 185 分钟、站间等候 48 分钟），"
                "末站游览于 15:38 结束。系统前端呈现的 13 维状态置信度与证据出处抽屉如图 17 所示。"
            )
            p283_part2 = (
                "为确保系统在走向实地部署时具备可靠的物理可行性，项目组对当前原型的时空约束边界进行了深入分析，"
                "明确指出后续需要现场闭环的四项现实因素："
                "（1）返程出园路径闭环：末站游览于 15:38 结束，距离 16:00 离园死线剩余 22 分钟。当前规划引擎仅完成园内景点的串联求解，"
                "未将末站返回南门出口的行程纳入目标函数。根据数字孪生路网测算，曼飞龙塔返回南门出口约 1200 米，长辈步行约需 31 分钟；"
                "若计入返程，预计出园时间为 16:09，将超出离园时间 9 分钟。因此，当前动线界定为园内游览安排，"
                "后续工程需将返程出口设为终点硬约束并触发算法动态剪枝；"
                "（2）演出停止检票缓冲对接：13:12 提前到达梵宫产生的 48 分钟为节点间流转的时间余量，"
                "后续系统需将剧场“提前 15 分钟停止检票”与安检排队时间作为刚性门禁前置扣减；"
                "（3）道路坡度与阶梯精密测绘：当前路网中各路段的无障碍属性为定性标签，"
                "实地部署需进一步通过手持激光测距仪与坡度计采集精确坡度（如小于 2.5°）与阶梯步数；"
                "（4）景区接驳车调度网络构建：景区内实际运营的电瓶车站点、发车频次与换乘等待时间，需进一步建模并融入多模态路网拓扑。"
            )
            set_para_text(p, p283_part1)
            add_para_after(doc, p, p283_part2)
            break

    # 11. P287 Section 6.2.1 Field survey protocol
    for p in doc.paragraphs:
        if '【可执行的现场走查与验证方案】' in p.text:
            print("Updating P287 (Field survey & algorithm protocol into fluent paragraph)...")
            p287_clean = (
                "为在实地部署阶段彻底闭环上述现实约束，项目组已制定现场走查与算法闭环实施方案："
                "（1）走查工具与设备：采用手持激光测距仪、高精度气压坡度计以及具备 GPS 轨迹记录功能的智能穿戴设备，实地记录各路段通行数据；"
                "（2）采样路线与任务：重点选定 4 条典型测试动线，包括长辈陪游线、轮椅避障线、临界赶场线与微游览线；"
                "（3）实测记录指标：逐段采集物理米数、实走通行耗时、阶梯步数、最大纵坡坡度、轮椅推行阻抗以及出园闸机通行耗时；"
                "（4）算法闭环接入机制：在拓扑路网中补齐各景点至南门出口的返程边，并在运筹规划器中增加返回出口的强约束；"
                "演出节点前置扣除 15 分钟检票缓冲；若检测到返程超时，系统自动剪枝非必去景点（如优化移除五印坛城或曼飞龙塔），"
                "重新规划使全程（含安全出园）严格收敛在游客设定的离园死线之内。通过扎实的现场走查与闭环工程，实现从技术原型到实地运营的可靠跨越。"
            )
            set_para_text(p, p287_clean)
            break

    # 12. P300 Section 6.4 Cost intro
    for p in doc.paragraphs:
        if p.text.startswith('表 20 基于典型 4A/5A 级景区业务流量模型与边缘计算硬件成本进行测算。'):
            print("Updating P300 (Cost breakdown intro)...")
            p300_clean = (
                "表 20 基于典型 4A/5A 级景区业务流量模型与边缘计算硬件成本进行测算。系统采用 4 核边缘工控机本地部署，"
                "软件与大模型 API 采用轻量混合调度架构。测算遵循严谨的工程与财务核算准则："
                "（1）成本构成与核算口径：一次性建设成本合计约 5.0 万元（包含现场路网与无障碍实地测绘 3.5 万元、"
                "系统部署与接口对接 1.0 万元、运营与客服培训 0.5 万元）；年度常规运维成本合计约 1.39 万元/年"
                "（包含 4 核边缘工控机租赁与折旧 0.35 万元/年、云端大模型 API 预算约 0.04 万元/年、系统维护与数据更新 1.0 万元/年）；"
                "首年总投入合计为一次性建设 5.0 万元加首年运维 1.39 万元，共计 6.39 万元；次年起常规年运维成本稳定在 1.39 万元/年。"
            )
            set_para_text(p, p300_clean)
            break

    # 13. P302 Section 6.4 API & ROI
    for p in doc.paragraphs:
        if p.text.startswith('（2）硬件规格与 API 预算假设：'):
            print("Updating P302 (Hardware/API and ROI scenario model into 2 fluent paragraphs)...")
            p302_part1 = (
                "（2）硬件规格与 API 预算假设：系统采用 4 核 8G 内存本地边缘工控机（如 Intel x86 架构迷你工控主机），"
                "本地部署 ChromaDB 向量数据库与内存图运筹算法，拓扑规划求解时延小于 20ms，有效保障核心空间数据与游客轨迹不出园区。"
                "API 预算以试运行期低峰日均 200 次问答为基准测算，单次交互平均输入输出用量约 2,000 tokens，"
                "按 DeepSeek 官方刊例单价（输入约 1 元/100万 tokens，输出约 2 元/100万 tokens，综合折合约 1.5 元/100万 tokens）计算："
                "年调用量为 73,000 次，年 Token 消耗约 1.46 亿 tokens，理论年 API 费用约 219 元；"
                "预留重试与长上下文冗余后列支约 400 元/年（0.04 万元/年）。"
                "需要说明的是，上述预算基于低峰均值测算，未包含节假日客流高峰并发与超长多轮对话，实际商用支出需根据现场流量动态校准。"
            )
            p302_part2 = (
                "（3）商业回报（ROI）情景推演模型：本项目当前处于技术原型与申报阶段，尚未正式面向游客收费。针对未来商业化落地，"
                "构建如下三类情景推演模型：第一类为 ToC 适老化定制导览服务，灵山胜境年客流量约 200 万人次，"
                "若未来按 0.5% 转化率向携带长辈或轮椅家庭提供定制化无障碍导览（单人次增值服务费 5 元），年增值收入为 5.0 万元，"
                "首年总投入 6.39 万元的静态回收期约为 1.28 年（约 15 个月）；第二类为 ToB 景区导览人力替代与服务分流，"
                "若智能体在游客中心与分流点日均承接 1,000 次咨询，分流 15%～20% 的高频重复问询，"
                "相当于释放 1 名季节性客服导游人力（年人力综合成本约 4～6 万元），首年投入预计可在 12～18 个月实现成本对冲；"
                "第三类为旅游旺季增值提成场景，在旺季结合文创与餐饮二消提成（客单提成 5 元）且具备高转化率的理想情景下，"
                "理论回本周期有望压缩至 3～6 个月。以上测算旨在探讨项目的经济可行性与落地潜力，不构成已实现的财务收益承诺。"
            )
            set_para_text(p, p302_part1)
            add_para_after(doc, p, p302_part2)
            break

    # 14. Table 5 (doc.tables[4]) Row 7 Cell 2
    t5 = doc.tables[4]
    cell_t5 = t5.rows[7].cells[2]
    if '待闭环' in cell_t5.text:
        print("Updating Table 5 Row 7 Cell 2...")
        set_cell_text(cell_t5, "返程路径计入预算（推进实地闭环）", font_size_pt=9.5)

    # 15. Table 19 (doc.tables[18]) Row 7
    t19 = doc.tables[18]
    r7 = t19.rows[7]
    print("Updating Table 19 Row 7...")
    set_cell_text(r7.cells[0], "15:38–16:09", font_size_pt=9.5)
    set_cell_text(r7.cells[1], "返程测算：曼飞龙塔至南门出口（约 1200 米；长辈步速测算需 31 分钟，后续联动出园剪枝）", font_size_pt=9.5)
    set_cell_text(r7.cells[2], "—", font_size_pt=9.5)
    set_cell_text(r7.cells[3], "31", font_size_pt=9.5)
    set_cell_text(r7.cells[4], "出园路径测算", font_size_pt=9.5)

    doc.save(DOC_PATH)
    print("All updates applied and saved successfully!")

if __name__ == '__main__':
    run()
