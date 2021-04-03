'use strict';

module.exports.handler = async (event) => {

  // INPUT
  // {
  // "id": "abc12",
  // "name": "copy files",
  // "stepCount": 3,
  // "start": 0,
  // "current": 0,
  // "steps": [
  //   {
  //     "id": 0,
  //     "name": "step1",
  //     "action": "COPY",
  //     "source": "bucket1/file1",
  //     "destination": "bucket2/file1"
  //   },
  //   {
  //     "id": 1,
  //     "name": "step2",
  //     "action": "COPY",
  //     "source": "bucket1/file1",
  //     "destination": "bucket2/file1"
  //   },
  //   {
  //     "id": 2,
  //     "name": "step3",
  //     "action": "MOVE",
  //     "source": "bucket1/file1",
  //     "destination": "bucket3/file1"
  //   }
  // ]
  // }

  console.log(`Starting ${event.name} (${event.id}) at ${new Date().toISOString()}`)

  return event
};
