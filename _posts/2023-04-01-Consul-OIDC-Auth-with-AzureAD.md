---
title: "Consul OIDC Authentication with Azure AD"
excerpt: Consul OIDC Authentication with Azure AD
date: April 01, 2023
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
  - Deployments
  - Bash
  - Demo
  - Linux
  - Security
  - Terraform
  - Consul
  - ActiveDirectory
  - IaC
  - ServiceMesh
  - OIDC
  - AzureAD
  - Authentication
  - RBAC
  - Authorization


---

<img align="right" width="550" height="240" src="../assets/images/post23/Logo.png">

Hi All,

This post will be a references to my recently created github repository [Consul-OIDC-Azure-AD](https://github.com/andriktr/consul-oidc-azure-ad) which contains a Terraform configuration which will help you to configure OIDC authentication with Azure AD in your Consul cluster.

If you like me using Consul as a Service Mesh and your cloud provider is Azure it will be a really good idea to use Azure AD as your OIDC provider. In this case you will be able to assign Consul roles to your Azure AD users and groups and your users will be able to authenticate to Consul using their Azure AD credentials. This will simplify your life as you will no longer need to issue separate Consul tokens for your users.

So I encourage you to check out [Consul-OIDC-Azure-AD](https://github.com/andriktr/consul-oidc-azure-ad) repository and try it out. There is a detailed [README](https://github.com/andriktr/consul-oidc-azure-ad#readme) which will guide you through the process of deploying the configuration.

If you have any questions or suggestions please feel free to contact me.

See you soon in the next post 🤜 🤛, bye!
