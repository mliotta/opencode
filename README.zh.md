<p align="center">
  <a href="https://opencode.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="OpenCode logo">
    </picture>
  </a>
</p>
<p align="center">开源的 AI Coding Agent。</p>
<p align="center">
  <a href="https://opencode.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/opencode-ai"><img alt="npm" src="https://img.shields.io/npm/v/opencode-ai?style=flat-square" /></a>
  <a href="https://github.com/mliotta/opencode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/mliotta/opencode/publish.yml?style=flat-square&branch=main" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

[![OpenCode Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://opencode.ai)

---

> [!NOTE]
> **This is the [Matt Liotta](https://github.com/mliotta) fork of [opencode](https://github.com/sst/opencode), rebuilt on top of [CAR](https://github.com/Parslee-ai/car-releases) — the Common Agent Runtime.** See the [English README](README.md#powered-by-car) for what changes.

---

### 安装

This is a personal fork distributed as source. Build it yourself:

```bash
git clone https://github.com/mliotta/opencode.git
cd opencode
bun install                # requires Bun (https://bun.sh)
bun run dev                # run from source
```

> [!NOTE]
> The package-manager commands you may have seen for upstream `opencode` (`curl | bash`, `npm i -g opencode-ai`, `brew install opencode`, `scoop`, `choco`, `pacman`, `mise`, `nixpkgs`) all install [`sst/opencode`](https://github.com/sst/opencode), not this fork. To run this fork's CAR-powered engine, build from source.

### Agents

OpenCode 内置两种 Agent，可用 `Tab` 键快速切换：

- **build** - 默认模式，具备完整权限，适合开发工作
- **plan** - 只读模式，适合代码分析与探索
  - 默认拒绝修改文件
  - 运行 bash 命令前会询问
  - 便于探索未知代码库或规划改动

另外还包含一个 **general** 子 Agent，用于复杂搜索和多步任务，内部使用，也可在消息中输入 `@general` 调用。

了解更多 [Agents](https://opencode.ai/docs/agents) 相关信息。

### 文档

更多配置说明请查看我们的 [**官方文档**](https://opencode.ai/docs)。

### 参与贡献

如有兴趣贡献代码，请在提交 PR 前阅读 [贡献指南 (Contributing Docs)](./CONTRIBUTING.md)。

### 基于 OpenCode 进行开发

如果你在项目名中使用了 “opencode”（如 “opencode-dashboard” 或 “opencode-mobile”），请在 README 里注明该项目不是 OpenCode 团队官方开发，且不存在隶属关系。

### 常见问题 (FAQ)

#### 这和 Claude Code 有什么不同？

功能上很相似，关键差异：

- 100% 开源。
- 不绑定特定提供商。推荐使用 [OpenCode Zen](https://opencode.ai/zen) 的模型，但也可搭配 Claude、OpenAI、Google 甚至本地模型。模型迭代会缩小差异、降低成本，因此保持 provider-agnostic 很重要。
- 内置 LSP 支持。
- 聚焦终端界面 (TUI)。OpenCode 由 Neovim 爱好者和 [terminal.shop](https://terminal.shop) 的创建者打造，会持续探索终端的极限。
- 客户端/服务器架构。可在本机运行，同时用移动设备远程驱动。TUI 只是众多潜在客户端之一。

---

**加入我们的社区** [飞书](https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=738j8655-cd59-4633-a30a-1124e0096789&qr_code=true) | [X.com](https://x.com/opencode)
