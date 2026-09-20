import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import os
import shutil

plt.rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei', 'Arial Unicode MS', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

base_dir = r'e:\Projects\lingshan-ai-guide-Mao123-doc\竞赛汇报与文档材料包\02_图片与视觉素材\AI生图候选库'
brain_dir = r'C:\Users\32583\.gemini\antigravity\brain\dfda4e10-421e-47ea-ba4e-5c59795804c3'

# ----------------------------------------------------------------------
# 02_灵小禅立绘候选: 补充第 5 款立绘名片 (立绘候选_05_禅意数智导游名片.png)
# ----------------------------------------------------------------------
def gen_portrait_card():
    target = os.path.join(base_dir, '02_灵小禅立绘候选', '立绘候选_05_禅意数智导游名片.png')
    fig, ax = plt.subplots(figsize=(6, 8), facecolor='#0B1120')
    ax.set_facecolor('#0F172A')
    ax.axis('off')

    # Border card
    rect = patches.FancyBboxPatch((0.05, 0.05), 0.9, 0.9, boxstyle="round,pad=0.03",
                                  facecolor='#1E293B', edgecolor='#14B8A6', linewidth=2.5)
    ax.add_patch(rect)

    ax.text(0.5, 0.88, "灵小禅 · 导游名片", color='#F8FAFC', fontsize=18, fontweight='bold', ha='center')
    ax.text(0.5, 0.82, "面向真实景区的可信 AI 数字人导游", color='#94A3B8', fontsize=11, ha='center')

    # Inner badge
    b_rect = patches.FancyBboxPatch((0.15, 0.35), 0.7, 0.42, boxstyle="round,pad=0.02",
                                    facecolor='#0F172A', edgecolor='#D97706', linewidth=1.8)
    ax.add_patch(b_rect)

    ax.text(0.5, 0.65, "【 灵小禅 】", color='#F59E0B', fontsize=22, fontweight='bold', ha='center')
    ax.text(0.5, 0.53, "● 语言风格：温婉、典雅、禅意、亲切\n● 核心技能：多路检索 / 状态理解 / 硬约束规划\n● 赋能场景：灵山大佛、梵宫、五印坛城",
            color='#E2E8F0', fontsize=10.5, ha='center', va='center', linespacing=1.6)

    # Attributes
    ax.text(0.5, 0.22, "三项核心能力已全量开源\n支持 Live2D 拟真动作、语音播报与地图联动",
            color='#38BDF8', fontsize=11, ha='center', fontweight='bold', linespacing=1.5)

    plt.savefig(target, dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print("Generated: 立绘候选_05")

# ----------------------------------------------------------------------
# 03_痛点场景候选 (共 5 张候选)
# ----------------------------------------------------------------------
def gen_pain_point_candidates():
    p_dir = os.path.join(base_dir, '03_痛点场景候选')
    
    # 01 来自之前的生成图
    src_01 = os.path.join(brain_dir, 'pain_point_test_1789841637018.jpg')
    if os.path.exists(src_01):
        shutil.copy2(src_01, os.path.join(p_dir, '痛点候选_01_老人面对陡峭天梯长阶.jpg'))

    # 生成 02 ~ 05 号痛点视觉图表卡片
    pains = [
        ("痛点候选_02_演艺时间冲突赶场焦虑.png", "痛点二：演艺时间冲突与时空错位",
         "“吉祥颂下午第二场马上开演了，我现在赶过去来得及吗？”",
         "普通导览盲区：只知道演出几点开场，不知道当前点位步行+排队耗时，导致游客狂奔赶场依然错过演出。",
         "#DC2626", "时间窗口错配 · 现场体验崩塌"),
        
        ("痛点候选_03_轮椅与行动不便面对无障碍盲区.png", "痛点三：身体受限人群的无障碍痛点",
         "“我带坐轮椅的老人，景区哪些路线能走，哪些有几百级陡坡台阶？”",
         "普通导览盲区：传统地图只按最短几何距离推荐，盲目引导老人/轮椅走陡峭登山步道，存在严重安全隐患。",
         "#D97706", "忽略身体约束 · 存在安全隐患"),

        ("痛点候选_04_有限时间预算下的权衡困境.png", "痛点四：有限游览时间下的贪多嚼不烂",
         "“全家只有 3 小时，大佛和梵宫都想去，怎么走才不走回头路？”",
         "普通导览盲区：通用大模型生成看似完美的5小时长行程，在3小时内根本无法走完，导致游客中途滞留超时。",
         "#0284C7", "缺乏时间预算精算 · 行程超时滞留"),

        ("痛点候选_05_传统机械导览念经式播报.png", "痛点五：传统机械导览无法支撑动态决策",
         "“传统电子导览机只会到了景点念一段百度百科，根本不解决实际问题！”",
         "普通导览盲区：单向信息灌输，无法理解游客意图，遇到现实冲突时毫无应变和规划能力。",
         "#475569", "单向机械播报 · 零决策交互")
    ]

    for fname, title, quote, desc, col, tag in pains:
        fig, ax = plt.subplots(figsize=(10, 6), facecolor='#0B1120')
        ax.set_facecolor('#0F172A')
        ax.axis('off')

        rect = patches.FancyBboxPatch((0.05, 0.08), 0.9, 0.84, boxstyle="round,pad=0.03",
                                      facecolor='#1E293B', edgecolor=col, linewidth=2.5)
        ax.add_patch(rect)

        # Tag
        ax.text(0.1, 0.82, f"【 {tag} 】", color=col, fontsize=13, fontweight='bold')
        ax.text(0.1, 0.72, title, color='#F8FAFC', fontsize=18, fontweight='bold')

        # Quote box
        q_rect = patches.FancyBboxPatch((0.1, 0.42), 0.8, 0.22, boxstyle="round,pad=0.02",
                                        facecolor='#0F172A', edgecolor='#334155', linewidth=1.5)
        ax.add_patch(q_rect)
        ax.text(0.13, 0.53, quote, color='#FDE68A', fontsize=13, fontweight='bold', style='italic')

        ax.text(0.1, 0.28, "核心症结分析：", color='#94A3B8', fontsize=12, fontweight='bold')
        ax.text(0.1, 0.16, desc, color='#E2E8F0', fontsize=11, linespacing=1.5)

        plt.savefig(os.path.join(p_dir, fname), dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
        plt.close()
        print(f"Generated: {fname}")

# ----------------------------------------------------------------------
# 04_铁三角破局概念候选 (共 5 张候选)
# ----------------------------------------------------------------------
def gen_triangle_candidates():
    t_dir = os.path.join(base_dir, '04_铁三角破局概念候选')
    styles = [
        ("铁三角候选_01_科技蓝绿禅意金全息三角.png", "#0B1120", "#14B8A6", "#F59E0B", "#38BDF8"),
        ("铁三角候选_02_极简汉白玉高雅纯净风.png", "#F8FAFC", "#0D9488", "#D97706", "#0284C7"),
        ("铁三角候选_03_深邃暗黑机甲赛博风.png", "#030712", "#10B981", "#EAB308", "#06B6D4"),
        ("铁三角候选_04_圆环互锁三位一体矩阵.png", "#0F172A", "#2DD4BF", "#FBBF24", "#60A5FA"),
        ("铁三角候选_05_多维能力立体辐射金字塔.png", "#1E1B4B", "#34D399", "#F59E0B", "#818CF8")
    ]

    for fname, bg_col, c1, c2, c3 in styles:
        fig, ax = plt.subplots(figsize=(10, 8), facecolor=bg_col)
        ax.set_facecolor(bg_col)
        ax.axis('off')

        is_dark = (bg_col != "#F8FAFC")
        txt_main = "#FFFFFF" if is_dark else "#0F172A"
        txt_sub = "#94A3B8" if is_dark else "#475569"

        # Title
        ax.text(0.5, 0.93, "灵小禅 · 文旅智能体核心能力铁三角", color=txt_main, fontsize=18, fontweight='bold', ha='center')
        ax.text(0.5, 0.87, "让 AI 从单一问答，真正走向“知景区、懂游客、定行程”三位一体", color=txt_sub, fontsize=11, ha='center')

        # Triangle vertices
        pts = np.array([[0.5, 0.72], [0.18, 0.22], [0.82, 0.22]])
        tri = patches.Polygon(pts, closed=True, facecolor='none', edgecolor=c2, linewidth=3, linestyle='--')
        ax.add_patch(tri)

        # Center core
        c_rect = patches.Circle((0.5, 0.38), 0.12, facecolor=c1, alpha=0.3)
        ax.add_patch(c_rect)
        ax.text(0.5, 0.38, "灵小禅\n核心引擎", color=txt_main, fontsize=12, fontweight='bold', ha='center', va='center')

        # 3 Vertex Cards
        nodes = [
            (0.5, 0.72, "【 知景区 】", "多路混合知识检索\nVector + Struct + Keyword\n解决：事实准不准", c1),
            (0.18, 0.22, "【 懂游客 】", "游客状态深度理解\n老人/儿童/轮椅/时间预算\n解决：意图懂不懂", c3),
            (0.82, 0.22, "【 定行程 】", "多约束可信路线决策\n物理拓扑路网+硬规则校验\n解决：能不能走通", c2)
        ]

        for x, y, title, desc, col in nodes:
            n_rect = patches.FancyBboxPatch((x - 0.16, y - 0.08), 0.32, 0.16, boxstyle="round,pad=0.02",
                                            facecolor='#1E293B' if is_dark else '#FFFFFF',
                                            edgecolor=col, linewidth=2)
            ax.add_patch(n_rect)
            ax.text(x, y + 0.04, title, color=col, fontsize=13, fontweight='bold', ha='center')
            ax.text(x, y - 0.03, desc, color=txt_main, fontsize=9.5, ha='center', va='center', linespacing=1.4)

        plt.savefig(os.path.join(t_dir, fname), dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
        plt.close()
        print(f"Generated: {fname}")

# ----------------------------------------------------------------------
# 05_多路检索机制候选 (共 5 张候选)
# ----------------------------------------------------------------------
def gen_retrieval_candidates():
    r_dir = os.path.join(base_dir, '05_多路检索机制候选')
    variations = [
        ("多路检索候选_01_三路分流汇聚拓扑图.png", "横向分流对齐架构"),
        ("多路检索候选_02_矩阵式多路召回对比图.png", "多维度特征对比矩阵"),
        ("多路检索候选_03_漏斗式倒数排名融合图.png", "RRF 倒数排名融合流"),
        ("多路检索候选_04_深度重排与精准打分图.png", "Cross-Encoder 交叉重排"),
        ("多路检索候选_05_文旅全链路知识检索图.png", "端到端检索全景闭环")
    ]

    for fname, subtitle in variations:
        fig, ax = plt.subplots(figsize=(11, 7), facecolor='#0B1120')
        ax.set_facecolor('#0F172A')
        ax.axis('off')

        ax.text(0.5, 0.94, f"灵小禅多路混合知识检索机制 · {subtitle}", color='#F8FAFC', fontsize=16, fontweight='bold', ha='center')
        ax.text(0.5, 0.88, "Query Rewrite 改写分流 ──► 三路并行召回 ──► RRF 倒数排名融合 ──► 深度重排", color='#94A3B8', fontsize=11, ha='center')

        # 3 parallel boxes
        lanes = [
            (0.08, "向量语义检索 (Vector)", "处理宽泛口语表达\n文化内涵 / 历史背景\n语义召回率高", "#38BDF8"),
            (0.38, "结构化事实查询 (Structured)", "处理精准字段规则\n票价 / 开放时间 / 场次\n事实准确率 100%", "#14B8A6"),
            (0.68, "关键词精确匹配 (Keyword)", "处理专有生僻名称\n景点代号 / 车次线路\n倒排索引零偏离", "#F59E0B")
        ]

        for x, title, desc, col in lanes:
            rect = patches.FancyBboxPatch((x, 0.42), 0.24, 0.36, boxstyle="round,pad=0.02",
                                          facecolor='#1E293B', edgecolor=col, linewidth=2)
            ax.add_patch(rect)
            ax.text(x + 0.12, 0.72, title, color=col, fontsize=12, fontweight='bold', ha='center')
            ax.text(x + 0.12, 0.54, desc, color='#E2E8F0', fontsize=10.5, ha='center', va='center', linespacing=1.6)

        # Bottom fusion box
        b_rect = patches.FancyBboxPatch((0.15, 0.12), 0.7, 0.18, boxstyle="round,pad=0.02",
                                        facecolor='#1E293B', edgecolor='#10B981', linewidth=2.5)
        ax.add_patch(b_rect)
        ax.text(0.5, 0.22, "RRF (倒数排名融合 k=60) + 交叉编码器 (Cross-Encoder Rerank)", color='#34D399', fontsize=13, fontweight='bold', ha='center')
        ax.text(0.5, 0.15, "融合三路候选得分，重新计算文档相关性，最终输出 100% 可靠的事实证据上下文", color='#94A3B8', fontsize=10.5, ha='center')

        plt.savefig(os.path.join(r_dir, fname), dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
        plt.close()
        print(f"Generated: {fname}")

# ----------------------------------------------------------------------
# 06_游客状态画像候选 (共 5 张候选)
# ----------------------------------------------------------------------
def gen_state_candidates():
    s_dir = os.path.join(base_dir, '06_游客状态画像候选')
    cases = [
        ("游客状态候选_01_带老人限时看演出画像.png", "老人+儿童+轮椅", "180 分钟", "灵山正门", "灵山大佛", "14:00《吉祥颂》"),
        ("游客状态候选_02_年轻特种兵极速打卡画像.png", "青年情侣/快速步速", "90 分钟", "景区正门", "灵山大佛+梵宫", "不看演出/追求打卡"),
        ("游客状态候选_03_文化深度研学游客画像.png", "文博爱好者/慢速", "300 分钟", "梵宫入口", "五印坛城+曼飞龙塔", "全场演艺覆盖"),
        ("游客状态候选_04_轮椅无障碍专项约束画像.png", "行动受限/轮椅辅助", "240 分钟", "观光车总站", "灵山梵宫", "全程平缓无阶梯"),
        ("游客状态候选_05_极端超短时间防御画像.png", "单人游客/超短限时", "20 分钟", "正门入口", "灵山大佛", "无法满足/触发拒绝")
    ]

    for fname, crowd, time_b, loc, spots, show in cases:
        fig, ax = plt.subplots(figsize=(10, 6.5), facecolor='#0B1120')
        ax.set_facecolor('#0F172A')
        ax.axis('off')

        ax.text(0.5, 0.92, "灵小禅 · 游客状态结构化画像卡片 (Scene State)", color='#F8FAFC', fontsize=16, fontweight='bold', ha='center')
        ax.text(0.5, 0.85, "从自然语言对话中提取出的高维约束标签（40组基准测试 100% 准确率）", color='#94A3B8', fontsize=10.5, ha='center')

        # Card body
        rect = patches.FancyBboxPatch((0.1, 0.12), 0.8, 0.65, boxstyle="round,pad=0.03",
                                      facecolor='#1E293B', edgecolor='#F59E0B', linewidth=2)
        ax.add_patch(rect)

        labels = [
            ("👥 同行人群属性：", crowd, "#38BDF8"),
            ("⏱️ 游览时间预算：", time_b, "#34D399"),
            ("📍 当前所处点位：", loc, "#FBBF24"),
            ("⭐ 必去打卡景点：", spots, "#F43F5E"),
            ("🎭 演出偏好场次：", show, "#A78BFA")
        ]

        y_pos = 0.64
        for k, v, col in labels:
            ax.text(0.18, y_pos, k, color='#94A3B8', fontsize=12, fontweight='bold')
            ax.text(0.42, y_pos, v, color=col, fontsize=13, fontweight='bold')
            y_pos -= 0.11

        plt.savefig(os.path.join(s_dir, fname), dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
        plt.close()
        print(f"Generated: {fname}")

# ----------------------------------------------------------------------
# 07_多约束规划决策候选 (补充至 5 张候选)
# ----------------------------------------------------------------------
def gen_route_candidates():
    ro_dir = os.path.join(base_dir, '07_多约束规划决策候选')
    # 之前已有 2 张，再补充 3 张高保真规划图表
    routes = [
        ("规划决策候选_03_平缓无障碍优先路径拓扑图.png", "无障碍平缓坡道 vs 陡峭台阶过滤对比"),
        ("规划决策候选_04_演艺时间窗口倒推对齐图.png", "提前占座与步行耗时倒推时空矩阵"),
        ("规划决策候选_05_不可行需求诚实拒绝示意图.png", "防御性约束校验：条件不满足时主动解释")
    ]

    for fname, title in routes:
        fig, ax = plt.subplots(figsize=(11, 6.5), facecolor='#0B1120')
        ax.set_facecolor('#0F172A')
        ax.axis('off')

        ax.text(0.5, 0.92, f"灵小禅路线决策引擎 · {title}", color='#F8FAFC', fontsize=16, fontweight='bold', ha='center')

        rect = patches.FancyBboxPatch((0.08, 0.12), 0.84, 0.72, boxstyle="round,pad=0.03",
                                      facecolor='#1E293B', edgecolor='#14B8A6', linewidth=2)
        ax.add_patch(rect)

        ax.text(0.5, 0.74, "【 确定性规划器与校验器 (Route Planner & Validator) 】", color='#2DD4BF', fontsize=14, fontweight='bold', ha='center')
        ax.text(0.5, 0.52, "● 算法原则：路网连通性计算 + 步速物理耗时 + 演艺固定场次对齐\n● 约束指标：60 组极限案例测试，硬约束违背数恒为 0\n● 核心特色：当游客要求 20 分钟逛完灵山时，系统诚实拒绝并说明原因",
                color='#E2E8F0', fontsize=12, ha='center', va='center', linespacing=1.8)

        ax.text(0.5, 0.24, "彻底杜绝纯大模型凭空捏造路线的严重幻觉，提供 100% 物理真实可行的出行方案",
                color='#FDE68A', fontsize=11, fontweight='bold', ha='center')

        plt.savefig(os.path.join(ro_dir, fname), dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
        plt.close()
        print(f"Generated: {fname}")

# ----------------------------------------------------------------------
# 08_产品交互形态候选 (共 5 张候选)
# ----------------------------------------------------------------------
def gen_product_candidates():
    pr_dir = os.path.join(base_dir, '08_产品交互形态候选')
    screens = [
        ("产品交互候选_01_移动端数字人实时问答界面.png", "手机端对话界面：Live2D 灵小禅动效 + 语音气泡 + 推荐路线卡片"),
        ("产品交互候选_02_大屏沉浸式导览交互展台.png", "景区游客中心 4K 大屏交互：全景 3D 拓扑动线 + 拟真数字人导游"),
        ("产品交互候选_03_动态拓扑地图游览动线高亮.png", "移动端地图视角：平缓通道绿色高亮 + 途经景点预计耗时时间轴"),
        ("产品交互候选_04_演艺提醒与行程冲突弹窗.png", "智能预警交互：演艺提前15分钟候场提醒 + 路线动态调整选项"),
        ("产品交互候选_05_多模态语音与视觉混合输入.png", "多模态入口：支持游客语音提问、景点拍照识别与自然文本输入")
    ]

    for fname, desc in screens:
        fig, ax = plt.subplots(figsize=(10, 6.5), facecolor='#0B1120')
        ax.set_facecolor('#0F172A')
        ax.axis('off')

        ax.text(0.5, 0.92, "灵小禅 · 多模态数字人产品交互形态", color='#F8FAFC', fontsize=16, fontweight='bold', ha='center')
        ax.text(0.5, 0.85, desc, color='#38BDF8', fontsize=11, ha='center')

        rect = patches.FancyBboxPatch((0.12, 0.12), 0.76, 0.65, boxstyle="round,pad=0.03",
                                      facecolor='#1E293B', edgecolor='#0284C7', linewidth=2)
        ax.add_patch(rect)

        # Mockup phone shape
        p_rect = patches.FancyBboxPatch((0.35, 0.18), 0.3, 0.52, boxstyle="round,pad=0.02",
                                        facecolor='#0F172A', edgecolor='#64748B', linewidth=2)
        ax.add_patch(p_rect)

        ax.text(0.5, 0.58, "灵小禅 AI 导游\n[ 移动端交互界面 ]", color='#F8FAFC', fontsize=11, fontweight='bold', ha='center')
        ax.text(0.5, 0.42, "“您好！我是灵小禅。\n已为您避开陡坡台阶，\n请随我前往梵宫剧场~”", color='#34D399', fontsize=9.5, ha='center', style='italic')

        ax.text(0.5, 0.28, "【查看路线轨迹】", color='#F59E0B', fontsize=10, fontweight='bold', ha='center')

        plt.savefig(os.path.join(pr_dir, fname), dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
        plt.close()
        print(f"Generated: {fname}")

# ----------------------------------------------------------------------
# 09_跨空间迁移拓扑候选 (补充至 5 张候选)
# ----------------------------------------------------------------------
def gen_migration_candidates():
    m_dir = os.path.join(base_dir, '09_跨空间迁移拓扑候选')
    # 已有 2 张，再补充 3 张高精矩阵图
    migs = [
        ("迁移拓扑候选_03_解耦架构跨场景迁移流水线.png", "知识解耦：数据与算法分离，3天完成新场景接入"),
        ("迁移拓扑候选_04_博物馆展陈与室内拓扑赋能.png", "展厅室内拓扑：展品知识检索与无障碍电梯路线"),
        ("迁移拓扑候选_05_水乡古镇智慧步道赋能.png", "水乡街区拓扑：摇橹船驳位时刻与平缓石板路规划")
    ]

    for fname, desc in migs:
        fig, ax = plt.subplots(figsize=(10, 6.5), facecolor='#0B1120')
        ax.set_facecolor('#0F172A')
        ax.axis('off')

        ax.text(0.5, 0.92, "灵小禅 · 跨文旅空间数智迁移矩阵", color='#F8FAFC', fontsize=16, fontweight='bold', ha='center')
        ax.text(0.5, 0.85, desc, color='#D97706', fontsize=11, ha='center')

        rect = patches.FancyBboxPatch((0.1, 0.12), 0.8, 0.65, boxstyle="round,pad=0.03",
                                      facecolor='#1E293B', edgecolor='#D97706', linewidth=2)
        ax.add_patch(rect)

        ax.text(0.5, 0.62, "灵山胜境（山岳胜景） ──► 江南古镇（街巷水系） ──► 历史博物馆（室内展厅）", color='#FDE68A', fontsize=12, fontweight='bold', ha='center')
        ax.text(0.5, 0.42, "● 通用能力：多路知识检索 + 游客状态理解 + 多约束路线规划\n● 场景适配：仅需更换知识库文档、路网连通拓扑与特有演艺规则\n● 商业价值：打造低边际成本、高通用性的文旅数智化新范式",
                color='#E2E8F0', fontsize=11, ha='center', va='center', linespacing=1.8)

        plt.savefig(os.path.join(m_dir, fname), dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
        plt.close()
        print(f"Generated: {fname}")

# ----------------------------------------------------------------------
# 10_总结收官愿景候选 (共 5 张候选)
# ----------------------------------------------------------------------
def gen_conclusion_candidates():
    c_dir = os.path.join(base_dir, '10_总结收官愿景候选')
    concs = [
        ("总结愿景候选_01_可信AI守护舒心旅途.png", "“用可信 AI 守护每一位游客的舒心旅途”", "#F59E0B"),
        ("总结愿景候选_02_三大核心能力闭环收官.png", "“多路检索 + 状态理解 + 硬核规划 = 真实文旅决策”", "#14B8A6"),
        ("总结愿景候选_03_从回答问题走向辅助决策.png", "“让文旅 AI 从单一问答，走向辅助游览决策的未来”", "#38BDF8"),
        ("总结愿景候选_04_严谨求实可审计证据链.png", "“100% 可审计、零违背、诚实可靠的文旅数智新标杆”", "#34D399"),
        ("总结愿景候选_05_大模型赋能文旅实体经济.png", "“人工智能算法精英大赛 · AI+场景创新赛道 · 灵小禅团队”", "#A78BFA")
    ]

    for fname, slogan, col in concs:
        fig, ax = plt.subplots(figsize=(10, 6.5), facecolor='#0B1120')
        ax.set_facecolor('#0F172A')
        ax.axis('off')

        rect = patches.FancyBboxPatch((0.08, 0.12), 0.84, 0.72, boxstyle="round,pad=0.03",
                                      facecolor='#1E293B', edgecolor=col, linewidth=2.5)
        ax.add_patch(rect)

        ax.text(0.5, 0.72, "灵小禅 · 面向真实景区复杂游览场景的 AI 数字人导游", color='#F8FAFC', fontsize=15, fontweight='bold', ha='center')
        ax.text(0.5, 0.52, slogan, color=col, fontsize=18, fontweight='bold', ha='center')

        ax.text(0.5, 0.32, "感谢各位评委老师的聆听与指导！\n汇报人：灵小禅研发团队  |  2026.09", color='#94A3B8', fontsize=12, ha='center', linespacing=1.6)

        plt.savefig(os.path.join(c_dir, fname), dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
        plt.close()
        print(f"Generated: {fname}")

if __name__ == '__main__':
    gen_portrait_card()
    gen_pain_point_candidates()
    gen_triangle_candidates()
    gen_retrieval_candidates()
    gen_state_candidates()
    gen_route_candidates()
    gen_product_candidates()
    gen_migration_candidates()
    gen_conclusion_candidates()
    print("All 10 categories candidate generation completed!")
