# Set variables 
export TENANT_ID="xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxxxx" # Your azure tenant id
export SUBSCRIPTION='My Azure Subscription' # Your azure subscription name
export LOCATION="westeurope" # Azure region where your resources will be deployed
export COMMON_NAME="aks-csi-demo" # A common name which will be used for naming
export GROUP_NAME=aks-csi-demo # A resource group name where we deploy a key vault and managed identity 
export KEYVAULT_NAME=csi-demo-keyvault # A keyvault where we will store our secrets
export IDENTITY_NAME=aks-csi-demo-identity # An managed identity name which we will create and use to access our key vault secrets
export AKS_CLUSTER_NODE_GROUP_NAME=aks-nodes-west-dev # Name of the resource group where our AKS cluster VM scale set is running
export SECRET_NAME=aks-csi-demo-secret # Name of azure key vault secret which we will create 
export SECRET_VALUE=MySecretDemoPassword # Value of our azure key vault secret
export CERTIFICATE_SECRET_NAME=aks-csi-demo-cert # Name certificate which will be kept in our key vault as certificate object 

# Create Resources (group, keyvault, identity)
az group create --name $GROUP_NAME --location $LOCATION --subscription "$SUBSCRIPTION"
az keyvault create --name $KEYVAULT_NAME --resource-group $GROUP_NAME --location $LOCATION --subscription "$SUBSCRIPTION"
az identity create --name $IDENTITY_NAME --resource-group $GROUP_NAME --location $LOCATION --subscription "$SUBSCRIPTION"

# Create a demo self signed certificates
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -subj '/CN=aks-csi-demo'
openssl pkcs12 -inkey key.pem -in cert.pem -export -out $COMMON_NAME.pfx

# Create a Kevault secret and store certificate
az keyvault secret set --name $SECRET_NAME --vault-name $KEYVAULT_NAME --value $SECRET_VALUE  
az keyvault certificate import --file $COMMON_NAME.pfx --name $CERTIFICATE_SECRET_NAME --vault-name $KEYVAULT_NAME --password $COMMON_NAME

# Retrieve User Assigned Managed Identity  
IDENTITY_ID=$(az identity show --name $IDENTITY_NAME --resource-group $GROUP_NAME --subscription "$SUBSCRIPTION" --query id -o tsv)
IDENTITY_CLIENT_ID=$(az identity show --name $IDENTITY_NAME --resource-group $GROUP_NAME --subscription "$SUBSCRIPTION" --query clientId -o tsv)

# Assign keyvault "Get" permission for User Assigned Managed Identity  
az keyvault set-policy --name $KEYVAULT_NAME --key-permissions get --spn $IDENTITY_CLIENT_ID
az keyvault set-policy --name $KEYVAULT_NAME --secret-permissions get --spn $IDENTITY_CLIENT_ID
az keyvault set-policy --name $KEYVAULT_NAME --certificate-permissions get --spn $IDENTITY_CLIENT_ID

# Retrieve AKS cluster VMSS pool name
VMSS=$(az vmss list --resource-group $AKS_CLUSTER_NODE_GROUP_NAME --subscription "$SUBSCRIPTION" --query "[].name" -o tsv)

# Assign User Assigned Managed Identity to the aks cluster VMSS
az vmss identity assign --resource-group $AKS_CLUSTER_NODE_GROUP_NAME -n $VMSS --identities $IDENTITY_ID

# Deploy demo secretProviderClass and Pod
cat <<EOF | kubectl apply -f -
apiVersion: secrets-store.csi.x-k8s.io/v1alpha1
kind: SecretProviderClass
metadata:
  name: aks-csi-demo
  namespace: infra
spec:
  provider: azure
  secretObjects:                            
  - secretName: $CERTIFICATE_SECRET_NAME
    type: kubernetes.io/tls
    data: 
    - objectName: $CERTIFICATE_SECRET_NAME
      key: tls.key
    - objectName: $CERTIFICATE_SECRET_NAME
      key: tls.crt  
  parameters:
    usePodIdentity: "false"
    useVMManagedIdentity: "true"
    userAssignedIdentityID: $IDENTITY_CLIENT_ID
    keyvaultName: $KEYVAULT_NAME
    objects:  |
      array:
        - |
          objectType: secret
          objectName: $SECRET_NAME
        - |
          objectType: secret
          objectName: $CERTIFICATE_SECRET_NAME
    tenantId: $TENANT_ID
---
kind: Pod
apiVersion: v1
metadata:
  name: $COMMON_NAME
  namespace: infra
  labels:
    name: $COMMON_NAME
    environment: development
    itSystemCode: unknown
    responsible: andrej.trusevic
spec:
  containers:
    - name: $COMMON_NAME
      image: ifbalacrdev.azurecr.io/utils:1.0.1
      volumeMounts:
      - name: $COMMON_NAME
        mountPath: "/mnt/csi-demo"
        readOnly: true               
      - name: $CERTIFICATE_SECRET_NAME
        mountPath: "/csi-demo-cert/"
        readOnly: true  
      resources:
        requests:
          cpu: 100m
          memory: 100Mi
        limits:
          cpu: 200m   
          memory: 300Mi
  volumes:
    - name: $COMMON_NAME
      csi:
        driver: secrets-store.csi.k8s.io
        readOnly: true
        volumeAttributes:
          secretProviderClass: $COMMON_NAME
    - name: $CERTIFICATE_SECRET_NAME
      secret:
        secretName: $CERTIFICATE_SECRET_NAME                        
EOF
