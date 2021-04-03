'use strict';

const { S3Client, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')

const s3Client = new S3Client({})

module.exports.handler = async (event) => {

  const step = event.job.steps[event.job.current]

  console.log(`Running step ${step.name} (${step.id}) at ${new Date().toISOString()}`)

  if (step.action === 'ERROR') {
    throw new Error('Action ERROR found for step')
  }

  if (step.action !== 'DELETE') {
    console.log(`Copying ${step.source} to ${step.destination}`)

    const params = {
      Bucket: step.destination.split('/')[0],
      Key: step.destination.split('/').slice(1).join('/'),
      CopySource: step.source
    }
    try {
      await s3Client.send(new CopyObjectCommand(params))
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  if (step.action !== 'COPY') {
    console.log(`Deleting ${step.source}`)

    const params = {
      Bucket: step.source.split('/')[0],
      Key: step.source.split('/').slice(1).join('/')
    }
    try {
      await s3Client.send(new DeleteObjectCommand(params))
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  event.job.current++

  return event.job
}
