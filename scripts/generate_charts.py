import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import os

# Set Chinese font
plt.rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei', 'Arial Unicode MS', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

out_dir = r'e:\Projects\lingshan-ai-guide-Mao123-doc\竞赛汇报与文档材料包\02_图片与视觉素材'
os.makedirs(out_dir, exist_ok=True)

# -------------------------------------------------------------
# 1. 消融实验高精对比柱状图 (Ablation Bar Chart) - 纯中文版
# -------------------------------------------------------------
def create_ablation_chart():
    profiles = [
        '仅结构化检索',
        '仅向量语义检索',
        '向量检索+重排',
        '仅关键词精确检索',
        '多路检索(无重排)',
        '多路检索(无改写)',
        '灵小禅多路全检索\n（完整方案）'
    ]
    accuracies = [66.0, 94.0, 94.0, 96.0, 90.0, 98.0, 98.0]
    recalls = [69.4, 96.0, 95.0, 97.7, 93.3, 99.3, 98.0]
    latencies = [2.17, 2.34, 2.87, 2.22, 2.36, 2.41, 2.88]

    fig, ax1 = plt.subplots(figsize=(13.5, 6.8), facecolor='#0B1120')
    ax1.set_facecolor('#0F172A')

    x = np.arange(len(profiles))
    width = 0.35

    bar_colors_acc = ['#334155', '#0D9488', '#0D9488', '#0D9488', '#475569', '#14B8A6', '#F59E0B']
    bar_colors_rec = ['#1E293B', '#115E59', '#115E59', '#115E59', '#334155', '#0F766E', '#D97706']

    rects1 = ax1.bar(x - width/2, accuracies, width, label='问答准确率（百分比 %）', color=bar_colors_acc, edgecolor='#38BDF8', linewidth=1.2, alpha=0.95)
    rects2 = ax1.bar(x + width/2, recalls, width, label='事实召回率（百分比 %）', color=bar_colors_rec, edgecolor='#2DD4BF', linewidth=1.2, alpha=0.9)

    ax1.set_ylabel('准确率与召回率（%）', color='#F8FAFC', fontsize=13, fontweight='bold', labelpad=10)
    ax1.set_title('灵小禅 7 组检索组件消融实验对比（权威基线评测）', color='#F8FAFC', fontsize=16, fontweight='bold', pad=20)
    ax1.set_xticks(x)
    ax1.set_xticklabels(profiles, color='#E2E8F0', fontsize=11, fontweight='bold')
    ax1.set_ylim(50, 105)
    ax1.tick_params(colors='#94A3B8')
    ax1.grid(axis='y', linestyle='--', alpha=0.2, color='#64748B')

    # Line for Latency on secondary axis
    ax2 = ax1.twinx()
    ax2.plot(x, latencies, color='#38BDF8', marker='o', linewidth=2.5, markersize=8, label='端到端平均耗时（秒）', linestyle='-.')
    ax2.set_ylabel('端到端耗时（秒）', color='#38BDF8', fontsize=13, fontweight='bold', labelpad=10)
    ax2.set_ylim(1.5, 3.8)
    ax2.tick_params(colors='#38BDF8')

    # Data labels on bars
    for rect in rects1:
        h = rect.get_height()
        ax1.annotate(f'{h:.1f}%',
                     xy=(rect.get_x() + rect.get_width() / 2, h),
                     xytext=(0, 4), textcoords="offset points",
                     ha='center', va='bottom', color='#FFFFFF', fontsize=10, fontweight='bold')

    # Annotation for Full RAG
    ax1.annotate('★ 权威基线：98.0% 准确率\n多路融合与深度重排达到最佳平衡',
                 xy=(6 - width/2, 98), xytext=(3.8, 101),
                 arrowprops=dict(facecolor='#F59E0B', edgecolor='#F59E0B', arrowstyle='->', lw=2),
                 color='#FDE68A', fontsize=11, fontweight='bold',
                 bbox=dict(boxstyle='round,pad=0.5', facecolor='#1E293B', edgecolor='#F59E0B', lw=1.5))

    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper left', facecolor='#1E293B', edgecolor='#475569', labelcolor='#F8FAFC', fontsize=11)

    plt.tight_layout()
    chart_path = os.path.join(out_dir, '图表_7组检索消融实验对比柱状图.png')
    plt.savefig(chart_path, dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print(f'Created: {chart_path}')

# -------------------------------------------------------------
# 2. 综合性能评估雷达图 (Evaluation Radar Chart) - 纯中文版
# -------------------------------------------------------------
def create_radar_chart():
    categories = [
        '事实问答通过率\n(96.0%)',
        '事实召回深度\n(97.0%)',
        '场景状态提取\n(100.0%)',
        '路线硬约束合规\n(100.0%)',
        '真实环境可复现性\n(100.0%)',
        '端到端响应时效\n(85.0%)'
    ]
    values = [96.0, 97.0, 100.0, 100.0, 100.0, 85.0]
    traditional_values = [75.0, 68.0, 45.0, 30.0, 40.0, 90.0]

    num_vars = len(categories)
    angles = np.linspace(0, 2 * np.pi, num_vars, endpoint=False).tolist()
    values += values[:1]
    traditional_values += traditional_values[:1]
    angles += angles[:1]

    fig, ax = plt.subplots(figsize=(9, 9), subplot_kw=dict(polar=True), facecolor='#0B1120')
    ax.set_facecolor('#0F172A')

    # Plot traditional AI guide
    ax.plot(angles, traditional_values, color='#64748B', linewidth=2, linestyle='--', label='传统大模型景区导览')
    ax.fill(angles, traditional_values, color='#64748B', alpha=0.15)

    # Plot Ling Xiaochan
    ax.plot(angles, values, color='#14B8A6', linewidth=3, label='灵小禅·可信游客决策智能体')
    ax.fill(angles, values, color='#14B8A6', alpha=0.35)

    # High-light points
    ax.scatter(angles, values, color='#F59E0B', s=80, zorder=10, edgecolor='#FFFFFF', linewidth=1.5)

    ax.set_theta_offset(np.pi / 2)
    ax.set_theta_direction(-1)
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories, color='#F8FAFC', fontsize=11, fontweight='bold')

    ax.set_rlabel_position(0)
    ax.set_yticks([30, 50, 70, 90, 100])
    ax.set_yticklabels(["30%", "50%", "70%", "90%", "100%"], color='#64748B', fontsize=9)
    ax.set_ylim(0, 108)

    ax.grid(color='#334155', linestyle='--', alpha=0.7)
    ax.spines['polar'].set_color('#1E293B')

    plt.title('灵小禅 vs 传统景区导览 综合能力六维雷达图', color='#F8FAFC', fontsize=15, fontweight='bold', pad=30)
    plt.legend(loc='upper right', bbox_to_anchor=(1.25, 1.1), facecolor='#1E293B', edgecolor='#475569', labelcolor='#F8FAFC', fontsize=11)

    plt.tight_layout()
    chart_path = os.path.join(out_dir, '图表_综合性能评估雷达图.png')
    plt.savefig(chart_path, dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print(f'Created: {chart_path}')

# -------------------------------------------------------------
# 3. 系统分层架构拓扑图 (Architecture Diagram) - 纯中文版
# -------------------------------------------------------------
def create_architecture_diagram():
    fig, ax = plt.subplots(figsize=(14.5, 8.5), facecolor='#0B1120')
    ax.set_facecolor('#0B1120')
    ax.axis('off')

    layers = [
        ("表现层 · 多模态人机交互", "#0284C7", [
            ("数字人拟真交互", "灵小禅立绘与肢体动作驱动 / 实时语音播报"),
            ("移动端高亮动线地图", "景区拓扑底图渲染 / 动态游览折线导航"),
            ("智能多轮对话交互", "自然语言问答气泡 / 行程卡片 / 推荐理由可视化")
        ]),
        ("决策与规划层 · 硬约束规则引擎", "#0D9488", [
            ("物理路网拓扑计算", "景点间步行耗时估算 / 坡度台阶可达性矩阵"),
            ("演艺时空对齐引擎", "演出固定时间窗口 / 提前占座候场时间判定"),
            ("防御性约束校验器", "零违背硬规则过滤 / 不可行时主动拒绝与解释")
        ]),
        ("知识层 · 多路协同检索与重排", "#059669", [
            ("意图理解与改写", "口语化问题拆解 / 专有名词标准化转换"),
            ("三路并行检索矩阵", "向量语义召回 + 结构化规则查询 + 关键词精准匹配"),
            ("排名融合与深度重排", "倒数排名融合算法 + 交叉编码器深度重排")
        ]),
        ("状态理解层 · 游客画像构建", "#D97706", [
            ("自然语言属性抽取", "老人 / 幼儿 / 轮椅 / 行动不便等特殊人群识别"),
            ("游览边界条件锁定", "剩余可用时长 / 当前所处点位 / 必去目标景点"),
            ("动态偏好状态建模", "已游览景点过滤 / 演艺场次倾向性画像")
        ]),
        ("数据底座与可审计追溯", "#475569", [
            ("灵山胜境领域知识库", "景点文化详情 / 票务规则 / 演艺时刻 / 拓扑路网"),
            ("全链路执行日志追踪", "各阶段耗时记录 / 召回切片证据 / 模型执行追踪"),
            ("基准评测与消融套件", "50题知识问答基线 / 40组场景 / 60组路线评测集")
        ])
    ]

    y_start = 0.84
    layer_height = 0.13
    gap = 0.035

    ax.text(0.5, 0.96, "灵小禅：面向真实景区复杂游览场景的 AI 数字人导游 · 系统分层架构",
            color='#F8FAFC', fontsize=18, fontweight='bold', ha='center', va='center')

    for i, (layer_title, border_color, modules) in enumerate(layers):
        y = y_start - i * (layer_height + gap)
        
        rect = patches.FancyBboxPatch((0.04, y), 0.92, layer_height,
                                      boxstyle="round,pad=0.015,rounding_size=0.015",
                                      facecolor='#1E293B', edgecolor=border_color, linewidth=2, alpha=0.95)
        ax.add_patch(rect)

        ax.text(0.06, y + layer_height * 0.5, layer_title,
                color=border_color, fontsize=12, fontweight='bold', va='center', rotation=0)

        box_width = 0.23
        box_gap = 0.02
        start_x = 0.28

        for j, (mod_title, mod_desc) in enumerate(modules):
            bx = start_x + j * (box_width + box_gap)
            by = y + 0.015
            b_rect = patches.FancyBboxPatch((bx, by), box_width, layer_height - 0.03,
                                           boxstyle="round,pad=0.01,rounding_size=0.01",
                                           facecolor='#0F172A', edgecolor='#334155', linewidth=1)
            ax.add_patch(b_rect)
            ax.text(bx + 0.015, by + (layer_height - 0.03) * 0.65, mod_title,
                    color='#F8FAFC', fontsize=11, fontweight='bold', va='center')
            ax.text(bx + 0.015, by + (layer_height - 0.03) * 0.32, mod_desc,
                    color='#94A3B8', fontsize=8.5, va='center')

    for i in range(len(layers) - 1):
        y_arrow = y_start - i * (layer_height + gap) - gap/2
        ax.annotate('', xy=(0.5, y_arrow - 0.008), xytext=(0.5, y_arrow + 0.008),
                    arrowprops=dict(arrowstyle="->", color='#38BDF8', lw=2))

    chart_path = os.path.join(out_dir, '图表_系统五层架构拓扑图.png')
    plt.savefig(chart_path, dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print(f'Created: {chart_path}')

# -------------------------------------------------------------
# 4. 多约束路线决策流程图 (Route Planning Pipeline) - 纯中文版
# -------------------------------------------------------------
def create_route_pipeline_diagram():
    fig, ax = plt.subplots(figsize=(14.5, 7.2), facecolor='#0B1120')
    ax.set_facecolor('#0B1120')
    ax.axis('off')

    ax.text(0.5, 0.93, "灵小禅：从自然语言到可执行游览方案的决策流向",
            color='#F8FAFC', fontsize=17, fontweight='bold', ha='center', va='center')

    steps = [
        ("1. 自然语言需求输入", "“我带坐轮椅的老人，只有3小时\n想看两点演出，大佛必去，现在在正门”", "#38BDF8", 0.05),
        ("2. 游客状态结构化抽取", "● 人群标签：老人 / 轮椅 / 行动不便\n● 时间预算：180 分钟（限时游览）\n● 必去景点：灵山大佛\n● 目标演出：14:00《吉祥颂》", "#D97706", 0.28),
        ("3. 多约束规则引擎校验", "● 自动过滤陡峭长台阶（优选平缓坡道）\n● 演艺时间倒推计算（13:45前抵达剧场）\n● 步行步速与电瓶车接驳耗时精算\n● 现实可行性验证（硬约束 0 违背）", "#0D9488", 0.52),
        ("4. 双轨可信结果输出", "【方案可行时】\n输出精准时间轴与动态推荐路线\n\n【方案不可行时】\n主动澄清并诚实拒绝，说明具体原因", "#10B981", 0.76)
    ]

    card_width = 0.19
    card_height = 0.55
    y_card = 0.22

    for title, desc, color, x in steps:
        rect = patches.FancyBboxPatch((x, y_card), card_width, card_height,
                                      boxstyle="round,pad=0.02,rounding_size=0.02",
                                      facecolor='#1E293B', edgecolor=color, linewidth=2, alpha=0.95)
        ax.add_patch(rect)

        # Header box
        h_rect = patches.FancyBboxPatch((x, y_card + card_height - 0.1), card_width, 0.1,
                                        boxstyle="round,pad=0.01,rounding_size=0.01",
                                        facecolor=color, edgecolor='none')
        ax.add_patch(h_rect)
        ax.text(x + card_width/2, y_card + card_height - 0.05, title,
                color='#FFFFFF', fontsize=12, fontweight='bold', ha='center', va='center')

        # Content text
        ax.text(x + 0.015, y_card + card_height - 0.16, desc,
                color='#F1F5F9', fontsize=10.5, va='top', linespacing=1.6)

    # Draw connecting arrows
    for i in range(len(steps) - 1):
        x_from = steps[i][3] + card_width
        x_to = steps[i+1][3]
        ax.annotate('', xy=(x_to, y_card + card_height/2), xytext=(x_from, y_card + card_height/2),
                    arrowprops=dict(arrowstyle="->", color='#F59E0B', lw=3))

    # Bottom note
    ax.text(0.5, 0.08, "核心优势：大语言模型仅负责自然语言理解与解释，物理世界连通性与时间计算由确定性校验器裁决，彻底根治路线幻觉！",
            color='#FDE68A', fontsize=11, fontweight='bold', ha='center', va='center',
            bbox=dict(boxstyle='round,pad=0.6', facecolor='#1E293B', edgecolor='#F59E0B', lw=1.5))

    chart_path = os.path.join(out_dir, '图表_多约束路线决策流向图.png')
    plt.savefig(chart_path, dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print(f'Created: {chart_path}')

if __name__ == '__main__':
    create_ablation_chart()
    create_radar_chart()
    create_architecture_diagram()
    create_route_pipeline_diagram()
    print("All 4 pure-Chinese charts generated successfully!")
