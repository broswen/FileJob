'use strict';

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { S3Client } from "@aws-sdk/client-s3";
import { Job } from "../models/JobTypes";
import { JobService } from "../services/JobService";
import { JobServiceImpl } from "../services/JobServiceImpl";


const KSUID = require('ksuid')

const middy = require('@middy/core');
const createError = require('http-errors');

const jsonBodyParser = require('@middy/http-json-body-parser');
const httpErrorHandler = require('@middy/http-error-handler');
const validator = require('@middy/validator');

const ebClient = new EventBridgeClient({})
const s3Client: S3Client = new S3Client({})
const ddbClient: DynamoDBClient = new DynamoDBClient({})
const jobService: JobService = new JobServiceImpl(ddbClient, s3Client, ebClient)

const inputSchema: Object = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 1 },
        name: { type: 'string', minLength: 1, pattern: '[a-zA-Z0-9_-]+' },
        schedule: { type: 'string', minLength: 1 },
        state: { type: 'string', enum: ['ENABLED', 'DISABLED'] },
        steps: {
          type: 'array', items: { type: 'object' }
        }
      },
      required: ['name', 'schedule', 'state', 'steps']
    },
    pathParameters: {
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 1 }
      },
      required: ['id']
    }
  }
}


const updateJob = async (event, context) => {

  const job: Job = {
    id: event.pathParameters.id,
    name: event.body.name,
    schedule: event.body.schedule,
    updated: new Date(),
    state: event.body.state,
    steps: event.body.steps
  }

  try {
    await jobService.putJob(job)
  } catch (error) {
    console.error(error)
    throw new createError(500)
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      name: event.body.name,
      id: event.pathParameters.id
    })
  };
};

const handler = middy(updateJob)
  .use(jsonBodyParser())
  .use(validator({ inputSchema }))
  .use(httpErrorHandler())

module.exports = { handler }