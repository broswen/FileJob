import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { Job, JobDetails, JobStep, JobValidationState } from "../models/JobTypes";

export interface JobService {
    putJob(job: Job): Promise<Job>
    getJobDetails(id: string): Promise<JobDetails>
    getJobSteps(id: string): Promise<JobStep[]>
    deleteJob(id: string): Promise<string>
    setJobValidationState(id: string, status: JobValidationState): Promise<string>
    listJobs(limit: number, exclusiveStartKey?: { [key: string]: AttributeValue }): Promise<{ jobDetails: JobDetails[], lastEvaluatedKey: { [key: string]: AttributeValue } }>
}