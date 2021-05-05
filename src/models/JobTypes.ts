export type Job = JobDetails & { steps: JobStep[] }

export type JobDetails = {
    name: string
    id: string
    schedule: string
    updated: Date
    state: JobState
}

export type JobStep = {
    id: number
    name: string
    action: JobAction
    source?: string
    sources?: string[]
    destination: string
}

export type JobAction = 'COPY' | 'MOVE' | 'DELETE' | 'MERGE'
export type JobState = 'ENABLED' | 'DISABLED'