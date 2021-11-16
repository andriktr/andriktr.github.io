---
title: "Azure Kubernetes Services (AKS). Secure your AKS clusters with well known policy managers" 
excerpt: "Azure Kubernetes Services (AKS). Secure your AKS clusters with well known policy managers"
date: November xx, 2021
toc: true
toc_label: "Content"
toc_sticky: true
tags:
  - Microsoft
  - AzureCLI
  - Script
  - Helm
  - YAML
  - AKS
  - K8S
  - Kubernetes
  - Kyverno
  - Security
  - AdmissionsControllers
  - Charts
  - Github
  - Nirmata
  - OPA
  - GateKeeper
  - CNCF

---

<img align="right" width="450" height="200" src="../assets/images/post15/kyverno-aks.png">

Hello Folks,

In this AKS series post I would like to about how to secure your AKS cluster after the Pod Security Policy removal from Kubernetes.

## 1. PSP Deprecation

Those of you who constantly works with Kubernetes and tracks release changelog probably have heard that [Pod Security Policies] (PSP) deprecated as of Kubernetes v1.21, and will be removed in v1.25. PSP is a cluster-level resource that controls security sensitive aspects of the pod specification. The PodSecurityPolicy objects define a set of conditions that a pod must run with in order to be accepted into the system, as well as defaults for the related fields. With PSP you can deny such thing like privileged pods, run container as a root, force read only root file system etc.

PSP deprecation for cluster admins means that we need to prepare our K8S infrastructure to be able to control security context of pods and containers which will run on our clusters. There are bunch of different projects which could help to achieve the same or even more that we can to achieve with PSP, but in my opinion there are two projects [Kyverno] and [OPA GateKeeper] which are most valuable in this area. Both of this solutions are open source CNCF projects.

## 2. Kyverno or OPA Gatekeeper

Generally [Kyverno] and [OPA GateKeeper] runs as [admission controllers] in Kubernetes receives validating and mutating admission webhook HTTP callbacks from the API server and applies matching policies to return results that enforce admission policies or reject requests.

In terms of AKS if you enable [azure policy addon] for you clusters you can create policies from the portal or azure cli, but in the background [OPA GateKeeper] used as the policy management engine.

As you probably noticed from the post title I prefer to use Kyverno instead of OPA GateKeeper based azure policy addon and there are few reasons for this:

* Both policy managers can **validate** (check that resource is match specified criteria), **mutate** (edit resource based on specified criteria), however only Kyverno can [generate] new resources based on specified conditions and this quite valuable feature as it can automate a lot of things. As example you can create Kyverno policy according to which each time when new namespace will be created additionally Kyverno will create a network policy or resource quota or whatever resource you need.

* Another key deference between GateKeeper and Kyverno is the way how policies are written. 
  In order to use GateKeeper you need to understand a REGO language which is used to describe policy in GateKeeper constraint templates. So if you writing a complex policy this might be quite tricky if you don't know well all REGO specifics. In case of AKS with enabled azure policy addon you may find a lot of already prepared azure policies which are ready to use and can help to secure a cluster in many aspects and for sure these policies covers all what PSP does. However if you will need to create some custom policy (currently [custom policy definitions for aks clusters] available as in public preview) you will need to write an azure policy definition with a reference to Gatekeeper constraint template and constraint files this might be quite complicated process. Additionally it may take more than 30 minutes for policy to take effect after policy assignment to the cluster.

  In case of Kyverno things are much more simpler. When you deploy Kyverno it deploys a few Custom Resource Definitions (CRD's) then when you want to deploy a Kyverno policy you simply need to apply `ClusterPolicy` or `Policy` definition file to your cluster. All Kyverno policies should described as a simple yaml based files without using any additional complex languages. For sure you still need to understand basic rules on [how Kyverno policies should be written] and which spec's are supported in policy definition files.

  Here is how the policy which requires for certain label to be set on each namespace looks in [OPA GateKeeper]
  In GateKeeper we first need to specify a constraint template where we describe our policy rules

  ```yaml
  
  ```

  After this we need to create a constraint for this template. Constraint used to describe for which resource kind our constraint template will be applied.

  ```yaml
    
  ```

  And the following yaml shows how the same policy looks in Kyverno

  ```yaml
  
  ```  

These two aspects are the main reasons why my choice was `Kyverno` instead of Azure Policy + OPA GateKeeper. Also it's worth to mention that you can use both policy managers in parallel however if your AKS clusters are large with a lot of requests to the API this may add additional load for master nodes or delays during various operations with resources. This is because a lot of API requests (depend to which kinds policies will be applied) will be forwarded to and processed by `Kyverno` and `GateKeeper` admissions controller before action.

If you would like to see super detailed comparison between Kyverno and OPA Gatekeeper I recommend to read this [Kyverno vs OPA Gatekeeper comparison] post.

## Protect AKS with Azure Policy for Kubernetes aka OPA Gatekeeper

## Protect AKS with Kyverno

<!-- Links -->
[Pod Security Policies]: https://kubernetes.io/docs/concepts/policy/pod-security-policy/
[Kyverno]: https://kyverno.io/docs/
[OPA GateKeeper]: https://github.com/open-policy-agent/gatekeeper
[Kyverno vs OPA Gatekeeper comparison]: https://neonmirrors.net/post/2021-02/kubernetes-policy-comparison-opa-gatekeeper-vs-kyverno/
[Azure Policy for Kubernetes]: https://docs.microsoft.com/en-us/azure/governance/policy/concepts/policy-for-kubernetes
[admission controllers]: https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/
[azure policy addon]: https://docs.microsoft.com/en-us/azure/governance/policy/concepts/policy-for-kubernetes
[generate]: https://kyverno.io/docs/writing-policies/generate/
[custom policy definitions for aks clusters]:https://azure.microsoft.com/en-us/updates/public-preview-custom-policy-definitions-for-aks-clusters/
[how Kyverno policies should be written]: https://kyverno.io/docs/writing-policies/
[PSP Replacement]: https://github.com/kubernetes/enhancements/tree/master/keps/sig-auth/2579-psp-replacement