import Database from "better-sqlite3";
import crypto from "node:crypto"

const db=new Database("queue.db")


export function generate_uuid(){
    return crypto.randomUUID();
}


function create_table(){
    db.exec(`
        create table if not exists jobs(
        id text primary key,
        command text not null,
        state text default 'pending',
        attempts integer default 0,
        max_attempts integer default 3,
        worker_id integer
        created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))),
        updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))),
        completed_at text,
        next_try_in text,

        check (state in('pending','running','completed','failed','dead'))
        );

        create index if not exists pending_jobs
        on jobs(state,created_at)
        where state='pending'

        create index if not exists worker_jobs
        on jobs(worker_id,state)

        create index if not exists retry_jobs
        on jobs(state,next_try_in)
        where state='failed'
        
        `)
        console.log("Table created with indexes....")
}




export function closeDB(){
    db.close();
    db=null;
} 