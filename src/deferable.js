import * as g from './general.js';

export default class {

    constructor(initial) {
        this.value = initial;
        this.thens = [];
        this.status = 'pending'
        this.promisifyCondition; // whether this.value is should become a promise
        this.promisifyConversion; // how to convert this.value into a promise
    }

    then(func) {
        this.thens.push(func);
        return this;
    }

    // for the user to set the catch logic
    catch(func) {
        this.catchFunc = func;
        return this;
    }

    // for the developer to use the catch logic
    catcher (error) { 
        this.status = 'rejected';
        if (!this.catchFunc)
            throw error;
        this.value = this.catchFunc(error);        
    }    

    execute(finalFunc) {

        try {
                
            if (finalFunc != undefined)
                this.thens.push(finalFunc);

            for(let func of this.thens) {

                // promisify if necessary
                if (!g.isPromise(this.value) && this.promisifyCondition(this.value))
                    this.value = this.promisifyConversion(this.value);
    
                this.value = 
                    g.isPromise(this.value) && this.catchFunc ? this.value.then(func).catch(this.catchFunc)
                    : g.isPromise(this.value) ? this.value.then(func)
                    : func(this.value);
   
             }

            this.status = g.isPromise(this.value) 
                ? 'promisified' 
                : 'resolved'; 
            
            return this.value;

        }

        catch(error) {
            this.catcher(error);
        }

    }

}
