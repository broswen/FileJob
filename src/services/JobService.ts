import { Job, JobDetails, JobStep } from "../models/JobTypes";

export interface JobService {
    putJob(job: Job): Promise<Job>
    getJobDetails(id: string): Promise<JobDetails>
    getJobSteps(id: string): Promise<JobStep[]>
    deleteJob(id: string): Promise<string>
}