
import Roman from 'roman-numerals'

const COLNAMES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'


export function run_program(env, program, i, j, sheets=null){
    // if(program.trim().toLowerCase() === 'data') return '';

    function lookup(ri, rj){
        if(ri < 0) throw new Error('invalid row index');
        if(rj < 0) throw new Error('invalid column index');
        if(j == rj && ri >= i) throw new Error('can not refer to uncomputed cell');
        if(rj > j) throw new Error('can not refer to uncomputed column ' + rj);
        // console.log(all, rj, ri)
        // return JSON.stringify([ri, rj])
        var val = env[ri + ':' + rj].value;
        if(val === '') throw new Error('no value');

        if(/^\-?\d+$/.test(val)) val = parseFloat(val, 10);
        return val
    }
    var scope = {};

    var prefix = ''
    for(let _j = 0; _j < j+1; _j++){
        scope[COLNAMES[_j]] = function(offset=0){
            return lookup(i+parseInt(offset), _j)
        }

        prefix += 'var ' + COLNAMES[_j] + ' = scope.' + COLNAMES[_j] + ';'
    }

    prefix += ';void(0);'



    function UPPER(x){
        return x.toString().toUpperCase()
    }
    function LOWER(x){
        return x.toString().toLowerCase()
    }
    function CAP(x){
        return capitalizeFirstLetter(x.toString())
    }

    
    function SLICE(x,y,z){
        return x.toString().slice(y,z)
    }
    function LEN(x){
        return x.toString().length
    }
    function LIST(name, index){
        return LISTS[name][index-1]
    }
    function INVLIST(name, key){
        let index = LISTS[name].indexOf(key);
        if(index < 0) throw new Error('not found');
        return index + 1;
    }
    function get_index(list, index){
        if(index < 0){
            return castString(list[list.length + index])
        }else{
            return castString(list[index])
        }
    }
    function WORD(x, index){
        return get_index(x.toString().split(/\s+/), index)
    }
    function TOKEN(x, index){
        var re = /(\w+)/g;
        var s = x.toString();
        var m, parts = []
        do {
            m = re.exec(s);
            if (m) parts.push(m[1]);
        } while (m);
        return get_index(parts, index)
    }
    function REP(times, piece){
        return (new Array(parseInt(times) + 1)).join(piece)
    }
    function UNROMAN(n){
        return Roman.toArabic(n)
    }
    function ROMAN(n){
        return Roman.toRoman(parseInt(n))
    }


    function VLOOKUP(value, sheet_index=0, key_col=0, lookup_col=0){
        if(key_col === lookup_col) throw new Error('lookup col must not be key col');
        if(!sheets[sheet_index]) throw new Error('can not vlookup on same sheet');

        // console.log(value, sheet_index, key_col, lookup_col, sheets)
        for(var i = 0; i < sheets[sheet_index][1].rowCount; i++){
            if(sheets[sheet_index][0][i + ':' + key_col].value + '' === value + ''){
                let found = sheets[sheet_index][0][i + ':' + lookup_col].value
                // console.log('found', found)
                return found
            }
        }
        return 'NULL'
    }

    var ROW = i + 1,
            COL = j + 1;
    
    var DATA = '';
    
    // with(scope){
        return castString(eval(prefix + program))
    // }
    
}

function castString(x){
    if(typeof x === 'number') return x.toString()
    if(typeof x === 'string') return x;
    return ''
}


function program_auto(state, j){
    return state.autoprograms[j] || ''
}

function program_custom(state, j){
    return state.programs[j] || ''
}


function cell_manual(state, i, j){
    return state.data[i + ':' + j] || ''
}
export function run_programs(state, sheets=null){

    var env = {};

    // for each column
    for(var j = 0; j < state.colCount; j++){
        var pc = program_custom(state, j),
                pa = program_auto(state, j);
        var program = pc || pa;

        run_column(program, env, state, j, sheets)

        for(var i = 0; i < state.rowCount; i++){
            let c = env[i + ':' + j];
            c.concrete = c.manual || (pc ? c.auto : '');
        }
    }
    // console.log(env)
    return env
}


function run_column(program, env, state, j, sheets=null){
    // compute all the rows
    for(var i = 0; i < state.rowCount; i++){
        var error = null;
        try {
            var pp = run_program(env, program, i, j, sheets)
        } catch (err) { error = err }

        var manual = cell_manual(state, i, j)
        env[i + ':' + j] = {
            value: (pp && !error) ? pp : manual,
            auto: pp || '',
            manual: manual,
            error: error
        }

        // console.log(i, j, pp, manual)
    }
    return env;
}



export function fitProgramTable(state, result, sheets=null){
    var auto_programs = {}
    for(var j = 0; j < state.colCount; j++){
        var prog = fitProgramColumn(state, result, j, sheets)
        if(prog){
            auto_programs[j] = prog;
        }
    }
    return auto_programs;
}

function fitProgramColumn(state, result, j, sheets = null){
    var working_programs = {}
    // for each row
    for(var i = 0; i < state.rowCount; i++){
        var output = result[i + ':' + j].concrete
        // find something with a concrete result
        if(!output) continue;

        var inputs = []
        // find all possible inputs
        for(let [name, value] of enumerateInputs(state, result, i, j)){
            if(!value) continue;
            // figure out all possible programs that might do stuff with these inputs
            inputs.push([name, value])
        }

        // var programs = []
        for(let program of enumeratePrograms(inputs, output)){
            if(!working_programs[program]){
                working_programs[program] = 1
            }else{
                working_programs[program]++  
            }
        }

        if(sheets){
            for(let program of enumerateJoinPrograms(inputs, output, sheets)){
                if(!working_programs[program]){
                    working_programs[program] = 1
                }else{
                    working_programs[program]++  
                }
            }
        }

        // console.log(name, value, output)
    }


    var programs = Object.keys(working_programs);

    var sorted = _.sortBy(programs, program => 
        - working_programs[program] 
        + program
                .replace(/ROW|COL/g,'1')
                .replace(/\".*?\"/g, '2').length / 100
    );

    console.log(sorted)

    for(let prog of sorted){
        // console.log(prog, j)
        if(checkProgram(state, result, prog, j, sheets)){

            return prog
        }
    }

    
}

function* enumerateJoinPrograms(inputs, output, sheets){
    for(var s = 0; s < sheets.length; s++){
        if(!sheets[s]) continue;

        for(var i = 0; i < sheets[s][1].rowCount; i++){
            for(var j = 0; j < sheets[s][1].colCount; j++){

                if(sheets[s][0][i + ':' + j] && sheets[s][0][i + ':' + j].value == output){
                    // search row for matching inputs

                    for(let [name, input] of inputs){
                        for(var j1 = 0; j1 < sheets[s][1].colCount; j1++){
                            if(j1 === j) continue;

                            if(sheets[s][0][i + ':' + j1] && sheets[s][0][i + ':' + j1].value == input){
                                yield 'VLOOKUP(' + name + ',' + s + ',' + j1 + ',' + j + ')'
                            }
                        }
                    }
                }
            }
        }
    }
}



function* enumerateUnaryPrograms(input, output){
    yield JSON.stringify(output);
    yield* enumerateSlice(input, output)
    yield* enumerateTransform(input, output)
    yield* enumerateNumberTransform(input, output)
    yield* enumerateAddConstant(input, output)
    yield* enumerateSubtractConstant(input, output)
    yield* enumerateMultiplyConstant(input, output)
    yield* enumerateKnownLists(input, output)
    yield* enumerateKnownInvLists(input, output)
    yield* enumerateWord(input, output)
    yield* enumerateToken(input, output)
    yield* enumerateStringMultiply(input, output)
    yield* enumerateRomanConvert(input, output)

}

function* enumerateRomanConvert(input, output){
    try {

        if(isFinite(parseInt(input)) && /^[xivldcm]+$/i.test(output)){
            for(let p of enumerateTransform(Roman.toRoman(parseInt(input)), output)){
                yield p.replace(/\$/g, 'ROMAN($)')
            }
        }else if(isFinite(parseInt(output)) && /^[xivldcm]+$/i.test(input)){
            if(parseInt(output) === Roman.toArabic(input)){
                yield 'UNROMAN($)'
            }
        }

    } catch (err) {}
}

function* enumerateUnaryProgramsByInputs(inputs, output){
    for(let [name, input] of inputs){
        // enumerate all the single argument programs
        for(let program of enumerateUnaryPrograms(input, output)){
            yield program.replace(/\$/g, name);
        }
    }

    yield* factorizeString(inputs, output)
}


function* factorizeString(inputs, output){
    for(let program of recursiveStringFactorization2(inputs, output)){

        var fixed = program
            .filter(k => !(typeof k == 'string' && k.length == 0))
            .reduce((acc, k) => {
                if(typeof acc[acc.length - 1] == 'string' && typeof k == 'string'){
                    acc[acc.length - 1] += k
                    return acc
                }else{
                    return acc.concat([k])
                }
            }, [])
        var program = fixed.map(k => 
            (typeof k === 'object') ? 
                k.name : 
                JSON.stringify(k)).join('+')
        // console.log(program)
        yield program
    }
}

function* enumerateTailSlice(input, output){
    for(var j = 1; j < input.length; j++){
        for(let p of enumerateTransform(input.slice(0, j), output)){
            yield p.replace(/\$/g, 'SLICE($,0,' + j + ')'  )
        }
    }
}

function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
}

function* enumerateTransform(input, output){
    if(!input) return;
    if(!output) return;

    if(input === output){
        yield '$'
    }
    if(input.toString().toUpperCase() === output){
        yield 'UPPER($)'
    }
    if(input.toString().toLowerCase() === output){
        yield 'LOWER($)'
    }

    if(capitalizeFirstLetter(input.toString()) === output){
        yield 'CAP($)'
    }


}

function* augmentInputs(inputs){
    for(let [name, input] of inputs){
        yield [name, input]
        yield ['UPPER(' + name + ')', input.toString().toUpperCase()]
        yield ['LOWER(' + name + ')', input.toString().toLowerCase()]    

        for(let i = 0; i < input.length; i++){
            yield ['SLICE(' + name + ',0,' + i + ')', input.toString().slice(0, i)]
        }


    }
}

function* recursiveStringFactorization2(inputs, output){
    yield [output];
    if(output.length == 0) return;
    for(let [name, input] of augmentInputs(inputs)){
        input = input.toString()
        if(input.length == 0) continue;

        if(name.indexOf('(-1)') > 0 || name.indexOf('(-2)') > 0) continue;
        
        let pos = output.indexOf(input);
        if(pos != -1){
            for(let prog of recursiveStringFactorization2(inputs, output.slice(pos + input.length))){
                yield [output.slice(0, pos), {input, name}].concat(prog);
                yield [output.slice(0, pos + input.length)].concat(prog)
            }
        }
    }
}




function* recursiveStringFactorization(inputs, output){
    yield [output];
    if(output.length == 0) return;
    for(let [name, input] of inputs){
        input = input.toString()
        if(input.length == 0) continue;

        
        let pos = output.indexOf(input);
        if(pos != -1){
            for(let prog of recursiveStringFactorization(inputs, output.slice(pos + input.length))){
                yield [output.slice(0, pos), {input, name}].concat(prog);
                yield [output.slice(0, pos + input.length)].concat(prog)
            }
        }
    }
}


function* enumeratePrograms(inputs, output){
    yield* enumerateUnaryProgramsByInputs(inputs, output)
    yield* enumerateAddSubtractTerms(inputs, output)
    // console.log(inputs)
    // yield* recursiveEnumeratePrograms(inputs, output)
}


function* enumerateAddSubtractTerms(inputs, output){
    for(let i = 0; i < inputs.length; i++){
        for(let j = 0; j < i; j++){
            if(parseFloat(inputs[i][1]) + parseFloat(inputs[j][1]) == parseFloat(output)){
                yield inputs[i][0] + '+' + inputs[j][0]
            }
            if(parseFloat(inputs[i][1]) - parseFloat(inputs[j][1]) == parseFloat(output)){
                yield inputs[i][0] + '-' + inputs[j][0]
            }
            if(parseFloat(inputs[j][1]) - parseFloat(inputs[i][1]) == parseFloat(output)){
                yield inputs[j][0] + '-' + inputs[i][0]
            }
        }
    }
}

function* tokenIndices(str){
    var re = /\w+/g, match;
    while ((match = re.exec(str)) != null) {
        yield match.index;
    }
}

function* recursiveEnumeratePrograms(inputs, output){
    // for(var i = 3; i < output.length - 3; i++){
    for(let i of tokenIndices(output)){
        if(i == 0) continue;

        var lhs = _.uniq(Array.from(enumerateUnaryProgramsByInputs(inputs, output.slice(0, i))))
        var rhs = _.uniq(Array.from(enumeratePrograms(inputs, output.slice(i))))

        console.log('lhs/rhs', JSON.stringify(output.slice(0, i)), JSON.stringify(output.slice(i)), lhs, rhs)
        
        for(let y of rhs){
            for(let program of lhs){
                yield program + '+' + y;
            }
        }
    }
}




function* enumerateStringMultiply(input, output){
    var num = parseInt(input)
    if(!isFinite(num)) return;
    if(output.length % num != 0) return;
    var piece = output.slice(0, output.length / num)

    if(output == (new Array(num + 1)).join(piece)){
        yield 'REP($,' + JSON.stringify(piece) + ')'
    }
}


function* enumerateToken(input, output){
    var re = /(\w+)/g;
    var s = input.toString();
    var m;
    let parts = []
    do {
        m = re.exec(s);
        if (m) {
            parts.push(m[1]);
        }
    } while (m);


    for(var i = 0; i < parts.length; i++){
        // console.log(parts[i], output)
        for(let p of enumerateTransform(parts[i], output)){
            yield p.replace(/\$/g, 'TOKEN($,' + i + ')')
            yield p.replace(/\$/g, 'TOKEN($,' + (-(parts.length - i)) + ')')
        }
    }
}


function* enumerateWord(input, output){
    var parts = input.toString().split(/\s+/);
    if(parts.length < 2) return;

    for(var i = 0; i < parts.length; i++){
        // console.log(parts[i], output)
        for(let p of enumerateTransform(parts[i], output)){
            yield p.replace(/\$/g, 'WORD($,' + i + ')')
            yield p.replace(/\$/g, 'WORD($,' + (-(parts.length - i)) + ')')
        }
    }
}




var LISTS = {
    alpha: 'abcdefghijklmnopqrstuvwxyz',
    ALPHA: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    month3: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    day3: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    nums: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'ninteen', 'twenty']
    // roman: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'],
}

function* enumerateKnownLists(input, output){
    if(!/^\d+$/.test(input)) return;
    var index = parseInt(input)-1
    if(!isFinite(index)) return;

    for(let name in LISTS){
        let list = LISTS[name]
        for(let p of enumerateTransform(list[index], output)){
            yield p.replace(/\$/g, 'LIST(' + JSON.stringify(name) + ',$)'  )
        }
    }
}


function* enumerateKnownInvLists(input, output){
    if(!/^\d+$/.test(output)) return;
    var index = parseInt(output)-1
    if(!isFinite(index)) return;

    for(let name in LISTS){
        let list = LISTS[name]
        for(let p of enumerateTailSlice(input, list[index])){
            // yield p.replace(/\$/g, 'LIST(' + JSON.stringify(name) + ',$)'  )
            yield 'INVLIST(' + JSON.stringify(name) +',' + p + ')'
        }
        // for(let p of enumerateTransform(list[index], output)){
        //     yield p.replace(/\$/g, 'LIST(' + JSON.stringify(name) + ',$)'  )
        // }
    }
}

function* enumerateNumberTransform(input, output){
    if(input.toString().length.toString() === output){
        yield 'LEN($)'
    }
}


function* enumerateAddConstant(input, output){
    if(!isFinite(parseFloat(input))) return;
    if(!isFinite(parseFloat(output))) return;
    if(parseFloat(input) === parseFloat(output)){
        yield '$'
    }else{
        let quantity = (parseFloat(output)-parseFloat(input));
        if(quantity < 0){
            yield '$-' + (-quantity)
        }else{
            yield '$+' + quantity  
        }
    }
    
}


function* enumerateSubtractConstant(input, output){
    if(!isFinite(parseFloat(input))) return;
    if(!isFinite(parseFloat(output))) return;
    if(parseFloat(input) === parseFloat(output)) return;
    yield (parseFloat(input)+parseFloat(output)) + '-$' 
}

    

function* enumerateMultiplyConstant(input, output){
    if(!isFinite(parseFloat(input))) return;
    if(!isFinite(parseFloat(output))) return;
    if(input === output) return;
    yield '$*' + (parseFloat(output)/parseFloat(input))
}
    


function* enumerateInputs(state, result, i, j){
    // positional inputs
    yield ['ROW', i+1]
    yield ['COL', j+1]

    // inductive inputs
    if(result[(i - 1) + ':' + j]){
        yield [COLNAMES[j] + '(-1)', result[(i - 1) + ':' + j].concrete]  
    }
    
    if(result[(i - 2) + ':' + j]){
      yield [COLNAMES[j] + '(-2)', result[(i - 2) + ':' + j].concrete]
    }

    // previous columnar inputs
    for(var k = 0; k < j; k++){
        yield [COLNAMES[k] + '()', result[i + ':' + k].value]

        if(result[(i-1) + ':' + k]){
            yield [COLNAMES[k] + '(-1)', result[(i-1) + ':' + k].value]  
        }
        
        if(result[(i+1) + ':' + k]){
            yield [COLNAMES[k] + '(+1)', result[(i+1) + ':' + k].value]  
        }
    }
}




function checkProgram(state, result, program, j, sheets=null){
    var env = Object.assign({}, result);
    run_column(program, env, state, j, sheets)
    var correct = 0,
            examples = 0;
    for(var i = 0; i < state.rowCount; i++){
        var ref = result[i + ':' + j].concrete
        if(!ref) continue;

        var value = env[i + ':' + j].value;
        examples++
        if(value === ref){
            correct++
        }
    }

    // console.log(correct, "/", examples)
    return correct === examples && examples > 1
}


// function* enumerateIOPrograms(input, output){
//   yield* enumerateSlice(input, output)
//   yield* enumerateTransform(input, output)
// }

function* enumerateSlice(input, output){
    for(var i = 0; i < input.length; i++){
        for(var j = i + 1; j < input.length; j++){
            for(let p of enumerateTransform(input.slice(i, j), output)){
                yield p.replace(/\$/g, 'SLICE($,' + i + ',' + j + ')'  )
            }
            // if(input.slice(i, j) == output){
            //   yield '$.slice(' + i + ',' + j + ')'  
            // }
        }
    }
}

function* enumerateTailSlice(input, output){
    for(var j = 1; j < input.length; j++){
        for(let p of enumerateTransform(input.slice(0, j), output)){
            yield p.replace(/\$/g, 'SLICE($,0,' + j + ')'  )
        }
    }
}

function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
}

function* enumerateTransform(input, output){
    if(!input) return;
    if(!output) return;

    if(input === output){
        yield '$'
    }
    if(input.toString().toUpperCase() === output){
        yield 'UPPER($)'
    }
    if(input.toString().toLowerCase() === output){
        yield 'LOWER($)'
    }

    if(capitalizeFirstLetter(input.toString()) === output){
        yield 'CAP($)'
    }


}

