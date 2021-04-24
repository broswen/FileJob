'use strict';

import { CompleteMultipartUploadCommand, CompleteMultipartUploadCommandInput, CompleteMultipartUploadCommandOutput, CopyObjectCommandInput, CreateMultipartUploadCommand, CreateMultipartUploadCommandInput, CreateMultipartUploadCommandOutput, DeleteObjectCommandInput, GetObjectCommand, GetObjectCommandInput, GetObjectCommandOutput, HeadObjectCommand, HeadObjectCommandInput, HeadObjectCommandOutput, UploadPartCommand, UploadPartCommandInput, UploadPartCommandOutput } from "@aws-sdk/client-s3";

const { S3Client, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')

const s3Client = new S3Client({})

module.exports.handler = async (event) => {

  const step = event.job.steps[event.job.current]

  console.log(`Running step ${step.name} (${step.id}) at ${new Date().toISOString()}`)

  if (step.action === 'ERROR') {
    throw new Error('Action ERROR found for step')
  }

  if (step.action === 'COPY' || step.action === 'MOVE') {
    console.log(`Copying ${step.source} to ${step.destination}`)

    const params: CopyObjectCommandInput = {
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

  if (step.action === 'MOVE' || step.action === 'DELETE') {
    console.log(`Deleting ${step.source}`)

    const params: DeleteObjectCommandInput = {
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

  if (step.action === 'MERGE') {
    await mergeFilesMultipart(step)
  }
  event.job.current++

  return event.job
}

async function getSourcesTotalSize(step: { id: string, action: string, name: string, sources: string[], destination: string }) {
  const files = step.sources.map(source => ({ bucket: source.split('/')[0], key: source.split('/').slice(1).join('/') }))
  let totalSize: number = 0
  for (let file of files) {
    const params: HeadObjectCommandInput = {
      Bucket: file.bucket,
      Key: file.key
    }
    let headObjectResponse: HeadObjectCommandOutput
    try {
      headObjectResponse = await s3Client.send(new HeadObjectCommand(params))
    } catch (error) {
      console.error(error)
      throw error
    }
    totalSize += headObjectResponse.ContentLength
  }
  return totalSize
}

async function mergeFilesMultipart(step: { id: string, action: string, name: string, sources: string[], destination: string }) {
  // split files out into bucket and key
  const files = step.sources.map(source => ({ bucket: source.split('/')[0], key: source.split('/').slice(1).join('/') }))
  // split destination bucket and key
  const dstBucket = step.destination.split('/')[0]
  const dstKey = step.destination.split('/').slice(1).join('/')
  console.log(`Merging ${step.sources} into ${step.destination}`)

  // create multipart upload and save UploadId 
  const params: CreateMultipartUploadCommandInput = {
    Bucket: dstBucket,
    Key: dstKey
  }

  let createMultipartResponse: CreateMultipartUploadCommandOutput
  try {
    createMultipartResponse = await s3Client.send(new CreateMultipartUploadCommand(params))
  } catch (error) {
    console.error(error)
    throw error
  }

  const multipartUploadId: string = createMultipartResponse.UploadId
  // keep track of parts to merge
  let parts: { ETag: string, PartNumber: number }[] = []
  let partNumber: number = 1

  // for every file, download file in chunks of 10MB
  // upload each chunk as a part
  const chunkSize: number = 5242880 + 100 // 5MiB + 100B
  let chunk: Buffer = Buffer.from([])
  for (let file of files) {
    console.log(`Downloading ${file.bucket}/${file.key}`)
    const params: GetObjectCommandInput = {
      Bucket: file.bucket,
      Key: file.key
    }
    let getObjectResponse: GetObjectCommandOutput
    try {
      getObjectResponse = await s3Client.send(new GetObjectCommand(params))
    } catch (error) {
      console.error(error)
      throw error
    }

    for await (let partial of getObjectResponse.Body) {
      chunk = Buffer.concat([chunk, partial])

      if (chunk.length > chunkSize) {
        console.log(`Uploading part ${partNumber} from ${file.bucket}/${file.key}`)
        const part = await uploadPart(dstBucket, dstKey, chunk, partNumber, multipartUploadId)
        parts.push(part)
        partNumber += 1
        chunk = Buffer.from([])
      }
    }


  }
  // check if last chunk was smaller than 10MB and upload
  if (chunk.length > 0) {
    console.log(`Uploading final part ${partNumber}`)
    const part = await uploadPart(dstBucket, dstKey, chunk, partNumber, multipartUploadId)
    parts.push(part)
    partNumber += 1
  }

  console.log(`Starting multipart upload for ${step.destination} with ${parts.length} parts`)

  const params2: CompleteMultipartUploadCommandInput = {
    Bucket: dstBucket,
    Key: dstKey,
    UploadId: multipartUploadId,
    MultipartUpload: { Parts: parts }
  }

  console.log(params2)

  let completeMultipartResponse: CompleteMultipartUploadCommandOutput
  try {
    completeMultipartResponse = await s3Client.send(new CompleteMultipartUploadCommand(params2))
  } catch (error) {
    console.error(error)
    throw error
  }


  console.log(`Completed multipart upload for ${step.destination}`)

}

async function uploadPart(dstBucket: string, dstKey: string, chunk: Buffer, partNumber: number, multipartUploadId: string): Promise<{ ETag: string, PartNumber: number }> {
  const params: UploadPartCommandInput = {
    Bucket: dstBucket,
    Key: dstKey,
    Body: chunk,
    PartNumber: partNumber,
    UploadId: multipartUploadId
  }
  let uploadPartResponse: UploadPartCommandOutput
  try {
    uploadPartResponse = await s3Client.send(new UploadPartCommand(params))
  } catch (error) {
    console.error(error)
    throw error
  }
  return { ETag: uploadPartResponse.ETag, PartNumber: partNumber }
}