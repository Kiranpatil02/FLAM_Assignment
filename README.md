<div align="center" style="text-align: center;">

<h1>QueueCTL</h1>

<h3>CLI-based background job Queue system</h3>

<p>
This system should manage background jobs with worker processes, handle retries using exponential backoff, and maintain a Dead Letter Queue (DLQ) for permanently failed jobs.
</p>

# [Click here for video](https://drive.google.com/file/d/1xe2PhCUpEB1brqZbNMLWVNlJkwWLb4mQ/view?usp=sharing)

</div>

## Features
1. Persistence: Used in SQL lite  DB and which is lightweigh embedded realational database.
2. ErrorMessage: Failed Jobs shows clearly what went wrong during execution.
3. Dead Letter Queue (DLQ): Jobs that reach their maximum retry attempts are moved to a DLQ.
4. Concurrent Workers: Run multiple worker processes with prevention of Race condition.


## Getting started

```bash
git clone https://github.com/Kiranpatil02/FLAM_Assignment.git
```
```bash
npm install
```
Get all commands description
```
node src/cliqueuectl.js -h
```

```bash
node src/cliqueuectl.js <command> [options]
```

## Examples
<h3> Enqueueing Jobs</h3>
- This adds a new job to the queue which where the workers would pick the tasks.

Add a job with default retries(3)
```bash
node src/cli/queuectl.js job1 enqueue "echo 'Hello world'"
```
Set cutom retries for specific jobs 
```bash
node src/cli/queuectl.js job2 enqueue "sleep 2" --retries 5
```
<p align="center">
    <img src="assests\example1.png">
    <br/>
    <img src="assests\example2.png" >
</p>

<h3> Managing Workers</h3>
TLDR; -> Picks pending JOB, executes it,retries for maximum attempts, else moves to DLQ.

- Workers pick jobs which are pending and execute them, through __fork__ function which creates child process and establishes IPC connection with Parent process.

Start a single worker process in the foreground
```
node src/cli/queuectl.js worker:start
```
Start 3 concurrent worker processes
```
node src/cli/queuectl.js worker:start
```


Stop all running workers gracefully,
through established IPC connection between Parent and child

```
node src/cli/queuectl.js worker:stop
```
<p align="center">
    <img src="assests\example3.png">
    <br/>
    <img src="assests\example4.png" >
</p>


<h3> Checking Status and Listing jobs</h3>

```
node src/cli/queuectl.js status
```

List all jobs in the queue

```
node src/cli/queuectl.js list
```
List only jobs that are in 'failed' state

```
node src/cli/queuectl.js list --state failed
```
List all jobs that are in 'dead' state, 
permanently failed.


<p align="center">
    <img src="assests\example5.png">
    <br/>
    <img src="assests\example6.png" >
</p>


<h3>Dead Letter Queue(DLQ) </h3>

```
node src/cli/queuectl.js dlq list
```

Retry a job from the DLQ by its ID
```
node src/cli/queuectl.js dlq retry <job-id>
```

<h3> Configuration</h3>

 Sets whole system  with maximum retries to 5
```
node src/cli/queuectl.js config set max-retries 5
```
<p align="center">
    <img src="assests\example7.png">
    <br/>
    <img src="assests\example6.png" >
    <br/>
    <img src="assests\example8.png">
</p>

> 
> The tables can be made Readable by using cli-table3 dependency.
> 


## Architecture Diagram (Brief overview)

<img src="assests\arch2.png">


## Job Lifecycle

1. pending: Initial state of a job is enqueued,waiting to be picked.
2. processing: A child worker has claimed the job executing its command.
3. completed:  job's command was executed successfully (exit code 0)(No errors).
4. failed: job's command failed, but it  retries remaining with deafult tries or custom tries. It will be picked up again after its next_retry_at timestamp.
5. dead: The job has failed and reached maximum number of retry attempts. It is now in the Dead Letter Queue (DLQ).

## References (Things I studied before I dived in.)

1. ### [Node Js Child Process working](https://nodejs.org/api/child_process.html)

- Explains everything related to spawning multiple worker, either through shell execution, file execution and establishing a communication channel between child process and Parent process what is known as IPC channel.
- Also studied about SIGTERM, SIGINT mainly, others breifly, how they interpet signals to stop child process.
- Exit calls for gracefull shutdown and immediate shutdown when errors

2. ###  [Commander JS (Parsing Command line arguments)](https://www.npmjs.com/package/commander#life-cycle-hooks)

- A npm package, which helps to write Command line  interfaces.
- All functions, like creating a commands, description, versions, hooks(important) is made by help of this package.

3. ###  [Better-sqllite3](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- A quick lightweight relational database management, used in thsi project  for queueing Jobs, managing Locks, dead lock prevention, indexing etc..
- This helps the Queue Jobs stay alive after restarts.

4. ###  [Dead Letter Queue](https://en.wikipedia.org/wiki/Dead_letter_queue)
- Everything about Dead Letter queue and its working, applications.

5. ###  [Exponention backoff](https://en.wikipedia.org/wiki/Exponential_backoff)
-   [Article for exponential backoff](https://medium.com/bobble-engineering/how-does-exponential-backoff-work-90ef02401c65)
- Working of Exponential backoff and how its used.

6. ###  [Brief video about Child process like spawn(), exec(), execfile(), fork() ](https://www.youtube.com/watch?v=C1v4MXGhpcM&pp=ygUVbm9kZSBqcyBjaGlsZCBwcm9jZXNz)






