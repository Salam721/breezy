#!/usr/bin/env bash
# Build lambda.zip for AWS Lambda (Python 3.12, x86_64).
# boto3 is already in the Lambda Python runtime, so only shapely (+ numpy) is bundled.
# Handler to set in Lambda:  breezy_pipeline.handler.lambda_handler
set -euo pipefail
cd "$(dirname "$0")"
rm -rf build lambda.zip
mkdir build
pip install --quiet --target build \
  --platform manylinux2014_x86_64 --python-version 3.12 --implementation cp \
  --only-binary=:all: shapely
cp -r breezy_pipeline build/
(cd build && zip -qr ../lambda.zip . -x "*/__pycache__/*" "*.dist-info/*")
ls -lh lambda.zip
echo "Upload lambda.zip to Lambda (Python 3.12, x86_64). Zip direct-upload limit is 50 MB."
