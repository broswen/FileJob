'use strict';

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { Job, JobDetails, JobStep } from "../models/JobTypes";
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
    pathParameters: {
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 1 }
      },
      required: ['id']
    }
  }
}


const getJob = async (event, context) => {

  let jobDetails: JobDetails
  try {
    jobDetails = await jobService.getJobDetails(event.pathParameters.id)
  } catch (error) {
    console.error(error)
    throw createError(500)
  }

  let jobSteps: JobStep[]
  try {
    jobSteps = await jobService.getJobSteps(event.pathParameters.id)
  } catch (error) {
    console.error(error)
    throw createError(500)
  }

  let job: Job = jobDetails as Job
  job.steps = jobSteps

  return {
    statusCode: 200,
    body: JSON.stringify(job)
  };
};

const handler = middy(getJob)
  .use(jsonBodyParser())
  .use(validator({ inputSchema }))
  .use(httpErrorHandler())

module.exports = { handler }