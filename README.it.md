<p align="center">
  <a href="https://opencode.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Logo OpenCode">
    </picture>
  </a>
</p>
<p align="center">L’agente di coding AI open source.</p>
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

### Installazione

This is a personal fork distributed as source. Build it yourself:

```bash
git clone https://github.com/mliotta/opencode.git
cd opencode
bun install                # requires Bun (https://bun.sh)
bun run dev                # run from source
```

> [!NOTE]
> The package-manager commands you may have seen for upstream `opencode` (`curl | bash`, `npm i -g opencode-ai`, `brew install opencode`, `scoop`, `choco`, `pacman`, `mise`, `nixpkgs`) all install [`sst/opencode`](https://github.com/sst/opencode), not this fork. To run this fork's CAR-powered engine, build from source.

### Agenti

OpenCode include due agenti integrati tra cui puoi passare usando il tasto `Tab`.

- **build** – Predefinito, agente con accesso completo per il lavoro di sviluppo
- **plan** – Agente in sola lettura per analisi ed esplorazione del codice
  - Nega le modifiche ai file per impostazione predefinita
  - Chiede il permesso prima di eseguire comandi bash
  - Ideale per esplorare codebase sconosciute o pianificare modifiche

È inoltre incluso un sotto-agente **general** per ricerche complesse e attività multi-step.
Viene utilizzato internamente e può essere invocato usando `@general` nei messaggi.

Scopri di più sugli [agenti](https://opencode.ai/docs/agents).

### Documentazione

Per maggiori informazioni su come configurare OpenCode, [**consulta la nostra documentazione**](https://opencode.ai/docs).

### Contribuire

Se sei interessato a contribuire a OpenCode, leggi la nostra [guida alla contribuzione](./CONTRIBUTING.md) prima di inviare una pull request.

### Costruire su OpenCode

Se stai lavorando a un progetto correlato a OpenCode e che utilizza “opencode” come parte del nome (ad esempio “opencode-dashboard” o “opencode-mobile”), aggiungi una nota nel tuo README per chiarire che non è sviluppato dal team OpenCode e che non è affiliato in alcun modo con noi.

### FAQ

#### In cosa è diverso da Claude Code?

È molto simile a Claude Code in termini di funzionalità. Ecco le principali differenze:

- 100% open source
- Non è legato a nessun provider. Anche se consigliamo i modelli forniti tramite [OpenCode Zen](https://opencode.ai/zen), OpenCode può essere utilizzato con Claude, OpenAI, Google o persino modelli locali. Con l’evoluzione dei modelli, le differenze tra di essi si ridurranno e i prezzi scenderanno, quindi essere indipendenti dal provider è importante.
- Supporto LSP pronto all’uso
- Forte attenzione alla TUI. OpenCode è sviluppato da utenti neovim e dai creatori di [terminal.shop](https://terminal.shop); spingeremo al limite ciò che è possibile fare nel terminale.
- Architettura client/server. Questo, ad esempio, permette a OpenCode di girare sul tuo computer mentre lo controlli da remoto tramite un’app mobile. La frontend TUI è quindi solo uno dei possibili client.

---

**Unisciti alla nostra community** [Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
