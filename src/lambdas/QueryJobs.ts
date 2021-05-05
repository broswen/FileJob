'use strict';

import { AttributeValue, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { JobDetails } from "../models/JobTypes";
import { JobService } from "../services/JobService";
import { JobServiceImpl } from "../services/JobServiceImpl";


const middy = require('@middy/core');
const createError = require('http-errors');

const jsonBodyParser = require('@middy/http-json-body-parser');
const httpErrorHandler = require('@middy/http-error-handler');
const validator = require('@middy/validator');

const s3Client: S3Client = new S3Client({})
const ddbClient: DynamoDBClient = new DynamoDBClient({})
const jobService: JobService = new JobServiceImpl(ddbClient, s3Client)

const inputSchema: Object = {
  type: 'object',
  properties: {
    queryStringParameters: {
      type: 'object',
      properties: {
        exclusiveStartKey: { type: 'string', minLength: 1 },
        limit: { type: 'number', minimum: 1 }
      },
    }
  }
}


const queryJobs = async (event, context) => {

  let queryResponse: { jobDetails: JobDetails[], lastEvaluatedKey: { [key: string]: AttributeValue } }
  let limit: number = 25
  if (event.queryStringParameters && event.queryStringParameters.limit) {
    limit = event.queryStringParameters.limit
  }

  try {
    queryResponse = await jobService.listJobs(limit)
  } catch (error) {
    console.error(error)
    throw createError(500)
  }

  return {
    statusCode: 200,
    body: JSON.stringify(queryResponse)
  };
};

const handler = middy(queryJobs)
  .use(jsonBodyParser())
  .use(validator({ inputSchema }))
  .use(httpErrorHandler())

module.exports = { handler }