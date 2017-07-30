import React, { Component } from 'react';

import './App.css';
import _ from 'lodash';


class AquaCell extends React.Component {
    componentDidMount(){
        this.componentDidUpdate()
    }
    componentDidUpdate(){
        var { i, j, data } = this.props;
        if(i === data.focus[0] && j === data.focus[1]){
            this.textInput.focus()
            this.props.update({ focus: [-1, -1] })
        }
    }
    render(){
        var props = this.props;

        var cell = [props.data, props.i, props.j]
        var manual = cell_manual(...cell);
        var auto = props.result ? props.result[props.i + ':' + props.j].value : ''

        var mismatched = false;
        if(manual && auto){
            mismatched = manual != auto;
        }

        return <td className={ (mismatched ? 'mismatched ' : '') }>
            <input 
                type="text" 
                onKeyDown={e => {
                    if(e.keyCode == 13){
                        // props.update(setFocus(props.data, props.i+(e.shiftKey ? -1 : 1), 0))
                        if(e.metaKey){
                            props.update(setFocus(props.data, props.i+(e.shiftKey ? -1 : 1), 0))
                        }else{
                            props.update(setFocus(props.data, props.i+(e.shiftKey ? -1 : 1), props.j))    
                        }
                    }else if(e.keyCode == 40){ // down
                        props.update(setFocus(props.data, props.i+1, props.j))
                    }else if(e.keyCode == 38){ // up
                        props.update(setFocus(props.data, props.i-1, props.j))
                    }else if(e.keyCode == 39){ // right
                        if(e.target.selectionEnd == e.target.selectionStart && e.target.selectionEnd == e.target.value.length){
                            props.update(setFocus(props.data, props.i, props.j + 1))  
                        }
                    }else if(e.keyCode == 37){ // left
                        if(e.target.selectionEnd == e.target.selectionStart && e.target.selectionEnd == 0){
                            props.update(setFocus(props.data, props.i, props.j - 1))  
                        }
                    }
                }}
                ref={(input) => { this.textInput = input; }}
                onFocus={e => 
                    props.update(setFocus(props.data, props.i, props.j))
                }
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
    if(!result) return false;
    for(var i = 0; i < data.rowCount; i++){
        if(!result[i + ':' + j].error){
            return false
        }
    }
    return true
}

function AquaHeaderCell(props){
    var j = props.j;
    const COLNAMES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

    return <th className={(col_error(props.data, props.result, j) ? 'error ':'')}>
        <div className={"colheader "}>
            <div className="colname" onClick={e => 
                props.update(set_program(props.data, j, program_auto(props.data, j) || 'DATA'))
            }>{COLNAMES[j]}</div>
            <input 
                type="text" 
                onFocus={e => props.update({ focus: [-1, j] })}
                onChange={e => props.update(set_program(props.data, j, e.target.value))}
                value={program_custom(props.data, j)} 
                placeholder={program_auto(props.data, j)} />
        </div>
    </th>
}

function clone_state(state){
    return {
        data: Object.assign({}, state.data),
        programs: Object.assign({}, state.programs),
    }
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

function set_cell(state, i, j, value){
    var new_state = clone_state(state)
    new_state.data[i + ':' + j] = value;
    return new_state
}

function set_program(state, j, value){
    var new_state = clone_state(state)
    new_state.programs[j] = value;
    return new_state
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



function updateIndex(arr, index, replacement){
    return arr.map((k, i) => i === index ? 
        Object.assign({}, k, replacement) : 
        Object.assign({}, k, { focus: [-1, -1]}))
}

// export default App;

import BreadLoaf from 'breadloaf'
import './layout.css'



class Slice extends React.Component {
    render(){
        var i = 0;
        var sheet = this.props.view;
        var sheets = this.props.sheets;
        return <div className="slice">
            <div className="slice-header" onMouseDown={this.props.beginDrag}>
                <div style={{flexGrow: 1, fontSize: '18px'}}>
                    Sheet {sheet.index} / 
                    <input className="title-field" type="text" 
                        onChange={e => this.props.updateView({ name: e.target.value })}
                        value={sheet.name || ''} placeholder="Untitled Sheet" />
                </div>
                <button onClick={this.props.close}>&times;</button>
            </div>
            
            <AquaTable data={sheet} result={sheet.result} update={data => this.props.updateView(data) } />
        </div>
    }
}


import { run_programs } from './program'


let SynthesisEngine = require('worker-loader!./worker.js')

let synth = new SynthesisEngine()
synth.onmessage = function(e){
    global.updateAutoprograms(e.data)
}


export default class Demo extends React.Component {
    state = {
        // layout: require('./directors.json')
        layout: []
    }

    componentWillUpdate(){
        let sheets = []
        for(let { items } of this.state.layout){
            for(let sheet of items){
                sheets.push(sheet)
                delete sheet.index
                delete sheet.result
            }
        }
        synth.postMessage(sheets)
    }

    componentDidMount(){
        global.updateAutoprograms = updates => {
            for(let { items } of this.state.layout){
                for(let sheet of items){
                    if(sheet.id in updates){
                        sheet.autoprograms = updates[sheet.id]
                    }
                }
            }
            this.setState({})
        }
    }

    render() {

        let sheets = []
        for(let { items } of this.state.layout){
            for(let sheet of items){
                sheets.push(sheet)
                sheet.index = sheets.length;
            }
        }

        sheets.forEach((sheet, i) => 
            sheet.result = run_programs(sheet, 
                sheets.map((m, n) => n>=i ? null:[sheets[n].result, m])))

        return <div>
            <BreadLoaf 
                ref={e => this.loaf = e} 
                layout={this.state.layout}
                makeSlice={e => _.cloneDeep(EMPTY_SHEET)}
                updateLayout={e => this.setState({ layout: e })}
                element={ <Slice sheets={sheets} /> }  />

        </div>     
    }
}

