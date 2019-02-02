import { parser } from './parser.js';

export let objectKeyValuesAreEqual = (left, right) => {

    let distinctKeys = 
        Array.from(
            new Set(
                Object.keys(left)
                .concat(
                    Object.keys(right)
                )
            )
        );

    for (let key of distinctKeys) 
        if (left[key] !== right[key])
            return false;
            
    return true;

}

export let isSubsetOf = (sub, sup) =>  
    setEquals (
        new Set(
            [...sub]
            .filter(x => [...sup].indexOf(x) >= 0) // intersection
        ), 
        sub
    );

export let asSet = obj => {

    let s = 
        obj instanceof Set ? obj
        : isString(obj) ? new Set(obj)
        : Array.isArray(obj) ? new Set(obj)
        : undefined;

    if (!s) 
        throw "Could not convert object to set";
    
    return s;

}

// Max Leizerovich: stackoverflow.com/questions/
//   31128855/comparing-ecma6-sets-for-equality
export let setEquals = (a, b) =>
    a.size === b.size 
    && [...a].every(value => b.has(value));

export let isPromise = obj => 
    Promise.resolve(obj) == obj;

export let stringifyObject = obj => {

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

}

export let isString = input =>
    typeof input === 'string' 
    || input instanceof String;

export let isFunction = input => 
    typeof input === 'function';

