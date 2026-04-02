# ASIF — Deployment Guide

## Architecture

```
iPhone App  ──HTTPS──▶  asif-api.tulidu.com (CloudFront EL5YSKDH45CFX) ──HTTP:3002──▶  EC2 (PM2 asif-server)
Browser     ──HTTPS──▶  asif.tulidu.com     (CloudFront E1KCKLWQAC76IU) ────────────▶  S3 (asif-admin-frontend)
```

**Reused from tulidu-sport:**
- Same EC2 instance (`ec2-3-92-164-103.compute-1.amazonaws.com`)
- Same ACM certificate (`*.tulidu.com`) — already covers both new subdomains
- Same Route53 hosted zone (`tulidu.com`)

---

## One-time AWS Setup

### Step 1 — Create S3 bucket for admin UI

```bash
aws s3api create-bucket \
  --bucket asif-admin-frontend \
  --region eu-west-1 \
  --create-bucket-configuration LocationConstraint=eu-west-1

# Block all public access (CloudFront OAC handles it)
aws s3api put-public-access-block \
  --bucket asif-admin-frontend \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### Step 2 — Create CloudFront distribution for Admin UI

```bash
aws cloudfront create-distribution --distribution-config '{
  "CallerReference": "asif-admin-'$(date +%s)'",
  "Aliases": { "Quantity": 1, "Items": ["asif.tulidu.com"] },
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "asif-admin-frontend",
      "DomainName": "asif-admin-frontend.s3.eu-west-1.amazonaws.com",
      "OriginAccessControlId": "E25DA55YS7SXRG",
      "S3OriginConfig": { "OriginAccessIdentity": "" }
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "asif-admin-frontend",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": { "Quantity": 2, "Items": ["HEAD","GET"], "CachedMethods": { "Quantity": 2, "Items": ["HEAD","GET"] } },
    "Compress": true,
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6"
  },
  "CustomErrorResponses": {
    "Quantity": 2,
    "Items": [
      { "ErrorCode": 403, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 10 },
      { "ErrorCode": 404, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 10 }
    ]
  },
  "ViewerCertificate": {
    "ACMCertificateArn": "arn:aws:acm:us-east-1:201698141128:certificate/e7e18153-7052-4554-9d2a-94483148ff77",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "Enabled": true,
  "HttpVersion": "http2"
}'
```
▶ **Save the distribution ID** → set `ADMIN_CF_ID` in `deploy/.env`

### Step 3 — Set S3 bucket policy for OAC

Replace `ADMIN_CF_ARN` with the ARN from the distribution created above:

```bash
ADMIN_CF_ARN="arn:aws:cloudfront::201698141128:distribution/<ADMIN_CF_ID>"

aws s3api put-bucket-policy --bucket asif-admin-frontend --policy "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Effect\": \"Allow\",
    \"Principal\": { \"Service\": \"cloudfront.amazonaws.com\" },
    \"Action\": \"s3:GetObject\",
    \"Resource\": \"arn:aws:s3:::asif-admin-frontend/*\",
    \"Condition\": { \"StringEquals\": { \"AWS:SourceArn\": \"$ADMIN_CF_ARN\" } }
  }]
}"
```

### Step 4 — Create CloudFront distribution for API

```bash
aws cloudfront create-distribution --distribution-config '{
  "CallerReference": "asif-api-'$(date +%s)'",
  "Aliases": { "Quantity": 1, "Items": ["api.asif.tulidu.com"] },
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "asif-api",
      "DomainName": "ec2-3-92-164-103.compute-1.amazonaws.com",
      "CustomOriginConfig": {
        "HTTPPort": 3002,
        "HTTPSPort": 443,
        "OriginProtocolPolicy": "http-only",
        "OriginReadTimeout": 30,
        "OriginKeepaliveTimeout": 5
      }
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "asif-api",
    "ViewerProtocolPolicy": "https-only",
    "AllowedMethods": { "Quantity": 7, "Items": ["HEAD","DELETE","POST","GET","OPTIONS","PUT","PATCH"], "CachedMethods": { "Quantity": 3, "Items": ["HEAD","GET","OPTIONS"] } },
    "Compress": true,
    "CachePolicyId": "83da9c7e-98b4-4e11-a168-04f0df8e2c65",
    "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3"
  },
  "ViewerCertificate": {
    "ACMCertificateArn": "arn:aws:acm:us-east-1:201698141128:certificate/e7e18153-7052-4554-9d2a-94483148ff77",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "Enabled": true,
  "HttpVersion": "http2"
}'
```
▶ **Save the distribution ID** → set `API_CF_ID` in `deploy/.env`

### Step 5 — Add Route53 DNS records

Get the CloudFront domain names from the distributions above, then:

```bash
# Replace CF_DOMAIN values with actual CloudFront domains (e.g. dXXXX.cloudfront.net)

aws route53 change-resource-record-sets \
  --hosted-zone-id Z099469415RQDQT1S0UKA \
  --change-batch '{
    "Changes": [
      {
        "Action": "CREATE",
        "ResourceRecordSet": {
          "Name": "asif.tulidu.com",
          "Type": "CNAME",
          "TTL": 300,
          "ResourceRecords": [{ "Value": "<ADMIN_CF_DOMAIN>.cloudfront.net" }]
        }
      },
      {
        "Action": "CREATE",
        "ResourceRecordSet": {
          "Name": "api.asif.tulidu.com",
          "Type": "CNAME",
          "TTL": 300,
          "ResourceRecords": [{ "Value": "<API_CF_DOMAIN>.cloudfront.net" }]
        }
      }
    ]
  }'
```

### Step 6 — Open port 3002 on EC2 security group

```bash
# Security group ID from tulidu-sport deploy config
aws ec2 authorize-security-group-ingress \
  --group-id sg-05e80cef3e637a9ba \
  --protocol tcp \
  --port 3002 \
  --cidr 0.0.0.0/0
```

---

## Ongoing Deployment

### Deploy server (after code changes)
```bash
cd /path/to/asif
./deploy/deploy-server.sh
```

### Deploy admin UI (after code changes)
```bash
cd /path/to/asif
./deploy/deploy-admin.sh
```

### Setup deploy/.env (first time)
```bash
cp deploy/env.example deploy/.env
# Fill in ADMIN_CF_ID and API_CF_ID after Step 2 and Step 4
```

---

## EC2 — First-Time Setup

SSH in and install PM2 if not already present (tulidu-sport should have installed it):

```bash
ssh -i ~/.ssh/amos-keypair.pem ec2-user@ec2-3-92-164-103.compute-1.amazonaws.com
pm2 --version   # should already be installed
```

---

## Updating the iPhone App API URL

For testing on a real device before prod, set the IP in `asif-app/.env.local`:
```
VITE_API_URL=http://192.168.x.x:3002
```

For production build (handled automatically by `deploy-admin.sh`):
```
VITE_API_URL=https://asif-api.tulidu.com
```
(If you use `https://api.asif.tulidu.com`, that hostname must exist in Route53 — currently the live API is `asif-api.tulidu.com` per product doc.)
