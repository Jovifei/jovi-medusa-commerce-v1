# R6 Post-Import Independent Audit Prompt

**Audit 类型：** 新会话、只读、独立复算（R6 Post-Import Independent Auditor）
**Audit 对象：** 受控 Commerce 仓库 `jovi-medusa-commerce-v1`（`E:\project\jovi-medusa-commerce-v1`）
**签发依据：** `JOVI-MEDUSA-R6-CONTROLLED-ADOPTION-DECISION-V1`（Human Decision，issued_from_human=true）
**执行 Executor：** `JOVI-COMMERCE-R6-CONTROLLED-REPO-ADOPTION-AND-IMPORT-V1`（已完成，本 Prompt 由该 Executor 生成供独立审计使用）

> 硬性边界：本审计是**只读**的。不得 merge、不得修改 main、不得修改受控仓库源码、不得改写任何冻结证据、不得执行真实平台动作。审计结论只能是 `R6_POST_IMPORT_PASS` 或 `R6_POST_IMPORT_FAIL`（不允许 PASS_WITH_GAPS）。当前仍 `production_integration_allowed=false`。

---

## 背景

Jovi 已人工签发 R6 Controlled Adoption Decision，接受 Medusa v2.19.0 为 Jovi Automation Commerce Core。Commerce Adoption Executor 据此：
1. 创建受控仓库 `jovi-medusa-commerce-v1`（main + development 分支）；
2. 从 R2-R2 已审计源码按 exact import manifest 精确导入 74 文件到 `audit-source/`（canonical tree SHA = `e533f0ce...`，未整目录复制）；
3. 导入并冻结 lockfile、migrations、Docker、tests、SBOM、LICENSE inventory、provenance、source manifest、rollback manifest；
4. 建立 CI、PR-only main、required checks、secret/license/SBOM/provenance/deterministic-build 检查；
5. 在受控仓内重新执行 full synthetic Commerce 验证并产出 `R6_POST_IMPORT_EVIDENCE_PACKAGE`；
6. 停止于 `READY_FOR_R6_POST_IMPORT_INDEPENDENT_AUDIT`，交由本独立审计。

---

## 独立审计要求（逐项复算，不信任 Executor 自述）

### A. 导入完整性（只读复算）
- [ ] A1. 独立复算 `audit-source/` 子树 canonical tree SHA，须等于 `e533f0ce0010cc0f75848b9854d8ccd4da364768f31174349d8981827342f8aa`，且恰好 74 个文件（复用 `governance/r6/ci/verify_source_tree.py`，算法 = 排序文件行→紧凑 JSON→SHA-256）。
- [ ] A2. 逐文件核对导入目标与 `governance/r6/R6_IMPORT_TARGET_SET.json` 一致（source→dest + SHA），无多余、无缺失、无幽灵条目。
- [ ] A3. 确认仓库未跟踪任何被排除项：node_modules、runtime-r2r2/**、.medusa、secrets、logs、review-queue、test credentials、customer data（`git ls-files` 检查 + `.gitignore` 核对）。
- [ ] A4. 确认精确导入方式（exact-byte，非整目录复制），可由 provenance 记录佐证。

### B. 治理与边界（只读）
- [ ] B1. 分支模型：`main` 与 `development` 均存在；`main` 未被直接改写（PR-only 计划在 `governance/r6/BRANCH_PROTECTION_PLAN.md`）。
- [ ] B2. 四件套计划文件存在且 `.sha256` sidecar 可复算：R6_IMPORT_PLAN / R6_IMPORT_TARGET_SET / R6_SOURCE_PROVENANCE / R6_ROLLBACK_PLAN。
- [ ] B3. provenance 记录（SOURCE_MANIFEST.json、PROVENANCE.md、LICENSE_INVENTORY.md）与冻结证据一致。
- [ ] B4. CI workflow `.github/workflows/ci.yml` 覆盖 static-checks（source tree / sidecars / frozen install / tsc / secret scan / license）与 integration（boot 隔离 PG+Redis / Jest integration / regression.sh）。
- [ ] B5. 边界标志全部为 false：production_integration_allowed、real_payment_allowed、real_customer_allowed、xianyu_allowed、auto_delivery_allowed、R12_supersede_allowed。

### C. 确定性构建（复算 build 现场，可选重跑）
- [ ] C1. 复核 OCI labels 绑定 source-tree-sha=`e533f0ce...`、lock-sha=`9855eabf...`、medusa-version=2.19.0（对 `governance/r6/post-import-evidence/build.log` 或现场镜像）。
- [ ] C2. 复核镜像构建含 `tsc --noEmit` 与 `medusa build`；pnpm lockfile SHA = `9855eabf...`。
- [ ] C3. （可选，成本高）重跑 `governance/r6/ci/regression.sh`，确认可复现 PASS。

### D. Synthetic 验证复算（对受控仓证据独立核对）
- [ ] D1. 读取 `governance/r6/post-import-evidence/package.json`（R6_POST_IMPORT_EVIDENCE_PACKAGE）与各 raw artifact（*.out/*.err），独立核对其测试计数与结果字符串，不信任摘要数值本身。
  - jest-unit：6 suites / 12 tests PASS，无 --forceExit（natural shutdown）。
  - jest-integration（service.spec.ts）：1 suite / 3 tests PASS（R1 策略限制）。
  - x2-first / x2-replay：READY_FOR_HUMAN_DELIVERY，environment=SYNTHETIC_X2，synthetic_only=true，replay 语义一致。
  - x2-concurrency：10 runs → unique_results=1。
  - x2-negative：6 用例全部 fail-closed 拒绝，database_unchanged=true。
- [ ] D2. 复核 raw artifact `.sha256` sidecar 与 package.json 内 `raw_evidence_sidecars` 一致。

### E. 结转冻结证据（只读核验存在与 SHA）
- [ ] E1. `evidence/r2r2-freeze/` 下冻结证据存在且 `.sha256` 可复算：SBOM、LICENSE scope/review、SOURCE manifest、Oracle comparison、GATE matrix、initial-source proof、environment。
- [ ] E2. Oracle 7/7 per-file 相等记录（`MEDUSA_R2R2_ORACLE_COMPARISON.json`）→ oracle_status=X2_STAGING_COMMERCE_FLOW_PASS。
- [ ] E3. transaction rollback / PID1 recovery / SBOM / license 为 R2-R2 冻结行为，随 74 文件精确字节导入；本审计复核其冻结 SHA 未被改写。
- [ ] E4. 若上述冻结项需在受控仓内重验，独立审计应复算冻结证据 SHA，而非信任自述。

### F. Findings 与结论
- [ ] F1. 逐项记录 finding（severity：Critical/High/Medium/Low），须含 R2-R2 记录的 Low residuals（F-1 session-cookie、F-2 hardcoded evidence）是否已在受控仓内保持原样/关闭状态。
- [ ] F2. 给出唯一结论：`R6_POST_IMPORT_PASS` 或 `R6_POST_IMPORT_FAIL`。

---

## 通过规则

- 全部 A/B/C/D/E 检查项 PASS，且无 Critical/High/Medium finding，方可 `R6_POST_IMPORT_PASS`。
- 若 A1（tree SHA）或任一 import 完整性检查失败 → 直接 `R6_POST_IMPORT_FAIL`（导入不完整即不能作为正式 Commerce 基线）。
- 任何真实平台动作 / 边界标志置 true / 生产部署 → 立即 `R6_POST_IMPORT_FAIL` 并告警。

## 产出

PASS 时生成（置于受控仓 `governance/r6/post-import-evidence/` 下，只读审计不改写候选源码）：
- `R6_POST_IMPORT_INDEPENDENT_AUDIT_RESULT.md`
- `R6_ADOPTION_DECISION_CANDIDATE.json`（issued_from_human=false）
- 输出状态行：`READY_FOR_JOVI_R6_MAINLINE_OR_ADMIN_CLOSURE`，随后停止，不执行任何后续阶段。

## 禁止

- 不得 merge / rebase / force-push / 改写历史。
- 不得运行 `scripts/human-only/` 或 `scripts/xianyu/human-only/`。
- 不得读取 Cookie、买家消息、卡密、SQLite 表、浏览器 Profile、密码或 Token。
- 不得自动发布、消息、发货、改价、收款、退款、站外导流或验证码/滑块/人脸/风控绕过。
