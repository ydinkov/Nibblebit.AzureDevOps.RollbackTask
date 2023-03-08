import tl = require('azure-pipelines-task-lib/task');
import https from 'https';

async function run() {
    try {
        ///const inputString: string | undefined = tl.getInput('samplestring', true);
        const OrganizationUri = tl.getVariable("System.CollectionUri");
        const Project = tl.getVariable("System.TeamProject");
        const Token = tl.getVariable("System.AccessToken");
        const DefinitionId = tl.getVariable("System.DefinitionId");
        const BuildId = tl.getVariable("Build.BuildId");
        const Stage =  tl.getVariable("System.StageName");
        const BranchFilter = tl.getInput("BranchFilter");        


        const baseUrl = `${OrganizationUri}/${Project}/_apis`;       
        const auth = Buffer.from(`:${Token}`).toString('base64');
  
        const PatchPayload = JSON.stringify({
            state: 1,
            forceRetryAllJobs: true
        });

        let GetOptions = {
            method: 'GET',
            headers: {
              Authorization: `Basic ${auth}`,
            },
          };
        
        let PatchOptions = {
            method: 'PATCH',
            headers: {
                Authorization: `Basic ${auth}`,                
                'Content-Type': 'application/json'
            },
        };
        
        console.log("Init Complete")
        let buildsUrl = `${baseUrl}/build/builds?definitions=${DefinitionId}&api-version=7.0`;
        let req = https.request(buildsUrl, GetOptions, (res) => {
            console.log("Retreiving previous builds")
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                let response = JSON.parse(data);
                console.log(`Retreived ${response.value.length} builds`)

                let LatestSuccessfulBuildId = response.value
                    .filter((run: Record<string, any>) => run.id < Number(BuildId) && run.status === "completed" && run.result === "succeeded" && run.sourceBranch === BranchFilter)
                    .map((run: Record<string, any>) => ({
                        id: run.id,
                    }))
                    .sort((a: Record<string, any>, b: Record<string, any>) => b.id - a.id)[0].id;

                console.log(`Rolling back from  ${BuildId}:${Stage} to -> ${LatestSuccessfulBuildId}:${Stage}`)   
                //Now Execute
                let redeployUrl =  `${baseUrl}/build/builds/${LatestSuccessfulBuildId}/stages/${Stage}?api-version=7.0` 
                let req = https.request(redeployUrl, PatchOptions, (res) => {
                    let responseData = '';            
                    console.log(res.statusCode)
                    res.on('data', (chunk) => {
                        responseData += chunk;
                    });
                
                    res.on('end', () => {
                        //let response = JSON.parse(data);                         
                        console.log("Patch complete")
                        console.log(responseData)
                    });
                });
                console.log(redeployUrl)
                req.write(PatchPayload);
                req.end();
            });
        });
        req.end();
    }
    catch (errorMessage) {
        tl.setResult(tl.TaskResult.Failed,"Could not rollback!");
    }
}

run();