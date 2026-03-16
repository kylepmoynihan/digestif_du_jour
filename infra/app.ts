#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DigestifStack } from "./digestif-stack";

const app = new cdk.App();
new DigestifStack(app, "DigestifDuJour", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
});
