import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { Job, JobDetails, JobStep } from "../models/JobTypes";

export interface JobService {
    putJob(job: Job): Promise<Job>
    getJobDetails(id: string): Promise<JobDetails>
    getJobSteps(id: string): Promise<JobStep[]>
    deleteJob(id: string): Promise<string>
    listJobs(limit: number, exclusiveStartKey?: { [key: string]: AttributeValue }): Promise<{ jobDetails: JobDetails[], lastEvaluatedKey: { [key: string]: AttributeValue } }>
}