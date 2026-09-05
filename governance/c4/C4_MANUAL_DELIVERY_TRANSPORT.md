# C4 Manual Delivery Transport Specification — 2026-09-05

**Status:** `C4_MANUAL_DELIVERY_TRANSPORT_FROZEN`  
**Transport Type:** `HUMAN_CONTROLLED_ONE_TO_ONE`  
**Automated Send:** `false` (100% 人工受控发送)

---

## 1. 交付物规格与买家可见别名映射

- **不可变底层构建包：** `SYNTH-C3-MODBUS-RTU-0.2.0-dev.zip`
- **底层 SHA256：** `4bd5703ae80fcea9c1dcf7d5d1ea2a02fe282a5cf6ef3f04a2c9703db5188e59`
- **字节大小：** `82,853,839` 字节
- **面向买家规范别名：** `JoviModbusDiagnosticToolkit-0.2.0-dev-Windows-x64.zip`
- **映射关系：** 别名文件与底层交付包逐字节严格一致（Byte-for-byte identical）。

---

## 2. 交付流程标准规程

1. **付款核验**：买家在闲鱼平台完成支付后，Jovi 手工核验收款事实。
2. **凭据准备**：系统登记脱敏 `pilot_order_id`，准备对应的交付包。
3. **安全网盘/受控下载生成**：Jovi 生成带访问提取码或有效期（默认 7 天）的受控下载链接。
4. **私聊发送与校验引导**：Jovi 在闲鱼私聊发送下载链接、提取码以及官方 SHA256 完整性摘要。
5. **完整性校验命令**：提供 Windows 原生校验指令：
   ```powershell
   certutil -hashfile JoviModbusDiagnosticToolkit-0.2.0-dev-Windows-x64.zip SHA256
   ```
6. **收货与评价**：买家确认校验码无误并解压测试后，引导买家点击确认收货。
