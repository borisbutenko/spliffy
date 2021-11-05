const fetch = require('node-fetch')
const fs = require('fs')

const expectedFile = fs.readFileSync(__dirname+"/index.html").toString('utf-8')
const expected404 = fs.readFileSync(__dirname+"/404.html").toString('utf-8')
describe( "index.html", () => {
    it( "Should return the right content from get", async () => {
        let res = await fetch( "http://localhost:11420" );
        const body = await res.text()
        expect(res.status).toEqual(200)
        expect(body).toEqual(expectedFile)
    } )
    it("Should not make this test file into a route", async()=>{
        let res = await fetch( `http://localhost:11420/${__filename}` );
        const body = await res.text()
        expect(res.status).toEqual(404)
        expect(body).toBe(expected404)
    })
} )