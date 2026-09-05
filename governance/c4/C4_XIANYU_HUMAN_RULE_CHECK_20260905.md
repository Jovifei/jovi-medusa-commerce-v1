# C4 Xianyu Human Rule Check — 2026-09-05

**Status:** `PENDING_HUMAN_IN_APP_CONFIRMATION`  
**Required Actor:** Jovi (Manual in-app verification)  
**Safety Rule:** No browser automation, no Cookie/Token scraping, no profile scraping, no unredacted buyer PII in Git.

---

## 1. 人工核验操作指引

在签署 `C4_HUMAN_PILOT_DECISION` 启动 Pilot 前，请 Jovi 本人打开闲鱼客户端/网页端，使用拟开展试点的卖家账号进行以下 6 项核对：

### 待核对清单 (Checklist for Jovi)：

- [ ] **1. 类目允许性 (Category Permitted)：**  
  发布该 Modbus RTU 诊断工具包软件/服务，选择“电脑/数码配件 -> 软件/编程工具/源码服务”或相关类目是否可正常编辑并保存草稿？
- [ ] **2. 平台资质与费用提示 (Notices / Qualifications / Fees)：**  
  发布流程中是否出现虚拟/数字商品特殊资质要求、保证金缴纳提示或交易技术服务费提示？
- [ ] **3. 实际履约选项展示 (Fulfillment Options Displayed)：**  
  该账号与该类目下，订单发货界面是否实际提供“无需物流 / 在线虚拟发货”选项？
- [ ] **4. 平台退款与争议规则 (Refund / Dispute Rules)：**  
  平台当前展示给买家的虚拟商品售后/退款提示为何种规则？确认无任何“绝对不退款”霸王条款。
- [ ] **5. 价格与库存接受度 (Price & Inventory)：**  
  输入拟定建议价格 `99.00 CNY` 及库存 `10 件`，平台系统是否正常接受？
- [ ] **6. 人工交付方式兼容性 (Delivery Transport Compatible)：**  
  通过私聊发送受控云盘链接及 SHA256 校验码的交付方式，是否符合当前平台沟通与交易规范？

---

## 2. 核验结果记录区（由 Jovi 人工确认后填入）

- **核验完成时间：** [待填写]
- **使用卖家账号：** [Jovi 本人个人账号 / 仅记录脱敏标识]
- **选定发布类目：** [例如：电脑数码配件/软件工具]
- **虚拟发货可用性：** [可用 / 需特殊说明]
- **特别费用或保证金：** [无 / 有 (说明金额)]
- **人工核验结论：** `C4_XIANYU_HUMAN_RULE_CHECK_PASS` (需 Jovi 确认)
