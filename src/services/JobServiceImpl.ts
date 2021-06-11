import { AttributeValue, DeleteItemCommand, DeleteItemCommandInput, DynamoDBClient, GetItemCommand, GetItemCommandInput, GetItemCommandOutput, PutItemCommand, PutItemCommandInput, PutItemCommandOutput, ScanCommand, ScanCommandInput, ScanCommandOutput, UpdateItemCommand, UpdateItemCommandInput, UpdateItemCommandOutput } from "@aws-sdk/client-dynamodb";
import { DeleteRuleCommand, DeleteRuleCommandInput, EventBridgeClient, ListTargetsByRuleCommand, ListTargetsByRuleCommandInput, ListTargetsByRuleCommandOutput, PutRuleCommand, PutRuleCommandInput, PutRuleCommandOutput, PutTargetsCommand, PutTargetsCommandInput, PutTargetsCommandOutput, RemoveTargetsCommand, RemoveTargetsCommandInput } from "@aws-sdk/client-eventbridge";
import { DeleteObjectCommand, DeleteObjectCommandInput, GetObjectCommand, GetObjectCommandInput, GetObjectCommandOutput, PutObjectCommand, PutObjectCommandInput, PutObjectCommandOutput, S3Client } from "@aws-sdk/client-s3";
import { Job, JobDetails, JobState, JobStep, JobValidationState } from "../models/JobTypes";
import { JobService } from "./JobService";


export class JobServiceImpl implements JobService {

    private ddbClient: DynamoDBClient
    private s3Client: S3Client
    private ebClient: EventBridgeClient
    constructor(ddbClient: DynamoDBClient, s3Client: S3Client, ebClient: EventBridgeClient) {
        this.ddbClient = ddbClient
        this.s3Client = s3Client
        this.ebClient = ebClient
    }

    async setJobValidationState(id: string, validationState: JobValidationState): Promise<string> {
        const params: UpdateItemCommandInput = {
            TableName: process.env.JOBSTABLE,
            Key: {
                PK: {
                    S: `J#${id}`
                },
                SK: {
                    S: `J#${id}`
                }
            },
            ConditionExpression: 'SET #v = :v',
            ExpressionAttributeNames: {
                '#v': 'validationstate'
            },
            ExpressionAttributeValues: {
                ':v': {
                    'S': validationState
                }
            }
        }

        let updateItemResponse: UpdateItemCommandOutput
        try {
            updateItemResponse = await this.ddbClient.send(new UpdateItemCommand(params))
        } catch (error) {
            throw error
        }
        return id
    }

    async putJob(job: Job): Promise<Job> {
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
                },
                validationstate: {
                    S: job.validationState
                }
            }
        }

        let putItemResponse: PutItemCommandOutput
        try {
            putItemResponse = await this.ddbClient.send(new PutItemCommand(params))
        } catch (error) {
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
            throw error
        }

        // TODO create eventbridge scheduled rule
        const params3: PutRuleCommandInput = {
            Name: job.id,
            ScheduleExpression: job.schedule,
            State: job.state ? 'ENABLED' : 'DISABLED',
            RoleArn: process.env.EBROLE,
        }

        const params4: PutTargetsCommandInput = {
            Rule: job.id,
            Targets: [{
                Arn: process.env.JOBRUNNERSM,
                Id: job.id,
                RoleArn: process.env.EBROLE,
                Input: JSON.stringify({
                    id: job.id,
                }),
            }]
        }

        let putRuleOutput: PutRuleCommandOutput
        let putTargetOutput: PutTargetsCommandOutput
        try {
            putRuleOutput = await this.ebClient.send(new PutRuleCommand(params3))
            putTargetOutput = await this.ebClient.send(new PutTargetsCommand(params4))
        } catch (error) {
            throw error
        }

        // get ARN after created
        const ruleArn = putRuleOutput.RuleArn

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
            throw error
        }

        if (getItemResponse.Item === undefined) {
            throw new Error('Job not found')
        }

        return {
            id: getItemResponse.Item.id.S,
            name: getItemResponse.Item.jobname.S,
            schedule: getItemResponse.Item.schedule.S,
            updated: new Date(getItemResponse.Item.updated.S),
            state: getItemResponse.Item.jobstate.S as JobState,
            validationState: getItemResponse.Item.jobstatus.S as JobValidationState
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
            throw error
        }

        return steps
    }

    async deleteJob(id: string): Promise<string> {

        var job: JobDetails
        try {
            job = await this.getJobDetails(id)
        } catch (error) {
            throw error
        }

        let listTargetsInput: ListTargetsByRuleCommandInput = {
            Rule: job.id
        }

        let targets: ListTargetsByRuleCommandOutput
        try {
            targets = await this.ebClient.send(new ListTargetsByRuleCommand(listTargetsInput))
        } catch (error) {
            throw error
        }


        const removeTargetsInput: RemoveTargetsCommandInput = {
            Rule: job.id,
            Ids: targets.Targets.map(target => target.Id)
        }

        const deleteRuleInput: DeleteRuleCommandInput = {
            Name: job.id,
        }

        try {
            await this.ebClient.send(new RemoveTargetsCommand(removeTargetsInput))
            await this.ebClient.send(new DeleteRuleCommand(deleteRuleInput))
        } catch (error) {
            throw error
        }


        const deleteItemInput: DeleteItemCommandInput = {
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

        const deleteObjectInput: DeleteObjectCommandInput = {
            Bucket: process.env.JOBSBUCKET,
            Key: id
        }

        try {
            await this.s3Client.send(new DeleteObjectCommand(deleteObjectInput))
        } catch (error) {
            throw error
        }

        try {
            await this.ddbClient.send(new DeleteItemCommand(deleteItemInput))
        } catch (error) {
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
            state: item.jobstate.S as JobState,
            validationState: item.jobstatus.S as JobValidationState
        }))

        return { jobDetails, lastEvaluatedKey: scanResponse.LastEvaluatedKey }
    }
}