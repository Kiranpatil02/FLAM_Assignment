import {get_db,generate_uuid} from "./schema.js"


export function Enqueuejob(command,options={}){
    const db=get_db()

    const default_tries_config=Getconfig('max-retries');
    
    // console.log(`Value from Getconfig('max-retries'):`, default_tries_config); 

    const sysdeafult=default_tries_config || '3';

    const max_tries=options.max_retries?? parseInt(sysdeafult,10)
    // console.log(`[DEBUG] Final max_retries to be inserted:`, max_tries);


    const add_job=db.prepare(`
        insert into jobs(id,command,max_retries)
        values (?,?,?)
        returning *
        `)
    return add_job.get(generate_uuid(),command,max_tries)
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

export function Setconfig(key,value){
     console.log(`[DEBUG] Setconfig called. Key: ${key}, Value: ${value}`);
    const db=get_db();

    const query=db.prepare(`
        insert into config (key,value)
        values(?,?)
        on conflict(key) do update set value=excluded.value
        
        `);
        query.run(key,value)
}


export function Getconfig(key){
    const db=get_db();

    const query=db.prepare(`
        select value from config where key= ?
        
        `)
        const result=query.get(key);
        if(result) return result.value;

        return undefined
}