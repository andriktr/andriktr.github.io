---
title: "k8s-skills: Teaching AI Agents to Troubleshoot Kubernetes Without Breaking It"
excerpt: "25 open-source Kubernetes troubleshooting skills for Claude Code, Codex, Gemini CLI and Copilot that read first and ask before changing anything, and what breaking 76 things on kind taught me about the docs."
date: 2026-10-25
urlSlug: K8s-Skills-Read-First-Ask-Before-Changing
tags:
  - Kubernetes
  - AI
  - Claude Code
  - GitHub Copilot
  - DevOps
  - CLI
toc: true
draft: false
---

Give a coding agent `kubectl` and a problem, and it will usually find something. The trouble is what it does next. A good SRE looks at the pods, the events and the logs before touching anything, and when they do change something, they know how to undo it. An agent left to itself is just as likely to restart a Deployment, edit a ConfigMap in place or run `kubectl delete pod` to "see if it helps".

So I built [k8s-skills](https://github.com/k8s-servant/k8s-skills): 25 Agent Skills that teach an agent to troubleshoot Kubernetes the way I would. It looks first, explains what it found, and asks before it changes anything. This post covers how they work, how I test them, and the things I learned by breaking a kind cluster 76 different ways.

![An agent finds an OOMKilled pod with a 32Mi limit and proposes kubectl set resources with an undo line](/assets/images/post33/k8s-skills-demo.svg)

That's a real run: a fresh agent with a view-only kubeconfig, the workload skill, and the prompt *"my-app in my-namespace keeps restarting. Find out why."*

## What a skill is

A skill is a folder with a `SKILL.md` file: a short description the agent reads at startup, and instructions it reads only when the skill is relevant. I wrote about how agents use skills in [Agentic AI Basics](/Agentic-AI-Basics-Copilot-CLI). The format is an [open standard](https://agentskills.io), so the same folder works in Claude Code, Codex, Gemini CLI, GitHub Copilot and anything else that reads `SKILL.md`.

Each k8s-skills skill has the same five parts:

- **When to use**: the symptoms and error messages that should trigger it.
- **Investigate**: the commands to run, in order.
- **Read the results**: what each message or status actually means.
- **Proposed fix**: what to change, and how to undo it.
- **Sources**: the upstream docs and source code it is based on.

There is `k8s-triage` for "something is wrong and I don't know where", skills for workloads, networking, CoreDNS, storage, nodes, RBAC and the API server, and skills for the tools most clusters run: Argo CD, Flux, Helm, cert-manager, Istio, Cilium, Envoy Gateway, Kyverno, Gatekeeper, External Secrets, Prometheus, Grafana, Loki, Fluent Bit and the OpenTelemetry Collector. They hand off to each other by name. For example, `k8s-triage` finds a crash-looping pod and passes it to `k8s-workload-troubleshooting`.

## Read first, ask before changing

Every command in every skill is in one of three tiers:

| Tier | What | What the agent does |
|---|---|---|
| Run freely | Read-only: `get`, `describe`, `logs`, `events`, `top` and a few more | Runs them while it investigates |
| Ask first | Reversible changes: `set resources`, `rollout undo`, `scale`, `patch`, `cordon`... | Shows the command and its undo, and runs it only after you say yes |
| Never run | Anything destructive or hard to undo: `delete`, `drain`, `apply`, `replace`... | Writes it as a proposed fix for you to review and run |

An ask-first block in a skill looks like this:

````md
> Ask first: the agent runs this only after the user approves it.

```bash
kubectl set resources deployment/my-app -c app --limits=memory=512Mi --requests=memory=512Mi -n my-namespace
# Undo: kubectl set resources deployment/my-app -c app --limits=memory=256Mi --requests=memory=256Mi -n my-namespace
```
````

Two rules hold in every tier: **Secrets are never read**, and **every change comes with an `# Undo:` line**.

None of this works on trust. A small checker in CI parses every command in every skill and compares it with an allow-list for its tier. A read-only command with a write verb fails the build. So does an ask-first block without an undo line, or anything that touches `secrets`, `env`, tokens or a cloud metadata address. The allow-lists only grow through a reviewed pull request.

### The real lock is RBAC

"Ask first" is an instruction the agent follows, not a lock. An agent in auto-approve mode may not stop to ask. What actually limits it is the identity you give it. If you only want it to investigate, give it a read-only kubeconfig, for example a ServiceAccount bound to the built-in `view` ClusterRole, plus `get`/`list` on the few cluster-scoped objects the skills read (nodes, PVs, StorageClasses, webhooks, CRDs). The [README](https://github.com/k8s-servant/k8s-skills#your-agent-your-decision) lists exactly what each skill needs.

That's also how I test them.

## How each skill is tested

Every skill has at least two scenarios under `tests/<skill>/<case>/`:

```text
tests/k8s-workload-troubleshooting/oom-killed/
├── setup.sh      # install what the scenario needs
├── break.sh      # break it on purpose
├── cleanup.sh    # put everything back
└── expected.md   # the prompt, the cause, the evidence, acceptable fixes, wrong answers
```

A run goes like this:

1. `tests/cluster.sh up` creates a throwaway kind cluster. Tools are installed at pinned versions, and each download's checksum is checked first.
2. `tests/run.sh <skill> <case>` runs the setup and breaks the cluster.
3. A fresh headless agent gets **only that skill**, the prompt from `expected.md`, and a **view-only kubeconfig**.
4. It passes only if it names the cause, points at the evidence and proposes an acceptable fix, **without changing anything**.

There are 76 scenarios across the 25 skills, and the agent run for each one is recorded in the skill's pull request. Every error message a skill quotes was reproduced on the cluster. Where the cluster said something different from the docs, the skill quotes the cluster.

That last rule turned out to matter more than I expected.

## What breaking things taught me

Testing on a real cluster corrected a lot of what I would have written from memory or from the docs. Some examples from Kubernetes 1.37 and CoreDNS 1.14:

**A webhook with no backend says "connection refused".** Scale a validating webhook's Deployment to zero with `failurePolicy: Fail`, and every new pod in the namespaces it covers is rejected. Many guides tell you to look for `no endpoints available for service`. On kind, the ReplicaSet's events said:

```text
Error creating: Internal error occurred: failed calling webhook "validate.my-webhook.example.com":
failed to call webhook: Post "https://my-webhook.my-webhook-system.svc:443/validate?timeout=5s":
dial tcp <cluster IP>:443: connect: connection refused
```

kube-proxy rejects the connection to a Service with no ready endpoints. The "no endpoints" message only appears on clusters that route to endpoints directly, so the skill now teaches both.

**One broken APIService blocks every namespace deletion in the cluster.** Register an aggregated API whose Service doesn't exist, then delete an unrelated namespace. It stays `Terminating` forever, even though it never used that API. `kubectl api-resources` quietly leaves the broken group out and doesn't report an error. The only place the cause appears is the namespace's own conditions:

```text
NamespaceDeletionDiscoveryFailure=True  DiscoveryFailed: Discovery failed for some groups,
1 failing: unable to retrieve the complete list of server APIs:
my-api.example.com/v1beta1: stale GroupVersion discovery: ...
```

If you've ever removed finalizers by hand to unstick a namespace, check `kubectl get apiservices` first.

**"no matches for kind" doesn't mean the CRD is missing.** A deploy Job failed with `no matches for kind "Widget" in version "my-api.example.com/v1alpha1"` and the hint `ensure CRDs are installed first`. The CRD was installed. Only that version had `served: false` after an upgrade.

**A CoreDNS config error at startup has no `[FATAL]` prefix.** A typo in the Corefile crashes new CoreDNS pods with just this line:

```text
/etc/coredns/Corefile:22 - Error during parsing: Unknown directive 'loadbalanse'
```

It's easy to miss if you're searching the logs for `FATAL` or `ERROR`.

**A failed CoreDNS reload silently keeps the old config.** Running pods log `[ERROR] plugin/reload: Corefile changed but reload failed` and carry on serving the previous Corefile. DNS keeps working, and the ConfigMap now says something different from what's actually running. The next time the pods restart, for example on a node drain, they all crash on the broken file. A typo can wait for days before it takes DNS down.

**Even the test agent taught me something.** In one run, the agent wanted to confirm its fix with `kubectl apply --dry-run=server`. RBAC refused it. That was correct: a server-side dry run still goes through admission and calls every webhook. The skill now says to leave dry runs to the user.

## Try it

Install all skills with the [`skills` CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add k8s-servant/k8s-skills -a claude-code   # or -a codex, ...
```

Or as a Claude Code plugin:

```text
/plugin marketplace add k8s-servant/k8s-skills
/plugin install k8s-skills@k8s-skills
```

For Gemini CLI, run `gemini extensions install https://github.com/k8s-servant/k8s-skills`.

Then describe the problem the way you would to a colleague: *"pods in my-namespace can't resolve external names"*, or *"the cluster feels broken after the upgrade"*. Start it with a read-only kubeconfig and see what it finds.

## What's coming next

The [roadmap issue](https://github.com/k8s-servant/k8s-skills/issues/16) tracks what's planned:

- **Managed clusters: AKS, EKS and GKE.** These cover the problems that only exist in the cloud: node pools that won't scale, load balancers and public IPs, cloud storage classes, workload identity, and the add-ons each provider manages for you. kind can't reproduce most of these, so those parts will be checked against each provider's docs.
- **Karpenter**, together with the cloud skills: NodePools that don't provision, nodes that never join, consolidation that won't stop.
- **Velero**: backups and restores that fail or come back incomplete.
- **CloudNativePG**: PostgreSQL clusters that won't fail over or lose a replica.
- **Strimzi**: Kafka clusters, topics and users that never become Ready.
- After that: **Crossplane**, **Linkerd** and **Traefik**.

Every new skill gets the same treatment: upstream docs and source as references, at least two broken-on-purpose scenarios, and an agent run with a view-only kubeconfig before it's merged.

## How you can contribute

The project is Apache-2.0, and I'd love help with it. You don't need to write a whole skill to make a difference. Here are four ways in, from smallest to biggest.

**Tell me when a skill got it wrong.** If an agent using a skill missed the cause, blamed the wrong thing or proposed a bad fix, open a [Skill problem](https://github.com/k8s-servant/k8s-skills/issues/new?template=skill_problem.yml) issue. Include what you asked, what the agent concluded and what the real cause was. Use placeholders like `my-app` and `my-namespace`, never real names or Secrets. These reports are the most valuable feedback, because they come from problems in real clusters that my scenarios didn't cover.

**Ask for a skill.** If there's a tool you run that isn't covered, or one from the list above you need sooner, open a [New skill](https://github.com/k8s-servant/k8s-skills/issues/new?template=new_skill.yml) issue. Include the symptoms you'd describe to an agent and links to the tool's official docs. That's most of what a skill needs to start.

**Add a scenario.** This is a good first PR. Pick a symptom a skill describes but no scenario tests yet (there are [good first issues](https://github.com/k8s-servant/k8s-skills/labels/good%20first%20issue) like this). Write the four files, and run it on your own machine. The test kit only ever touches its own throwaway kind cluster:

```bash
git clone https://github.com/k8s-servant/k8s-skills.git && cd k8s-skills
tests/cluster.sh up                                      # throwaway kind cluster
tests/run.sh k8s-workload-troubleshooting my-new-case    # set up and break it
# give an agent the printed prompt and view-only KUBECONFIG, compare with expected.md
tests/run.sh --cleanup k8s-workload-troubleshooting my-new-case
tests/cluster.sh down
```

**Write a skill.** The rules are in [CONTRIBUTING.md](https://github.com/k8s-servant/k8s-skills/blob/main/CONTRIBUTING.md), and CI checks most of them for you:

- every fact comes from the tool's own docs or source, listed under Sources
- every error message is reproduced on kind
- every command is in its tier, with an undo line for each change
- there are at least two scenarios

Start from one of the existing ecosystem skills. They all follow the same shape.

If you just want to try it, run it against a cluster you know well, with a read-only kubeconfig, and tell me what it found. Stars help other people find the project too.
