import parser from './parser.js';
import hashBuckets from './hashBuckets.js';
import * as g from './general.js';

export let mergeMethod = {
    hash: 'hash',
    loop: 'loop',
    hashDistinct: 'hashDistinct'
};

// Options can be a mapper function,
// it can be a keyword representing a mapper function,
// or it can be, as the term implies, an object 
// of paramters for passing options 
export function* merge (
    leftData, 
    rightData, 
    matcher, 
    options, 
    method
) {

    let leftHasher;
    let rightHasher;
    let mapper;

    if (method && !Object.keys(mergeMethod).includes(method)) throw `
        method '${method}' is not recognized.  Leave undefined or
        use one of: ${Object.keys(mergeMethod).join(', ')}.
    `;

    // if options is an object with properties 
    if (!g.isFunction(options) && !g.isString(options)) {
        leftHasher = options.leftHasher || options.hasher;
        rightHasher = options.rightHasher || options.hasher;
        mapper = normalizeMapper(options.mapper, matcher);
    }
    // if options is a function or a string
    else {

        mapper = normalizeMapper(options, matcher);
        let hashers = parser.pairEqualitiesToObjectSelectors(matcher);

        if(!hashers) {
            method = method || 'loop';
            if (method != 'loop') throw ` 
                Must loop merge, "${matcher}" could not be parsed 
                into functions that return objects for hashing.`;
        }
        else {
            leftHasher = hashers.leftFunc;
            rightHasher = hashers.rightFunc;
        }

    }

    // If no hashers are passed, then do full-on loop join
    if (method == 'loop') {
        yield* loopMerge(leftData, rightData, matcher, mapper);
        return;
    }

    if (!method || ['hash', 'hashDistinct'].includes(method))
        yield* hashMerge(
            leftData, 
            rightData,
            matcher,
            leftHasher, 
            rightHasher,
            mapper, 
            method 
        );

}

function* hashMerge (
    leftData, 
    rightData, 
    matcher,
    leftHasher,
    rightHasher,
    mapper,
    method
) {

    let leftBuckets = 
        new hashBuckets(leftHasher, method == 'hashDistinct')
        .addItems(leftData);

    let rightBuckets = 
        new hashBuckets(rightHasher, method == 'hashDistinct')
        .addItems(rightData);

    // convenience function for extracting a bucket
    let removeBucket = (buckets, key) => {
        let bucket = buckets.get(key);
        buckets.delete(key);
        return bucket;
    }

    // yield matches and left unmatched
    for(let key of leftBuckets.keys()) 
        yield* loopMerge(
            removeBucket(leftBuckets, key), 
            removeBucket(rightBuckets, key) || [undefined], 
            matcher, 
            mapper
        );

    // yield right unmatched
    for(let key of rightBuckets.keys()) 
        for(let rightItem of removeBucket(rightBuckets, key)) 
            yield* wrapper(mapper(undefined, rightItem));

}

function* loopMerge (
    leftData, 
    rightData,
    matcher,
    mapper
) {

    let leftHits = new Set();
    let rightHits = new Set();

    for (let l in leftData)
    for (let r in rightData) {
        if (leftData[l] == undefined || rightData[r] == undefined)
            continue;
        if (matcher(leftData[l], rightData[r])) {
            leftHits.add(l);
            rightHits.add(r);
            yield* wrapper(mapper(leftData[l], rightData[r]));
        }
    }

    for (let l in leftData) 
        if (!leftHits.has(l))
            yield* wrapper(mapper(leftData[l], undefined));

    for (let r in rightData) 
        if (!rightHits.has(r))
            yield* wrapper(mapper(undefined, rightData[r]));

}

function* wrapper (mapped) {
    if (!mapped)
        return;
    if (mapped[Symbol.iterator]) 
        yield* mapped;
    else 
        yield mapped;
}

export function normalizeMapper (mapFunc, matchingLogic) {

    if (!mapFunc)
        mapFunc = 'both null'; // inner join by default

    if (g.isString(mapFunc)) {
        
        if (mapFunc.length == 2) 
            mapFunc = inflateKeywords(mapFunc);

        let keywords = mapFunc.split(' ');
        let onMatched = keywords[0];
        let onUnmatched = keywords[1];
        let allowedTerms = ['both', 'thob', 'left', 'right', 'null', 'stack'];

        if (!allowedTerms.includes(onMatched) || !allowedTerms.includes(onUnmatched))
            throw `mapper must be one of: ${allowedTerms.join(',')}}`;

        return (left,right) => mergeByKeywords(left, right, onMatched, onUnmatched);

    }

    if (!parametersAreEqual(matchingLogic, mapFunc))
        throw 'Cannot merge.  Parameters for "mapper" and "matchingLogic" do not match"';

    return mapFunc;

}

function mergeByKeywords (left, right, onMatched, onUnmatched) {

    if(left && right)
        switch(onMatched) {
            case 'both': return g.noUndefined(Object.assign({}, right, left));
            case 'thob': return g.noUndefined(Object.assign({}, left, right));
            case 'left': return left;
            case 'right': return right;
            case 'null': return undefined;
            case 'stack': return [left, right]; 
        }

    switch(onUnmatched) {
        case 'both': return left || right;
        case 'thob': return left || right; 
        case 'left': return left;
        case 'right': return right;
        case 'null': return undefined;
    }

}

function inflateKeywords (keywordString) {
    let replacer = str => 
          str == 'b' ? 'both'
        : str == 't' ? 'thob' 
        : str == 'l' ? 'left'
        : str == 'r' ? 'right'
        : str == 'n' ? 'null'
        : str == 's' ? 'stack'
        : null;
    return replacer(keywordString.substring(0,1)) + ' ' +
        replacer(keywordString.substring(1,2)); 
}

function parametersAreEqual (a,b) {

    a = parser.parameters(a);
    b = parser.parameters(b);

    if (a.length != b.length)
        return false;

    for(let i in a)
        if (a[i] != b[i])
            return false;

    return true;

}

