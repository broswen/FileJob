This StateMachine definition allows you to define multiple S3 Move/Copy operations with JSON and run them as a job.

1. Define job with JSON
```json
{
"id": "abc12",
"name": "copy files",
"stepCount": 3,
"start": 0,
"current": 0,
"steps": [
  {
    "id": 0,
    "name": "step1",
    "action": "COPY",
    "source": "bucket1/file1",
    "destination": "bucket2/file1"
  },
  {
    "id": 1,
    "name": "step2",
    "action": "COPY",
    "source": "bucket1/file1",
    "destination": "bucket2/file1"
  },
  {
    "id": 2,
    "name": "step3",
    "action": "MOVE",
    "source": "bucket1/file1",
    "destination": "bucket3/file1"
  }
]
}
```

2. StepFunctions iterates through the steps defined in the job definition.

![flowchart](./flow.png)