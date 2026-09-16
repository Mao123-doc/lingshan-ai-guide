# Release Rehearsal

## 确定性门禁

在工作树根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-release.ps1
```

脚本执行 Python evaluator、Backend API/可靠性/安全测试、Backend build、Frontend unit test、Frontend lint、Frontend build 和 `git diff --check`，并写入脱敏的 `evaluation/verification/release-manifest.json`。

## 浏览器门禁

确认 Vite/Playwright 依赖可用后执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-release.ps1 -RunBrowser
```

通过条件是 Desktop Chromium 与 Mobile Chromium 的 12 条核心旅程全部通过；失败时必须保留 Playwright trace 和 screenshot。

## 真实运行门禁

Vector Service、Backend 和真实 LLM 已启动后执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-release.ps1 -RunRuntimeSmoke
```

Runtime Smoke 非零退出、LLM fallback、Trace 不一致或 Vector 不可用时，禁止运行 50 题 Baseline 和任何消融实验。

## 交付判定

只有 manifest 的 `status=passed`、当前 commit SHA 正确、工作树 clean、所有 P0/P1 门禁通过，才允许作为竞赛交付检查点或创建 PR。
