'use strict';


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
    queryStringParameters: {
      type: 'object',
      properties: {
        page: { type: 'number', minimum: 0 },
        limit: { type: 'number', minimum: 1 }
      },
    }
  }
}


const getJob = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  let query = `SELECT * FROM jobs ORDER BY jobid DESC LIMIT 25`
  if (event.queryStringParameters) {
    query = `SELECT * FROM jobs ORDER BY jobid DESC LIMIT ${event.queryStringParameters.limit || 25} OFFSET ${event.queryStringParameters.page || 0}`
  }
  let pgRes;

  try {
    pgRes = await runQuery(query, [])
  } catch (error) {
    console.error(error)
    throw createError(500)
  }


  return {
    statusCode: 200,
    body: JSON.stringify(pgRes.rows.map(job => ({ id: job.jobid, name: job.name })))
  };
};

const handler = middy(getJob)
  .use(jsonBodyParser())
  // .use(validator({ inputSchema }))
  .use(httpErrorHandler())

module.exports = { handler }