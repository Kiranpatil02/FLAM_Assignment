import {get_db,generate_uuid} from "./schema.js"


export function Enqueuejob(command,options={}){
    const db=get_db()

    const max_retries=options.max_retries??3;

    const add_job=db.prepare(`
        insert into jobs(id,command,max_retries)
        values (?,?,?)
        returning *
        `)
    return add_job.get(generate_uuid(),command,max_retries)
}

export function Claimjob(worker_id){
    const db=get_db();

    const claim_job=db.prepare(`
        update jobs
        set state= 'processing',
            worker_id=?,
            attempts=attempts+1,
            updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        where id=(
        select id from jobs
        where state='pending'
            or (state='failed' and datetime(next_retry_at)<=datetime('now'))
            order by created_at asc
            limit 1
        )
        returning *
        
        `)
    return claim_job.get(worker_id)
}

export function Jobcomplete(jobid){
    const db=get_db();

    const complete_job=db.prepare(`
        update jobs
        set state='completed',
            completed_at=datetime('now'),
            error=null
        where id=?
        
        `)
    return complete_job.run(jobid)
}


export function Failjob(jobid,message){
    const db=get_db();

    const job=db.prepare(`
        select attempts, max_retries from jobs where id=?
        
        `).get(jobid);

    if(!job){
        throw new Error(`Job:${jobid} not found!!`)
    }
    if(job.attempts>=job.max_retries){
        const query=db.prepare(`
            update jobs
            set state='dead',
                error=?
            where id=?
            `)
        query.run(message,jobid)
        
    }else{
        // Implementting exponential backoff
        const backoff=Math.pow(2,job.attempts);

        const query=db.prepare(`
            update jobs
            set state='failed',
                error=?,
                next_retry_at =datetime('now','+' || ? ||' seconds')
            where id=?
            `)
        query.run(message,backoff,jobid)
    }
}



export function Listjobs(state=null){ // default null state
    const db=get_db();

    if(state){
        const query=db.prepare(`
            select * from jobs
                where state=?
                order by created_at desc
                limit 10
            `);

        return query.all(state)
    }else{
        const query=db.prepare(
            `
            select * from jobs
            order by created_at desc
            limit 10
            `
        )
        return query.all();
    }

}

export function Jobstatus(){
    const db=get_db();
    const query=db.prepare(`
        select state,count(*) as count
        from jobs
        group by state
        
        `)
        return query.all()
}

export function retryDeadJob(jobId) {
    const db = get_db();
    const stmt = db.prepare(`
        update jobs
        set
            state = 'pending',
            attempts = 0,
            error = NULL,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        where id = ? AND state = 'dead'
        returning *
    `);
    const result = stmt.get(jobId);
    if (!result) {
        throw new Error(`Job ${jobId} not found in the DLQ (state='dead').`);
    }
    return result;
}