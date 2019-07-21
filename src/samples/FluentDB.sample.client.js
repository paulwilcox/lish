import * as idb from 'idb';
import _sample from './FluentDB.sample.core.js';

export let sample = _sample;

export let sampleIdb = 
    idb.open(
        'sampleIdb', 
        2, 
        db => {            
            for (let name of db.objectStoreNames) 
                db.deleteObjectStore(name);
            for (let name of Object.keys(sample)) 
                db.createObjectStore(name, {keyPath: 'id'});
        }
    )
    .then(db => {

        for (let datasetKvp of Object.entries(sample)) {

            let store = 
                db
                .transaction(datasetKvp[0], "readwrite")
                .objectStore(datasetKvp[0]);     

            if (datasetKvp[0] == 'foods')
                store.clear();

            for (let row of datasetKvp[1]) 
                store.put(row);
                        
        }          

        return db;

    });


