'use strict';

import { PutRuleCommand, PutRuleCommandInput, PutRuleCommandOutput, PutTargetsCommand, PutTargetsCommandInput, PutTargetsCommandOutput } from "@aws-sdk/client-eventbridge";

const KSUID = require('ksuid')
const { EventBridgeClient } = require('@aws-sdk/client-eventbridge')
const ebClient = new EventBridgeClient({})

const pg = require('pg')
const pool = new pg.Pool()

const middy = require('@middy/core');
const createError = require('http-errors');

const jsonBodyParser = require('@middy/http-json-body-parser');
const httpErrorHandler = require('@middy/http-error-handler');
const validator = require('@middy/validator');

const runQuery = async (q, v) => {
  const client = await pool.connect()
  let res
  try {
    res = client.query(q, v)
  } catch (error) {
    console.error(error)
    throw error
  } finally {
    client.release()
  }
  return res
}

const inputSchema: Object = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, pattern: '[a-zA-Z0-9_-]+' },
        schedule: { type: 'string', minLength: 1 },
        source: { type: 'string', minLength: 1 },
        destination: { type: 'string', minLength: 1 },
        action: { type: 'string', minLength: 1 },
        state: { type: 'boolean' }
      },
      required: ['name', 'schedule', 'source', 'destination', 'action', 'state']
    }
  },
  pathParameters: {
    type: 'object',
    properties: {
      id: { type: 'string', minLength: 1 }
    },
    required: ['id']
  }
}


const updateJob = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const id = event.pathParameters.id

  // create eventbridge rule with ksuid, schedule, constant input
  // input is { action, source, destination }
  const params: PutRuleCommandInput = {
    Name: id,
    ScheduleExpression: event.body.schedule,
    State: event.body.state ? 'ENABLED' : 'DISABLED',
    RoleArn: process.env.EBROLE,
  }

  const params2: PutTargetsCommandInput = {
    Rule: id,
    Targets: [{
      Arn: process.env.FILEJOBSM,
      Id: id,
      RoleArn: process.env.EBROLE,
      Input: JSON.stringify({
        id: id,
        name: event.body.name,
        rule: id,
        action: event.body.action,
        source: event.body.source,
        destination: event.body.destination
      }),
    }]
  }


  let putRuleOutput: PutRuleCommandOutput
  let putTargetOutput: PutTargetsCommandOutput
  try {
    putRuleOutput = await ebClient.send(new PutRuleCommand(params))
    putTargetOutput = await ebClient.send(new PutTargetsCommand(params2))
  } catch (error) {
    console.error(error)
    throw createError(500)
  }

  // get ARN after created
  const ruleArn = putRuleOutput.RuleArn

  // put into postgres with ksuid, name, arn, schedule, source, destination, action
  const query = `UPDATE jobs SET name = $1, schedule = $2, source = $3, destination = $4, action = $5, state = $6 WHERE jobid = $7`
  let pgRes;

  try {
    pgRes = await runQuery(query, [event.body.name, event.body.schedule, event.body.source, event.body.destination, event.body.action, event.body.state, id])
  } catch (error) {
    console.error(error)
    throw createError(500)
  }

  // return name, ksuid
  return {
    statusCode: 200,
    body: JSON.stringify({
      name: event.body.name,
      id
    })
  };
};

const handler = middy(updateJob)
  .use(jsonBodyParser())
  .use(validator({ inputSchema }))
  .use(httpErrorHandler())

module.exports = { handler }