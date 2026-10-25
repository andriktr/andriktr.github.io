---
title: "Agentic AI Basics: What a Coding Agent Actually Does"
excerpt: "How a coding agent works under the hood: the agent loop, the layers of context, permissions, modes, subagents and skills, explained with GitHub Copilot CLI."
date: 2026-10-14
urlSlug: Agentic-AI-Basics-Copilot-CLI
tags:
  - AI
  - GitHub
  - GitHub Copilot
  - CLI
  - DevOps
  - Automation
toc: true
draft: true
---

I'm preparing an internal talk on GitHub Copilot CLI. While putting it together, I realised the most useful part isn't the list of features and commands. It's the questions people ask once they start using an agent, which all come down to the same thing: *what is the agent actually doing when it "thinks"?* Why does it read files nobody asked it to read? Why does it get slower in a long session? Why does it ask permission for some things and not others?

All of these have the same answer, and it's simpler than most people expect. This post is the written version of the talk. It explains how an agent works, then goes through the main features of Copilot CLI. The commands are Copilot CLI's, but the ideas apply just as well to Claude Code or any other coding agent. Once you understand the loop, every feature is just a way to steer it.

## Chat vs. Agent

- **Chat** (Copilot in the browser, ChatGPT): you ask, and it answers from what it already knows. One shot. If it needs a file, *you* paste it in.
- **Agent**: you give it a goal, and it looks things up, runs commands, edits files, checks the result and keeps going until it's done. It does the copy-pasting itself.

The model behind both can be the same. The difference is the **loop** around the model and the **tools** it's allowed to use.

## The Agent Loop

Here is one turn, from prompt to answer:

```
 ┌─────┐  1. prompt     ┌──────────────────────────────────────┐
 │     │───────────────▶│ CONTEXT                              │◀───────────┐
 │     │ "Why is        │ system prompt · instructions · tools │            │
 │     │  orders-api    │ · conversation · tool results        │            │
 │     │  failing in    └──────────────────┬───────────────────┘            │
 │     │  dev?"                            │ sent in full, every step       │
 │     │                                   ▼                                │
 │     │  esc = stop         ┌───────────────────────────┐  ↻ AGENT LOOP    │
 │     │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─▶│          MODEL            │  repeats until   │
 │ YOU │                     │ "I'll check the pods"     │  the model has   │
 │     │                     └──┬─────────────────────┬──┘  an answer       │
 │     │       wants a tool     │                     │                     │
 │     │                        ▼                     │                     │
 │     │  2. ask YOU  ┌──────────────────────────┐    │ has the answer      │
 │     │◀────────────▶│ needs YOU?               │    │                     │
 │     │  "Run it?"   │ · approve a tool call    │    │                     │
 │     │              │ · answer a question      │    │                     │
 │     │  "Which env?"└────────────┬─────────────┘    │                     │
 │     │                           ▼                  │                     │
 │     │              ┌──────────────────────────┐    │  result appended:   │
 │     │              │ CLI runs:                │────┼─ "orders-api-7f9c ──┘
 │     │              │ kubectl get pods -n      │    │   CrashLoopBackOff"
 │     │              │   orders-api-dev         │    │
 │     │              └──────────────────────────┘    │
 │     │  3. answer                                   │
 │     │◀─────────────────────────────────────────────┘
 │     │  "It crashes on startup: the DB host
 │     │   is wrong in the ConfigMap."
 └─────┘
```

The diagram shows one trip round. A real answer usually takes several: **get pods → see CrashLoopBackOff → read the logs → read the ConfigMap → answer.** Each result decides the next step, the same way you'd troubleshoot it yourself.

In four lines:

1. **The CLI sends the model everything:** the instructions, the conversation so far and the list of tools it may use.
2. **The model replies in one of two ways:** "call this tool with these arguments", or "here's my answer".
3. **For a tool call, the CLI runs it** and appends the result to the context. Some calls stop for you first.
4. **Repeat** until the model answers instead of calling a tool. One prompt from you can mean 2 steps or 40.

You can watch this happen. Ask Copilot CLI something like "What's in this repo?" and, when the answer arrives, scroll up: above it, the CLI printed what the model asked for, a directory listing and then a few file reads. Nobody told it which files to open. It looked around, read what it needed and only then answered.

### Where you come in

You sit in the loop at three points, plus an escape hatch:

- **Prompt:** you start the turn and set the goal.
- **Ask you:** the loop pauses for you in two cases:
  - **approval**, before an edit or a shell command you haven't already allowed ("Run it?")
  - **a clarifying question**: when the task is ambiguous, it asks instead of guessing ("Which env, dev or prod?"). Asking you is itself a tool (`ask_user`), so your answer goes into the context like any other tool result. Plan mode does this a lot.
- **Answer:** the turn ends and it's your move again. Follow up, correct it, or undo it.
- **`esc`:** you can stop the loop at any step and steer it with a new prompt.

In autopilot mode the "ask you" arrow mostly disappears: the agent answers its own questions and keeps going without waiting. More on that later. You're never out of the loop. You decide where you sit in it.

## What's in the Context

The model has no settings and no memory of its own. **Everything it knows about your session is text in the context**, and that text is built in layers:

```
┌───────────────────────────────────────────────────────────┐
│ 1. System prompt            written by GitHub, built in   │  ← you can't edit it
│    "You are Copilot CLI… use tools like this… be safe…"   │
│    + environment: OS, cwd, date, git branch               │
├───────────────────────────────────────────────────────────┤
│ 2. Tool definitions         name + description + params   │  ← YOU pick which tools
│    for every tool: read, edit, shell, GitHub MCP…         │
├───────────────────────────────────────────────────────────┤
│ 3. Custom instructions      .github/copilot-instructions  │  ← YOU write this (/init)
│                             AGENTS.md, ~/.copilot/…       │
├───────────────────────────────────────────────────────────┤
│ 4. Skill & agent list       names + descriptions only;    │  ← full skill text loads
│                             body loads when needed        │     only when used
├───────────────────────────────────────────────────────────┤
│ 5. Conversation             your prompts, its answers,    │  ← grows every step
│                             every tool call + result      │
└───────────────────────────────────────────────────────────┘
```

- **The system prompt** is the product's built-in job description: who it is, how to use its tools, how to behave, plus facts about your environment. That's why the same model behaves differently in Copilot CLI, VS Code and the browser: each has a different system prompt and a different set of tools.
- **Tool definitions:** you can't change what the built-in tools say, but you choose which tools are on the list. You add or remove MCP servers, pick GitHub MCP toolsets, filter tools for a run with `--available-tools` / `--excluded-tools`, or give a custom agent a narrower `tools:` list. Every tool on the list costs context on every step, even if it's never used. That's why piling on MCP servers makes an agent slower and fuzzier.
- **Instructions, skills and the conversation** are text you write. Custom instructions are effectively your addition to the system prompt, sent on every step.

The important part: **all of this is re-sent on every step of the loop.** Layers 1–4 cost roughly the same each time. Layer 5 is what fills up.

A lot follows from that:

- **The model remembers nothing between steps.** It only knows what's in the context. Every file it reads and every command output makes the context bigger, so context is a budget.
- **The model never touches your machine.** It only *asks* for a tool. The CLI runs it, and that's where permissions come in.
- **Modes change how the loop runs.** *Plan* gives it read-only tools, *interactive* stops for your approvals, and *autopilot* keeps looping without stopping.
- **A subagent is a loop inside the loop.** It has a fresh context and its own tool calls, and only its final answer comes back.
- **Instructions, skills and MCP are just more text in the context, or more tools on the list.** Nothing magic.

The rest of this post is that list, in practice. First, though, a word on what that budget is measured in.

## Tokens and Limits

Models don't read characters or words, they read **tokens**: chunks of text, roughly three quarters of an English word on average. Code, YAML and JSON tend to split into more tokens than prose. Everything is counted in tokens: the context, the model's answers and your usage.

There are three limits worth knowing:

- **The context window** is the maximum number of tokens the model can take in one step: the whole stack of layers above, including every tool result so far. It depends on the model, typically from around a hundred thousand tokens up to a million for some models. It sounds like a lot, but a few large files, a long log and a verbose command output fill it faster than you'd think.
- **The output limit** caps how much the model can write in one reply. It's much smaller than the context window, which is one reason agents write big files in several steps.
- **Usage limits** cap how much you can use over time: your plan's monthly allowance, rate limits when you send too much too quickly, and any cap you set yourself, like a credit limit on autopilot. In Copilot, different models also cost different amounts, so switching to a bigger model drains the allowance faster.

What happens as a session gets longer:

- **Each step gets heavier.** Because the full context is re-sent on every step, step 40 of a long session carries everything from steps 1 to 39 with it. Providers cache the repeated part to soften the cost, but every step is still bigger and slower than the one before.
- **Quality drops before you hit the limit.** The more there is in the context, the harder it is for the model to pay attention to the part that matters. Old, irrelevant tool output is noise. A focused session usually gives better answers than a huge one.
- **Near the limit, the CLI compacts.** It summarises the older history to make room and keeps going. The summary keeps the gist but loses details, so if something matters, put it in the instructions file or repeat it.

`/context` shows how full the window is right now, and `/usage` shows the tokens and credits the session has used so far.

## Driving It

Start it in a repo with `copilot`. The first prompt asks whether you trust the folder; trusting it lets Copilot load the repo's own agents and skills. A few things to know from the start:

| Key / command | What it does |
|---|---|
| `@file` | attach a file to the prompt |
| `!command` | run a shell command yourself, without the model |
| `esc` | stop the current turn |
| `shift+tab` | cycle modes: interactive → plan → autopilot |
| `/model` | switch model |
| `/env` | show what got loaded: instructions, agents, skills, MCP |
| `/help` | all commands |

## Instructions: `/init`

`/init` makes Copilot study the repo and write `.github/copilot-instructions.md`. Think of it as the agent's onboarding doc. It's sent on every step (layer 3), so team rules go here once instead of in every prompt.

Treat the generated file as a draft and review it like code. Then add the rules it can't infer from the repo: which commands are off limits, which environments it must never touch, how changes should be verified.

`/instructions` shows which instruction files are active. They can also come from `AGENTS.md`, and personal ones live in `~/.copilot/`.

## Managing Context

`/context` shows the context as a usage bar: system prompt, tools, instructions, messages and free space. Run it in a fresh session and look at how much is used before you've typed anything. That's layers 1–4. Every MCP server you add makes that part bigger.

Three commands keep it under control:

- `/ask <question>` asks a side question that **isn't** added to the conversation.
- `/compact` summarises the history to free up space. It also happens automatically near the limit.
- `/new` (or `/clear`) starts fresh. New topic, new session: that beats one huge chat.

## Plan First, and Tell It How to Verify

For anything bigger than a one-liner, start in **plan mode** (`shift+tab`, or `/plan <task>`). In plan mode the agent only has read-only tools. It reads what it needs and writes a plan, but **edits nothing**. Expect it to ask you questions along the way: plan mode leans on the `ask_user` tool to settle ambiguities before it commits to a plan, instead of guessing. That's the clarifying-question arrow from the diagram. Answer it, and the answer becomes part of the context the plan is built on.

The plan is the cheapest moment to correct the agent, before a dozen files exist. Once it looks right, approve it.

As it works, it asks for approvals. File edits and commands can be approved **once** or **for this session**. Approving read-only checks like linters and test runners for the session saves the loop from stopping on every verification.

The single most useful thing you can put in a prompt is **how to check the result**: which tests to run, which linter, what output to compare against. An agent that can check its own work will do it before saying it's done. If a check fails, you see the loop fix itself: it reads the error, edits and runs the check again. Most of the quality you get out of an agent comes from this.

When it's done, `/diff` shows everything it changed in one view. Read it like you'd read a colleague's PR.

## Undo and Permissions

`/rewind` undoes a turn, **including its file changes**. An edit you don't like, or a file it shouldn't have deleted, is one command away from being back.

Remember that the model never runs anything itself. It asks, and the CLI decides. `/permissions` shows the current mode and what you've approved this session. For scripted runs you set the rules up front:

```bash
copilot --allow-tool='shell(git:*)' --deny-tool='shell(git push)'
```

Deny always wins over allow. Don't confuse this with `--excluded-tools`: excluding takes a tool off the list, so the model never sees it (layer 2). Denying leaves it on the list and blocks the call.

For hard rules, like "never run kubectl against prod", there are hooks: a small script that runs before every tool call and can block it.

## Subagents: A Loop Inside the Loop

A subagent gets its own clean context, does one job and hands back only a summary, so the main conversation stays small. Run `/context` after a subagent finishes: the main context only grew by the summary, not by everything the subagent read.

A custom agent is just a Markdown file in `.github/agents/`: a name, a description, a list of tools and a short prompt. `/agent` lists the ones available. The `tools:` list is layer 2 again. A reviewer agent with only `read` and `search` can't edit anything, because edit tools aren't on its list at all. That's a much stronger guarantee than "you never edit files" in its prompt.

## Autopilot with `/goal`

`/goal <objective>` switches to autopilot with an objective. The agent stops waiting for you, answers its own questions and keeps going until the objective is met.

Write the objective with a "done when" part, for example "done when the tests and the linter pass". It's the same idea as verification in plan mode: an agent running on its own needs a clear way to know when it's finished. Autopilot has guardrails: you can cap the AI credits a goal may spend, `--max-autopilot-continues` limits how often it continues on its own, and `esc` stops it at any time.

So the three modes map onto the loop: **plan** looks but doesn't touch, **interactive** stops for your approvals, **autopilot** runs until the goal is reached or the budget runs out.

For bigger jobs, `/fleet` runs several subagents **in parallel** on independent parts of a task, and `/tasks` shows them while they run.

## Skills, MCP and Plugins

**Skills** are know-how that loads only when it's relevant. A skill is a `SKILL.md` file with a name, a description and instructions. Only the name and description sit in the context (layer 4); the full text loads when the agent decides it needs it. That's what makes them cheap: you can have many skills without paying for them on every step. `/skills` lists them. The `SKILL.md` format is the same one Claude Code uses. I wrote about skills in more depth in [How AI Agents Changed My Helm Chart Upgrade Routine](/AI-Agents-and-Helm-Chart-Upgrades) and [Teaching Claude to Triage My AKS Clusters](/AKS-Issue-Analyzer-Claude-Skill).

**MCP servers** add external tools. Copilot CLI comes with a GitHub server built in (`/mcp`), so "list my open pull requests" just works. You can add others with `copilot mcp add`. Just remember that every server's tools sit in the context on every step.

**Plugins** bundle skills, agents, hooks and MCP servers into one install. `/plugin` opens the marketplace.

## Sessions

Sessions are saved, so you can leave and come back:

```bash
copilot --continue         # last session
copilot --resume           # pick from a list
copilot --resume <name>    # by name, after /rename <name>
```

Resuming brings the context back. `/fork` branches the conversation to try something else, `/share` exports it to Markdown, HTML or a gist, and `/usage` shows the tokens and credits used.

## Headless Mode

The same agent without the UI, for scripts and pipelines:

```bash
git diff main | copilot -p "Review this diff for bugs" -s
```

`-p` takes the prompt, and `-s` prints only the answer. Combine it with `--allow-tool` / `--deny-tool` so it can't do more in CI than you intend.

## When Things Go Wrong

| Problem | Fix |
|---|---|
| Wandering off | `esc`, then a more specific prompt |
| Bad edit | `/rewind` |
| `/goal` running too long | `esc`; the credit cap stops it anyway |
| Answers getting worse in a long session | `/compact`, or `/new` for a new topic |

## Takeaways

1. **It's a loop.** The model asks for tools, the CLI runs them and the results go back in, until it has an answer. Every feature is a way to steer that loop.
2. **Context is the job.** Rules go in instructions, know-how in skills, big side jobs in subagents. Keep the tool list lean.
3. **Tell it how to verify.** An agent that can check its own work will do it, and that's where most of the quality comes from.
4. **Plan first, read the diff, use `/rewind`.** Review agent output like you'd review a colleague's PR.

If you want to start small: run `/init` in one of your own repos, fix what it got wrong in the instructions file, and give it a task you'd normally do by hand. Watch the lines above the answer. That's where you learn how it works.
