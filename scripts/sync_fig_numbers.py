# -*- coding: utf-8 -*-
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('final_full_content.md', 'r', encoding='utf-8') as f:
    text = f.read()

# Update 5.4.2 to include the two figure captions
old_part = """其一，专有名词同名混淆（以“灵山大照壁题字作者”用例 #14 为例）。由于涉及专有名词歧义，单关键词通道的事实召回率仅为 0.50（评测判定未通过）；完整方案通过向量通道补充语义关联，将召回率提升至 1.00（判定通过）。

其二，建筑层数精确数字（以“佛教文化博览馆位置与层数”用例 #15 为例）。向量检索通道对“地上三层、地下一层”的具体数字缺乏足够敏感度，召回率仅为 0.50；完整方案结合结构化属性表精确查询，使召回率恢复到 1.00。"""

new_part = """其一，专有名词同名混淆（以“灵山大照壁题字作者”为例，见图 13）。由于涉及专有名词歧义，单关键词通道的事实召回率仅为 0.50（评测判定未通过）；完整方案通过向量通道补充语义关联，将召回率提升至 1.00（判定通过）。
图 13  边缘案例一：“灵山大照壁题字作者”，单关键词召回率 0.50（FAIL），完整方案 1.00（PASS）

其二，建筑层数精确数字（以“佛教文化博览馆位置与层数”为例，见图 14）。向量检索通道对“地上三层、地下一层”的具体数字缺乏足够敏感度，召回率仅为 0.50；完整方案结合结构化属性表精确查询，使召回率恢复到 1.00。
图 14  边缘案例二：“佛教文化博览馆位置与层数”，单向量召回率 0.50（FAIL），完整方案 1.00（PASS）"""

if old_part in text:
    text = text.replace(old_part, new_part)
    print("✓ Updated Section 5.4.2 captions for 图 13 and 图 14")
else:
    print("Warning: old_part not found in 5.4.2")

# Update Section 6.2.1 figures: 图 13 -> 图 15, 图 14 -> 图 16
text = text.replace("（详见图 13 与表 19）", "（详见图 15 与表 19）")
text = text.replace("图 13  原型路线输出：园内游览动线 278 分钟闭环与充裕离园缓冲", "图 15  原型路线输出：园内游览动线 278 分钟闭环与充裕离园缓冲")
text = text.replace("证据出处抽屉如图 14 所示。", "证据出处抽屉如图 16 所示。")
text = text.replace("图 14  原型需求理解与数据出处：13 维需求状态抽取结果展示", "图 16  原型需求理解与数据出处：13 维需求状态抽取结果展示")

# Update Section 6.2.3 figure: 图 15 -> 图 17
text = text.replace("如图 15。", "如图 17。")
text = text.replace("界面如图 15 所示", "界面如图 17 所示")
text = text.replace("图 15  信息不足时的澄清追问：先补齐出发位置、当前时间与可用时长再规划", "图 17  信息不足时的澄清追问：先补齐出发位置、当前时间与可用时长再规划")

with open('final_full_content.md', 'w', encoding='utf-8') as f:
    f.write(text)

with open('竞赛汇报与文档材料包/upload/final_full_content.md', 'w', encoding='utf-8') as f:
    f.write(text)

print("✓ Updated both final_full_content.md files to 17 figures!")
