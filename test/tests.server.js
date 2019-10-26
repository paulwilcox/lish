/**
 * ISC License (ISC)
 * Copyright (c) 2019, Paul Wilcox <t78t78@gmail.com>
 * 
 * Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

'use strict';

/**
 * ISC License (ISC)
 * Copyright (c) 2019, Paul Wilcox <t78t78@gmail.com>
 * 
 * Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

let isPromise = obj => 
    Promise.resolve(obj) == obj;

let stringifyObject = obj => {

    // todo: find out if this is bad.  But for now it's
    // fixing something.
    if (obj === undefined) 
        return '';

    let isObject = variable => 
           variable 
        && typeof variable === 'object' 
        && variable.constructor === Object;

    if (!isObject(obj))
        return obj.toString();

    let stringified = '[';

    let keys = Object.keys(obj).sort();

    for (let key of keys) {
        let val = obj[key];
        let valToStringify = isObject(val) ? stringifyObject(val) : val;
        stringified += `[${key},${valToStringify}]`;
    }

    return stringified + ']';

};

let isString = input =>
    typeof input === 'string' 
    || input instanceof String;

let isFunction = input => 
    typeof input === 'function';

// array.flat not out in all browsers/node
let flattenArray = array => {
    let result = [];
    for(let element of array) 
        if (Array.isArray(element))
            for(let nestedElement of element)
                result.push(nestedElement);
        else 
            result.push(element);
    return result;
};

class parser {

    // Parse function into argument names and body
    constructor (func) {

        this.parameters = [];
        this.body = "";

        let lr = this.splitLeftAndRight(func);

        this.parameters = 
            lr.left
            .replace(/[()\s]/g, '')
            .split(',');

        this.body =
            lr.right
            .replace(/^\s*\{|\}\s*$/g,'')
            .replace(/^\s*|\s*$/g,'');

    }

    splitLeftAndRight (func) {

        let uncommented = 
            func.toString() 
            .replace(/[/][/].*$/mg,'') // strip single-line comments
            .replace(/[/][*][^/*]*[*][/]/g, ''); // strip multi-line comments  
	
        let arrowIx = uncommented.indexOf('=>');
        let braceIx = uncommented.indexOf('{');	

        if (arrowIx == -1 && braceIx == -1) {
            console.trace();
            throw "it seems that a non-function was passed to 'parser'";
        }

        let splitIx = 
            braceIx == -1 ? arrowIx
            : arrowIx == -1 ? braceIx
            : arrowIx < braceIx ? arrowIx 
            : braceIx;

        let isArrow = splitIx == arrowIx;

        let left = uncommented.slice(0,splitIx);
        let right = uncommented.slice(splitIx);

        if(isArrow)
            right = right.slice(2); // get rid of the arrow
        else {
            let parenIx = left.indexOf('(');
            left = left.slice(parenIx);
        }
        
        return { left, right };

    }

}

parser.parse = function (func) {
    return new parser(func);
};

parser.parameters = function(func) {
    return new parser(func).parameters;
};

// Converts (v,w) => v.a = w.a && v.b == w.b 
// into v => { x0 = v.a, x1 = v.b }
// and w => { x0 = w.a, x1 = w.b }
parser.pairEqualitiesToObjectSelectors = function(func) {

    let parsed = new parser(func);
    let leftParam = parsed.parameters[0];
    let rightParam = parsed.parameters[1];

        let splitBodyByAnds = parsed.body.split(/&&|&/);

        let leftEqualities = [];
        let rightEqualities = [];

        for (let aix in splitBodyByAnds) {

            let andPart = splitBodyByAnds[aix];
            let eqParts = andPart.split(/==|=/);
            let leftEq;
            let rightEq;

            if (eqParts.length != 2)
                return;

            for (let eix in eqParts) {

                let ep = eqParts[eix].trim();

                if (/[^A-Za-z0-9_. ]/.test(ep)) 
                        return null;

                if (ep.indexOf(`${leftParam}.`) > -1)
                    leftEq = ep;
                else if (ep.indexOf(`${rightParam}.`) > -1)
                    rightEq = ep;
                else
                    return null; 

            }	    
            
            leftEqualities[aix] = `x${aix}: ${leftEq}`;
            rightEqualities[aix] = `x${aix}: ${rightEq}`;

        }

    return {
        leftFunc: new Function(leftParam, `return { ${leftEqualities.join(', ')} };`),
        rightFunc: new Function(rightParam, `return { ${rightEqualities.join(', ')} };`)
    };

};

class deferable {

    constructor(initial) {
        this.value = initial;
        this.thens = [];
        this.status = 'pending';
    }

    then(func) {
        this.thens.push(func);
        return this;
    }

    catch(func) {
        this.catchFunc = func;
        return this;
    }

    execute() {

        try {
                
            for(let func of this.thens) 
                this.value = isPromise(this.value) 
                    ? this.value.then(func)
                    : func(this.value);

            this.status = isPromise(this.value) 
                ? 'promisified' 
                : 'resolved'; 
            
            if (isPromise(this.value) && this.catchFunc)
                this.value = this.value.catch(this.catchFunc);

            return this.value;

        }

        catch(error) {
            this.status = 'rejected';
            if (this.catchFunc) {
                this.value = this.catchFunc(error);
                return;
            }
            throw error;
        }

    }

}

class dsGetter {

    constructor(dbConnector) {
        this.dbConnector = dbConnector;
    }

    map() { throw "Please override 'map'." }
    filter() { throw "Please override 'filter'." }
    merge() { throw "Please override 'merge'." }

}

class dataset {

    constructor(key, data) {
        this.key = key;
        this.data = data;
    }

    call (arrayOperation, ...args) {
        this.data = this.callWithoutModify(arrayOperation, ...args);
    }

    callWithoutModify (arrayOperation, ...args) {

        if (this.data instanceof dsGetter) 
            return this.data[arrayOperation](...args);

        let fromArrayProto = isString(arrayOperation);

        if (fromArrayProto) 
            arrayOperation = Array.prototype[arrayOperation];        

        return this.callNested(
            arrayOperation, 
            fromArrayProto,
            this.data,
            ...args 
        );

    }

    callNested(
        arrayOperation,
        fromArrayProto,
        maybeNested,
        ...args
    ) {

        // if not nested, apply the function
        if (!Array.isArray(maybeNested[0]) || maybeNested.length == 0) 
            return fromArrayProto 
                ? arrayOperation.call(maybeNested, ...args)
                : arrayOperation.call(null, maybeNested, ...args);    
    
        let output = [];
    
        for (let nested of maybeNested)  
            output.push(
                this.callNested(arrayOperation, fromArrayProto, nested, ...args)
            );
    
        return output;
    
    }

}

class dbConnector {
    open() { throw "Please override 'open'." }
    dsGetter() { throw "Please override 'dsGetter'."}
}

let thenRemoveUndefinedKeys = mapper =>

    (...args) => {

        let result = mapper(...args);
        
        for(let key of Object.keys(result))
            if (result[key] === undefined) 
                delete result[key];
        
        return result;

    };

class hashBuckets {
    
    constructor (
        hashKeySelector
    ) {
        this.mapper = new Map();
        this.hashKeySelector = hashKeySelector;
    }

    addItems(items) {
        for(let item of items) 
            this.addItem(item);
        return this;
    }

    addItem(item) {

        let objectKey = this.hashKeySelector(item);
        let stringKey = stringifyObject(objectKey);

        if (!this.mapper.has(stringKey)) 
            this.mapper.set(stringKey, [item]);
        else 
            this.mapper.get(stringKey).push(item);

        return this;

    }

    getBucket(
        objectToHash, 
        hashKeySelector,
        remove = false
    ) {

        let objectKey = hashKeySelector(objectToHash);
        let stringKey = stringifyObject(objectKey);

        let value = this.mapper.get(stringKey);

        if (remove) 
            this.mapper.delete(stringKey);

        return value;

    }

    getBucketFirstItem (
        objectToHash,
        hashKeySelector,
        remove = false
    ) {

        let bucket = 
            this.getBucket(
                objectToHash,
                hashKeySelector,
                remove
            );

        if (!bucket || bucket.length == 0)
            return null;

        return bucket[0];

    }

    getKeys() {
        return Array.from(this.mapper.keys());
    }

    getBuckets() {
        return Array.from(this.mapper.values());
    }

}

class joiner { 

    constructor (fromDs, joinDs, options) {

        this.options = options;
        this.fromDs = fromDs;
        this.joinDs = joinDs;
        this.joinType = this.extractOption('inner left right full', 'inner');
        this.algorithm = this.extractOption('hash loop', 'hash');
        this.results = [];

    }
            
    execute(matchingLogic, mapper) {

        if (typeof arguments[0] == null)
            throw "'matchingLogic in 'executeJoin' cannot be null";

        if (mapper && !Array.isArray(matchingLogic)) {
            let ml = parser.parameters(matchingLogic);
            let mp = parser.parameters(mapper);
            if (ml[0] != mp[0] || ml[1] != mp[1])
                throw   'Mapper parameters do not match matchingLogic parameters.  ' +
                        'Cannot execute join.';
        }
        else if (!mapper)
            mapper = (fromRow, joinRow) => Object.assign({}, joinRow, fromRow);

        mapper = thenRemoveUndefinedKeys(mapper);

        if (this.algorithm == 'hash') {
                
            let leftFunc;
            let rightFunc;

            if (Array.isArray(matchingLogic)) {
                leftFunc = matchingLogic[0];
                rightFunc = matchingLogic[1];
            }
            else {
                let parsed = parser.pairEqualitiesToObjectSelectors(matchingLogic);
                if (!parsed)
                    throw   'Could not parse function into object selectors.  ' +
                            'Pass object selectors explicitly or use loop join instead';
                leftFunc = parsed.leftFunc;
                rightFunc = parsed.rightFunc;
            }

            return this.executeHashJoin(leftFunc, rightFunc, mapper);

        }

        return this.executeLoopJoin(matchingLogic, mapper);

    }

    executeLoopJoin(matchingLogic, mapper) {

        // if matching logic is array of object selectors, then 
        // convert it to a boolean function comparing the selected
        // objects 
        if(Array.isArray(matchingLogic)) {
            let ml0 = matchingLogic[0];
            let ml1 = matchingLogic[1];
            matchingLogic = (fromRow, joinRow) => 
                stringifyObject(ml0(fromRow)) == stringifyObject(ml1(joinRow));
        }

        let fromHits = [];
        let joinHits = [];

        for (let fix in this.fromDs.data) 
        for (let jix in this.joinDs.data) {

            let fromRow = this.fromDs.data[fix];
            let joinRow = this.joinDs.data[jix];

            if (matchingLogic(fromRow, joinRow)) { 
                this.results.push(
                    mapper(fromRow, joinRow)
                );
                fromHits[fix] = true;
                joinHits[jix] = true;
            }
            
        }

        if (["left", "full"].includes(this.joinType))
        for (let fix in this.fromDs.data) 
        if (!fromHits[fix]) 
            this.results.push(
                mapper(this.fromDs.data[fix], {})
            );
    
        if (["right", "full"].includes(this.joinType))
        for (let fix in this.fromDs.data) 
        if (!joinHits[fix]) 
            this.results.push(
                mapper({}, this.joinDs.data[fix])
            );

        return this.results;

    }

    executeHashJoin (
        fromEqualitySelector,
        joinEqualitySelector, // optional, coalesces to fromSelector
        mapper
    ) {

        joinEqualitySelector = joinEqualitySelector || fromEqualitySelector;

        // Create a bucketed hashtable from the left-hand ('from') rows 
        let fromBucketsMap = new hashBuckets(fromEqualitySelector);
        for (let fromRow of this.fromDs.data) 
            fromBucketsMap.addItem(fromRow);

        for (let joinRow of this.joinDs.data) {

            // Get the left-hand rows that match the right-hand ('join') row.
            // These are removed from the hashtable. 
            let fromBucket = fromBucketsMap.getBucket(joinRow, joinEqualitySelector, true);

            // Add the merged row to the results.
            if (fromBucket)
            for (let fromRow of fromBucket) 
                this.results.push(
                    mapper(fromRow, joinRow)
                );
               
            // If there were no matches, just add the unmerged right-hand row to the results.
            else if (["right", "full"].includes(this.joinType))
                this.results.push({}, joinRow);

        }

        // Add any remaining left-hand rows in the hash-table to the results
        if (["left", "full"].includes(this.joinType))
        for(let fromBucket of fromBucketsMap.getBuckets()) 
        for(let fromRow of fromBucket) 
            this.results.push(fromRow, {});

        return this.results;

    }

    extractOption(searchTerms, defaultTerm) {

        let opts = this.options.split(' ').map(o => o.trim());
        let terms = searchTerms.split(' ').map(t => t.trim());
        
        let option =  opts.filter(o => terms.includes(o))[0]; 
        
        if (option == undefined && defaultTerm != undefined)
            option = defaultTerm;

        return option;

    }

}

joiner.forEachJoinType = operation => 
    ['inner', 'left', 'right', 'full']
    .forEach(operation);

// TODO: See if we need to uncomment the falsy checks below.
// I ran orderby without them and surprisingly, it did not 
// fail, though I don't know if the ordering comes out as 
// desired.
//
// orderedValuesSelector accepts a single function that selects 
// values from an object "{}" and returns an array "[]"
let quickSort = (unsorted, orderedValuesSelector) => {

    if (unsorted.length <= 1) 
        return unsorted;

    let pivot = unsorted.pop();
    let left = []; 
    let right = [];

    for (let row of unsorted) {

        let orderDecision = 
            decideOrder(
                orderedValuesSelector(row), 
                orderedValuesSelector(pivot)
            );

        orderDecision == -1
            ? left.push(row) 
            : right.push(row);

    }

    return quickSort(left, orderedValuesSelector)
        .concat([pivot])
        .concat(quickSort(right, orderedValuesSelector));

};

/*
    Take two points or arrays of values.  Compare the 
    first value in each for <, >, or =.  If < or >, then 
    that's your result.  If =, then compare the second 
    value in each array.  Only if all are =, then output =.  
    As usual -1, 0, and 1 correspond to <, =, > respectively.
    Valid < invalid (e.g. "x" < undefined) (but is this 
    going to kill performance?)
*/  
let decideOrder = (
    leftVals,
    rightVals
) => {

    if (!Array.isArray(leftVals))
        leftVals = [leftVals];

    if (!Array.isArray(rightVals))
        rightVals = [rightVals];
        
    let length = 
            leftVals.length > rightVals.length
        ? leftVals.length
        : rightVals.length;

    for(let i = 0; i < length; i++) {

        let leftVal = leftVals[i];
        let rightVal = rightVals[i];

        //let isLeftValid = leftVal === 0 || leftVal === false || Boolean(leftVal);
        //let isRightValid = rightVal === 0 || rightVal === false || Boolean(rightVal);

        //if (isLeftValid && !isRightValid) return -1
        //if (!leftValid && isRightValid) return 1;
        if (leftVal < rightVal) return -1;
        if (rightVal < leftVal) return 1;

    }

    return 0;

};

// rowMaker takes the passed in parameters 
// and turns the into a row in the dataset.
// In other words, it will shape your rows.
let reducer = (obj, name, rowMaker, processor) => {
    let p = processor;
    obj[name] = (...vals) => new emulator(p, rowMaker(...vals));
    return p;
};

// Aggregators such as 'sum' or 'avg' operate on
// columnar data.  But the values passed to the
// aggregators, such as 'x' in 'sum(x)' or 'avg(x)'
// are point data.  'emulator' stores the row value,
// but it also stores the the intented function (the 
// one it emulates), for later loading into a master 
// aggregators object.    
class emulator {
    constructor(processor, rowValue) {
        this.rowValue = rowValue;
        this.processor = processor;
    }
}

// 'emulatorsFunc' is what the user will pass in.
let runEmulators = function (
    dataset,
    emulatorsFunc
) {

    let keyStores = {};
    let isNaked = false;

    for (let row of dataset) {

        let emulators = emulatorsFunc(row);
        
        if (emulators instanceof emulator) {
            isNaked = true;
            emulators = { x: emulators };
        }

        for (let key of Object.keys(emulators)) {

            let rowValue = emulators[key].rowValue;

            if (!keyStores[key]) 
                keyStores[key] = {
                    processor: emulators[key].processor,
                    data: []
                };

            keyStores[key].data.push(rowValue);

        }

    }

    for (let key of Object.keys(keyStores)) 
        keyStores[key] = keyStores[key].processor(keyStores[key].data);

    if (isNaked)
        keyStores = keyStores.x;

    return keyStores;

};

function merger (type, target, source, targetIdentityKey, sourceIdentityKey) {

    let typeIx = ix => Array.isArray(type) && type[ix];
    let typeIn = (...args) => !Array.isArray(type) && [...args].includes(type.toLowerCase());
    
    let updateIfMatched = typeIn('upsert', 'update', 'full') || typeIx(0);
    let deleteIfMatched = typeIn('delete') || typeIx(1);
    let insertIfNoTarget = typeIn('upsert', 'insert', 'full') || typeIx(2);
    let deleteIfNoSource = typeIn('full') || typeIx(3);

    let incomingBuckets = 
        new hashBuckets(sourceIdentityKey)
        .addItems(source);
    
    for (let t = target.length - 1; t >= 0; t--) {

        let sourceRow = 
            incomingBuckets.getBucketFirstItem(
                target[t], 
                targetIdentityKey,
                true 
            );

        if (sourceRow)
            if (deleteIfMatched)
                target.splice(t, 1);
            else if (updateIfMatched)
                target[t] = sourceRow;

        else if (deleteIfNoSource) // target but no source
            target.splice(t, 1);

    }

    if (insertIfNoTarget) {
            
        let remainingItems = // source but no target
            incomingBuckets.getBuckets()
            .map(bucket => bucket[0]);

        for(let item of remainingItems)  
            target.push(item);

    }

    return target;

}

/*
    jsFiddle paging:

    anushree
   - https://stackoverflow.com/questions/19605078/
        how-to-use-pagination-on-html-tables
   - https://jsfiddle.net/u9d1ewsh
*/

function addPagerToTables(
    tables, 
    rowsPerPage = 10, 
    aTagMax = 10,
    pageInputThreshold = null
) {

    tables = 
        typeof tables == "string"
        ? document.querySelectorAll(tables)
        : tables;

    for (let table of Array.from(tables)) 
        addPagerToTable(table, rowsPerPage, aTagMax, pageInputThreshold);
    
}

function addPagerToTable(
    table, 
    rowsPerPage = 10, 
    aTagMax = 10,
    pageInputThreshold = null
) {

    let tBodyRows = table.querySelectorAll(':scope > tBody > tr');
    let numPages = Math.ceil(tBodyRows.length/rowsPerPage);
    
    if (pageInputThreshold == null) 
        pageInputThreshold = aTagMax;

    if(numPages == 1)
        return;

    let colCount = 
        Array.from(
            table.querySelector('tr').cells
        )
        .reduce((a,b) => a + parseInt(b.colSpan), 0);

    table
    .createTFoot()
    .insertRow()
    .innerHTML = `
        <td colspan=${colCount}>
            <div class="oneQueryPageDiv"></div>
        </td>
    `;

    let pageDiv = table.querySelector('.oneQueryPageDiv');
    insertPageLinks(pageDiv, numPages);
    insertPageInput(pageDiv, numPages, pageInputThreshold);
    addPageInputListeners(table);

    changeToPage(table, 1, rowsPerPage, numPages, aTagMax);

    for (let pageA of table.querySelectorAll('.oneQueryPageDiv a'))
        pageA.addEventListener(
            'click', 
            e => {

                let cPage = currentPage(table);
                let hasLt = e.target.innerHTML.substring(0,3) == '&lt';
                let hasGt = e.target.innerHTML.substring(0,3) == '&gt';
                let rel = e.target.rel;

                let toPage = 
                    (hasLt && cPage == 1) ? numPages
                    : (hasGt && cPage == numPages) ? 1
                    : (hasLt && rel < 0) ? cPage - 1
                    : (hasGt && rel < 0) ? cPage + 1
                    : parseInt(rel) + 1;

                changeToPage(
                    table, 
                    toPage,  
                    rowsPerPage,
                    numPages,
                    aTagMax
                );

            }
        );

}

function insertPageLinks(pageDiv, numPages, aTagMax) {

    let insertA = (rel,innerHtml) =>
        pageDiv
        .insertAdjacentHTML(
            'beforeend',
            `<a href='#' rel="${rel}">${innerHtml}</a> ` 
        );

    insertA(0,'<');
    insertA(-1,'<');

    for(let page = 1; page <= numPages; page++) 
        insertA(page - 1,page);

    insertA(-1,'>');
    insertA(numPages - 1,'>');

}

function insertPageInput(pageDiv, numPages, pageInputThreshold) {

    if (numPages < pageInputThreshold)
        return;

    pageDiv
    .insertAdjacentHTML(
        'beforeend',
        `
            <br/>
            <div class='oneQueryPageInputDiv' style='display:none;'>
                <div contenteditable='true' class='oneQueryPageInput'>1</div>
                <button class='oneQueryPageInputSubmit'></button>
            </div>
            <label class='oneQueryPageRatio'>${numPages} pages</label>
        `
    );

}

function showInputDiv (tbl, show) {
    if (!tbl.tFoot.querySelector('.oneQueryPageInputDiv'))
        return;
    tbl.tFoot.querySelector('.oneQueryPageInputDiv').style.display = show ? 'inline-block' : 'none';
    tbl.tFoot.querySelector('.oneQueryPageRatio').style.display = show ? 'none' : 'inline-block';
}

function addPageInputListeners (table) {

    if (!table.tFoot.querySelector('.oneQueryPageInputDiv'))
        return;

    let listen = (selector, event, callback) => 
        table.querySelector(selector)
        .addEventListener(event, callback); 

    table
    .addEventListener(
        'mouseleave',
        e => {
            showInputDiv(e.target, false);
            table.querySelector('.oneQueryPageInput').innerHTML = "";
        }
    );

    listen(
        '.oneQueryPageRatio',
        'mouseenter',
        e => showInputDiv(table, true)
    );

    listen(
        '.oneQueryPageRatio', 
        'click',
        e => showInputDiv(table, true)
    );

    listen(
        '.oneQueryPageInput',
        'mouseenter',
        e => table.querySelector('.oneQueryPageInput').innerHTML = ""
    );

    listen(
        '.oneQueryPageInputSubmit',
        'click',
        e => {

            let pInput = table.querySelector('.oneQueryPageInput');
            let desiredPage = parseInt(pInput.innerHTML);

            if (isNaN(desiredPage)) {
                pInput.innerHTML = "";
                return;
            }

            changeToPage(
                table,
                desiredPage,
                rowsPerPage,
                numPages,
                pageButtonDeviation
            );

        }

    );    

}

function changeToPage(
    table, 
    page, 
    rowsPerPage, 
    numPages, 
    aTagMax
) {

    let startItem = (page - 1) * rowsPerPage;
    let endItem = startItem + rowsPerPage;
    let pageAs = table.querySelectorAll('.oneQueryPageDiv a');
    let tBodyRows = [...table.tBodies].reduce((a,b) => a.concat(b)).rows;

    for (let pix = 0; pix < pageAs.length; pix++) {

        let a = pageAs[pix];
        let aText = pageAs[pix].innerHTML;
        let aPage = parseInt(aText);

        if (page == aPage)
            a.classList.add('active');
        else 
            a.classList.remove('active');

        a.style.display =
            (
                    aPage > page - Math.ceil(aTagMax / 2.0) 
                && aPage < page + Math.ceil(aTagMax / 2.0)
            )
            || isNaN(aPage) 
            ? 'inline-block'
            : 'none';

        for (let trix = 0; trix < tBodyRows.length; trix++) 
            tBodyRows[trix].style.display = 
                (trix >= startItem && trix < endItem)
                ? 'table-row'
                : 'none';  

    }

}

function currentPage (table) {
    return parseInt(
        table.querySelector('.oneQueryPageDiv a.active').innerHTML
    );
}

// Christoph at https://stackoverflow.com/questions/
//   524696/how-to-create-a-style-tag-with-javascript
function addDefaultCss () {

    if (hasoneQueryCssRule())
        return;

    let style = document.createElement('style');
    style.type = 'text/css';

    style.appendChild(document.createTextNode(defaultCss));
    document.head.appendChild(style);

}

let hasoneQueryCssRule = () => {

    for(let sheet of document.styleSheets)
    for(let rule of sheet.rules)
    if(rule.selectorText.substring(0,5) == ".oneQuery")
        return true;

    return false; 

};

let defaultCss = `

    .oneQueryString {
        color: #FF9900;
    }

    .oneQueryNumber {
        color: #0088cc;
    }

    .oneQueryNuloneQuery {
        color: gainsboro;
        font-style: italic;
    }

    .oneQueryFunc {
        color: BB5500;
        font-family: monospace;
    }

    .oneQueryTable {
        border: 2px solid #0088CC;
        border-collapse: collapse;
        margin:5px;
    }

    .oneQueryTable caption {
        border: 1px solid #0088CC;
        background-color: #0088CC;
        color: white;
        font-weight: bold;
        padding: 3px;
    }

    .oneQueryTable th {
        background-color: gainsboro;
        border: 1px solid #C8C8C8;
        padding: 3px;
    }

    .oneQueryTable td {
        border: 1px solid #C8C8C8;
        text-align: center;
        vertical-align: middle;
        padding: 3px;
    }

    .oneQueryTable tFoot {
        background-color: whitesmoke;
        font-style: italic;
        color: teal;
    }

    .oneQueryTable tFoot a {
        text-decoration: none;
        color: teal;
    }

    .oneQueryTable tFoot a.active {
        text-decoration: underline;
    }

    .oneQueryPageDiv {
        text-align: left;
        vertical-align: middle;
        font-size: smaller;
    }

    .oneQueryPageInputDiv * {
        display: inline-block;
    }

    .oneQueryPageInput {
        padding: 1px 3px;
        background-color: white;
        border: solid 1px blue;
        color: black;
        font-style: normal;
        min-width: 15px;
    }

    .oneQueryPageInputSubmit {
        height: 10px;
        width: 10px;
        margin: 0;
        padding: 0;
    }

`;

function print(target, obj, caption) {

    document.querySelector(target).innerHTML +=
        makeHtml(obj, caption);

    let maybeTables = 
        document.querySelector(target)
        .querySelectorAll('.oneQueryTable');

    if (maybeTables.length > 0)
        addPagerToTables(maybeTables);

    addDefaultCss();

}

function makeHtml(obj, caption) {

    let printType = getPrintType(obj);

    return printType == 'arrayOfObjects' ? arrayOfObjectsToTable(obj, caption)
        : printType == 'array' ? arrayToTable(obj, caption)
        : printType == 'string' ? stringToHtml(obj)
        : printType == 'number' ? `<span class='oneQueryNumber'>${obj}</span>`
        : printType == 'nuloneQuery' ? `<span class='oneQueryNuloneQuery'>${obj}</span>`
        : printType == 'function' ? functionToHtml(obj)
        : printType == 'object' ? objectToTable(obj)
        : `${obj}`;

}

function getPrintType (obj) {

    let isArray = Array.isArray(obj);        
    let isArrayOfObjects = false;

    if (isArray) {
        let len = obj.length;
        let keyCounts = Object.values(getArrayKeys(obj));
        let highlyUsedKeys = keyCounts.filter(kc => kc >= len * 0.75).length;
        isArrayOfObjects = 
            highlyUsedKeys >= keyCounts.length * 0.75 // highly structured;
            && keyCounts.length > 0; 
    }

    return isArrayOfObjects ? 'arrayOfObjects'
        : isArray ? 'array'
        : (obj == null || typeof obj == 'undefined') ? 'nuloneQuery'
        : typeof obj;

}

function getArrayKeys (array) {

    let keys = {};

    for(let item of array) 
    if (getPrintType(item) == 'object')
    for(let key of Object.keys(item))
        if(keys[key])
            keys[key] += 1;
        else 
            keys[key] = 1;

    return keys;

}

function stringToHtml (str) {
    return `
        <span class='oneQueryString'>
            ${ htmlEncode(str) }
        </span>
    `;
}

function functionToHtml (func) {
    return `
        <span class='oneQueryFunc'>
            ${ htmlEncode(func.toString()) }
        </span>
    `;
}

function objectToTable (obj) {
    
    let html = ``;

    for (let entry of Object.entries(obj))
        html += `
        <tr>
            <th>${entry[0]}</th>
            <td>${makeHtml(entry[1])}</td>
        </tr>
        `;

    return `<table class='oneQueryTable'>${html}</table>`;

}

function arrayToTable (items, caption) {
    
    let html = ``;

    for(let item of items) 
        html += `<tr><td>${makeHtml(item)}</td></tr>`;

    return `
        <table class='oneQueryTable'>
            ${caption != null ? `<caption>${caption}</caption>` : ''}
            ${html}
        </table>`;

}

function arrayOfObjectsToTable (objects, caption) {

    let keys = Object.keys(getArrayKeys(objects));
    
    let header = `<tr>`;
    for(let key of keys)
        header += `<th>${key}</th>`;
    header += `</tr>`;

    let body = ``;

    for(let obj of objects) {
        body += `<tr>`;
        if (getPrintType(obj) == 'object')
            for (let key of keys) 
                body += `<td>${makeHtml(obj[key])}</td>`;
        else 
            body += `<td colspan=${keys.length}>${makeHtml(obj)}</td>`;
        body += `</tr>`;
    }

    return `
        <table class='oneQueryTable'>
            ${caption != null ? `<caption>${caption}</caption>` : ''}
            <tHead>${header}</tHead>
            <tBody>${body}</tBody>
        </table>
    `;

}

function htmlEncode (str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\t/g, '&emsp;')
        .replace(/  /g, '&emsp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');
}

class database {

    constructor() {
        this.datasets = []; 
        this.dbConnectors = {};
    }

    getDataset(key) {
        let dss = this.getDatasets(key);
        if (dss.length > 1)
            throw `more than one dataset matching ${key} was found.`
        return dss[0];
    }

    getDatasets(key, errorIfNotFound) {

        if (isFunction(key)) 
            key = new parser.parameters(key);

        if (isString(key))
            key = [key];

        let foundDss = 
            this.datasets
            .filter(ds => key.some(k => ds.key == k));

        if (errorIfNotFound && foundDss.length != key.length) 
            throw   `One of the keys passed is not a dataset.  ` + 
                    `The keys passed are: (${key.join(',')})`;

        return foundDss;

    }

    addSource (key, data) { 
        this.datasets.push(new dataset(key, data));
        return this;
    }    

    removeSource (key) {

        for (let i in this.datasets) {
            
            let ds = this.datasets[i];
            
            if (ds.key == key) {
                this.datasets.splice(i, 1);
                return this;
            }

        }

        return this;

    }

    // parameter should be a dsConnector alias
    // value should be a dataset name (string)
    makeDsGetter(func) {

        let conAlias = parser.parameters(func)[0];
        let dsName = func();

        if (!isString(dsName))
            throw `
                ${ds.key} did not return a string.  It should 
                return the name of a dataset in ${conAlias}.
            `;
                 
        return this.dbConnectors[conAlias]
            .dsGetter(dsName);

    }

    addSources (obj) { 

        let items = Object.keys(obj).map(k => ({ key: k, val: obj[k]}));
        let dbCons = items.filter(i => i.val instanceof dbConnector);
        let dsFuncs = items.filter(i => isFunction(i.val));
        let datasets = items.filter(i => !(i.val instanceof dbConnector) && !isFunction(i.val));

        for (let con of dbCons)
            this.dbConnectors[con.key] = con.val;

        for (let ds of datasets) 
            this.addSource(ds.key, ds.val);

        // A function in addSources should only ever have the form:
        //    dbConnectorAlias => 'datasetName';            
        for (let dsFunc of dsFuncs) 
            this.addSource(
                dsFunc.key, 
                this.makeDsGetter(dsFunc.val)
            );

        return this;

    }

    filter (func) { 
        let ds = this.getDataset(func);
        ds.call('filter', func);
        return this;
    }

    map (func) {    
        let ds = this.getDataset(func);    
        ds.call('map', thenRemoveUndefinedKeys(func));
        return this;
    }

    join (
        newKey,
        options, // inner, left, right, full, default, loop, hash
        matchingLogic, // (f,j) => f.col1 == j.col1 && f.col2 < j.col2
        mapper
    ) {
        
        // You can tell whether the user desires to bypass newKey or
        // options based on place of the first parameter that is not
        // a string.  Shift the arguments accordingly and call 'join' 
        // again.

        // shift parameters by two
        if (!isString(newKey))
            return this.join(
                parser.parameters(newKey)[0], 
                'inner hash',
                newKey, // really matchingLogic
                options // really mapper
            );        

        // shift parameters by one
        if (!isString(options)) 
            return this.join(
                parser.parameters(options)[0], 
                newKey, // really options
                options, // really matchingLogic
                matchingLogic // really mapper
            );

        let keys = 
            isFunction(matchingLogic)
            ? parser.parameters(matchingLogic)
            : [
                 parser.parameters(matchingLogic[0]),
                 parser.parameters(matchingLogic[1])
              ];

        let fromDs = this.getDataset(keys[0]);
        let joinDs = this.getDataset(keys[1]);

        let joinedRows = 
            new joiner (fromDs, joinDs, options)
            .execute(matchingLogic, mapper);

        if (!this.getDataset(newKey))
            this.addSource(newKey, joinedRows);
        else 
            this.getDataset(newKey).data = joinedRows;

        return this;

    }

    group (groupKeySelector) {
    
        let ds = this.getDataset(groupKeySelector);

        let buckets = 
            new hashBuckets(groupKeySelector)
            .addItems(ds.data)
            .getBuckets();

        ds.data = buckets;

        return this;

    }

    sort (orderedValuesSelector) {

        let ds = this.getDatasets(orderedValuesSelector)[0];

        ds.call(
            parser.parameters(orderedValuesSelector).length > 1 
                ? 'sort' 
                : quickSort, 
            orderedValuesSelector
        );

        return this;

    } 

    reduce (outerFunc) {
        let ds = this.getDataset(outerFunc);
        ds.call(runEmulators, outerFunc);
        // 'runEmulators' returns an object, reduced from an array.   
        // But to keep allowing chaining of methods, we still need 
        // to return an array, not an object.
        if (!Array.isArray(ds.data))
            ds.data = [ds.data];
        return this;
    }

    print (func, target, caption) {

        let ds = this.getDataset(func);

        // if dataset is an external dataset (is a dsGetter),
        // then it is a promise, so print inside 'then'.
        if (ds.data instanceof dsGetter) {
            ds.callWithoutModify('map', func)
                .then(rows => print(target, rows, caption));
            return this;
        }

        let rows = ds.callWithoutModify('map', func);
        print(target, rows, caption);
        return this;

    }

    merge (
        type, // update, insert, delete, upsert, full, or [] of 4 bools
        targetIdentityKey, 
        sourceIdentityKey  
    ) {

        let target = this.getDataset(targetIdentityKey);
        let source = this.getDataset(sourceIdentityKey); 

        target.data = merger(
            type, 
            target.data, 
            source.data, 
            targetIdentityKey, 
            sourceIdentityKey
        );

        return this;

    }

}

class dsGetterIdb extends dsGetter {

    constructor (storeName, idbConnector) {
        super(idbConnector);
        this.storeName = storeName;
        this.filterFunc;
    }

    filter(filterFunc) {

        if (!this.filterFunc) 
            this.filterFunc = filterFunc;
        else 
            this.filterFunc = this.filterFunc && filterFunc;

        return this;

    }

    // - thanks netchkin at https://stackoverflow.com/questions/46326212/
    //   how-to-return-indexeddb-query-result-out-of-event-handler
    // - also see "using a cursor" at https://developer.mozilla.org/en-US/
    //   docs/Web/API/IndexedDB_API/Using_IndexedDB
    map(mapFunc) {

        return new Promise((resolve, reject) => {

            let dbCon = this.dbConnector.open();
            
            dbCon.onsuccess = () => {

                let db = dbCon.result;
                let tx = db.transaction(this.storeName);
                let store = tx.objectStore(this.storeName);
                let filterFunc = this.filterFunc || (x => true);
                let results = [];

                let storeCursor = store.openCursor();
                
                storeCursor.onsuccess = event => {

                    let cursor = event.target.result;

                    if (!cursor) {
                        resolve(results);
                        return;
                    }

                    if (filterFunc(cursor.value))
                        results.push(
                            mapFunc(cursor.value)
                        );

                    cursor.continue();

                }; 
                
                storeCursor.onerror = event => reject(event);
                tx.oncomplete = () => db.close(); 
                tx.onerror = event => reject(event); 

            };

            dbCon.onerror = event => reject(event); 

        });

    }

    merge (
        type,
        targetIdentityKey, 
        sourceIdentityKey,
        source 
    ) {

        let typeIx = ix => (Array.isArray(type) && type[ix]);
        let typeIn = (...args) => [...args].includes(type.toLowerCase());
        
        let updateIfMatched = typeIn('upsert', 'update', 'full') || typeIx(0);
        let deleteIfMatched = typeIn('delete') || typeIx(1);
        let insertIfNoTarget = typeIn('upsert', 'insert', 'full') || typeIx(2);
        let deleteIfNoSource = typeIn('full') || typeIx(3);

        return new Promise((resolve, reject) => {

            let incomingBuckets = 
                new hashBuckets(sourceIdentityKey)
                .addItems(source);
    
            let dbCon = this.dbConnector.open();

            dbCon.onsuccess = () => {

                let db = dbCon.result;

                let tx = db.transaction(this.storeName, "readwrite");
                let store = tx.objectStore(this.storeName);

                let storeCursor = store.openCursor();
                
                storeCursor.onsuccess = event => {

                    let cursor = event.target.result;

                    if (!cursor) {
                        
                        if (insertIfNoTarget) {
                                
                            let remainingItems = // source but no target
                                incomingBuckets.getBuckets()
                                .map(bucket => bucket[0]);
    
                            for(let item of remainingItems) {
                                let addRequest = store.add(item);
                                addRequest.onerror = event => reject(event); 
                            }
                        
                        }

                        return;

                    }

                    let sourceRow = 
                        incomingBuckets.getBucketFirstItem(
                            cursor.value, 
                            targetIdentityKey,
                            true 
                        );

                    if (sourceRow)
                        if (deleteIfMatched) 
                            cursor.delete();
                        else if (updateIfMatched) 
                            cursor.update(sourceRow);
        
                    else if (deleteIfNoSource) 
                        cursor.delete();

                    cursor.continue();

                }; 
                    
                storeCursor.onerror = event => reject(event); 
                tx.oncomplete = () => db.close();
                tx.onerror = event => reject(event); 

            };

            dbCon.onerror = event => reject(event); 

        });

    }

}

class dbConnectorIdb extends dbConnector {

    constructor (dbName) {
        super();
        this.dbName = dbName;
    }

    open() {
        return window.indexedDB.open(this.dbName);
    }

    dsGetter(storeName) {
        return new dsGetterIdb(storeName, this);
    }

}

// TODO: Try-Catch logic is bad

function $$(obj) { 
    return new FluentDB().addSources(obj); 
}

class FluentDB extends deferable {

    constructor() {
        super(new database());
        this.attachDbFuncs(
            'addSources', 'filter', 'map', 
            'join', 'group', 'sort', 
            'reduce', 'print', 'merge'
        );
    }
 
    mergeExternal (
        type, // update, insert, delete, upsert, full, or [] of 4 bools
        targetIdentityKey, 
        sourceIdentityKey  
    ) {

        this.then(db => {

            let target = db.getDataset(targetIdentityKey).data;

            if (!(target instanceof dsGetter))
                throw 'target dataset is not a dsGetter.  Use "merge" instead.'

            let source = 
                db.getDataset(sourceIdentityKey)
                .callWithoutModify('map', x => x); // just get the raw data

            target.merge(type, targetIdentityKey, sourceIdentityKey, source);
            return db;

        });

        return this;

    }

    test (
        testName = 'test',
        finalMapper,
        boolFunc, 
        catchFunc = err => err
    ) {

        if (testName == 'notest')
            return undefined;

        let _catchFunc = err => ({
            testName,
            result: false,
            error: catchFunc(err) 
        });

        let data;
        try {data = this.execute(finalMapper);}
        catch (err) {return _catchFunc(err);}

        let process = rows => {
            try {

                // if it's not an array, it's the result of a catch
                if (!Array.isArray(rows))
                    throw rows;

                return { 
                    testName,
                    result: boolFunc(rows)
                };

            }
            catch(err) {
                return _catchFunc(err);
            }
        };

        return isPromise(data) 
            ? data.then(process).catch(_catchFunc)
            : process(data);

    }

    // TODO: Close all dsConnector connections
    execute (finalMapper) {

        let catcher = err => { 
            if (this.catchFunc)
                return this.catchFunc(err);
            throw err;
        };
        
        try {        

            let db = super.execute();

            let param = parser.parameters(finalMapper)[0];
            finalMapper = thenRemoveUndefinedKeys(finalMapper);

            if (this.status == 'rejected' || finalMapper === undefined)
                return db;
    
            db = this.promisifyDbIfNecessary(db);

            return isPromise(db) 
                ? db.then(db => db.getDataset(param).data.map(finalMapper)).catch(catcher)
                : db.getDataset(param).data.map(finalMapper);

        }

        catch(err) {
            return catcher(err);
        }

    }

    attachDbFuncs (...funcNames) {

        for(let funcName of funcNames) 
            this[funcName] = function(...args) { return this.then(db => {

                db = this.resolveGetters(db, funcName, args);
                db = this.promisifyDbIfNecessary(db);
                
                return (isPromise(db)) 
                    ? db.then(db => db[funcName](...args))
                    : db[funcName](...args);

            });};
        
    } 

    resolveGetters(db, funcName, args) {

        let argDatasets = this.argumentDatasets(db, args);
        let foundGetters = 0;

        for(let i = argDatasets.length - 1; i >= 0; i--) {

            let argDs = argDatasets[i];
            let hasFunc = argDs.data[funcName] ? true : false;
            let isGetter = argDs.data instanceof dsGetter;
            if (isGetter)
                foundGetters++;

            // - If the first dataset arg is a dsGetter, and it is the only dsGetter,
            //   and the dsGetter has the function being called, then use the function
            //   on that getter.    
            if (i == 0 && isGetter && foundGetters == 1 && hasFunc && funcName != 'merge') 
                argDs.data = argDs.data[funcName](...args);
            else if (isGetter) 
                argDs.data = argDs.data.map(x => x);

        }

        return db;

    }

    promisifyDbIfNecessary (db) {
        
        if (isPromise(db))
            return db;

        let hasPromises = db.datasets.filter(ds => isPromise(ds.data)).length > 0; 

        if (!hasPromises)
            return db;

        return Promise.all(db.datasets.map(ds => ds.data))
            .then(datas => {
                for(let i in db.datasets) 
                    db.datasets[i].data = datas[i];
                return db;
            });

    }

    // Get datasets from passed arguments
    argumentDatasets (db, args) {

        let funcArgs = flattenArray(
            args
            .filter(a => isFunction(a))
            .map(a => parser.parameters(a))
        );

        return funcArgs
            .filter((a,i,self) => self.indexOf(a) == i) // distinct
            .map(p => db.getDataset(p))
            .filter(p => p); // some function params don't represent datasets

    }

}

$$.reducer = reducer;
$$.runEmulators = runEmulators;

$$.reducer($$, 'first', v => v, array => array.reduce((a,b) => a || b));
$$.reducer($$, 'last', v => v, array => array.reduce((a,b) => b || a));
$$.reducer($$, 'sum', v => v, array => array.reduce((a,b) => a + b));
$$.reducer($$, 'count', v => v, array => array.reduce((a,b) => a + 1, 0));

$$.reducer($$, 'avg', v => v, array => {

    let agg = runEmulators(array, val => ({
        sum: $$.sum(val), 
        count: $$.count(val)     
    }));

    return agg.sum / agg.count

});

$$.reducer($$, 'mad', v => v, array => {

    let agg = runEmulators(array, val => $$.avg(val));

    for (let ix in array)
        array[ix] = Math.abs(array[ix] - agg);

    return runEmulators(array, val => $$.avg(val));
    
});

$$.reducer($$, 'cor', (x,y) => ({ x, y }), data => {

    let agg = runEmulators(data, row => ({ 
        xAvg: $$.avg(row.x), 
        yAvg: $$.avg(row.y) 
    }));

    for(let ix in data) 
        data[ix] = { 
            xDiff: data[ix].x - agg.xAvg, 
            yDiff: data[ix].y - agg.yAvg
        };

    agg = runEmulators(data, row => ({
        xyDiff: $$.sum(row.xDiff * row.yDiff), 
        xDiffSq: $$.sum(row.xDiff ** 2),
        yDiffSq: $$.sum(row.yDiff ** 2)    
    }));

    return agg.xyDiff / (agg.xDiffSq ** 0.5 * agg.yDiffSq ** 0.5);
    
});

$$.idb = dbName => new dbConnectorIdb(dbName);
$$.dbConnector = dbConnector;
$$.dsGetter = dsGetter;

// TODO: Try to make it so that seriToRun and testsToRun are 
// set from the user in the console.  Most likely by using 
// process.argv (remember that args start at index 2 so use 
// process.argv[2] and process.argv[3]) inside runTests.js and 
// then accepting the variables as parameters in this file.

// TODO: Implement testing structure for FluentDB.mergeExternal,
// or just do direct tests, because it is not really covered here.

class tests {

    constructor (seriToRun, testsToRun) {
        this.seriToRun = seriToRun;
        this.testsToRun = testsToRun;
    }

    name (testName, seriesName) {
        if(this.testsToRun && !this.testsToRun.includes(testName) && this.testsToRun != testName)
            return 'notest';
        if(this.seriToRun && !this.seriToRun.includes(seriesName) && this.seriToRun != seriesName)
            return 'notest';
        return testName;
    }

    async run (seriesName, createFDB) { 
        
        let n = testName => this.name(testName, seriesName);

        return Promise.all([

            createFDB()
                .filter(o => o.customer == 2)
                .test(n('filter'), o => o, data => 
                    data.filter(x => x.customer == 2).length > 0 && 
                    data.filter(x => x.customer != 2).length == 0
                ),

            createFDB()
                .map(o => ({
                    customer: o.customer,
                    rating: o.rating,
                    flag: o.rating < 10 ? 'bad' : o.rating < 50 ? 'okay' : 'good'
                }))
                .test(n('map'), o => o, data =>
                    Object.keys(data[0]).includes('customer') && 
                    !Object.keys(data[0]).includes('id')
                ),

            createFDB() 
                .sort((o,o2) => // 'o2' is free, in that it doesn't matter what you name it
                    o.customer > o2.customer ? 1
                    : o.customer < o2.customer ? -1  
                    : o.rating > o2.rating ? -1 
                    : o.rating < o2.rating ? 1
                    : 0
                )
                .test(n('sort'), o => o, data => {
                    for(let i = 1; i < data.length; i++) {
                        let prv = data[i-1];
                        let cur = data[i];
                        return prv.customer <= cur.customer && prv.rating >= cur.rating;
                    }
                }),

            createFDB()
                .join((o,p) => o.product == p.id)
                .test(n('join'), o => o, data => 
                    Object.keys(data[0]).includes('price')
                ),

            createFDB()
                .group(o => o.customer) // if you don't group, '.reduce' will still output an array (with one item)
                .reduce(o => ({
                    customer: $$.first(o.customer), 
                    speed: $$.avg(o.speed),
                    rating: $$.avg(o.rating),
                    speed_cor: $$.cor(o.speed, o.rating)
                }))
                .test(n('groupReduce'), o => o, data => {
                    let row0 = prop => Math.round(data[0][prop] * 100) / 100;
                    return data.length == 3
                        && row0('rating') == 58.29
                        && row0('speed') == 4.57
                        && row0('speed_cor') == 0.74;
                }),

            createFDB()
                .merge('upsert', c => c.id, pc => pc.id)
                .merge('delete', c => c.id, s => s.id)
                .test(n('merge'), c => c, data =>  
                    data.find(row => row.id == 2).fullname == 'Johnathan Doe' && 
                    data.filter(row => row.id == 4 || row.id == 5).length == 0
                )

        ])
        .then(res => 
            res
            .filter(row => row !== undefined)
            .map(row => ({
                passStatus: row.result,
                seriesName,
                name: row.testName
            }))
        ); 

    }

}

module.exports = tests;
