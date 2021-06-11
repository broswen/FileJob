'use strict';

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { S3Event, SQSEvent } from "aws-lambda";
import * as Joi from "joi";
import { ValidationError } from "joi";
import { JobDetails, JobStep } from "../models/JobTypes";
import { JobService } from "../services/JobService";
import { JobServiceImpl } from "../services/JobServiceImpl";

const s3Client: S3Client = new S3Client({})
const ddbClient: DynamoDBClient = new DynamoDBClient({})
const jobService: JobService = new JobServiceImpl(ddbClient, s3Client, undefined)

const schema = Joi.array().items(Joi.object({
  id: Joi.number().min(0).integer(),
  name: Joi.string().min(1),
  action: Joi.string().valid("COPY", "MOVE", "DELETE", "MERGE"),
  source: Joi.string().pattern(/^.+\/.+/),
  sources: Joi.array().items(Joi.string().pattern(/^.+\/.+/)),
  destination: Joi.string().pattern(/^.+\/.+/),
}))

module.exports.handler = async (sqsEvent: SQSEvent) => {

  console.log(sqsEvent)

  for (let sqsRecord of sqsEvent.Records) {
    let s3Event: S3Event = JSON.parse(sqsRecord.body)
    for (let s3Record of s3Event.Records) {
      let jobDetails: JobDetails = await jobService.getJobDetails(s3Record.s3.object.key)
      let jobSteps: JobStep[] = await jobService.getJobSteps(s3Record.s3.object.key)


      const { error, value } = schema.validate(jobSteps)

      if (error !== undefined) {
        let validationError: ValidationError = error as ValidationError
        let errorMessage: string = validationError.message

        console.error("Invalid Job Schema")
        console.error(errorMessage)
        await jobService.setJobValidationState(jobDetails.id, 'INVALID')

      } else {
        console.log("Valid Job Schema")
        await jobService.setJobValidationState(jobDetails.id, 'VALID')
      }
    }
  }
};
