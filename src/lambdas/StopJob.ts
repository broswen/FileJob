'use strict';

module.exports.handler = async (event) => {

  console.log(`Stopping ${event.job.name} (${event.job.id}) at ${new Date().toISOString()}`)

  return {
  };
};
