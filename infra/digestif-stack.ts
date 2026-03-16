import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

export class DigestifStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const table = new dynamodb.Table(this, "DigestifTable", {
      tableName: "DigestifDuJour",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI1 for reverse lookups
    table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Processor Lambda (does the real work: Claude, DynamoDB, Telegram response)
    const processor = new NodejsFunction(this, "Processor", {
      entry: "src/processor.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(120),
      retryAttempts: 0, // No retries on async invoke — prevents duplicate Claude calls
      environment: {
        DYNAMODB_TABLE_NAME: table.tableName,
        BOT_TOKEN: process.env.BOT_TOKEN || "",
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
        BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY || "",
        ALLOWED_USER_IDS: process.env.ALLOWED_USER_IDS || "",
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ["@aws-sdk/*"],
      },
    });

    table.grantReadWriteData(processor);

    // Receiver Lambda (fast: validate, invoke processor, return 200)
    const receiver = new NodejsFunction(this, "Receiver", {
      entry: "src/receiver.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        PROCESSOR_FUNCTION_NAME: processor.functionName,
        ALLOWED_USER_IDS: process.env.ALLOWED_USER_IDS || "",
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ["@aws-sdk/*"],
      },
    });

    processor.grantInvoke(receiver);

    // API Gateway
    const api = new apigateway.RestApi(this, "DigestifApi", {
      restApiName: "DigestifDuJour",
      description: "Telegram webhook for Digestif Du Jour bot",
    });

    const webhook = api.root.addResource("webhook");
    webhook.addMethod(
      "POST",
      new apigateway.LambdaIntegration(receiver)
    );

    // Outputs
    new cdk.CfnOutput(this, "WebhookUrl", {
      value: `${api.url}webhook`,
      description: "Set this as your Telegram webhook URL",
    });

    new cdk.CfnOutput(this, "TableName", {
      value: table.tableName,
    });
  }
}
