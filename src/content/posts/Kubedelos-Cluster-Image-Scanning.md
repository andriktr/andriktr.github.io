---
title: "kubedelos: What to Fix First in Your Cluster's Images"
excerpt: "kubedelos scans the images actually running in a Kubernetes cluster with Trivy, keeps every run in SQLite, and ranks the findings by a risk score that weighs exposure and known exploitation. One command, nothing installed in the cluster."
date: 2026-11-23
urlSlug: Kubedelos-Cluster-Image-Scanning
tags:
  - Kubernetes
  - Security
  - Trivy
  - Vulnerability
  - Helm
  - Claude Code
draft: false
---

Running Trivy against one image is easy. Doing it for a whole cluster, week after week, is where it gets hard. `trivy k8s` gives you a long report of what is vulnerable right now, but the questions I actually get asked are different: which of these should we fix first, what changed since last week, and which team owns that namespace?

So I built [kubedelos](https://github.com/k8s-servant/kubedelos). It lists the images that really run in a cluster, scans each one once with a pinned Trivy, keeps every run in a local SQLite database, and shows the results in a web UI with a fix-first list on top. Version 0.1.1 is on PyPI and GHCR. This post shows how to try it in two minutes and what it does with the results.

![The kubedelos dashboard: counts per severity, the change since the previous run, the worst images and the fix-first list ordered by risk score](/assets/images/post35/dashboard-dark.png)

## Try it in two minutes

You need Python 3.12 or later, a kubeconfig context that can list pods, and Linux or macOS:

```bash
pipx install kubedelos        # or: uv tool install kubedelos
kubedelos ui
```

`kubedelos ui` opens the UI in your browser against your current kube-context (`--context` picks another one). Open the Scans page and press Scan. The first scan downloads Trivy and its vulnerability DB, so give it a few minutes; later scans reuse both.

![A scan from the Scans page, then the dashboard with the top fix opened, then the findings sorted by risk](/assets/images/post35/scan.gif)

Nothing is installed in the cluster. There is no operator, no CRD, and no Lens or Headlamp plugin to set up first. The UI listens on `127.0.0.1` only, and the URL it prints carries a token that is swapped for a session cookie on the first visit.

## What a scan covers

kubedelos scans what actually runs, not what a Helm chart says should run:

- the images of running pods, including init and ephemeral containers;
- the pod templates of CronJobs, and of Deployments and StatefulSets scaled to zero, so a job that runs at night or an app parked at zero replicas is still covered;
- each unique image once per platform, however many pods use it.

Every call is a read-only `list`, and it never reads Secrets. If your identity may not list a namespace or a resource, that part is skipped with a warning and the run is marked incomplete. It never shows up as "no findings".

Results are cached for 24 hours by image digest, so the second scan of a cluster only scans images that changed. To narrow a scan, use namespaces, label selectors, image exclusions, or OS packages vs application libraries:

```bash
KUBEDELOS_NAMESPACES='["team-a","team-b"]' kubedelos ui
```

## What to fix first

Severity alone is a poor order. A Critical CVE in a pod nothing can reach ranks above a High one that attackers are already exploiting, in a pod exposed to the internet with a cluster-admin token. So kubedelos gives every finding a risk score from 0 to 100:

- **Severity**, as the base.
- **Known exploitation:** points if the CVE is in the [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) catalog, and for its [EPSS](https://www.first.org/epss/) probability.
- **Exposure:** is the workload behind a LoadBalancer, an Ingress or an HTTPRoute, only reachable inside the cluster, or fenced by a NetworkPolicy?
- **Host access:** privileged, host PID, network or IPC, a writable hostPath, dangerous added capabilities, or running as root.
- **Rights:** what its ServiceAccount may do through RBAC.

Every score comes with the factors behind it, so you can see why something is on top. This one is 73: Critical (+40), an EPSS of 0.88 (+15), reachable from outside the cluster (+15), and +3 because kubedelos couldn't tell whether it runs as root.

![The fix-first list with its top fix opened: risk 73 from critical +40, EPSS 0.88 +15, external +15 and root unknown +3, and the images it affects](/assets/images/post35/fix-first-dark.png)

That last factor shows a rule I care about: a fact kubedelos can't read counts as unknown and adds a little risk. It never counts as safe.

The facts come from the same read-only list calls (Services, Ingresses, HTTPRoutes, NetworkPolicies, RBAC). The two threat feeds are downloaded at most once a day with plain GETs that send nothing about your cluster. `KUBEDELOS_ATTACK_SURFACE=false` and `KUBEDELOS_THREAT_FEEDS=false` turn them off.

The fix-first list groups findings by fix (one package upgrade and every image it fixes) or by image. The findings page sorts by risk too:

![The findings page sorted by risk, each row with its score and factors](/assets/images/post35/findings-risk-dark.png)

## What changed since last time

Every run stays in SQLite, so the dashboard shows the change since the previous comparable run: new Criticals, fixed ones, images that failed. The other pages:

- **Findings:** filter by severity, namespace, image or package, and download the view as CSV.
- **Namespaces:** namespaces ranked by what they carry.
- **Compare:** any two runs side by side.
- **Report:** a print-friendly report, ready to save as PDF.
- **Accepted risks:** a register that takes a finding off the work lists with a reason and an expiry.
- **Scans:** start, follow, cancel or retry a scan, and see where its time went.

## Running it in the cluster

The laptop mode suits me for ad hoc checks. For a cluster you want watched all the time, `kubedelos serve` runs inside it from a Helm chart, scans on a cron schedule (03:00 by default) and serves the same UI to your team:

```bash
helm install kubedelos oci://ghcr.io/k8s-servant/charts/kubedelos \
  --version 0.1.1 --namespace kubedelos --create-namespace \
  --set clusterName=my-cluster
```

The chart runs one hardened replica (non-root, read-only root filesystem) with a volume for the database, a read-only ClusterRole and a NetworkPolicy. The image bundles the pinned Trivy, so the pod downloads no binaries at runtime.

One warning before you expose it: **anyone who can reach the UI can read the whole vulnerability inventory, and by default can also start scans and accept risks.** Set `readOnly: true`, keep it cluster-internal, or put it behind a sign-in proxy. The docs have [an example with oauth2-proxy and Envoy Gateway](https://github.com/k8s-servant/kubedelos/blob/main/docs/exposure-oauth2-proxy-envoy-gateway.md).

Private registries work with a cloud workload identity (ACR from AKS, ECR from EKS, Artifact Registry from GKE), mounted Docker config Secrets, or, if you opt in, the pull secrets of the pods being scanned.

The image and the chart are signed keylessly with cosign from the release workflow, so you can check them before installing:

```bash
IDENTITY='^https://github.com/k8s-servant/kubedelos/\.github/workflows/release-please\.yml@refs/heads/main$'
ISSUER=https://token.actions.githubusercontent.com

cosign verify ghcr.io/k8s-servant/kubedelos:0.1.1 \
  --certificate-identity-regexp "$IDENTITY" --certificate-oidc-issuer "$ISSUER"
cosign verify ghcr.io/k8s-servant/charts/kubedelos:0.1.1 \
  --certificate-identity-regexp "$IDENTITY" --certificate-oidc-issuer "$ISSUER"
```

## Ask your agent

This is the part I use most myself. `kubedelos mcp` is a read-only MCP server over your local scan database, so the coding agent you already use can answer questions from your scan results:

```bash
claude mcp add kubedelos -- kubedelos mcp
```

Then ask Claude Code "what should I fix first in my-cluster?" or "which internet-facing workloads run a Critical with a fix?", and it answers from the same data and the same risk score as the UI. The server never contacts the cluster, calls no LLM itself and needs no API key. VS Code Copilot and other MCP clients work too.

## Careful by default

A security tool that runs against production clusters should be boring about its own security. A few things kubedelos does on purpose:

- **Trivy is pinned** (v0.76.1) and checked against a SHA-256 built into kubedelos. It never resolves "latest".
- **Read-only cluster access.** No code path changes a cluster object, and Secrets are not read unless you opt into pod pull secrets for namespaces you name.
- **Registry tokens never touch disk or logs**, not even in error messages.
- **The only outbound calls** besides Trivy and your registries are the KEV and EPSS downloads.
- **The image is installed from hashed lock files**, and the image, the chart and the PyPI package come from one signed release workflow.

kubedelos doesn't try to gate CI pipelines. Plain Trivy already does that well, so kubedelos sticks to what happens after the image is deployed.

## What's next

0.1 is the first release, so expect rough edges. Next on the list:

- reports sent to each namespace's owners by email, Slack or Teams (owners already come from the `kubedelos.io/owner-email` namespace annotation);
- verifying `serve` on AKS, EKS and GKE (so far it's tested on kind);
- warnings when the Trivy DB or the threat feed copy is out of date.

If you try it, I'd like to hear what works and what doesn't. Open an issue on [GitHub](https://github.com/k8s-servant/kubedelos/issues), or leave a comment below.
