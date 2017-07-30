import { run_programs, fitProgramTable } from './program'
import _ from "lodash"

let queryQueue;
let lastProcessed;

function processNext(){
    let sheets = queryQueue;
    queryQueue = null;
    
    if(!sheets) return;
    lastProcessed = sheets.map(_.clone);

    let changes = {}

    sheets.forEach((sheet, i) => {
        sheet.result = run_programs(sheet, 
                sheets.map((m, n) => n>=i ? null:[sheets[n].result, m]))

        let result = sheet.result;
        if(!result) return;


        var progs = fitProgramTable(sheet, result, 
          sheets.map((m, n) => n>=i ? null:[sheets[n].result, m]) )

        if(!_.isEqual(progs, sheet.autoprograms)){
            changes[sheet.id] = progs;
        }
    })

    if(Object.keys(changes).length > 0){
        // console.log("CHANGING TIMES", changes)
        postMessage(changes)
    }
}

onmessage = function(e){
    let sheets = e.data.map(k => ({ 
        data: k.data, 
        programs: k.programs, 
        id: k.id,
        autoprograms: k.autoprograms,
        rowCount: k.rowCount,
        colCount: k.colCount
    }));

    if(!_.isEqual(sheets, lastProcessed)){
        // console.log(sheets, e.data)
        queryQueue = sheets;    
    }
}


function runLoop(){
    try {
        processNext()
    } finally {
        setTimeout(runLoop, 100)
    }
}

runLoop()
