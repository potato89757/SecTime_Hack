# hack-v1-tm14-di-yi-ci-bi-sai

# Drop Verse | Web3 Alpha 智能情报代理

## 项目简介
Drop Verse 是一个构建于 Eliza OS 框架之上的 Web3 专属 AI Agent，专注于帮助用户（尤其是加密新手与散户）精准追踪：

- 代币生成事件（TGE）
- 公募项目（IDO、ICO、IEO）
- 已验证的空投机会
- Claim 页面提醒与任务指引

Drop Verse 不发布臆测、不制造噪音，仅转发来自可信来源的可验证信息。

## 核心功能

**1. Alpha 信号捕捉**  
自动识别发币、公募、TGE 等关键事件信号，来源包括官方公告、头部媒体、Launchpad 发布等。

**2. 空投教程筛选**  
识别可信账号发布的高质量空投教程并转发，用清晰语句总结操作路径，帮助用户降低参与门槛。

**3. Claim 页面预警**  
结合链上合约部署、快照时间、媒体同步发布等条件，判断项目是否即将开放 Claim 页面。

**4. 引用转推系统**  
自动引用或转发可信账号内容，并使用自身语气重新组织语言发布，无虚构、无主观评价。

**5. 多源交叉验证机制**  
依据知识库规则对代币消息进行来源验证和内容一致性比对，提高信息可信度。

## 项目结构

```
/agent-dropverse
├── character.json               # Agent 性格与语气设定
├── knowledge/
│   ├── tge_basics.txt           # TGE 基础概念知识
│   ├── fake_airdrop_warnings.txt  # 钓鱼空投识别规则
│   ├── claim_pattern_checklist.txt # Claim 页面上线前信号
│   ├── alpha_crosscheck_rules.txt # 多源验证标准
│   └── verified_kol_list.txt     # 可引用账号名单
├── messageExamples.json         # 多轮互动范例
├── postExamples.json            # 推文发布示例
├── retweetRules.txt             # 转发规则设定
└── assets/                      # 品牌素材、封面图、Logo
```

## 数据来源
- Twitter API（官方项目账号、KOL）
- 公链浏览器（Etherscan、Arbiscan 等）
- Launchpad 平台（Binance Launchpad、CoinList、Camelot、Fjord）
- 空投平台（Galxe、Zealy、Layer3）
- 加密媒体（BlockBeats、Odaily、吴说区块链、TechFlowPost）

## 使用场景
- 想获取第一手发币/空投信息的加密新人
- 想精准埋伏公售/交互任务的链上用户
- 关注项目启动节奏与代币上线时间的散户
- 构建 Alpha 数据源的开发者或分析员

## 技术栈
- Eliza OS v0.25+
- Node.js + Typescript
- Twitter 插件（agent-twitter-client）
- JSON 格式知识库嵌入与交互规则配置

## 贡献
目前为个人维护项目，未来可能开放贡献者协作，敬请关注。

## 免责声明
Drop Verse 仅发布可验证信息，不提供财务建议、不预测市场走势、不转发虚假内容。所有用户请自行判断与研究（DYOR）。

## 开源协议
MIT License


