# C4 Listing Claim Review Report — 2026-09-05

**Verdict:** `C4_LISTING_CLAIM_REVIEW_PASS`  
**Source Evidence:** `governance/c3/C3_LISTING_CLAIM_EVIDENCE.json` (SHA256: `471fc8bcbf6d48c4850a54baa533698e4c71b5d3c5a673e024e2c6ba6e5c3623`)  
**Reviewed Claims:** 12 (KEEP: 10, REWRITE: 2, REMOVE: 0)

---

## 1. 审核原则与安全基线

所有面向买家展示的文案必须由本地已核验的 C3 原始证据直接支持。严禁夸大营销、做出未经测试的承诺或将数字完整性校验混淆为数字签名。

### 严格剔除或重写项：
- **CRC 校验**：严格界定为“计算与校验（错误检测）”，严禁宣称为“硬件纠错”或“自动纠错”。
- **SHA256 完整性码**：严格界定为“防篡改哈希/摘要值”，严禁宣称为“数字签名”（安装包 Authenticode 状态明确为 `NotSigned`）。
- **运行环境与依赖**：交付物为打包后的 Windows 桌面端应用（.exe），买家普通使用无需预装 Python 3.10+，亦无需具备 Python 编程基础；严禁增加“需具备 Python 基础”等脱离交付事实的门槛。
- **虚拟串口与源码**：安装包中不包含独立第三方虚拟串口驱动（com0com），亦未交付原始 Python 源码工程，文案中不得宣称包含此类构件。
- **退款政策**：尊重闲鱼平台数字商品争议与退款规则，不得使用“一经发货概不退款”等绝对免责字样。

---

## 2. 12 项 Claim 审核明细

| Claim ID | 原始主张 | 审核决定 | 面向买家合规表述 | 证据路径与 SHA256 (首8位) | 审核理由 |
|:---|:---|:---:|:---|:---|:---|
| C3-CLAIM-001 | Product release version is 0.2.0-dev | **KEEP** | 当前试点版本为 0.2.0-dev，按 Beta Pilot 透明披露；安装包为未签名构件（UNSIGNED）。 | `src/jovi_modbus/__init__.py`<br>`a1eba6dd...` | Accurately reflects 0.2.0-dev product version and discloses Beta Pilot / unsigned state. |
| C3-CLAIM-002 | Supports Modbus RTU standard read function codes FC01, FC03, and FC04 | **KEEP** | 支持 Modbus RTU 标准读取功能码 FC01（读线圈）、FC03（读保持寄存器）、FC04（读输入寄存器）。 | `docs/product/USER_MANUAL.md`<br>`d66c2261...` | Directly backed by USER_MANUAL.md section 'Main workflow'. |
| C3-CLAIM-003 | Provides COM port parameter configuration including baudrate, parity, stop bits and address scan range 1-247 | **KEEP** | 可配置 COM 串口参数（波特率、校验位、停止位），并支持 1–247 地址范围扫描配置。 | `docs/product/USER_MANUAL.md`<br>`d66c2261...` | Directly backed by USER_MANUAL.md port panel documentation. |
| C3-CLAIM-004 | Device identity identification is strictly governed by reviewed JSON profiles, otherwise returns NOT_AVAILABLE | **KEEP** | 设备身份识别仅依据已审核的 JSON profile 规则比对；无法确认时返回 NOT_AVAILABLE，不虚构设备标识。 | `docs/product/USER_MANUAL.md`<br>`d66c2261...` | Directly backed by USER_MANUAL.md explicit profile behavior statement. |
| C3-CLAIM-005 | Manual write functions FC06 and FC16 are disabled by default in candidate scan mode for safety | **KEEP** | 为保障工业设备现场安全，扫描模式下默认禁用 FC06/FC16 写操作，需用户显式二次确认后方可启用。 | `docs/product/USER_MANUAL.md`<br>`d66c2261...` | Directly backed by USER_MANUAL.md write operation safety guard documentation. |
| C3-CLAIM-006 | Generates diagnostic reports in HTML and PDF formats from unified session data model | **KEEP** | 支持从统一诊断会话数据生成 HTML 与 PDF 格式的诊断测试报告。 | `docs/product/USER_MANUAL.md`<br>`d66c2261...` | Directly backed by USER_MANUAL.md reporting and export section. |
| C3-CLAIM-007 | Protocol engine, CRC calculator, frame parser and offscreen GUI pass 40 unit and integration tests | **REWRITE** | 协议引擎、CRC 校验计算器、帧解析和离屏 GUI 路径已通过 40 项本地单元与集成自动化测试。 | `modbus_test_run.log`<br>`9fdfe577...` | Clarified CRC as computation and verification (error detection), avoiding description as error correction, hardware CRC or digital signature. |
| C3-CLAIM-008 | Release deliverables comprise standalone Windows installer executable and portable standalone ZIP package | **KEEP** | 发布构件包含 Windows 桌面端安装包（.exe）与免安装便携版（Portable .zip）。 | `reports/product/TEST_RESULTS.md`<br>`04c3078b...` | Directly backed by reports/product/TEST_RESULTS.md and release artifacts. |
| C3-CLAIM-009 | Software distributed under Jovi commercial evaluation license terms | **REWRITE** | 本交付物受随包 LICENSE.txt 所载 Jovi 商业评估许可条款约束，具体授权与使用权利以随包法律文本为准。 | `LICENSE.txt`<br>`bacf1b47...` | Clarified commercial evaluation terms without promising perpetual/unrestricted redistribution rights beyond license. |
| C3-CLAIM-010 | Third-party open-source components and licenses documented in THIRD_PARTY_NOTICES.md | **KEEP** | 第三方开源依赖组件与其许可证声明完整记录于随包 THIRD_PARTY_NOTICES.md 文件中。 | `THIRD_PARTY_NOTICES.md`<br>`39698405...` | Directly backed by THIRD_PARTY_NOTICES.md in product root. |
| C3-CLAIM-011 | Requires Windows 10/11 x64 and compatible USB-RS485 adapter with vendor-provided driver | **KEEP** | 运行环境要求为 64 位 Windows 10 或 Windows 11 系统；若连接真实物理设备，需自备兼容的 USB-RS485 转接器及厂商驱动。 | `docs/product/COMPATIBILITY_MATRIX.md`<br>`0d488911...` | Directly backed by COMPATIBILITY_MATRIX.md. |
| C3-CLAIM-012 | Demo simulation mode produces synthetic device telemetry labeled SIMULATED for UI evaluation only | **KEEP** | 软件内置的 Demo 仿真模式仅生成标记为 SIMULATED 的模拟数据用于界面操作评估，不可替代真实物理硬件验收。 | `docs/product/USER_MANUAL.md`<br>`d66c2261...` | Directly backed by USER_MANUAL.md demo mode disclaimer. |

---

## 3. 严格禁止添加的未验证营销宣称清单

- ❌ **禁止添加：** Python 3.10+ required for ordinary buyer use (desktop executable is bundled, Python is not required for buyer)
- ❌ **禁止添加：** Buyer needs Python programming basics (not required for desktop GUI operation)
- ❌ **禁止添加：** Virtual serial port driver / com0com included or bundled (not part of deliverable package)
- ❌ **禁止添加：** Raw Python source project included (not included in binary deliverable package)
- ❌ **禁止添加：** QUICKSTART.md or requirements.txt at outer root (documentation is located inside portable package docs/)
- ❌ **禁止添加：** 3-minute setup or fixed execution time guarantee (unsupported across arbitrary PC setups)
- ❌ **禁止添加：** CRC-16 hardware error correction (CRC is error detection/verification, not correction)
- ❌ **禁止添加：** SHA256 digital signature (SHA256 is integrity digest, Authenticode signature is NotSigned)
- ❌ **禁止添加：** 100% Modbus device compatibility (untested across proprietary vendor variations)
- ❌ **禁止添加：** Universal Windows compatibility without test verification
- ❌ **禁止添加：** Permanent free updates guarantee
- ❌ **禁止添加：** Unlimited lifetime customer support
- ❌ **禁止添加：** Absolute blanket non-refundable policy (platform supports refund/dispute process)

---

## 4. 审核结论

12 项 C3 原始 Claim 全部通过本地原始文件哈希重新核验（100% 逐文件匹配）。其中 10 项直接保留（KEEP），2 项按安全合规准则重写（REWRITE）。所有未验证营销宣称已明确剔除，审核结论为：`C4_LISTING_CLAIM_REVIEW_PASS`。
