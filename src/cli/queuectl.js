import { Command } from 'commander';
import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Enqueuejob, Listjobs} from '../db/queries.js'
import { closeDB } from '../db/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('queuectl')
  .description('FLAM ASSIGNMENT- CLI-based background job queue system')
  .version('1.0.0')


program
  .command('enqueue <command>')
  .description('Adds a new job to the queue')
  .option('-r, --retries <number>', 'Maximum number of retries for the job', '3')
  .action((command, options) => {
    try {
      const max_retries = parseInt(options.retries, 10);
      const job = Enqueuejob(command, { max_retries });
      console.log('✅ Enqueued new job:');
      console.table([job]);
    } catch (err) {
      console.error('❌ Error enqueuing job:', err.message);
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
      console.error('❌ Error listing jobs:', err.message);
    }
  });

program
  .command('worker:start')
  .description('Starts one or more worker processes')
  .option('-c, --count <number>', 'Number of worker processes to start', '1')
  .action((options) => {
    const count = parseInt(options.count, 10);
    console.log(`🚀 Starting ${count} worker(s)...`);

    const workers = [];

    for (let i = 0; i < count; i++) {
      const worker = fork(path.resolve(__dirname, 'worker.js'));
      workers.push(worker);
    }

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

program.parse(process.argv);

closeDB()