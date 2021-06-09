'use strict';

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { S3Client } from "@aws-sdk/client-s3";
import { JobService } from "../services/JobService";
import { JobServiceImpl } from "../services/JobServiceImpl";

const KSUID = require('ksuid')

const s3Client: S3Client = new S3Client({})
const ddbClient: DynamoDBClient = new DynamoDBClient({})
const ebClient = new EventBridgeClient({})
const jobService: JobService = new JobServiceImpl(ddbClient, s3Client, ebClient)

const middy = require('@middy/core');
const createError = require('http-errors');

const jsonBodyParser = require('@middy/http-json-body-parser');
const httpErrorHandler = require('@middy/http-error-handler');
const validator = require('@middy/validator');

const inputSchema: Object = {
  type: 'object',
  properties: {
    pathParameters: {
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 1 }
      },
      required: ['id']
    }
  }
}


const deleteJob = async (event, context) => {

  try {
    await jobService.deleteJob(event.pathParameters.id)
  } catch (error) {
    console.error(error)
    throw createError(500)
  }

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        id: event.pathParameters.id
      }
    )
  };
};

const handler = middy(deleteJob)
  .use(jsonBodyParser())
  .use(validator({ inputSchema }))
  .use(httpErrorHandler())

module.exports = { handler }