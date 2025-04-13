【用途说明】
本知识模块用于训练 AI Agent 识别项目是否即将 TGE（发币）或空投，结合多个来源（如官方动态、链上合约、媒体同步、任务平台等）进行多角度验证。Agent 依据信号强度与信息来源可靠性判断哪些项目具备即将 TGE/空投的高概率，避免盲目推送，确保每条预测均具逻辑支撑。

---

【核心概念定义】

- TGE（Token Generation Event）: 项目正式生成代币并开始分发的时间点，通常为代币上线前的关键阶段。
- 公售（Public Sale）: 用户公开参与的代币认购过程，可能以 ICO、IDO、IEO 等形式进行。
- 空投（Airdrop）: 项目免费将代币分发给特定用户，作为回馈、激励或营销行为。

---

【TGE、空投、公售的区别】

| 类型  | 是否花钱 | 目的         | 举例平台                 |
|-------|----------|--------------|--------------------------|
| TGE   | 否       | 上线与分发   | 合约部署、Token上线     |
| 公售  | 是       | 募资与分发   | Binance、Camelot 等     |
| 空投  | 否       | 激励与推广   | 交互、排行榜、Claim 页面 |

---

【判断项目是否即将 TGE / 空投的“强信号”】

✅ 以下行为同时满足 ≥3 项时，Agent 可判断该项目即将发币：

1. **官方已公布 TGE / Claim 日期**
   - 在 Twitter / Medium 明确写出时间或流程

2. **Launchpad 页面上线**
   - 如 Binance、CoinList、Camelot 显示认购时间与发币规则

3. **Token 合约已部署**
   - 链上出现代币合约、Claim Router、MerkleDistributor 等

4. **教程类推文同步出现**
   - 如“空投教程”、“Claim 教程”、“领取流程”等内容由可信 KOL 发布

5. **任务平台更新配合**
   - Galxe / Zealy 等同步任务积分结算或快照公告

6. **KOL + 媒体同步发布**
   - 如 @BlockBeatsAsia 与 @BiteyeCN 同时转发或写教程分析

7. **DEX 预部署流动性池**
   - 可在 Uniswap / Camelot 等链上看到新增交易对或初始化交易事件

---

【判断项目“可能发币”但仍需观察的信号】

🚩 仅满足以下 1-2 项时，不建议立即推送，仅归档并持续追踪：

- 官方仅提到“有发币计划”，未公开合约 / 平台;
- 项目宣布完成融资但未披露 Tokenomics;
- 社区出现 Claim 流言，但官方未证实;
- 推文内容为“猜测型”，无合约地址、参与规则等实证信息;

---

【判断项目是否“画饼”拖延发币】

⚠️ 出现以下情况时，Agent 应保持审慎，避免误导用户参与：

- 官方一再声称“不发币”或拒绝回答 Token 计划;
- 任务平台积分累计后长时间未结算或转换;
- 投资方仅为 logo 拼接，查无任何融资信息来源;
- 合约未部署、无上线日期、也无 Launchpad 信息;

---

【Agent 判断与行为建议】

📢 若出现强信号（如合约部署 + Launchpad 公告 + 媒体教程同步）→ Agent 可直接发布推文，建议语气为【专业 + 冷静】。

👀 若仅出现模糊迹象（如仅是融资、无教程、无Claim）→ Agent 可提示用户保持关注，但不生成预测或教程内容。

🚨 若出现假空投、未开源合约、钓鱼网站 → Agent 应立即发预警。

---

【高频信息源推荐】（用于交叉验证）

官方来源：
- 项目 Twitter、Medium、Discord、Telegram

媒体 / KOL：
- @BlockBeatsAsia、@OdailyChina、@BiteyeCN、@wublockchain12、@SoSoValue_CN

任务平台：
- Galxe、Zealy

链上合约：
- Etherscan、Arbiscan、ZkSync Explorer、BaseScan

Launchpad：
- Binance Launchpad、CoinList、Fjord、Camelot、DAO Maker、OKX Jumpstart

---

【知识应用场景】
- Agent 每日监控链上合约部署 + 官方社媒信号 + KOL 教程 + Launchpad 公告
- 满足 ≥3 信号则生成【高可信度预测】，否则归档监控
- 所有判断基于数据，不凭猜测或模型幻觉

