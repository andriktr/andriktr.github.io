---
title: "Enable Soft Delete For All Azure KeyVaults" 
excerpt: "Enable Soft Delete For All Azure KeyVaults"
date: October 18, 2022
toc: true
toc_label: "Content"
toc_sticky: true
tags:
  - Microsoft
  - Script
  - Automation
  - SoftDelete
  - KeyVault
  - DataProtection
  - Azure
  - Advisor
  - Terraform
  - AzureCLI
  - Bash
---
<img align="right" width="300" height="150" src="../assets/images/post14/key-vault.png">

Hi Folks,

Recently we did a review of Azure Advisor alerts in our company subscriptions and discovered that we still have a bunch of key vaults where [soft delete] option is not enabled. A while ago Microsoft made this option enabled by default for all newly created key vault (and at some point they will probably force it to all key vaults). Soft delete option allows you to recover your key vault even it was deleted from the resource group. When soft delete is enabled your key vault is not completely deleted and available for restore for as many days as you set in the soft delete retention days setting. Azure key vault is typically used for storing various sensitive data like passwords, tokens or certificates and keep it protected from accidental deletion is important and necessary.

As I mentioned we have found that some of our azure key vaults do not have soft delete enabled the reason for this is that all these key vault were created a long time ago and during their creation "soft delete" feature was not available.

To close the Azure Advisor alert we need to turn on "soft delete" for all key vaults. To achieve this we can for sure use Azure portal, but this not what we want to do for 100 key vaults. So I wrote a small and simple bash script which enables "soft delete" for all key vaults in the subscription where it's turned off.

```bash
export SUBSCRIPTION="Subscription Name Goes Here" # Subscription Name
export SOFT_DELETE_RETENTION_DAYS=90 # Number of days to keep your key vault recoverable from deletion 

KEY_VAULTS=$(az keyvault list --subscription "$SUBSCRIPTION" --query "[].{name:name}" -o tsv)
for VAULT in ${KEY_VAULTS[@]}
do
  GROUP_NAME=$(az keyvault list --query "[?name=='$VAULT'].{Group:resourceGroup}" --output tsv)
  SOFT_DELETE_STATUS=$(az keyvault show --resource-group $GROUP_NAME --name $VAULT --query "properties.enableSoftDelete" -o tsv)
  if [ "$SOFT_DELETE_STATUS" != true ]; then
    echo "Soft delete is not enabled for $VAULT. Going to enable it..."
    az keyvault update --name $VAULT --resource-group $GROUP_NAME --enable-soft-delete true --retention-days $SOFT_DELETE_RETENTION_DAYS
  fi
done
```

<i class="far fa-sticky-note"></i> **Note:** Once "soft delete" option is enabled it can't be turned off. If you use terraform for keyvault deployment this should not affect your deployment because version v2.42 of the Azure Provider and later ignore the value of the soft_delete_enabled field and force this value to be true - as such this field can be safely removed from your Terraform Configuration. This field will be removed in version 3.0 of the Azure Provider.
{: .notice--info}
{: .text-justify}

Thank you 🤜🤛

<!-- Links -->
[soft delete]: https://docs.microsoft.com/en-us/azure/key-vault/general/soft-delete-overview