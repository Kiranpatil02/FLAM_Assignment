import { Jobcomplete,Failjob,Claimjob } from '../db/queries.js';
import { exec } from 'node:child_process'; 

function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {

                error.stdout = stdout;
                error.stderr = stderr;
                reject(error);
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}

async function runWorker() {
    const workerId = `worker-${process.pid}`; 
    console.log(`[${workerId}] Started.`);

    let isShuttingDown = false;
    process.on('message', (msg) => {
        if (msg === 'shutdown') {
            console.log(`[${workerId}] Received shutdown signal. Will exit after current job.`);
            isShuttingDown = true;
        }
    });

    while (!isShuttingDown) {
        const job = Claimjob(workerId);

        if (job) {
            console.log(`[${workerId}] Claimed job ${job.id}: ${job.command}`);
            try {
                const { stdout } = await executeCommand(job.command);
                console.log(`[${workerId}] Job ${job.id} succeeded.`);
                Jobcomplete(job.id);
            } catch (error) {
                console.error(`[${workerId}] Job ${job.id} failed. Error: ${error.stderr}`);
                Failjob(job.id, error.stderr || error.message);
            }
        } else {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    console.log(`[${workerId}] Shutting down.`);
    process.exit(0);
}

runWorker();