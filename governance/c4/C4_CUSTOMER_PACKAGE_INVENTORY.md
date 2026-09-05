# C4 Customer Package Inventory Report — 2026-09-05

**Verdict:** `C4_CUSTOMER_PACKAGE_INVENTORY_PASS`  
**Package File:** `SYNTH-C3-MODBUS-RTU-0.2.0-dev.zip`  
**SHA256:** `4bd5703ae80fcea9c1dcf7d5d1ea2a02fe282a5cf6ef3f04a2c9703db5188e59`  
**Byte Size:** `82,853,839` bytes (82.85 MB)

---

## 1. 外部包（Outer Package）文件清单

| 文件路径 | 文件大小 (Bytes) | SHA256 (首8位) | 构件说明 |
|:---|:---:|:---:|:---|
| `MANIFEST.json` | 1,357 | `...` | 确定性交付包清单元数据 |
| `build/installer/JoviModbusDiagnosticToolkit-0.2.0-dev-unsigned.exe` | 34,563,797 | `d86ccc31...` | Windows 桌面安装向导程序（Inno Setup，未签名） |
| `build/JoviModbusDiagnosticToolkit-portable.zip` | 48,288,685 | `7525e4c8...` | 免安装便携版压缩包（解压即可运行） |

---

## 2. 内部便携包（Portable ZIP）关键内容核验

- **主程序：** `JoviModbusDiagnostic/JoviModbusDiagnostic.exe`（编译打包的独立 Windows 可执行程序，内置 PySide6 运行库与依赖动态库）。
- **运行环境要求：** 普通买家**无需**预装 Python 3.10+ 环境，直接双击运行可执行文件即可启动 GUI 诊断工具。
- **源码情况：** 包内**不包含**未编译的 Python 源码工程（`src/` 目录），交付物为纯二进制分发版。
- **虚拟串口驱动：** 包内**不包含**第三方虚拟串口驱动（com0com）。
- **随包附带文档与许可：**
  - `LICENSE.txt`（Jovi 商业评估许可条款）
  - `THIRD_PARTY_NOTICES.md`（第三方开源声明）
  - `SBOM.cdx.json`（CycloneDX 软件物料清单）
  - `docs/product/USER_MANUAL.md`（用户使用手册）
  - `docs/product/COMPATIBILITY_MATRIX.md`（软硬件兼容矩阵）
  - `docs/product/QUICKSTART.md`（快速入门说明）
  - `docs/product/TROUBLESHOOTING.md`（故障排除手册）

---

## 3. 面向买家别名与映射 (Customer-Facing Alias Mapping)

为避免内部工程代号 `SYNTH-C3-` 造成买家困惑，可使用面向买家友好的别名：
- **买家可见别名：** `JoviModbusDiagnosticToolkit-0.2.0-dev-Windows-x64.zip`
- **底层不可变 SHA256：** `4bd5703ae80fcea9c1dcf7d5d1ea2a02fe282a5cf6ef3f04a2c9703db5188e59`
- **映射关系：** 字节完全一致（100% Byte-for-Byte Identical）。

---

## 4. 与商品文案一致性审查结论

经核对，交付包内构件与 Phase D 中通过的合规商品文案严格一致：
- 宣称的 Windows 安装程序与便携版均在包内；
- 宣称的快速指南、用户手册与许可条款均在便携包内；
- 剔除了“买家需懂 Python”、“随包交付源码”、“随包附带虚拟串口驱动”等虚假文案。
- 最终裁决：`C4_CUSTOMER_PACKAGE_INVENTORY_PASS`。
