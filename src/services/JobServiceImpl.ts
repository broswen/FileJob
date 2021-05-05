import { AttributeValue, DeleteItemCommand, DeleteItemCommandInput, DynamoDBClient, GetItemCommand, GetItemCommandInput, GetItemCommandOutput, PutItemCommand, PutItemCommandInput, PutItemCommandOutput, ScanCommand, ScanCommandInput, ScanCommandOutput } from "@aws-sdk/client-dynamodb";
import { DeleteObjectCommand, DeleteObjectCommandInput, GetObjectCommand, GetObjectCommandInput, GetObjectCommandOutput, PutObjectCommand, PutObjectCommandInput, PutObjectCommandOutput, S3Client } from "@aws-sdk/client-s3";
import { Job, JobDetails, JobState, JobStep } from "../models/JobTypes";
import { JobService } from "./JobService";


export class JobServiceImpl implements JobService {

    private ddbClient: DynamoDBClient
    private s3Client: S3Client
    constructor(ddbClient: DynamoDBClient, s3Client: S3Client) {
        this.ddbClient = ddbClient
        this.s3Client = s3Client
    }


    async putJob(job: Job): Promise<Job> {
        console.log(JSON.stringify(job))
        const params: PutItemCommandInput = {
            TableName: process.env.JOBSTABLE,
            Item: {
                PK: {
                    S: `J#${job.id}`
                },
                SK: {
                    S: `J#${job.id}`
                },
                id: {
                    S: job.id
                },
                jobname: {
                    S: job.name
                },
                schedule: {
                    S: job.schedule
                },
                updated: {
                    S: job.updated.toISOString()
                },
                jobstate: {
                    S: job.state
                }
            }
        }

        let putItemResponse: PutItemCommandOutput
        try {
            putItemResponse = await this.ddbClient.send(new PutItemCommand(params))
        } catch (error) {
            console.error(error)
            throw error
        }

        const params2: PutObjectCommandInput = {
            Bucket: process.env.JOBSBUCKET,
            Key: job.id,
            Body: Buffer.from(JSON.stringify(job.steps))
        }

        let putObjectResponse: PutObjectCommandOutput
        try {
            putObjectResponse = await this.s3Client.send(new PutObjectCommand(params2))
        } catch (error) {
            console.error(error)
            throw error
        }

        return job
    }


    async getJobDetails(id: string): Promise<JobDetails> {
        const params: GetItemCommandInput = {
            TableName: process.env.JOBSTABLE,
            Key: {
                PK: {
                    S: `J#${id}`
                },
                SK: {
                    S: `J#${id}`
                }
            }
        }
        let getItemResponse: GetItemCommandOutput
        try {
            getItemResponse = await this.ddbClient.send(new GetItemCommand(params))
        } catch (error) {
            console.error(error)
            throw error
        }

        if (getItemResponse.Item === undefined) {
            throw new Error('Job not found')
        }

        console.log(JSON.stringify(getItemResponse.Item))

        return {
            id: getItemResponse.Item.id.S,
            name: getItemResponse.Item.jobname.S,
            schedule: getItemResponse.Item.schedule.S,
            updated: new Date(getItemResponse.Item.updated.S),
            state: getItemResponse.Item.jobstate.S as JobState
        }
    }

    async getJobSteps(id: string): Promise<JobStep[]> {
        const params: GetObjectCommandInput = {
            Bucket: process.env.JOBSBUCKET,
            Key: id
        }
        let getObjectResponse: GetObjectCommandOutput
        try {
            getObjectResponse = await this.s3Client.send(new GetObjectCommand(params))
        } catch (error) {
            console.error(error)
            throw error
        }
        let contents: string = ''
        for await (const part of getObjectResponse.Body) {
            contents += part
        }

        let steps: JobStep[]
        try {
            steps = JSON.parse(contents)
        } catch (error) {
            console.error('Error parsing job steps json')
            console.error(error)
            throw error
        }

        return steps
    }

    async deleteJob(id: string): Promise<string> {
        const params: DeleteItemCommandInput = {
            TableName: process.env.JOBSTABLE,
            Key: {
                PK: {
                    S: `J#${id}`
                },
                SK: {
                    S: `J#${id}`
                }
            }
        }

        try {
            await this.ddbClient.send(new DeleteItemCommand(params))
        } catch (error) {
            console.error(error)
            throw error
        }

        const params2: DeleteObjectCommandInput = {
            Bucket: process.env.JOBSBUCKET,
            Key: id
        }

        try {
            await this.s3Client.send(new DeleteObjectCommand(params2))
        } catch (error) {
            console.error(error)
            throw error
        }

        return id
    }

    async listJobs(limit: number = 25, exclusiveStartKey?: { [key: string]: AttributeValue }): Promise<{ jobDetails: JobDetails[], lastEvaluatedKey: { [key: string]: AttributeValue } }> {
        let params: ScanCommandInput = {
            TableName: process.env.JOBSTABLE,
            Limit: limit,
        }

        if (exclusiveStartKey !== undefined) {
            params.ExclusiveStartKey = exclusiveStartKey
        }

        let scanResponse: ScanCommandOutput
        try {
            scanResponse = await this.ddbClient.send(new ScanCommand(params))
        } catch (error) {
            console.error(error)
            throw error
        }

        if (scanResponse.Count === 0) {
            return { jobDetails: [], lastEvaluatedKey: scanResponse.LastEvaluatedKey }
        }

        const jobDetails: JobDetails[] = scanResponse.Items.map(item => ({
            id: item.id.S,
            name: item.jobname.S,
            schedule: item.schedule.S,
            updated: new Date(item.updated.S),
            state: item.jobstate.S as JobState
        }))

        return { jobDetails, lastEvaluatedKey: scanResponse.LastEvaluatedKey }
    }
}