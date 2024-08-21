
const rand = require('./random')
const app = require('./module')
const dat = require('./date')
const liniya = require('./liniya')
const end = require('./end')



console.log("\t")
console.log(liniya)
console.log(app)
let i = 1;
while(i<10){
console.log(rand())
 i++
}
console.log(dat())
console.log(liniya)
console.log("\t")
console.log(end())