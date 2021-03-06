import * as g from './general.js';
import hashBuckets from './hashBuckets.js';
import { quickSort } from './sorts.js';
import Matrix from './matrix.js';
import parser from './parser.js';
import { merge as mrg } from './mergeTools.js';

export default class dataset {

    constructor(data, groupLevel = 1) {
        this.data = data;
        this.groupLevel = groupLevel;
    }

    *[Symbol.iterator]() { 
        yield* this.data;
    }

    map (func) {    
        let _map = function* (data) {
            for(let row of data)
                yield g.noUndefined(func(row));
        }
        this.data = recurse(_map, this.data, this.groupLevel);
        return this;
    }

    filter (func) {    
        let _filter = function* (data) {
            for(let row of data)
            if(func(row))
                yield row;
        }
        this.data = recurse(_filter, this.data, this.groupLevel);
        return this;
    }

    sort (func) {
        let outerFunc = parser.parameters(func).length > 1 
            ? data => quickSort(data, func, false)
            : data => quickSort(data, func, true);
        this.data = recurse(outerFunc, this.data, this.groupLevel);
        return this;
    } 

    group (func) {
        let outerFunc = data => 
            new hashBuckets(func)
            .addItems(data)
            .getBuckets();
        this.data = recurse(outerFunc, this.data, this.groupLevel);
        this.groupLevel++;
        return this;
    }

    ungroup (func) {

        if (!func) 
            func = x => x;

        if (this.groupLevel == 1) {
            let counter = 0;
            for (let item of this.data) {
                if (++counter > 1)
                    throw   'Ungrouping to level 0 is possible, but ' +
                            'there can only be one item in the dataset.';
                this.data = item;
            }
            this.groupLevel--;
            return this;
        }

        let outerFunc = function* (data) {
            for (let item of data)
            for (let nested of item)
                yield func(nested);
        }

        // stop early becuase you want one level above base records
        this.data = recurse(outerFunc, this.data, this.groupLevel - 1);
        this.groupLevel--;
        return this;

    }

    reduce (obj, ungroup = true) {

        let isNaked = Object.keys(obj).length == 0;

        // wrap result in array to bring back to original nesting level
        let outerFunc = data => {
            let agg = {};
            if (isNaked)
                return [obj(data)];
            for(let [key,reducer] of Object.entries(obj)) {
                agg[key] = reducer(data);
            }
            return [agg]; 
        }

        this.data = recurse(outerFunc, this.data, this.groupLevel);

        if (ungroup)
            this.ungroup();

        return this;

    }

    distinct (func, sorter) {

        func = func || (x => x);
        
        if (sorter) sorter = 
            parser.parameters(sorter).length > 1 
            ? data => quickSort(data, func, false)
            : data => quickSort(data, func, true);
        else 
            sorter = data => data;

        let outerFunc = data => 
            new hashBuckets(func)
            .addItems(data)
            .getBuckets()
            .map(bucket => {
                return [...sorter(bucket)][0]
            });

        this.data = recurse(outerFunc, this.data, this.groupLevel);
        return this;

    }

    merge (incoming, matcher, options, method) {

        if (matcher == '=') 
            matcher = (l,r) => g.eq(l,r);

        let outerFunc = data => [...mrg (
            data, 
            incoming instanceof dataset ? incoming.data : incoming, 
            matcher, 
            options, 
            method
        )];

        this.data = recurse(outerFunc, this.data, this.groupLevel); 
        return this;

    }

    matrix(        
        selector, // csv of prop names or func returning array of numbers
        rowNames // string of a prop name or func identifiying the property representing the name
    ) {
        return new Matrix(this.data, selector, rowNames);
    }

    with (func) {
        let arr = recurseToArray(x => x, this.data, this.groupLevel);
        func(arr);
        this.data = arr;
        return this;
    }

    get (func) {
        if (!g.isIterable(this.data)) {
            if (func)
                this.data = func(this.data);
            return this.data;
        }
        let arr = recurseToArray(
            func || function(x) { return x }, 
            this.data,
            this.groupLevel
        );
        this.data = arr;
        return arr;
    }

    toJsonString(func) {
        let dataJson = JSON.stringify(this.get(func));
        return `{"data":${dataJson},"groupLevel":${this.groupLevel}}`;
    }

}

function* recurse (func, data, levelCountdown) {

    if (levelCountdown === 0)
        return func([data])[0];

    if (levelCountdown > 1) { // data is nested groups
        for (let item of data) 
            yield recurse(func, item, levelCountdown - 1);
        return;
    }

    yield* func(data); // data is base records

}

function recurseToArray (func, data, levelCountdown) {

    if (levelCountdown === 0)
        return func([data])[0];

    let list = [];
    for(let item of data)
        list.push(
            levelCountdown > 1          
            ? recurseToArray(func, item, levelCountdown - 1)
            : g.noUndefined(func(item))
        );
    return list;    

}

