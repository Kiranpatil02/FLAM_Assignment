import { Command } from 'commander';
import { fork } from 'node:child_process';
import path from 'node:path';
import { Enqueuejob, Listjobs,Jobstatus,retryDeadJob,Setconfig,Getconfig} from '../db/queries.js'
import fs from "node:fs"
import os from "node:os"
import { closeDB } from '../db/schema.js';


const program = new Command();

program
  .name('queuectl')
  .description('FLAM ASSIGNMENT- CLI-based background job queue system')
  .version('1.0.0')


program
  .command('enqueue <jobid> <command>')
  .description('Adds a new job to the queue')
  .option('-r, --retries <number>', 'Maximum number of retries for the job')
  .action((jobid,command, options) => {
    try {
        const queryoptions={}

        if(options.retries){
            queryoptions.max_retries=parseInt(options.retries,10);
        }
      const job = Enqueuejob(jobid,command, queryoptions);
      console.log('✅ Enqueued new job:');
      console.table([job]);
    } catch (err) {
      if(err.code=='SQLITE_CONSTRAINT_PRIMARYKEY'){
        console.log(`A job with ID '${jobid}' already exissts!!.`)
      }
      console.error(' Error enqueuing job:', err.message);
    }
  });


program
  .command('list')
  .description('List jobs in the queue')
  .option('--state <state>', 'Filter jobs by state (pending, processing, failed, etc.)')
  .action((options) => {
    try {
      const jobs = Listjobs(options.state);
      if (jobs.length === 0) {
        console.log('No jobs found with the specified criteria.');
        return;
      }
      console.log('Jobs:');
      console.table(jobs);
    } catch (err) {
      console.error(' Error listing jobs:', err.message);
    }
  });

program
  .command('worker:start')
  .description('Starts one or more worker processes')
  .option('-c, --count <number>', 'Number of worker processes to start', '1')
  .action((options) => {
    const count = parseInt(options.count, 10);
    console.log(` Starting ${count} worker(s)...`);

    
    const workers = [];
    
    
    for (let i = 0; i < count; i++) {
        const worker = fork('src/worker/worker.js');
        workers.push(worker);
    }
    const pids=workers.map(w=>w.pid);
    const pid_folder=path.join(os.homedir(),'.queue');
    if(!fs.existsSync(pid_folder)){
        fs.mkdirSync(pid_folder)
    }
    fs.writeFileSync(path.join(pid_folder,'pids.json'),JSON.stringify(pids))

    console.log(`✅ All ${workers.length} workers are running. Press Ctrl+C to stop.`);

    // Gracefull shutdown
    const shutdown = () => {
      console.log('graceful shutdowning the system...');
      for (const worker of workers) {
        worker.send('shutdown');
      }
      setTimeout(() => {
        console.log('All workers stopped.');
        process.exit(0);
      }, 3000); 
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

program
  .command('status')
  .description('Shows summary of all job states & active workers')
  .action(()=>{
    console.log('QUEUE status:');


    
  const counts=Jobstatus();
  if(counts.length>0){
    console.log('JOB states:');
    console.table(counts)
  }else{
    console.log('No jobs in the queue')
  }

    const pidFile = path.join(os.homedir(), '.queue', 'pids.json');
    if (fs.existsSync(pidFile)) {
        const pids = JSON.parse(fs.readFileSync(pidFile, 'utf-8'));
        console.log(`Active workers now (${pids.length}):`);
        console.log(pids.join(', '));
    } else {
        console.log('No active workers running.');
    }

  })





program
  .command('worker:stop')
  .description('stop running workers graceffully')
  .action(()=>{
    const pidFile=path.join(os.homedir(),'.queue','pids.json');
    if (!fs.existsSync(pidFile)) {
      console.log('No running workers found.');
      return;
    }

    const pids = JSON.parse(fs.readFileSync(pidFile, 'utf-8'));
    console.log(`Stopping ${pids.length} worker(s)...`);

        pids.forEach(pid => {
      try {
        process.kill(pid, 'SIGTERM');
      } catch (e) {
        console.warn(`Could not stop process ${pid}. It may have already exited.`);
      }
    });

    fs.unlinkSync(pidFile)

    console.log("SHutdown signals sent....")

  })

  const dlq=program
                .command('dlq')
                .description('Manage the Dead Letter Queue (DLQ)');

dlq
  .command('list')
  .description('List all jobs in the DLQ')
  .action(() => {
    const deadJobs = Listjobs('dead');
    if (deadJobs.length === 0) {
      console.log('DLQ is empty.');
      return;
    }
    console.log('Jobs in DLQ:');
    console.table(deadJobs);
  });

  dlq
  .command('retry <jobId>')
  .description('Retry a specific job from the DLQ')
  .action((jobId) => {
    try {
      const job = retryDeadJob(jobId);
      console.log(`Job ${jobId}  moved  to 'pending' state:`);
      console.table([job]);
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
  });

  const config=program
                .command('config')
                .description('Manage queue configureation')

    config
        .command('set <key> <value>')
        .description('set a configuation value for max-retries')
        .action((key,value)=>{

            const skeys=['max-retries'];
            if(!skeys.includes(key)){
                console.error(` ERROR: '${key} is not configuration key'`)
                console.log(`supported keys include :${skeys.join(', ')}`)
                return;
            }
            Setconfig(key,value);
            console.log(`Config updated: ${key}=${value}`);


        })
    
        program.hook('postAction',(thiscommand,actioncommand)=>{
            if(thiscommand.name()!=='worker:start'){
                console.log('Flushing DB connection...')
                closeDB();
            }
        })





program.parse(process.argv);
