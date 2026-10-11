# Deploy the pipeline to AWS (task B5)

**Status: commands not yet run.** They use standard AWS CLI syntax but have never been executed against your account, so treat each step as unverified and paste any error to Claude. You need an AWS account and the AWS CLI configured (`aws configure`) with permission to create S3, IAM, Lambda and EventBridge resources.

**Fallback if this takes too long:** skip AWS. Run the pipeline on the Mac and publish with `--s3` or host the file anywhere over HTTPS:
`python -m breezy_pipeline.run_local loop --out plumes.json` (every 5 minutes).

Set variables once (pick your own bucket name, it must be globally unique):
```bash
export REGION=us-east-1
export BUCKET=breezy-plumes-YOURNAME
export FN=breezy-pipeline
export ACCT=$(aws sts get-caller-identity --query Account --output text)
```

## 1. S3 bucket with one public file
```bash
aws s3api create-bucket --bucket $BUCKET --region $REGION
aws s3api put-public-access-block --bucket $BUCKET --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false
cat > /tmp/policy.json <<EOF
{ "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject",
                  "Resource": "arn:aws:s3:::$BUCKET/plumes.json" }] }
EOF
aws s3api put-bucket-policy --bucket $BUCKET --policy file:///tmp/policy.json
```
Only `plumes.json` is readable by the public. Its HTTPS URL is expected to be `https://$BUCKET.s3.$REGION.amazonaws.com/plumes.json` (unverified until the first upload). Put that in `app/.env` as `EXPO_PUBLIC_PLUME_URL`.

## 2. Build the Lambda package
```bash
cd pipeline && ./build_lambda.sh
```

## 3. IAM role
```bash
cat > /tmp/trust.json <<EOF
{ "Version": "2012-10-17", "Statement": [{ "Effect": "Allow",
  "Principal": { "Service": "lambda.amazonaws.com" }, "Action": "sts:AssumeRole" }] }
EOF
aws iam create-role --role-name breezy-lambda --assume-role-policy-document file:///tmp/trust.json
aws iam attach-role-policy --role-name breezy-lambda \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
cat > /tmp/put.json <<EOF
{ "Version": "2012-10-17", "Statement": [{ "Effect": "Allow", "Action": "s3:PutObject",
  "Resource": "arn:aws:s3:::$BUCKET/plumes.json" }] }
EOF
aws iam put-role-policy --role-name breezy-lambda --policy-name put-plumes --policy-document file:///tmp/put.json
```
Wait about 10 seconds for the role to propagate.

## 4. Lambda function
```bash
aws lambda create-function --function-name $FN --runtime python3.12 \
  --handler breezy_pipeline.handler.lambda_handler \
  --zip-file fileb://lambda.zip --role arn:aws:iam::$ACCT:role/breezy-lambda \
  --timeout 60 --memory-size 256 --region $REGION \
  --environment "Variables={OPENAQ_API_KEY=YOUR_KEY,OPENWEATHER_API_KEY=YOUR_KEY,BREEZY_S3_BUCKET=$BUCKET}"
aws lambda invoke --function-name $FN --region $REGION /tmp/out.json && cat /tmp/out.json
```
The keys are stored as Lambda environment variables (acceptable for a hackathon; production would use a secrets service). `out.json` shows `published: true`, or the error if, for example, no sensor data is valid. A failed run publishes nothing by design.

## 5. Run every 5 minutes
```bash
aws events put-rule --name breezy-every-5-min --schedule-expression "rate(5 minutes)" --region $REGION
aws lambda add-permission --function-name $FN --statement-id events --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:$REGION:$ACCT:rule/breezy-every-5-min --region $REGION
aws events put-targets --rule breezy-every-5-min --region $REGION \
  --targets "Id"="1","Arn"="arn:aws:lambda:$REGION:$ACCT:function:$FN"
```
Check: open the plume URL in a browser twice, 5+ minutes apart. `generated_at` should change.

## Tear down (avoids charges)
```bash
aws events remove-targets --rule breezy-every-5-min --ids 1 --region $REGION
aws events delete-rule --name breezy-every-5-min --region $REGION
aws lambda delete-function --function-name $FN --region $REGION
aws s3 rm s3://$BUCKET --recursive && aws s3api delete-bucket --bucket $BUCKET
aws iam delete-role-policy --role-name breezy-lambda --policy-name put-plumes
aws iam detach-role-policy --role-name breezy-lambda --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name breezy-lambda
```
