'use strict';

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { JobDetails, JobStep } from "../models/JobTypes";
import { JobService } from "../services/JobService";
import { JobServiceImpl } from "../services/JobServiceImpl";

const s3Client: S3Client = new S3Client({})
const ddbClient: DynamoDBClient = new DynamoDBClient({})
const jobService: JobService = new JobServiceImpl(ddbClient, s3Client, undefined)

module.exports.handler = async (event: { id: string }) => {

  // {
  //   id: 'kl32jlkj34'
  // }

  let jobDetails: JobDetails
  try {
    jobDetails = await jobService.getJobDetails(event.id)
  } catch (error) {
    console.error(error)
    throw error
  }
  let jobSteps: JobStep[]
  try {
    jobSteps = await jobService.getJobSteps(event.id)
  } catch (error) {
    console.error(error)
    throw error
  }

  if (jobDetails.validationState !== 'VALID') {
    throw new Error('Skipping job run. Job definition is not valid or has not been validated.')
  }

  console.log(`Starting ${event.id} at ${new Date().toISOString()}`)

  return {
    id: jobDetails.id,
    name: jobDetails.name,
    stepCount: jobSteps.length,
    start: 0,
    current: 0,
    steps: jobSteps
  }
};
