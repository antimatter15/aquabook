import React, { Component } from 'react';
import './App.css';
import _ from 'lodash';

import Roman from 'roman-numerals'

const COLNAMES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
function clone_state(state){
  return {
    data: Object.assign({}, state.data),
    programs: Object.assign({}, state.programs),
  }
}


function program_auto(state, j){
  // return '' //j + '?'
  return state.autoprograms[j] || ''
}

function program_custom(state, j){
  return state.programs[j] || ''
}

function cell_manual(state, i, j){
  return state.data[i + ':' + j] || ''
}

function set_cell(state, i, j, value){
  var new_state = clone_state(state)
  new_state.data[i + ':' + j] = value;
  return new_state
}


function run_program(env, program, i, j){
  function lookup(ri, rj){
    if(ri < 0) throw new Error('invalid row index');
    if(rj < 0) throw new Error('invalid column index');
    if(j == rj && ri >= i) throw new Error('can not refer to uncomputed cell');
    if(rj > j) throw new Error('can not refer to uncomputed column ' + rj);
    // console.log(all, rj, ri)
    // return JSON.stringify([ri, rj])
    var val = env[ri + ':' + rj].value;
    if(/^\d+$/.test(val)) val = parseFloat(val, 10);
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
  function REP(times, piece){
    return (new Array(parseInt(times) + 1)).join(piece)
  }
  function UNROMAN(n){
    return Roman.toArabic(n)
  }
  function ROMAN(n){
    return Roman.toRoman(parseInt(n))
  }
  var ROW = i + 1,
      COL = j + 1;
  
  // with(scope){
    return castString(eval(prefix + program))
  // }
  
}

function castString(x){
  if(typeof x === 'number') return x.toString()
  if(typeof x === 'string') return x;
  return ''
}


function run_programs(state){

  var env = {};

  // for each column
  for(var j = 0; j < state.colCount; j++){
    var pc = program_custom(state, j),
        pa = program_auto(state, j);
    var program = pc || pa;

    run_column(program, env, state, j)

    for(var i = 0; i < state.rowCount; i++){
      let c = env[i + ':' + j];
      c.concrete = c.manual || (pc ? c.auto : '');
    }
  }
  // console.log(env)
  return env
}


function run_column(program, env, state, j){
  // compute all the rows
  for(var i = 0; i < state.rowCount; i++){
    var error = null;
    try {
      var pp = run_program(env, program, i, j)
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


function set_program(state, j, value){
  var new_state = clone_state(state)
  new_state.programs[j] = value;
  return new_state
}


class AquaCell extends React.Component {
  componentDidMount(){
    var { i, j, data } = this.props;
    if(i === data.focus[0] && j === data.focus[1]){
      this.textInput.focus()
    }
  }
  componentDidUpdate(){
    var { i, j, data } = this.props;
    if(i === data.focus[0] && j === data.focus[1]){
      this.textInput.focus()
    }
  }
  render(){
    var props = this.props;

    var cell = [props.data, props.i, props.j]
    var manual = cell_manual(...cell);
    var auto = props.result[props.i + ':' + props.j].value

    var mismatched = false;
    if(manual && auto){
      mismatched = manual != auto;
    }

    return <td className={ (mismatched ? 'mismatched ' : '') }>
      <input 
        type="text" 
        onKeyDown={e => {
          if(e.keyCode == 13){
            props.update(setFocus(props.data, props.i+(e.shiftKey ? -1 : 1), props.j))
          }
        }}
        ref={(input) => { this.textInput = input; }}
        onFocus={e => props.update(setFocus(props.data, props.i, props.j))}
        onChange={e => props.update(set_cell(...cell, e.target.value))}
        value={manual} 
        placeholder={auto} />
    </td>

  }
}

function setFocus(state, i, j){
  return { 
    focus: [i, j],
    
    rowCount: Math.max(
      7, i + 1, 
      (2 + _.max(
        Object.keys(state.data)
        .filter(k => state.data[k])
        .map(k => parseInt(k.split(':')[0])))) || 0
    ),

    colCount: Math.max(
      4, j + 1, 
      (2 + _.max(
        Object.keys(state.data)
        .filter(k => state.data[k])
        .map(k => parseInt(k.split(':')[1])))) || 0
    )
  }
}

function AquaRow(props){
  var cols = [];
    for(var j = 0; j < props.data.colCount; j++){
      cols.push(<AquaCell 
          key={j} 
          i={props.i} 
          j={j} 
          result={props.result} 
          data={props.data} 
          update={props.update} />)
    }
    return <tr>{cols}</tr>
}


function col_error(data, result, j){
  for(var i = 0; i < data.rowCount; i++){
    if(!result[i + ':' + j].error){
      return false
    }
  }
  return true
}

function AquaHeaderCell(props){
  var j = props.j;
  
  return <th className={(col_error(props.data, props.result, j) ? 'error ':'')}>
    <div className={"colheader "}>
      <div className="colname">{COLNAMES[j]}</div>
      <input 
        type="text" 
        onFocus={e => props.update({ focus: [-1, j] })}
        onChange={e => props.update(set_program(props.data, j, e.target.value))}
        value={program_custom(props.data, j)} 
        placeholder={program_auto(props.data, j)} />
    </div>
  </th>
}

function AquaHeader(props){
  var cols = [];
  for(var j = 0; j < props.data.colCount; j++){
      cols.push(<AquaHeaderCell 
        j={j} 
        key={j} 
        data={props.data} 
        result={props.result} 
        update={props.update} />)
  }
  return <tr className="header">{cols}</tr>
}

function AquaTable(props){

  var rows = []
  for(var i = 0; i < props.data.rowCount; i++){
    rows.push(<AquaRow 
      key={i} 
      i={i} 
      result={props.result}
      data={props.data} 
      update={props.update} />)
  }
  return <table className="table">
    <tbody>
      <AquaHeader result={props.result} data={props.data} update={props.update} />
      {rows}
    </tbody>
  </table>
}


function fitPrograms2(state, result){
  var auto_programs = {}
  for(var j = 0; j < state.colCount; j++){
    var prog = fitProgram(state, result, j)
    if(prog){
      auto_programs[j] = prog;
    }
  }
  return auto_programs;
}

function fitProgram(state, result, j){
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
    // console.log(name, value, output)
  }


  var programs = Object.keys(working_programs);

  var sorted = _.sortBy(programs, program => 
    - working_programs[program] 
    + program
        .replace(/ROW|COL/g,'1')
        .replace(/\".*?\"/g, '2').length / 100
  );

  // console.log(sorted)

  for(let prog of sorted){
    // console.log(prog, j)
    if(checkProgram(state, result, prog, j)){

      return prog
    }
  }

  
}



function* enumerateUnaryPrograms(input, output){
    yield JSON.stringify(output);
    yield* enumerateSlice(input, output)
    yield* enumerateTransform(input, output)
    yield* enumerateNumberTransform(input, output)
    yield* enumerateAddConstant(input, output)
    yield* enumerateMultiplyConstant(input, output)
    yield* enumerateKnownLists(input, output)
    yield* enumerateWord(input, output)
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
}

function* enumeratePrograms(inputs, output){
  yield* enumerateUnaryProgramsByInputs(inputs, output)
  // yield* recursiveEnumeratePrograms(inputs, output)
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

    // console.log('lhs/rhs', JSON.stringify(output.slice(0, i)), JSON.stringify(output.slice(i)), lhs, rhs)
    
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
  var index = parseInt(input)-1
  if(!isFinite(index)) return;

  for(let name in LISTS){
    let list = LISTS[name]
    for(let p of enumerateTransform(list[index], output)){
      yield p.replace(/\$/g, 'LIST(' + JSON.stringify(name) + ',$)'  )
    }
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
    yield '$ + ' + (parseFloat(output)-parseFloat(input))  
  }
  
}
  

function* enumerateMultiplyConstant(input, output){
  if(!isFinite(parseFloat(input))) return;
  if(!isFinite(parseFloat(output))) return;
  if(input === output) return;
  yield '$ * ' + (parseFloat(output)/parseFloat(input))
}
  


function* enumerateInputs(state, result, i, j){
  // positional inputs
  yield ['ROW', i+1]
  yield ['COL', j+1]

  // inductive inputs
  if(result[(i - 1) + ':' + j]){
    yield [COLNAMES[j] + '(-1)', result[(i - 1) + ':' + j].concrete]  
  }
  
  // if(result[(i - 2) + ':' + j]){
  //   yield [COLNAMES[j] + '(-2)', result[(i - 2) + ':' + j].concrete]
  // }

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




function checkProgram(state, result, program, j){
  var env = Object.assign({}, result);
  run_column(program, env, state, j)
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

const EMPTY_SHEET = {
  data: {
    // '0:0': 'yolo'
  },
  programs: {
    
    // '1': 'A'
  },
  autoprograms: {
    // '0': 'A[-1]',
  },
  focus: [-1, -1],
  rowCount: 7,
  colCount: 4
}

class App extends Component {
  constructor(){
    super()

    this.state = {
      sheets: [clone(EMPTY_SHEET)]
    }
  }
  render() {
    
    // setTimeout(() => {
    //   var progs = fitPrograms2(this.state, result)
    //   if(!_.isEqual(progs, this.state.autoprograms)){
    //     this.setState({ autoprograms: progs })
    //   }
    // }, 10)

    return (
      <div className="App">
        <h1>Aquabook</h1>
        {
          this.state.sheets.map((sheet, i) => 
            <AquaTable key={i} 
                       result={run_programs(sheet)} 
                       data={sheet} 
                       update={data => this.setState({ sheets: 
                        updateIndex(this.state.sheets, i, data)})} />
          )
        }
        
        <button onClick={e => 
          this.setState({ 
            sheets: 
            this.state.sheets.concat([clone(EMPTY_SHEET)]) 
          })
        }>+</button>
      </div>
    );
  }
}

function updateIndex(arr, index, replacement){
  return arr.map((k, i) => i === index ? Object.assign({}, k, replacement) : k)
}

function clone(x){
  return JSON.parse(JSON.stringify(x))
}

export default App;
