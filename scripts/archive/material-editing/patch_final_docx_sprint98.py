# -*- coding: utf-8 -*-
"""
scripts/archive/material-editing/patch_final_docx_sprint98.py
Applies the 4 key expert jury recommendations directly into final.docx:
1. P135: Fix sim -> Formula (3-1) Cosine Similarity
2. P137: Fill Formula (3-2) RRF Score
3. P155, P156: Clean Planck h_i and sj_ai artifacts in Formula (3-6)
4. P157: Fill Formula (3-7) Total Time Conservation Constraint
5. P165: Fix Top(2₄) -> Top-24
6. After P191: Add AMap viaPoints waypoints injection & Multimodal Transit extension
7. P301: De-mine commercial model (replace 5-yuan fee with ToB/ToG three-pillar model)
8. After P319: Fill Section 7.4 (Future Planning) with 4 strategic technical pillars
"""

import os
import shutil
import sys
import docx
from docx.oxml.ns import qn
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def set_run_font(run, font_name='Times New Roman', east_asia='宋体', size_pt=10.5, bold=False):
    run.font.name = font_name
    run.font.size = Pt(size_pt)
    run.bold = bold
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn('w:eastAsia'), east_asia)

def format_formula_para(p, formula_text):
    p.text = ''
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = None
    p.paragraph_format.line_spacing = 1.25
    p.paragraph_format.space_before = 38100  # ~3pt
    p.paragraph_format.space_after = 38100   # ~3pt
    r = p.add_run(formula_text)
    set_run_font(r, font_name='Times New Roman', east_asia='宋体', size_pt=10.0, bold=False)

def format_body_para(p, text, first_line_indent=304800, line_spacing=1.25, space_after=38100):
    p.text = ''
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.first_line_indent = first_line_indent
    p.paragraph_format.line_spacing = line_spacing
    p.paragraph_format.space_after = space_after
    r = p.add_run(text)
    set_run_font(r, font_name='Times New Roman', east_asia='宋体', size_pt=10.5, bold=False)

def insert_paragraph_after(doc, target_p, text, first_line_indent=304800, line_spacing=1.25, space_after=38100):
    new_p = doc.add_paragraph()
    target_p._element.addnext(new_p._element)
    format_body_para(new_p, text, first_line_indent, line_spacing, space_after)
    return new_p

def main():
    target_dirs = [d for d in os.listdir('.') if os.path.exists(os.path.join(d, '03_申报文档与技术报告', 'Word工作稿'))]
    if not target_dirs:
        print("Error: upload dir not found")
        return
    
    doc_path = os.path.join(target_dirs[0], '03_申报文档与技术报告', 'Word工作稿', 'final.docx')
    backup_path = os.path.join(target_dirs[0], '03_申报文档与技术报告', 'Word工作稿', 'final_backup_pre_sprint98.docx')
    
    # 1. Create backup
    shutil.copyfile(doc_path, backup_path)
    print(f"Backed up {doc_path} to {backup_path}")

    doc = docx.Document(doc_path)
    print(f"Loaded {doc_path}, total paragraphs: {len(doc.paragraphs)}")

    # 2. Fix P135: sim -> Formula (3-1)
    p135 = doc.paragraphs[135]
    formula_31 = "sim(q, d) = (q · d) / (||q|| · ||d||) = q_norm · d_norm    (3-1)"
    format_formula_para(p135, formula_31)
    print("✓ P135 patched with Formula (3-1) Cosine Similarity")

    # 3. Fix P137: Empty -> Formula (3-2)
    p137 = doc.paragraphs[137]
    formula_32 = "RRF_Score(d) = ∑_{c ∈ C} [w_c / (k + r_c(d))]    (3-2)"
    format_formula_para(p137, formula_32)
    print("✓ P137 patched with Formula (3-2) RRF Score")

    # 4. Fix P155 & P156: Formula (3-6) and text
    p155 = doc.paragraphs[155]
    formula_36 = "ai = ei-1 + wi,    bi = ai + hi,    ei = bi + vi    (3-6)"
    format_formula_para(p155, formula_36)
    
    p156 = doc.paragraphs[156]
    text_156 = (
        "普通节点无需等待时 hi＝0；安排在场次 sj 观看演出时，必须先满足物理到达时刻 ai ≤ sj，"
        "再令开始时刻 bi＝sj、等待排队缓冲 hi＝sj - ai，停留时长 vi 由相应演出数据合同确定。"
        "等待时长表示演出开场前的必要前置时间轴空档，用于吸收排队与检票缓冲。"
    )
    format_body_para(p156, text_156)
    print("✓ P155 & P156 cleaned (Planck h_i and sj_ai resolved)")

    # 5. Fix P157: Empty -> Formula (3-7)
    p157 = doc.paragraphs[157]
    formula_37 = "T_total = ∑_{i=1}^n [w(v_{i-1}, v_i) + hi + vi] ≤ T_budget    (3-7)"
    format_formula_para(p157, formula_37)
    print("✓ P157 patched with Formula (3-7) Total Time Conservation Constraint")

    # 6. Fix P165: Top(2₄) -> Top-24
    p165 = doc.paragraphs[165]
    if "Top(2₄)" in p165.text or "Top" in p165.text:
        text_165 = p165.text.replace("Top(2₄)", "Top-24")
        format_body_para(p165, text_165)
        print("✓ P165 patched: Top(2₄) replaced with Top-24")

    # 7. Add Navigation & Multimodal after P191
    p191 = doc.paragraphs[191]
    nav_text = (
        "在规划成果交付与实景导航方面，推荐页支持“一键调起高德/百度实景步行导航”。针对通用商用地图缺乏景区内部私有微观无障碍台账的痛点，系统重构了调起协议：不向高德传递单一终点坐标，而是通过高德 URI API 的 viaPoints（途经点）参数，强制注入 Dijkstra 算法计算出的无障碍拐点经纬度折线序列（amapuri://route/plan/?sourceApplication=lingshan&dev=0&t=2&viaPoints=lat1,lon1|...），强行锁死第三方商用地图在景区内部的导航轨迹，彻底杜绝公网地图将轮椅游客重新引向“百子戏弥勒”陡峭长阶的硬性违规隐患。"
    )
    multimodal_text = (
        "此外，针对大型山岳景区长距离徒步体能消耗问题，系统已设计“人车多模态接驳规划（Multimodal Transit Extension）”架构：将景区固定观光电瓶车站点建模为拓扑图中的虚拟换乘超边，综合考虑发车班次间隔（Headway 5~10min）、排队候车时长与轮椅乘降无障碍踏板操作时间，使算法具备在纯轮椅坡道徒步与“步行＋景交车”换乘方案之间智能权衡与自适应求解的能力。"
    )
    new_nav_p = insert_paragraph_after(doc, p191, nav_text)
    insert_paragraph_after(doc, new_nav_p, multimodal_text)
    print("✓ Inserted AMap viaPoints & Multimodal Transit paragraphs after P191")

    # 8. Re-locate P301 (now shifted by 2 paragraphs -> P303) and patch commercial model
    p_comm = None
    for p in doc.paragraphs:
        if "商业回报（ROI）情景推演" in p.text:
            p_comm = p
            break
            
    if p_comm:
        new_comm_text = (
            "（3）商业回报（ROI）情景推演：坚决贯彻国家《无障碍环境建设法》与文旅公共服务均等化导向，面向游客端的无障碍定制导览与数字人问答全面实行公益免费，杜绝任何向弱势群体变相收费的政策与伦理风险。系统构建稳健的“ToB/ToG 三位一体”商业闭环模型："
            "一为 ToG 智慧文旅适老专项扶持（覆盖一次性 CAPEX）：系统符合文旅部与住建部智慧旅游沉浸式体验、无障碍适老示范工程等申报标准，景区可申请 10~20 万元建设专项资金，直接覆盖 5.0 万元的一次性实地测绘与建制成本；"
            "二为 ToB 咨询分流减员增效（对冲日常 OPEX）：系统日均承接 1,000 次以上咨询并自动分流 15%~20% 高频基础问询（如票价政策、演出场次、轮椅租借点），相当于直接替代 1 名专职季节性外包客服或导游（年化人力成本约 4~6 万元），首年即可全面对冲 1.39 万元年度运维成本，次年起每年为景区净节约运营支出 2.5~4.5 万元；"
            "三为商业二消精准导流 CPS 分润（增量创收）：利用多约束规划动线对游客用餐与文化消费的精准卡点，将客流柔性引导至景区梵宫蔬食馆、文创礼品店等高价值消费业态，按核销客单收取 3%~5% 分成（按日均转化 30~50 单、客单价 50 元测算，年创收可达 2.7~4.5 万元）。在综合情景下，系统仅凭“运营降本＋二消分成”即可在 3~6 个月内完全收回首年综合投入，具备极高的商业自洽性与产业推广价值。"
        )
        format_body_para(p_comm, new_comm_text)
        print("✓ De-mined commercial model (Replaced 5-yuan disability fee with ToB/ToG three-pillar model)")

    # 9. Re-locate P319 (Section 7.4) and insert future planning
    p_74 = None
    for p in doc.paragraphs:
        if p.text.strip().startswith("7.4  未来规划"):
            p_74 = p
            break

    if p_74:
        future_plans = [
            "1. 多模态立体交通网络融合（Multimodal Transit Extension）：将景区观光电瓶车、索道缆车及无障碍摆渡车全面纳入统一路网拓扑，把各乘车站点建模为虚拟换乘超边（Hyper-edge），结合固定发车班次（Headway 5~10min）、实时排队时长与轮椅乘降踏板操作耗时，实现“无障碍步行＋景交车换乘”的全场景立体组合运筹求解。",
            "2. 移动端轻量扫街测绘工具链（48 小时极速冷启动）：研发基于智能手机高精度 RTK-GPS、气压计与 IMU 惯导融合的低成本移动端扫街建图 APP。景区巡检员只需推行轮椅巡查一次，系统即可自动提取道路实测长度、阶梯阻断点与坡度阻抗（对标 GB 50763—2012 国家标准），将新景区数字孪生测绘成本由 3.5 万元压降至 5000 元以内，实现 48 小时极速交付。",
            "3. 客流潮汐动态感知与突发事件熔断重规划：深度对接景区智慧大脑（含闸机客流监控、圣坛剧场瞬时承载量与恶劣天气雷达），建立“动态运营事件广播总线”。当发生剧场客满限流或暴雨导致台阶湿滑封路时，系统秒级响应并在游客游览途中自动触发“步中增量重规划（In-stride Dynamic Re-planning）”，避免现场聚集拥堵。",
            "4. 边缘网关语义缓存与中华优秀文化多语种出海：在本地 4 核工控机网关层落地基于内存向量索引的轻量级 Semantic Cache，将票价、开放时间等高频 Top-20 事实问答的时延压缩至 15ms 以内、并发 QPS 提升至 300+；同时构建梵语、英语、日语等多语种数字人文化导览大模型知识库，向海外游客讲好中国文化与东方智慧故事，践行科技赋能文化出海的国家战略。"
        ]
        
        curr_p = p_74
        # Add introductory lead-in paragraph
        intro_text = "立足无锡灵山胜境的落地经验，团队为灵小禅制定了清晰的技术演进与跨场景规模化拓展路线："
        curr_p = insert_paragraph_after(doc, curr_p, intro_text)
        
        for fp_text in future_plans:
            curr_p = insert_paragraph_after(doc, curr_p, fp_text)
            
        print("✓ Section 7.4 filled with 4 strategic technical roadmap pillars")

    # 10. Save docx
    doc.save(doc_path)
    print(f"Successfully saved updated Word document to {doc_path} (Total paragraphs: {len(doc.paragraphs)})")

if __name__ == "__main__":
    main()
