import tl = require('azure-pipelines-task-lib/task');
import https from 'https';

const OrganizationUri = tl.getVariable("System.CollectionUri");
    console.log(`Reading OrganizationUri:${OrganizationUri}`);
const Project = tl.getVariable("System.TeamProject");
    console.log(`Reading Project:${Project}`);
const Token = tl.getVariable("System.AccessToken");  
if (Token !== undefined) {
    console.log(`Reading Token:${"*".repeat(Token.length)}`);
}
const DefinitionId = tl.getVariable("System.DefinitionId");
    console.log(`Reading DefinitionId:${DefinitionId}`);
const BuildId = tl.getVariable("Build.BuildId");
    console.log(`Reading BuildId:${BuildId}`);
const Stage =  tl.getVariable("System.StageName");
    console.log(`Reading Stage:${Stage}`);
const BranchFilter = tl.getInput("BranchFilter");
    console.log(`Reading BranchFilter:${BranchFilter}`);


const baseUrl = `${OrganizationUri}/${Project}/_apis`;       
const auth = Buffer.from(`:${Token}`).toString('base64');

const PatchPayload = JSON.stringify({
    state: 1,
    forceRetryAllJobs: true
});

const GetOptions = {
    method: 'GET',
        headers: {
            Authorization: `Basic ${auth}`,
        },
    };

    const PatchOptions = {
    method: 'PATCH',
    headers: {
        Authorization: `Basic ${auth}`,                
        'Content-Type': 'application/json'
    },
};
        

async function run() {
    console.log("Starting rollback")    
    let buildsUrl = `${baseUrl}/build/builds?definitions=${DefinitionId}&api-version=7.0`;
    try {        
        let req = https.request(buildsUrl, GetOptions, (res) => {
            console.log("Retreiving previous builds")
            let data = '';
            res.on('data', (chunk) => { data += chunk; });            
            res.on('end', () => {
                let response = JSON.parse(data);
                console.log(`Retreived ${response.value.length} builds`)
                let LatestSuccessfulBuildId = response.value
                    .filter((run: Record<string, any>) => run.id < Number(BuildId) && run.status === "completed" && run.result === "succeeded" && run.sourceBranch === BranchFilter)
                    .map((run: Record<string, any>) => ({id: run.id}))
                    .sort((a: Record<string, any>, b: Record<string, any>) => b.id - a.id)[0].id;
                console.log(`Rolling back from  ${BuildId}:${Stage} to -> ${LatestSuccessfulBuildId}:${Stage}`)                   
                let redeployUrl =  `${baseUrl}/build/builds/${LatestSuccessfulBuildId}/stages/${Stage}?api-version=7.0` 
                let req = https.request(redeployUrl, PatchOptions, (res) => {
                    let responseData = '';            
                    console.log(res.statusCode)
                    res.on('data', (chunk) => {responseData += chunk;});                
                    res.on('end', () => {
                        console.log("Patch complete");
                        console.log(responseData);
                    });
                });
                console.log(redeployUrl)
                req.write(PatchPayload);
                req.end();
            });
        });
        req.end();
    }
    catch (errorMsg) {
        if (errorMsg instanceof Error) {
            console.log(errorMsg.message);
            console.log(errorMsg.stack);
        }
        tl.setResult(tl.TaskResult.Failed,"Could not rollback!");
    }
}

run();