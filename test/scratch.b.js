import * as g from '../src/general.js';


function incBetaContFrac() {

    let x = 0.9999999999//0.99943427471;
    let a = 5000;
    let b = 0.5;

    let d2m = (m) => {
        m = m/2;
        return (m*x*(b-m)) / ((a+2*m-1) * (a+2*m))
    };
    let d2mp1 = (m) => {
        m = m - 1; m = m/2;
        return - ((a+m)*(a+b+m)*x) / ((a+2*m)*(a+2*m+1))
    }

    // how does this even work when x = 1?
    let multiplier = (Math.pow(x,a)*Math.pow(1-x,b)) / (a*0.02506690941121089696);
    
    let result = 1;

    for (let i = 1000000; i >= 1; i--) {
        let dFunc = i % 2 == 0 ? d2m : d2mp1;
        let dVal = dFunc(i);
        result = 1 + dVal / result; 
    }

    result = 1 / result;
    return multiplier * result;    

}

function incBeta(
    x, 
    a, 
    b, 
    precision = 1e-8,
    maxIterations = 1000000,
    verbose = false 
) {

    // dlmf.nist.gov/8.17#SS5.p1
    // fresco.org.uk/programs/barnett/APP23.pdf (Most clear lentz reference, despite the title)
    // en.wikipedia.org/wiki/Continued_fraction (esp Theorem 4)

    // OMG, it's about as bad as the non-lentz way.  I guess efficiency isn't the
    // benefit.  Must only be the ability to stop at arbitrary precision.

    let d2m = (m) => {
        m = m/2;
        return (m*x*(b-m)) / ((a+2*m-1) * (a+2*m));
    };

    let d2mp1 = (m) => {
        m = m - 1; m = m/2;
        return - ((a+m)*(a+b+m)*x) / ((a+2*m)*(a+2*m+1));
    }

    let an = (n) => 
          n == 1 ? 1 // first numerator is 1
        : (n-1) %2 == 0 ? d2m(n-1) // after that, the d-sub-n is off by 1
        : d2mp1(n-1); 

    let bn = (n) => 1;

    // how does this even work when x = 1?
    let multiplier = (Math.pow(x,a)*Math.pow(1-x,b)) / (a*0.02506690941121089696);
    let small = 1e-32;

    let F = small;
    let C = small;
    let D = 0;
    let CD;

    for (let n = 1; n <= maxIterations; n++) {
        
        let _bn = bn(n);
        let _an = an(n);
        C = (_bn + _an / C) || small; 
        D = (_bn + _an * D) || small;
        D = 1 / D;
        CD = C * D;
        F *= CD;

        // Various literature shows that you can to set CD to be below a 
        // ceratin precision, and stop there.  But this may cut it off
        // earlier than you desire.  This is particularly true if your
        // working result keeps rising very slowly.  Then any one change 
        // can be small but the aggregate of many future iterations might
        // be substantial, and so your approximation is off.  So I'm 
        // multiplying CD by the number of iterations left.  This is 
        // worst case for how much change can be expected.  If that is 
        // under desired precision, then no point in going further.
        if (Math.abs(CD-1) * (maxIterations - n) < precision) {
            if (verbose)
                console.log(`Reached desired precison in ${n} iterations.`)
            return multiplier * F;
        }

    }

    throw   `Could not reach desired CD precision of ${precision} ` +
            `within ${maxIterations} iterations.  ` +
            `Answer to this point is ${multiplier * F}, ` +
            `and CD is ${CD}.`

}

async function test () {

    console.log({
        orig: incBetaContFrac(),
        new: incBeta(0.9999999999, 5000, 0.5, 0.00000001)
    })

}    


/*
    console.log({gamma: g.gamma(7.33)})
    console.log({iBeta: g.iBeta(0.99943427471, 5000, 0.5)})


    let b = g.iBeta(0.99943427471, 5000, 0.5);

    console.log({
        b,
        desired: 0.0004354190320508021051
    })


    let irb = g.invRegBeta(0.05, 5000, 0.5);
    let rb = g.regBeta(irb, 5000, 0.5);
    let ib = g.iBeta(irb, 5000, 0.5);

    console.log({
        a_irb: irb,
        b_rb: rb,
        c_ib: ib
    });
    
*/
    
    /*

    // Gamma references
        // link.springer.com/content/pdf/bbm%3A978-3-319-43561-9%2F1.pdf
        // my.fit.edu/~gabdo/gamma.txt
        // valelab4.ucsf.edu/svn/3rdpartypublic/boost/libs/math/doc/sf_and_dist/html/math_toolkit/backgrounders/lanczos.html


    // Getting Student's T critical value from probability 
    // homepages.ucl.ac.uk/~ucahwts/lgsnotes/JCF_Student.pdf
    // boost.org/doc/libs/1_58_0/libs/math/doc/html/math_toolkit/dist_ref/dists/students_t_dist.html

    let u = 0.95;
    let n = 10000;

    let sign = Math.sign(u - 0.5);
    let ib = g.invRegBeta(u < 0.5 ? 2 * u : 2 * (1-u), n/2, 0.5);
    let inner = n * (1/ib - 1);

    let result = sign * Math.pow(inner, 0.5);

    console.log({
        result,
        sign, 
        ib,
        inner
    });
    *?




    return;

    //let data = await sample('orders');

    let data = [
        { cases: 7, distance: 560, time: 16.68 },
        { cases: 3, distance: 220, time: 11.50 },
        { cases: 3, distance: 340, time: 12.03 },
        { cases: 4, distance: 80, time: 14.88 },
        { cases: 6, distance: 150, time: 13.75 },
        { cases: 7, distance: 330, time: 18.11 }
    ];

    let results = 
        $$(data)
        .reduce({
            model: $$.regress('cases, distance', 'time'),
            std: $$.std(row => row.cases, true)
        })
        .get();

    console.log(results.model)

    return true;

    */


class hyperGeo {
    
    constructor(
        iterations = 1000, 
        precision = 1e-10
    ) {
        this.iterations = iterations;
        this.precision = precision;
    }

    execute (a,b,c,z) {

        let sum = 1;
        let add;

        for(let n = 1; n <= this.iterations; n++) {

            let zn = Math.log(Math.pow(z,n));
            if (zn == 0)
                zn = 1e-10;

            add = ( (this.pochLogged(a,n) + this.pochLogged(b,n)) - this.pochLogged(c,n) ) 
                    + (zn - this.factLogged(n));

            add = Math.pow(Math.E, add);

            if (!isFinite(add)) 
                throw `The next value to add is not finite (sum til now: ${sum}, adder: ${add})`

            sum += add;

            if(Math.abs(add) <= this.precision)
                return sum;

        }

        throw `Couldn't get within in ${this.precision} (sum: ${sum}, adder: ${add})`;

    }

    incBeta(x,a,b) {
        return (Math.pow(x,a) / a) * this.execute(a, 1-b, a + 1, x);
    }

    pochLogged(q, n) {
        if (n == 0)
            return 1;
        let prod = Math.log(q);
        for (let i = 1; i < n; i++) 
            prod += Math.log(q + i);
        if (prod == 0) 
            prod = 1e-10;
        return prod;
    }

    factLogged(num) {
        let prod = Math.log(num);
        for (let i = num - 1; i >= 1; i--)
            prod += Math.log(i);
        return prod;
    }


}